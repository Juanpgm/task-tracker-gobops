import { signInWithEmailAndPassword, signOut, onAuthStateChanged, getIdToken } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { apiClient, projectApiClient } from '../lib/api-client';
import { authStore } from '../stores/authStore';
import type { 
  UserProfile, 
  ValidateSessionResponse, 
  RegisterUserPayload,
  ChangePasswordPayload,
  GoogleAuthPayload 
} from '../types';

/**
 * Inicia sesión con email y contraseña usando Firebase,
 * luego valida la sesión contra el backend.
 */
export async function login(email: string, password: string): Promise<void> {
  authStore.setLoading(true);
  try {
    if (!auth) {
      throw new Error('Firebase no está inicializado. Verifique la configuración.');
    }
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await getIdToken(userCredential.user);

    // Validate session against backend
    apiClient.setToken(idToken);
    projectApiClient.setToken(idToken);
    const backendUser = await apiClient.post<ValidateSessionResponse>('/auth/validate-session', {});

    const user: UserProfile = {
      uid: userCredential.user.uid,
      email: userCredential.user.email || email,
      displayName: backendUser.displayName || userCredential.user.displayName || '',
      role: backendUser.role || '',
      token: idToken,
      ...backendUser,
    };

    authStore.login(user);
  } catch (error: unknown) {
    let message = 'Error al iniciar sesión';
    if (error instanceof Error) {
      if (error.message.includes('auth/user-not-found') || error.message.includes('auth/wrong-password')) {
        message = 'Correo electrónico o contraseña incorrectos';
      } else if (error.message.includes('auth/too-many-requests')) {
        message = 'Demasiados intentos. Intente de nuevo más tarde.';
      } else if (error.message.includes('auth/invalid-credential')) {
        message = 'Credenciales inválidas. Verifique su correo y contraseña.';
      } else {
        message = error.message;
      }
    }
    authStore.setError(message);
    throw error;
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
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: backendUser.displayName || firebaseUser.displayName || '',
          role: backendUser.role || '',
          token: idToken,
          ...backendUser,
        };

        authStore.login(user);
      } catch {
        // Token refresh or validation failed, try restoring from local
        if (!authStore.restoreSession()) {
          authStore.logout();
        }
      }
    } else {
      // No Firebase user, check local storage
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
    // Register endpoint is public - don't send auth token
    const response = await fetch(`${import.meta.env.VITE_AUTH_API_URL || 'https://web-production-79739.up.railway.app'}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Registration failed (${response.status}): ${errorBody}`);
    }

    return response.json();
  } catch (error: unknown) {
    let message = 'Error al registrar usuario';
    if (error instanceof Error) {
      if (error.message.includes('already exists') || error.message.includes('ya existe')) {
        message = 'Este correo electrónico ya está registrado.';
      } else if (error.message.includes('weak-password')) {
        message = 'La contraseña es muy débil. Debe tener al menos 6 caracteres.';
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
    const response = await apiClient.postUrlEncoded<ValidateSessionResponse>('/auth/google', data);
    
    // Create user profile from response
    const user: UserProfile = {
      uid: response.uid,
      email: response.email || '',
      displayName: response.displayName || '',
      role: response.role || '',
      token: googleToken,
      ...response,
    };

    authStore.login(user);
  } catch (error: unknown) {
    let message = 'Error al autenticar con Google';
    if (error instanceof Error) {
      message = error.message;
    }
    authStore.setError(message);
    throw error;
  }
}
