import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@resort-pro/types';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planStatus?: string;
  trialEndsAt?: string | null;
  isActive?: boolean;
  isDemo?: boolean;
  currency?: string;
  taxRate?: number;
  onboardingStep?: number;
  onboardingCompletedAt?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  tenant: Tenant | null;
  token: string | null;
  setAuth: (user: AuthUser, tenant: Tenant, token: string, refreshToken?: string) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      token: null,
      setAuth: (user, tenant, token) => {
        localStorage.setItem('token', token);
        set({ user, tenant, token });
      },
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
      clearAuth: () => {
        localStorage.removeItem('token');
        set({ user: null, tenant: null, token: null });
      },
      isAuthenticated: () => !!get().token && !!get().user,
    }),
    {
      name: 'resort-pro-auth',
      partialize: (state) => ({ user: state.user, tenant: state.tenant, token: state.token }),
    },
  ),
);
