import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from '@resort-pro/types';

interface Tenant { id: string; name: string; slug: string; plan: string }

interface AuthState {
  user: AuthUser | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: AuthUser, tenant: Tenant, token: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, tenant, token, refreshToken) => {
    await SecureStore.setItemAsync('token', token);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
    await SecureStore.setItemAsync('tenant', JSON.stringify(tenant));
    set({ user, tenant, isAuthenticated: true });
  },

  clearAuth: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync('token'),
      SecureStore.deleteItemAsync('refreshToken'),
      SecureStore.deleteItemAsync('user'),
      SecureStore.deleteItemAsync('tenant'),
    ]);
    set({ user: null, tenant: null, isAuthenticated: false });
  },

  loadAuth: async () => {
    try {
      const [userStr, tenantStr, token] = await Promise.all([
        SecureStore.getItemAsync('user'),
        SecureStore.getItemAsync('tenant'),
        SecureStore.getItemAsync('token'),
      ]);
      if (userStr && tenantStr && token) {
        set({ user: JSON.parse(userStr), tenant: JSON.parse(tenantStr), isAuthenticated: true });
      }
    } catch {}
    set({ isLoading: false });
  },
}));
