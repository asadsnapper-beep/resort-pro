import { create } from 'zustand';

export type AdminRole = 'SUPER_ADMIN' | 'SUPPORT' | 'FINANCE' | 'VIEWER';

type AdminUser = {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: AdminRole;
};

type AdminStore = {
  admin: AdminUser | null;
  token: string | null;
  adminRole: AdminRole | null;
  setAdmin: (admin: AdminUser, token: string) => void;
  clearAdmin: () => void;
  isAdminAuthenticated: () => boolean;
  /** Check if the current admin has at least one of the given roles */
  hasRole: (roles: AdminRole[]) => boolean;
};

function decodeAdminToken(token: string): { adminRole?: AdminRole; isSuperAdmin?: boolean; exp?: number } | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  admin: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null,
  adminRole: (() => {
    if (typeof window === 'undefined') return null;
    const t = localStorage.getItem('admin_token');
    if (!t) return null;
    const p = decodeAdminToken(t);
    return (p?.adminRole ?? (p?.isSuperAdmin ? 'SUPER_ADMIN' : null)) as AdminRole | null;
  })(),

  setAdmin: (admin, token) => {
    if (typeof window !== 'undefined') localStorage.setItem('admin_token', token);
    const payload = decodeAdminToken(token);
    const adminRole = (payload?.adminRole ?? (payload?.isSuperAdmin ? 'SUPER_ADMIN' : null)) as AdminRole | null;
    set({ admin: { ...admin, role: adminRole ?? undefined }, token, adminRole });
  },

  clearAdmin: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('admin_token');
    set({ admin: null, token: null, adminRole: null });
  },

  isAdminAuthenticated: () => {
    const token = get().token || (typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null);
    if (!token) return false;
    const payload = decodeAdminToken(token);
    if (!payload || !payload.exp) return false;
    if (payload.exp * 1000 <= Date.now()) return false;
    // Accept both old (isSuperAdmin) and new (adminRole) tokens during migration
    return !!(payload.adminRole || payload.isSuperAdmin);
  },

  hasRole: (roles: AdminRole[]) => {
    const role = get().adminRole;
    if (!role) return false;
    return roles.includes(role);
  },
}));
