import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@resort-pro/types';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface AuthState {
  user: AuthUser | null;
  tenant: Tenant | null;
  token: string | null;
  refreshToken: string | null;
  setAuth: (user: AuthUser, tenant: Tenant, token: string, refreshToken: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      token: null,
      refreshToken: null,
      setAuth: (user, tenant, token, refreshToken) => {
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);
        set({ user, tenant, token, refreshToken });
      },
      clearAuth: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        set({ user: null, tenant: null, token: null, refreshToken: null });
      },
      isAuthenticated: () => !!get().token && !!get().user,
    }),
    {
      name: 'resort-pro-auth',
      partialize: (state) => ({ user: state.user, tenant: state.tenant, token: state.token, refreshToken: state.refreshToken }),
    },
  ),
);
