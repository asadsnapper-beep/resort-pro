import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const adminApi = axios.create({
  baseURL: `${API_URL}/api/admin`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach admin token from localStorage
adminApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
adminApi.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export const adminEndpoints = {
  login: (email: string, password: string) =>
    adminApi.post('/login', { email, password }),
  me: () => adminApi.get('/me'),
  stats: () => adminApi.get('/stats'),
  // Tenants
  tenants: (params?: Record<string, string>) =>
    adminApi.get('/tenants', { params }),
  tenant: (id: string) => adminApi.get(`/tenants/${id}`),
  updateTenant: (id: string, data: Record<string, unknown>) =>
    adminApi.patch(`/tenants/${id}`, data),
  suspendTenant: (id: string) => adminApi.delete(`/tenants/${id}`),
  reactivateTenant: (id: string) => adminApi.patch(`/tenants/${id}`, { isActive: true }),
  impersonate: (id: string) => adminApi.post(`/tenants/${id}/impersonate`),
  exportTenant: (id: string) => adminApi.get(`/tenants/${id}/export`, { responseType: 'blob' }),
  extendTrial: (id: string, days: number) => adminApi.post(`/tenants/${id}/extend-trial`, { days }),
  // Users
  users: (params?: Record<string, string>) =>
    adminApi.get('/users', { params }),
  // Billing
  billing: () => adminApi.get('/billing'),
  // Platform settings
  getSettings: () => adminApi.get('/settings'),
  updateSettings: (data: { trialDays?: number; plans?: unknown[] }) => adminApi.put('/settings', data),
  // Themes
  getThemes: () => adminApi.get('/themes'),
  updateTheme: (key: string, data: {
    name: string; description?: string; previewImage?: string;
    isActive?: boolean; isPremium?: boolean; sortOrder?: number;
  }) => adminApi.put(`/themes/${key}`, data),
  toggleTheme: (key: string) => adminApi.patch(`/themes/${key}/toggle`),
};
