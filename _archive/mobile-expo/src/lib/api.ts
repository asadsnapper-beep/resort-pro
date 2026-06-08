import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
          const { token: newToken, refreshToken: newRefresh } = res.data.data;
          await SecureStore.setItemAsync('token', newToken);
          await SecureStore.setItemAsync('refreshToken', newRefresh);
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return api.request(error.config);
        } catch {
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('refreshToken');
        }
      }
    }
    return Promise.reject(error);
  },
);

export const mobileAuthApi = {
  login: (data: { email: string; password: string; slug: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
};

export const mobileDashboardApi = {
  getStats: () => api.get('/dashboard'),
  getRevenue: () => api.get('/dashboard/revenue'),
};

export const mobileBookingsApi = {
  list: (params?: Record<string, unknown>) => api.get('/bookings', { params }),
  checkIn: (id: string) => api.patch(`/bookings/${id}/check-in`),
  checkOut: (id: string) => api.patch(`/bookings/${id}/check-out`),
};

export const mobileNotificationsApi = {
  list: () => api.get('/notifications'),
  readAll: () => api.patch('/notifications/read-all'),
};

export const mobileTicketsApi = {
  list: (params?: Record<string, unknown>) => api.get('/tickets', { params }),
  updateStatus: (id: string, status: string) => api.patch(`/tickets/${id}/status`, { status }),
};

export const mobileHousekeepingApi = {
  list: (params?: Record<string, unknown>) => api.get('/housekeeping', { params }),
  updateStatus: (id: string, status: string) => api.patch(`/housekeeping/${id}/status`, { status }),
};
