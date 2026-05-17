import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

function getAuthState() {
  try {
    const raw = localStorage.getItem('resort-pro-auth');
    return raw ? JSON.parse(raw)?.state : null;
  } catch { return null; }
}

function setAuthTokens(token: string, refreshToken: string) {
  try {
    const raw = localStorage.getItem('resort-pro-auth');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    stored.state.token = token;
    stored.state.refreshToken = refreshToken;
    localStorage.setItem('resort-pro-auth', JSON.stringify(stored));
  } catch { /* ignore */ }
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getAuthState()?.token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const refreshToken = getAuthState()?.refreshToken;
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
          const { token, refreshToken: newRefresh } = res.data.data;
          setAuthTokens(token, newRefresh);
          error.config.headers.Authorization = `Bearer ${token}`;
          return api.request(error.config);
        } catch {
          localStorage.removeItem('resort-pro-auth');
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { resortName: string; slug: string; firstName: string; lastName: string; email: string; password: string; referralCode?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string; slug: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string | null; avatarUrl?: string | null }) =>
    api.patch('/auth/me', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get('/dashboard'),
  getRevenue: () => api.get('/dashboard/revenue'),
  getOccupancy: () => api.get('/dashboard/occupancy'),
  getAnalytics: () => api.get('/dashboard/analytics'),
  getToday: () => api.get('/dashboard/today'),
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
  gantt: (from: string, to: string) => api.get('/bookings/gantt', { params: { from, to } }),
  getInvoice: (id: string) => api.get(`/bookings/${id}/invoice`),
  addInvoiceExtra: (id: string, data: { description: string; amount: number; quantity?: number }) =>
    api.post(`/bookings/${id}/invoice/extras`, data),
  deleteInvoiceExtra: (id: string, extraId: string) =>
    api.delete(`/bookings/${id}/invoice/extras/${extraId}`),
  sendInvoiceEmail: (id: string) => api.post(`/bookings/${id}/invoice/send-email`),
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
  getEmailSettings: () => api.get('/tenant/email-settings'),
  updateEmailSettings: (data: unknown) => api.patch('/tenant/email-settings', data),
  sendTestEmail: (toEmail: string) => api.post('/tenant/email-settings/test', { toEmail }),
  // Custom domain
  setDomain: (domain: string | null) => api.put('/tenant/domain', { domain }),
  verifyDomain: () => api.post('/tenant/domain/verify', {}),
};


// ── Maintenance ───────────────────────────────────────────────────────────────
export const maintenanceApi = {
  list: (params?: Record<string, unknown>) => api.get('/maintenance', { params }),
  summary: () => api.get('/maintenance/summary'),
  create: (data: unknown) => api.post('/maintenance', data),
  update: (id: string, data: unknown) => api.patch(`/maintenance/${id}`, data),
  resolve: (id: string, notes?: string) => api.patch(`/maintenance/${id}/resolve`, { notes }),
  delete: (id: string) => api.delete(`/maintenance/${id}`),
};

// ── Rate Plans ────────────────────────────────────────────────────────────────
export const ratePlansApi = {
  list: () => api.get('/rate-plans'),
  create: (data: unknown) => api.post('/rate-plans', data),
  update: (id: string, data: unknown) => api.patch(`/rate-plans/${id}`, data),
  delete: (id: string) => api.delete(`/rate-plans/${id}`),
  resolve: (roomId: string, checkIn: string, checkOut: string) =>
    api.get('/rate-plans/resolve', { params: { roomId, checkIn, checkOut } }),
};

// ── Loyalty ───────────────────────────────────────────────────────────────────
export const loyaltyApi = {
  getProgram: () => api.get('/loyalty/program'),
  updateProgram: (data: unknown) => api.patch('/loyalty/program', data),
  getAccounts: (params?: Record<string, unknown>) => api.get('/loyalty/accounts', { params }),
  getAccount: (guestId: string) => api.get(`/loyalty/accounts/${guestId}`),
  enroll: (guestId: string) => api.post(`/loyalty/accounts/${guestId}/enroll`),
  award: (guestId: string, data: { points: number; description: string; bookingId?: string }) =>
    api.post(`/loyalty/accounts/${guestId}/award`, data),
  redeem: (guestId: string, data: { points: number; description: string; bookingId?: string }) =>
    api.post(`/loyalty/accounts/${guestId}/redeem`, data),
  adjust: (guestId: string, data: { points: number; description: string }) =>
    api.post(`/loyalty/accounts/${guestId}/adjust`, data),
  leaderboard: () => api.get('/loyalty/leaderboard'),
};

