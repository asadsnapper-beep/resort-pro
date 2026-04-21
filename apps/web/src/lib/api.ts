import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
          const { token, refreshToken: newRefresh } = res.data.data;
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', newRefresh);
          error.config.headers.Authorization = `Bearer ${token}`;
          return api.request(error.config);
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { resortName: string; slug: string; firstName: string; lastName: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string; slug: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get('/dashboard'),
  getRevenue: () => api.get('/dashboard/revenue'),
  getOccupancy: () => api.get('/dashboard/occupancy'),
};

// ── Rooms ─────────────────────────────────────────────────────────────────────
export const roomsApi = {
  list: (params?: Record<string, unknown>) => api.get('/rooms', { params }),
  get: (id: string) => api.get(`/rooms/${id}`),
  create: (data: unknown) => api.post('/rooms', data),
  update: (id: string, data: unknown) => api.patch(`/rooms/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/rooms/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/rooms/${id}`),
  availability: (checkIn: string, checkOut: string) =>
    api.get('/rooms/availability', { params: { checkIn, checkOut } }),
};

// ── Bookings ──────────────────────────────────────────────────────────────────
export const bookingsApi = {
  list: (params?: Record<string, unknown>) => api.get('/bookings', { params }),
  get: (id: string) => api.get(`/bookings/${id}`),
  create: (data: unknown) => api.post('/bookings', data),
  checkIn: (id: string) => api.patch(`/bookings/${id}/check-in`),
  checkOut: (id: string) => api.patch(`/bookings/${id}/check-out`),
  cancel: (id: string) => api.patch(`/bookings/${id}/cancel`),
  addPayment: (id: string, data: unknown) => api.post(`/bookings/${id}/payment`, data),
  calendar: (month: number, year: number) => api.get('/bookings/calendar', { params: { month, year } }),
};

// ── Guests ────────────────────────────────────────────────────────────────────
export const guestsApi = {
  list: (params?: Record<string, unknown>) => api.get('/guests', { params }),
  get: (id: string) => api.get(`/guests/${id}`),
  create: (data: unknown) => api.post('/guests', data),
  update: (id: string, data: unknown) => api.patch(`/guests/${id}`, data),
  delete: (id: string) => api.delete(`/guests/${id}`),
};

// ── Staff ─────────────────────────────────────────────────────────────────────
export const staffApi = {
  list: (params?: Record<string, unknown>) => api.get('/staff', { params }),
  create: (data: unknown) => api.post('/staff', data),
  update: (id: string, data: unknown) => api.patch(`/staff/${id}`, data),
  delete: (id: string) => api.delete(`/staff/${id}`),
};

// ── Housekeeping ──────────────────────────────────────────────────────────────
export const housekeepingApi = {
  list: (params?: Record<string, unknown>) => api.get('/housekeeping', { params }),
  create: (data: unknown) => api.post('/housekeeping', data),
  updateStatus: (id: string, status: string) => api.patch(`/housekeeping/${id}/status`, { status }),
  assign: (id: string, staffId: string) => api.patch(`/housekeeping/${id}/assign`, { staffId }),
};

// ── Menu ──────────────────────────────────────────────────────────────────────
export const menuApi = {
  list: (params?: Record<string, unknown>) => api.get('/menu', { params }),
  create: (data: unknown) => api.post('/menu', data),
  update: (id: string, data: unknown) => api.patch(`/menu/${id}`, data),
  delete: (id: string) => api.delete(`/menu/${id}`),
};

// ── Food Orders ───────────────────────────────────────────────────────────────
export const foodOrdersApi = {
  list: (params?: Record<string, unknown>) => api.get('/food-orders', { params }),
  create: (data: unknown) => api.post('/food-orders', data),
  updateStatus: (id: string, status: string) => api.patch(`/food-orders/${id}/status`, { status }),
};

// ── Inventory ─────────────────────────────────────────────────────────────────
export const inventoryApi = {
  list: (params?: Record<string, unknown>) => api.get('/inventory', { params }),
  create: (data: unknown) => api.post('/inventory', data),
  update: (id: string, data: unknown) => api.patch(`/inventory/${id}`, data),
  addMovement: (id: string, data: unknown) => api.post(`/inventory/${id}/movement`, data),
};

// ── Tickets ───────────────────────────────────────────────────────────────────
export const ticketsApi = {
  list: (params?: Record<string, unknown>) => api.get('/tickets', { params }),
  get: (id: string) => api.get(`/tickets/${id}`),
  create: (data: unknown) => api.post('/tickets', data),
  updateStatus: (id: string, status: string) => api.patch(`/tickets/${id}/status`, { status }),
  assign: (id: string, userId: string) => api.patch(`/tickets/${id}/assign`, { userId }),
  addMessage: (id: string, message: string) => api.post(`/tickets/${id}/messages`, { message }),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => api.get('/notifications'),
  readAll: () => api.patch('/notifications/read-all'),
  read: (id: string) => api.patch(`/notifications/${id}/read`),
};

// ── Website ───────────────────────────────────────────────────────────────────
export const websiteApi = {
  get: () => api.get('/website'),
  update: (data: unknown) => api.put('/website', data),
};

// ── Tenant ────────────────────────────────────────────────────────────────────
export const tenantApi = {
  get: () => api.get('/tenant'),
  update: (data: unknown) => api.patch('/tenant', data),
};
