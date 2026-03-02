import { signInWithEmailAndPassword, signOut, onAuthStateChanged, getIdToken } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { apiClient, projectApiClient } from '../lib/api-client';
import { authStore } from '../stores/authStore';
import type {
  UserProfile,
  ValidateSessionResponse,
  LoginResponse,
  RegisterUserPayload,
  ChangePasswordPayload,
} from '../types';

/**
 * Inicia sesión con email y contraseña usando Firebase,
 * luego valida la sesión contra el backend enviando el ID token al endpoint /auth/login.
 * Implementa la lógica completa de "Administración y Control de Accesos" de la API.
 */
export async function login(email: string, password: string): Promise<void> {
  authStore.setLoading(true);
  try {
    if (!auth) {
      throw new Error('Firebase no está inicializado. Verifique la configuración.');
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await getIdToken(userCredential.user, true);

    apiClient.setToken(idToken);
    projectApiClient.setToken(idToken);

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
  } catch (error: unknown) {
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
      authStore.setLoading(false);
    }
    return () => {};
  }

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const idToken = await getIdToken(firebaseUser, true);
        apiClient.setToken(idToken);
        projectApiClient.setToken(idToken);

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
        if (!authStore.restoreSession()) {
          authStore.logout();
        }
      }
    } else {
      if (!authStore.restoreSession()) {
        authStore.setLoading(false);
      }
    }
  });
}

/**
 * Registra un nuevo usuario en el sistema.
 */
export async function registerUser(payload: RegisterUserPayload): Promise<string> {
  try {
    const response = await apiClient.post<Record<string, unknown>>('/auth/register', payload as unknown as Record<string, unknown>);
    if (typeof response?.message === 'string') {
      return response.message;
    }
    return 'Usuario registrado exitosamente';
  } catch (error: unknown) {
    let message = 'Error al registrar usuario';
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        message = 'No se pudo conectar con el servidor de autenticación. Verifique CORS/URL del API en producción.';
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
