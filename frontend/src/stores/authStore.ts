import { writable } from 'svelte/store';
import type { AuthState, UserProfile } from '../types';

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
  };
}

export const authStore = createAuthStore();