// ── Group Bookings ────────────────────────────────────────────────────────────
export const groupBookingsApi = {
  list: (params?: Record<string, unknown>) => api.get('/group-bookings', { params }),
  get: (id: string) => api.get(`/group-bookings/${id}`),
  create: (data: unknown) => api.post('/group-bookings', data),
  update: (id: string, data: unknown) => api.patch(`/group-bookings/${id}`, data),
  delete: (id: string) => api.delete(`/group-bookings/${id}`),
  summary: (id: string) => api.get(`/group-bookings/${id}/summary`),
  addBooking: (id: string, bookingId: string) => api.post(`/group-bookings/${id}/add-booking`, { bookingId }),
  removeBooking: (id: string, bookingId: string) => api.delete(`/group-bookings/${id}/remove-booking/${bookingId}`),
  bulkCheckIn: (id: string) => api.post(`/group-bookings/${id}/bulk-checkin`),
  bulkCheckOut: (id: string) => api.post(`/group-bookings/${id}/bulk-checkout`),
};

// ── Packages ──────────────────────────────────────────────────────────────────
export const packagesApi = {
  list: () => api.get('/packages'),
  create: (data: unknown) => api.post('/packages', data),
  update: (id: string, data: unknown) => api.patch(`/packages/${id}`, data),
  delete: (id: string) => api.delete(`/packages/${id}`),
  // Booking-package operations
  getForBooking: (bookingId: string) => api.get(`/packages/booking/${bookingId}`),
  apply: (bookingId: string, packageId: string) => api.post('/packages/apply', { bookingId, packageId }),
  remove: (bookingId: string, packageId: string) => api.delete('/packages/remove', { data: { bookingId, packageId } }),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  getDaily: (date?: string) => api.get('/reports/daily', { params: date ? { date } : {} }),
  emailDaily: (date?: string, toEmail?: string) =>
    api.post('/reports/daily/email', { toEmail }, { params: date ? { date } : {} }),
};

// ── Billing ───────────────────────────────────────────────────────────────────
export const billingApi = {
  getStatus: () => api.get('/billing/status'),
  getInvoices: () => api.get('/billing/invoices'),
  createCheckout: (planKey: string) => api.post('/billing/checkout', { planKey }),
  createPortal: () => api.post('/billing/portal'),
};

// ── Booking Payment Link ───────────────────────────────────────────────────────
export const bookingPaymentApi = {
  createPaymentLink: (bookingId: string) => api.post(`/bookings/${bookingId}/payment-link`),
};

// ── Expenses ──────────────────────────────────────────────────────────────────
export const expensesApi = {
  list: (params?: { month?: string; category?: string; page?: number; limit?: number }) =>
    api.get('/expenses', { params }),
  create: (data: {
    date: string; category: string; description: string; amount: number;
    vendor?: string; paymentMode?: string; notes?: string;
  }) => api.post('/expenses', data),
  update: (id: string, data: Partial<{
    date: string; category: string; description: string; amount: number;
    vendor?: string; paymentMode?: string; notes?: string;
  }>) => api.patch(`/expenses/${id}`, data),
  delete: (id: string) => api.delete(`/expenses/${id}`),
  summary: (month?: string) => api.get('/expenses/summary', { params: month ? { month } : {} }),
  trends: () => api.get('/expenses/trends'),
};

// ── Payment Gateways ──────────────────────────────────────────────────────────
export const paymentGatewayApi = {
  getSettings: () => api.get('/payments/settings'),
  saveSettings: (data: {
    bkash?: { enabled?: boolean; appKey?: string; appSecret?: string; username?: string; password?: string };
    ssl?: { enabled?: boolean; storeId?: string; storePassword?: string; isLive?: boolean };
    stripe?: { enabled?: boolean };
  }) => api.patch('/payments/settings', data),
  getActive: (slug: string) => api.get(`/payments/settings/active/${slug}`),
  bkashInitiate: (bookingId: string) => api.post('/payments/bkash/initiate', { bookingId }),
  sslInitiate: (bookingId: string) => api.post('/payments/ssl/initiate', { bookingId }),
  stripeIntent: (bookingId: string) => api.post('/payments/stripe/intent', { bookingId }),
};

// ── External Calendars (iCal sync) ────────────────────────────────────────────
export const externalCalendarsApi = {
  list: () => api.get('/external-calendars'),
  create: (data: { roomId: string; name: string; icalUrl: string; isActive?: boolean }) =>
    api.post('/external-calendars', data),
  update: (id: string, data: { name?: string; icalUrl?: string; isActive?: boolean }) =>
    api.patch(`/external-calendars/${id}`, data),
  delete: (id: string) => api.delete(`/external-calendars/${id}`),
  sync: (id: string) => api.post(`/external-calendars/${id}/sync`),
  status: (id: string) => api.get(`/external-calendars/${id}/status`),
  testUrl: (url: string) => api.post('/external-calendars/test-url', { url }),
};
