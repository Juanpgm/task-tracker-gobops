import { signInWithEmailAndPassword, signOut, onAuthStateChanged, onIdTokenChanged, getIdToken } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { apiClient, projectApiClient, uploadApiClient, type RefreshResult } from '../lib/api-client';
import { authStore } from '../stores/authStore';
import type {
  UserProfile,
  ValidateSessionResponse,
  LoginResponse,
  RegisterUserPayload,
  ChangePasswordPayload,
} from '../types';

// Flag to prevent onAuthStateChanged from conflicting with an active login() call
let loginInProgress = false;

/**
 * Error Classification Table (Firebase code -> RefreshResult status), per
 * design.md. A code NOT in either list (or an error with no `.code` at all)
 * falls through to 'transient' as a fail-safe: an SDK code we don't
 * recognize yet should never be the reason a user gets kicked to login.
 */
const TRANSIENT_CODES = new Set([
  'auth/network-request-failed',
  'auth/timeout',
  'auth/internal-error',
  'auth/too-many-requests',
]);

const SESSION_INVALID_CODES = new Set([
  'auth/user-token-expired',
  'auth/token-expired',
  'auth/invalid-user-token',
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/requires-recent-login',
]);

function classifyRefreshError(err: unknown): 'transient' | 'session-invalid' {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && SESSION_INVALID_CODES.has(code)) return 'session-invalid';
  // Recognized transient codes AND anything unrecognized (no code, or a
  // code we don't have an entry for) both fail safe to 'transient'.
  return 'transient';
}

/**
 * Single-flight promise shared by all 3 HTTP clients: a burst of concurrent
 * 401s (one per client, or several requests on the same client) must
 * trigger exactly one `getIdToken(user, true)` call, not one per caller.
 * Cleared in `finally` — NOT cached beyond the in-flight call, so a later
 * caller (after this one settles) always gets a fresh attempt instead of a
 * stale transient failure replayed forever.
 */
let refreshInFlight: Promise<RefreshResult> | null = null;

/**
 * Refresca el ID token de Firebase y lo sincroniza en los tres clientes HTTP.
 * Se registra en cada ApiClient como su `onUnauthorized` handler: la PWA
 * queda abierta horas en el campo, así que el token (válido ~1h) expira a
 * mitad de sesión con frecuencia — sin este refresh reactivo, la primera
 * petición fresca tras la expiración (p. ej. "Crear PDF", a diferencia de
 * una vista con datos ya cacheados) fallaba con 401 aunque el usuario
 * siguiera logueado.
 *
 * Devuelve un `RefreshResult` discriminado en vez de `string | null`: un
 * fallo de refresh por causa de RED (Firebase `auth/network-request-failed`
 * y códigos afines) NUNCA debe desloguear al usuario — antes se colapsaba
 * junto con una sesión genuinamente muerta en el mismo `null`, forzando un
 * logout indebido ante cualquier hipo de conectividad en campo. Sólo una
 * sesión realmente inválida/revocada (o `auth.currentUser === null`, que
 * significa que la sesión real de Firebase ya no existe — ITP de iOS purgó
 * su IndexedDB, `signOut` en otra pestaña, storage borrado) fuerza logout.
 */
