import { create } from 'zustand';

type AdminUser = { id?: string; email: string; firstName?: string; lastName?: string };

type AdminStore = {
  admin: AdminUser | null;
  token: string | null;
  setAdmin: (admin: AdminUser, token: string) => void;
  clearAdmin: () => void;
  isAdminAuthenticated: () => boolean;
};

export const useAdminStore = create<AdminStore>((set, get) => ({
  admin: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null,

  setAdmin: (admin, token) => {
    if (typeof window !== 'undefined') localStorage.setItem('admin_token', token);
    set({ admin, token });
  },

  clearAdmin: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('admin_token');
    set({ admin: null, token: null });
  },

  isAdminAuthenticated: () => {
    const token = get().token || (typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null);
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.isSuperAdmin === true && payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  },
}));
