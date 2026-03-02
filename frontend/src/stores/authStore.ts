import { writable, derived } from 'svelte/store';
import type { AuthState, UserProfile, TemporaryPermission } from '../types';

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: true,
  error: null,
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,
    setLoading: (loading: boolean) => {
      update((state) => ({ ...state, loading, error: null }));
    },
    login: (user: UserProfile) => {
      set({
        isAuthenticated: true,
        user,
        token: user.token,
        loading: false,
        error: null,
      });
      try {
        localStorage.setItem('auth_user', JSON.stringify(user));
        sessionStorage.setItem('auth_token', user.token);
      } catch {
        // Ignore storage errors
      }
    },
    logout: () => {
      set({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: null,
      });
      try {
        localStorage.removeItem('auth_user');
        sessionStorage.removeItem('auth_token');
      } catch {
        // Ignore storage errors
      }
    },
    setError: (error: string) => {
      update((state) => ({ ...state, error, loading: false }));
    },
    clearError: () => {
      update((state) => ({ ...state, error: null }));
    },
    restoreSession: () => {
      try {
        const savedUser = localStorage.getItem('auth_user');
        const savedToken = sessionStorage.getItem('auth_token');
        if (savedUser && savedToken) {
          const user: UserProfile = JSON.parse(savedUser);
          user.token = savedToken;
          set({
            isAuthenticated: true,
            user,
            token: savedToken,
            loading: false,
            error: null,
          });
          return true;
        }
      } catch {
        // Ignore parse errors
      }
      return false;
    },
    /**
     * Actualiza la información de roles y permisos del usuario.
     */
    updateUserRolesAndPermissions: (roles: string[], permissions: string[], temporaryPermissions: TemporaryPermission[] = []) => {
      update((state) => {
        if (state.user) {
          return {
            ...state,
            user: {
              ...state.user,
              roles,
              permissions,
              temporary_permissions: temporaryPermissions,
            },
          };
        }
        return state;
      });
      // Update local storage
      update((state) => {
        if (state.user) {
          try {
            localStorage.setItem('auth_user', JSON.stringify(state.user));
          } catch {
            // Ignore storage errors
          }
        }
        return state;
      });
    },
    /**
     * Asigna roles al usuario actual.
     */
    setUserRoles: (roles: string[]) => {
      update((state) => {
        if (state.user) {
          return {
            ...state,
            user: {
              ...state.user,
              roles,
            },
          };
        }
        return state;
      });
    },
    /**
     * Asigna permisos al usuario actual.
     */
    setUserPermissions: (permissions: string[]) => {
      update((state) => {
        if (state.user) {
          return {
            ...state,
            user: {
              ...state.user,
              permissions,
            },
          };
        }
        return state;
      });
    },
    /**
     * Agrega un permiso temporal al usuario.
     */
    addTemporaryPermission: (permission: string, expiresAt: string) => {
      update((state) => {
        if (state.user) {
          const temporaryPermissions = state.user.temporary_permissions || [];
          return {
            ...state,
            user: {
              ...state.user,
              temporary_permissions: [
                ...temporaryPermissions,
                {
                  permission,
                  expires_at: expiresAt,
                  granted_at: new Date().toISOString(),
                },
              ],
            },
          };
        }
        return state;
      });
    },
    /**
     * Remueve un permiso temporal del usuario.
     */
    removeTemporaryPermission: (permission: string) => {
      update((state) => {
        if (state.user && state.user.temporary_permissions) {
          return {
            ...state,
            user: {
              ...state.user,
              temporary_permissions: state.user.temporary_permissions.filter(
                (tp) => tp.permission !== permission
              ),
            },
          };
        }
        return state;
      });
    },
  };
}

export const authStore = createAuthStore();

/**
 * Derived store que verifica si el usuario es super admin.
 */
export const isSuperAdmin = derived(authStore, ($authStore) => {
  return $authStore.user?.is_super_admin || false;
});

/**
 * Derived store que verifica si el usuario es admin.
 */
export const isAdmin = derived(authStore, ($authStore) => {
  if (!$authStore.user) return false;
  return $authStore.user.is_super_admin || $authStore.user.is_admin || false;
});

/**
 * Derived store con los roles del usuario.
 */
export const userRoles = derived(authStore, ($authStore) => {
  return $authStore.user?.roles || [];
});

/**
 * Derived store con los permisos del usuario.
 */
export const userPermissions = derived(authStore, ($authStore) => {
  return $authStore.user?.permissions || [];
});

/**
 * Derived store con los permisos temporales del usuario.
 */
export const userTemporaryPermissions = derived(authStore, ($authStore) => {
  return $authStore.user?.temporary_permissions || [];
});