async function refrescarTokenYSincronizar(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async (): Promise<RefreshResult> => {
    if (!auth || !auth.currentUser) {
      authStore.logout();
      return { status: 'session-invalid' };
    }
    try {
      const idToken = await getIdToken(auth.currentUser, true);
      apiClient.setToken(idToken);
      projectApiClient.setToken(idToken);
      uploadApiClient.setToken(idToken);
      return { status: 'refreshed', token: idToken };
    } catch (err) {
      const classification = classifyRefreshError(err);
      if (classification === 'session-invalid') {
        authStore.logout();
        return { status: 'session-invalid' };
      }
      return { status: 'transient' };
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

apiClient.setUnauthorizedHandler(refrescarTokenYSincronizar);
projectApiClient.setUnauthorizedHandler(refrescarTokenYSincronizar);
uploadApiClient.setUnauthorizedHandler(refrescarTokenYSincronizar);

/**
 * Inicia sesión con email y contraseña usando Firebase,
 * luego valida la sesión contra el backend enviando el ID token al endpoint /auth/login.
 * Implementa la lógica completa de "Administración y Control de Accesos" de la API.
 */
export async function login(email: string, password: string): Promise<void> {
  authStore.setLoading(true);
  loginInProgress = true;
  try {
    if (!auth) {
      throw new Error('Firebase no está inicializado. Verifique la configuración.');
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await getIdToken(userCredential.user, true);

    apiClient.setToken(idToken);
    projectApiClient.setToken(idToken);
    uploadApiClient.setToken(idToken);

    const loginPayload: Record<string, unknown> = { id_token: idToken };
    const backendUser = await apiClient.post<LoginResponse>('/auth/login', loginPayload);

    const user: UserProfile = {
      uid: backendUser.uid || userCredential.user.uid,
      email: backendUser.email || userCredential.user.email || email,
      displayName: backendUser.displayName || backendUser.full_name || userCredential.user.displayName || '',
      full_name: backendUser.full_name || backendUser.displayName || '',
      role: backendUser.role || '',
      roles: Array.isArray(backendUser.roles) ? backendUser.roles : [],
      permissions: Array.isArray(backendUser.permissions) ? backendUser.permissions : [],
      temporary_permissions: Array.isArray(backendUser.temporary_permissions) ? backendUser.temporary_permissions : [],
      cellphone: backendUser.cellphone || '',
      nombre_centro_gestor: backendUser.nombre_centro_gestor || '',
      is_super_admin: backendUser.is_super_admin === true,
      is_admin: backendUser.is_admin === true,
      token: idToken,
    };

    authStore.login(user);
    authStore.setLoading(false);
    loginInProgress = false;
  } catch (error: unknown) {
    loginInProgress = false;
    let message = 'Error al iniciar sesión';
    if (error instanceof Error) {
      if (error.message.includes('auth/user-not-found')) {
        message = 'No existe una cuenta con este correo electrónico.';
      } else if (error.message.includes('auth/wrong-password')) {
        message = 'Contraseña incorrecta.';
      } else if (error.message.includes('auth/invalid-credential')) {
        message = 'Credenciales inválidas. Verifique su correo y contraseña.';
      } else if (error.message.includes('auth/invalid-email')) {
        message = 'Formato de correo electrónico inválido.';
      } else if (error.message.includes('auth/user-disabled')) {
        message = 'Esta cuenta ha sido deshabilitada. Contacte al administrador.';
      } else if (error.message.includes('auth/too-many-requests')) {
        message = 'Demasiados intentos fallidos. Intente de nuevo más tarde.';
      } else if (error.message.includes('auth/network-request-failed')) {
        message = 'Error de conexión. Verifique su conexión a internet.';
      } else if (error.message.includes('401')) {
        message = 'No autorizado. Token de autenticación inválido o expirado.';
      } else if (error.message.includes('403')) {
        message = 'Acceso denegado. No tiene permisos para acceder al sistema.';
      } else if (error.message.includes('404')) {
        message = 'Usuario no encontrado en el sistema.';
      } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
        message = 'Error en el servidor. Intente de nuevo más tarde.';
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        message = 'No se pudo conectar con el servidor de autenticación.';
      } else {
        message = error.message;
      }
    }

    authStore.setError(message);
    authStore.setLoading(false);
    throw new Error(message);
  }
}

/**
 * Cierra la sesión del usuario.
 */
export async function logout(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // Continue with local logout even if Firebase logout fails
  }

  apiClient.setToken(null);
  projectApiClient.setToken(null);
  uploadApiClient.setToken(null);
  authStore.logout();
}

/**
 * Monitorea cambios en el estado de autenticación de Firebase.
 * Valida la sesión y verifica los permisos y roles del usuario.
 * Retorna un unsubscribe function.
 */
export function initAuthListener(): () => void {
  if (!auth) {
    console.warn('Firebase auth not initialized. Falling back to local session.');
    if (!authStore.restoreSession()) {
      // iOS ITP fallback: try IndexedDB before giving up
      authStore.restoreSessionFromIdb().then((ok) => {
        if (!ok) authStore.setLoading(false);
      });
    }
    return () => {};
  }

  // Proactive refresh: the Firebase SDK refreshes the underlying ID token
  // before it expires on its own schedule; this listener just picks that
  // fresh token up and syncs it, shrinking the window during which a
  // request can 401 due to plain expiry. Deliberately lightweight — it
  // does NOT call /auth/validate-session or rebuild the profile (that's
  // onAuthStateChanged's job on sign-in/out), or it would hammer the
  // backend on every hourly token rotation. Guarded by `loginInProgress`
  // for the same reason onAuthStateChanged is: don't race an active login().
  onIdTokenChanged(auth, async (firebaseUser) => {
    if (loginInProgress || !firebaseUser) return;
    try {
      const idToken = await getIdToken(firebaseUser);
      apiClient.setToken(idToken);
      projectApiClient.setToken(idToken);
      uploadApiClient.setToken(idToken);
      authStore.updateToken(idToken);
    } catch (err) {
      // Best-effort: a failure here just means the proactive refresh didn't
      // land; the reactive 401 path (refrescarTokenYSincronizar) still
      // covers it, so this is not worth surfacing to the user.
      console.warn('onIdTokenChanged proactive refresh failed:', err);
    }
  });

  return onAuthStateChanged(auth, async (firebaseUser) => {
    // Skip if login() is already handling authentication
    if (loginInProgress) {
      return;
    }

    if (firebaseUser) {
      try {
        const idToken = await getIdToken(firebaseUser, true);
        apiClient.setToken(idToken);
        projectApiClient.setToken(idToken);
        uploadApiClient.setToken(idToken);

        const backendUser = await apiClient.post<ValidateSessionResponse>('/auth/validate-session', {});

        const user: UserProfile = {
          uid: backendUser.uid || firebaseUser.uid,
          email: backendUser.email || firebaseUser.email || '',
          displayName: backendUser.displayName || backendUser.full_name || firebaseUser.displayName || '',
          full_name: backendUser.full_name || backendUser.displayName || '',
          role: backendUser.role || '',
          roles: Array.isArray(backendUser.roles) ? backendUser.roles : [],
          permissions: Array.isArray(backendUser.permissions) ? backendUser.permissions : [],
          temporary_permissions: Array.isArray(backendUser.temporary_permissions) ? backendUser.temporary_permissions : [],
          cellphone: backendUser.cellphone || '',
          nombre_centro_gestor: backendUser.nombre_centro_gestor || '',
          is_super_admin: backendUser.is_super_admin === true,
          is_admin: backendUser.is_admin === true,
          token: idToken,
        };

        authStore.login(user);
      } catch (error) {
        console.error('Session validation failed:', error);
        apiClient.setToken(null);
        projectApiClient.setToken(null);
        uploadApiClient.setToken(null);
        if (!authStore.restoreSession()) {
          const ok = await authStore.restoreSessionFromIdb();
          if (!ok) authStore.logout();
        }
      }
    } else {
      if (!authStore.restoreSession()) {
        const ok = await authStore.restoreSessionFromIdb();
        if (!ok) authStore.logout();
      }
    }
  });
}

/**
 * Registra un nuevo usuario en el sistema.
 * Usa fetch directo sin auth (endpoint público) para evitar interferencia
 * con tokens de sesión previos en apiClient.
 */
export async function registerUser(payload: RegisterUserPayload): Promise<string> {
  const baseUrl = import.meta.env.VITE_AUTH_API_URL || '/api/auth';
  const url = `${baseUrl}/auth/register`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`POST /auth/register failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    if (typeof data?.message === 'string') {
      return data.message;
    }
    return 'Usuario registrado exitosamente';
  } catch (error: unknown) {
    let message = 'Error al registrar usuario';
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        message = 'No se pudo conectar con el servidor de autenticación. Verifique su conexión a internet.';
      } else if (error.message.includes('already exists') || error.message.includes('ya existe') || error.message.includes('EMAIL_EXISTS')) {
        message = 'Este correo electrónico ya está registrado.';
      } else if (error.message.includes('weak-password') || error.message.includes('WEAK_PASSWORD')) {
        message = 'La contraseña es muy débil. Debe tener al menos 8 caracteres.';
      } else {
        message = error.message;
      }
    }
    throw new Error(message);
  }
}

/**
 * Cambia la contraseña de un usuario existente.
 */
export async function changePassword(payload: ChangePasswordPayload): Promise<string> {
  const data: Record<string, string> = {
    uid: payload.uid,
    new_password: payload.new_password,
  };
  return apiClient.postUrlEncoded<string>('/auth/change-password', data);
}

/**
 * Obtiene el estado de Workload Identity Federation.
 */
export async function getWorkloadIdentityStatus(): Promise<string> {
  return apiClient.get<string>('/auth/workload-identity/status');
}

/**
 * Autenticación con Google Sign-In.
 */
export async function googleAuth(googleToken: string): Promise<void> {
  authStore.setLoading(true);
  try {
    const data: Record<string, string> = { google_token: googleToken };
    const response = await apiClient.postUrlEncoded<LoginResponse>('/auth/google', data);

    const user: UserProfile = {
      ...response,
      uid: response.uid,
      email: response.email || '',
      displayName: response.displayName || response.full_name || '',
      full_name: response.full_name || response.displayName || '',
      role: response.role || '',
      roles: response.roles || [],
      permissions: response.permissions || [],
      temporary_permissions: response.temporary_permissions || [],
      cellphone: response.cellphone || '',
      nombre_centro_gestor: response.nombre_centro_gestor || '',
      is_super_admin: response.is_super_admin || false,
      is_admin: response.is_admin || false,
      token: googleToken,
    };

    authStore.login(user);
  } catch (error: unknown) {
    let message = 'Error al autenticar con Google';
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        message = 'No se pudo conectar con el servidor de autenticación.';
      } else {
        message = error.message;
      }
    }
    authStore.setError(message);
    throw new Error(message);
  }
}

/**
 * Obtiene los roles disponibles en el sistema.
 * Requiere ser super_admin o admin_general.
 */
export async function listRoles(): Promise<any[]> {
  return apiClient.get<any[]>('/auth/admin/roles');
}

/**
 * Obtiene los detalles de un rol específico.
 */
export async function getRoleDetails(roleId: string): Promise<any> {
  return apiClient.get<any>(`/auth/admin/roles/${roleId}`);
}

/**
 * Lista todos los usuarios del sistema.
 * Requiere permisos de administrador.
 */
export async function listUsers(limit: number = 100, offset: number = 0): Promise<any[]> {
  return apiClient.get<any[]>(`/auth/admin/users?limit=${limit}&offset=${offset}`);
}

/**
 * Lista todos los super admins del sistema.
 */
export async function listSuperAdmins(limit: number = 100, offset: number = 0): Promise<any[]> {
  return apiClient.get<any[]>(`/auth/admin/users/super-admins?limit=${limit}&offset=${offset}`);
}

/**
 * Obtiene los detalles de un usuario específico.
 */
export async function getUserDetails(uid: string): Promise<UserProfile> {
  return apiClient.get<UserProfile>(`/auth/admin/users/${uid}`);
}

/**
 * Actualiza la información de un usuario.
 */
export async function updateUserInfo(uid: string, userData: Partial<UserProfile>): Promise<UserProfile> {
  return apiClient.put<UserProfile>(`/auth/admin/users/${uid}`, userData);
}

/**
 * Asigna roles a un usuario.
 */
export async function assignRolesToUser(uid: string, roles: string[]): Promise<any> {
  return apiClient.post<any>(`/auth/admin/users/${uid}/roles`, { roles });
}

/**
 * Otorga un permiso temporal a un usuario.
 */
export async function grantTemporaryPermission(uid: string, permission: string, expiresAt: string): Promise<any> {
  return apiClient.post<any>(`/auth/admin/users/${uid}/temporary-permissions`, {
    permission,
    expires_at: expiresAt,
  });
}

/**
 * Revoca un permiso temporal de un usuario.
 */
export async function revokeTemporaryPermission(uid: string, permission: string): Promise<any> {
  return apiClient.delete<any>(`/auth/admin/users/${uid}/temporary-permissions/${permission}`);
}

/**
 * Obtiene los logs de auditoría.
 * Requiere permisos de admin_general o super_admin.
 */
export async function getAuditLogs(limit: number = 100, userUid?: string, action?: string): Promise<any[]> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (userUid) params.append('user_uid', userUid);
  if (action) params.append('action', action);
  return apiClient.get<any[]>(`/auth/admin/audit-logs?${params}`);
}

/**
 * Obtiene estadísticas del sistema de autorización.
 * Requiere ser super_admin.
 */
export async function getSystemStats(): Promise<any> {
  return apiClient.get<any>('/auth/admin/system/stats');
}

/**
 * Obtiene la configuración de Firebase para el frontend.
 */
export async function getFirebaseConfig(): Promise<any> {
  return apiClient.get<any>('/auth/config');
}

/**
 * Verifica si el usuario actual tiene un permiso específico.
 */
export function hasPermission(user: UserProfile | null, permission: string): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;

  if (user.permissions?.includes(permission)) return true;

  if (user.temporary_permissions) {
    const now = new Date();
    const activeTemporaryPermission = user.temporary_permissions.find(tp => {
      return tp.permission === permission && new Date(tp.expires_at) > now;
    });
    if (activeTemporaryPermission) return true;
  }

  return false;
}

/**
 * Verifica si el usuario actual tiene un rol específico.
 */
export function hasRole(user: UserProfile | null, role: string): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return user.roles?.includes(role) || user.role === role;
}

/**
 * Verifica si el usuario es admin (super_admin o admin).
 */
export function isAdmin(user: UserProfile | null): boolean {
  if (!user) return false;
  return user.is_super_admin || user.is_admin || user.role === 'super_admin' || user.role === 'admin';
}
