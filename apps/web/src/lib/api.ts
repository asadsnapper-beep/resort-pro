import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

function getAuthState() {
  try {
    const raw = localStorage.getItem('resort-pro-auth');
    return raw ? JSON.parse(raw)?.state : null;
  } catch { return null; }
}

function setAuthToken(token: string) {
  try {
    const raw = localStorage.getItem('resort-pro-auth');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    stored.state.token = token;
    delete stored.state.refreshToken;
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
      const hasToken = !!getAuthState()?.token;
      if (hasToken) {
        try {
          const res = await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true });
          const { token } = res.data.data;
          setAuthToken(token);
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
  register: (data: { resortName: string; slug: string; firstName: string; lastName: string; email: string; password: string; referralCode?: string; plan?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string; slug: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout', {}),
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
  list:         (params?: Record<string, unknown>) => api.get('/rooms', { params }),
  get:          (id: string) => api.get(`/rooms/${id}`),
  stats:        () => api.get('/rooms/stats'),
  create:       (data: unknown) => api.post('/rooms', data),
  update:       (id: string, data: unknown) => api.patch(`/rooms/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/rooms/${id}/status`, { status }),
  delete:       (id: string) => api.delete(`/rooms/${id}`),
  availability: (checkIn: string, checkOut: string) =>
    api.get('/rooms/availability', { params: { checkIn, checkOut } }),
};

// ── Bookings ──────────────────────────────────────────────────────────────────
export const bookingsApi = {
  list: (params?: Record<string, unknown>) => api.get('/bookings', { params }),
  get: (id: string) => api.get(`/bookings/${id}`),
  create: (data: unknown) => api.post('/bookings', data),
  checkIn: (id: string, data?: { deposit?: number; roomNotes?: string; roomId?: string }) =>
    api.patch(`/bookings/${id}/check-in`, data ?? {}),
  checkOut: (id: string, data?: { additionalPayment?: number; paymentMethod?: string }) =>
    api.patch(`/bookings/${id}/check-out`, data ?? {}),
  walkIn: (data: unknown) => api.post('/bookings/walk-in', data),
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

// ── Front Desk ────────────────────────────────────────────────────────────────
export const frontDeskApi = {
  today:   () => api.get('/front-desk/today'),
  roomMap: () => api.get('/front-desk/room-map'),
};

// ── Guests ────────────────────────────────────────────────────────────────────
export const guestsApi = {
  list: (params?: Record<string, unknown>) => api.get('/guests', { params }),
  get: (id: string) => api.get(`/guests/${id}`),
  create: (data: unknown) => api.post('/guests', data),
  update: (id: string, data: unknown) => api.patch(`/guests/${id}`, data),
  delete: (id: string) => api.delete(`/guests/${id}`),
  // Documents
  listDocuments: (id: string) => api.get(`/guests/${id}/documents`),
  uploadDocument: (id: string, formData: FormData) =>
    api.post(`/guests/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteDocument: (guestId: string, docId: string) => api.delete(`/guests/${guestId}/documents/${docId}`),
};

// ── Staff ─────────────────────────────────────────────────────────────────────
export const staffApi = {
  list:          (params?: Record<string, unknown>) => api.get('/staff', { params }),
  create:        (data: unknown) => api.post('/staff', data),
  update:        (id: string, data: unknown) => api.patch(`/staff/${id}`, data),
  delete:        (id: string) => api.delete(`/staff/${id}`),
  reactivate:    (id: string) => api.patch(`/staff/${id}/reactivate`),
  invite:        (data: { email: string; role: string; ownershipPercent?: number }) => api.post('/staff/invite', data),
  listInvites:   () => api.get('/staff/invites'),
  cancelInvite:  (id: string) => api.delete(`/staff/invites/${id}`),
};

// ── Shareholders ──────────────────────────────────────────────────────────────
export const shareholdersApi = {
  list:          () => api.get('/shareholders'),
  summary:       () => api.get('/shareholders/summary'),
  update:        (id: string, data: { ownershipPercent?: number; notes?: string }) => api.patch(`/shareholders/${id}`, data),
  remove:        (id: string) => api.delete(`/shareholders/${id}`),
  recordPayout:  (id: string, data: { amount: number; method: string; paidAt: string; note?: string }) =>
    api.post(`/shareholders/${id}/payouts`, data),
  payouts:       (id: string) => api.get(`/shareholders/${id}/payouts`),
  deletePayout:  (id: string, payoutId: string) => api.delete(`/shareholders/${id}/payouts/${payoutId}`),
  me:            () => api.get('/shareholders/me'),
  myPayouts:     () => api.get('/shareholders/me/payouts'),
};

// ── Venues & Events ───────────────────────────────────────────────────────────
export const venuesApi = {
  list:            () => api.get('/venues'),
  create:          (data: unknown) => api.post('/venues', data),
  update:          (id: string, data: unknown) => api.patch(`/venues/${id}`, data),
  remove:          (id: string) => api.delete(`/venues/${id}`),
  availability:    (id: string, date: string) => api.get(`/venues/${id}/availability`, { params: { date } }),
  listBookings:    (venueId?: string) => api.get('/venues/bookings', { params: venueId ? { venueId } : {} }),
  createBooking:   (data: unknown) => api.post('/venues/bookings', data),
  updateBooking:   (id: string, data: unknown) => api.patch(`/venues/bookings/${id}`, data),
};

// ── Corporate Accounts ────────────────────────────────────────────────────────
export const corporateAccountsApi = {
  list:            () => api.get('/corporate-accounts'),
  active:          () => api.get('/corporate-accounts/active'),
  create:          (data: unknown) => api.post('/corporate-accounts', data),
  update:          (id: string, data: unknown) => api.patch(`/corporate-accounts/${id}`, data),
  remove:          (id: string) => api.delete(`/corporate-accounts/${id}`),
  bookings:        (id: string) => api.get(`/corporate-accounts/${id}/bookings`),
  invoices:        (id: string) => api.get(`/corporate-accounts/${id}/invoices`),
  generateInvoice: (id: string, bookingIds: string[]) => api.post(`/corporate-accounts/${id}/invoices`, { bookingIds }),
  updateInvoice:   (id: string, data: { status?: string; paidAmount?: number }) => api.patch(`/corporate-accounts/invoices/${id}`, data),
};

// ── Housekeeping ──────────────────────────────────────────────────────────────
export const housekeepingApi = {
  list:         (params?: Record<string, unknown>) => api.get('/housekeeping', { params }),
  stats:        (params?: { date?: string }) => api.get('/housekeeping/stats', { params }),
  create:       (data: unknown) => api.post('/housekeeping', data),
  updateStatus: (id: string, status: string) => api.patch(`/housekeeping/${id}/status`, { status }),
  assign:       (id: string, staffId: string) => api.patch(`/housekeeping/${id}/assign`, { staffId }),
};

// ── Menu ──────────────────────────────────────────────────────────────────────
export const menuApi = {
  list: (params?: Record<string, unknown>) => api.get('/menu', { params }),
  create: (data: unknown) => api.post('/menu', data),
  update: (id: string, data: unknown) => api.patch(`/menu/${id}`, data),
  delete: (id: string) => api.delete(`/menu/${id}`),
};

// ── AI ──────────────────────────────────────────────────────────────────────
export const aiApi = {
  status:          ()              => api.get('/ai/status'),
  generateContent: (data: unknown) => api.post('/ai/content/generate', data),
};

// ── Restaurant Tables ─────────────────────────────────────────────────────────
export const restaurantTablesApi = {
  list:   ()                        => api.get('/restaurant/tables'),
  create: (data: unknown)           => api.post('/restaurant/tables', data),
  update: (id: string, data: unknown) => api.patch(`/restaurant/tables/${id}`, data),
  delete: (id: string)              => api.delete(`/restaurant/tables/${id}`),
};

// ── Food Orders ───────────────────────────────────────────────────────────────
export const foodOrdersApi = {
  list:         (params?: Record<string, unknown>) => api.get('/food-orders', { params }),
  stats:        () => api.get('/food-orders/stats'),
  create:       (data: unknown) => api.post('/food-orders', data),
  updateStatus: (id: string, status: string) => api.patch(`/food-orders/${id}/status`, { status }),
};

// ── Inventory ─────────────────────────────────────────────────────────────────
export const inventoryApi = {
  list: (params?: Record<string, unknown>) => api.get('/inventory', { params }),
  stats: () => api.get('/inventory/stats'),
  create: (data: unknown) => api.post('/inventory', data),
  update: (id: string, data: unknown) => api.patch(`/inventory/${id}`, data),
  addMovement: (id: string, data: unknown) => api.post(`/inventory/${id}/movement`, data),
  getMovements: (id: string) => api.get(`/inventory/${id}/movements`),
  exportCsv: () => api.get('/inventory/export', { responseType: 'blob' }),
  importCsv: (rows: unknown[]) => api.post('/inventory/import', { rows }),
};

// ── Vendors ───────────────────────────────────────────────────────────────────
export const vendorsApi = {
  list: () => api.get('/vendors'),
  create: (data: unknown) => api.post('/vendors', data),
  update: (id: string, data: unknown) => api.patch(`/vendors/${id}`, data),
};

// ── Purchase Orders ──────────────────────────────────────────────────────────
export const purchaseOrdersApi = {
  list: (params?: Record<string, unknown>) => api.get('/purchase-orders', { params }),
  get: (id: string) => api.get(`/purchase-orders/${id}`),
  create: (data: unknown) => api.post('/purchase-orders', data),
  send: (id: string) => api.patch(`/purchase-orders/${id}/send`),
  receive: (id: string, data: unknown) => api.post(`/purchase-orders/${id}/receive`, data),
  cancel: (id: string) => api.patch(`/purchase-orders/${id}/cancel`),
};

// ── Assets (Asset Register) ──────────────────────────────────────────────────
export const assetsApi = {
  list: (params?: Record<string, unknown>) => api.get('/assets', { params }),
  stats: () => api.get('/assets/stats'),
  create: (data: unknown) => api.post('/assets', data),
  update: (id: string, data: unknown) => api.patch(`/assets/${id}`, data),
  getLogs: (id: string) => api.get(`/assets/${id}/logs`),
  addLog: (id: string, data: unknown) => api.post(`/assets/${id}/logs`, data),
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

// ── Ticket Webhooks (Channel Settings) ───────────────────────────────────────
export const ticketWebhooksApi = {
  telegramInfo: () => api.get('/ticket-webhooks/telegram/info'),
  telegramSetup: (data: { botToken: string; notifChatId?: string }) => api.post('/ticket-webhooks/telegram/setup', data),
  telegramDisconnect: () => api.delete('/ticket-webhooks/telegram/setup'),
  whatsappInfo: () => api.get('/ticket-webhooks/whatsapp/info'),
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
  getStats: () => api.get('/website/stats'),
};

// Public (no-auth) — used from client components on the booking website
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const publicWebsiteApi = {
  trackPageView: (slug: string) => {
    // fire-and-forget — never await, never throw
    fetch(`${PUBLIC_API}/site/${slug}/pageview`, { method: 'POST' }).catch(() => {});
  },
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
  // SMS & WhatsApp
  getSmsSettings: () => api.get('/tenant/sms-settings'),
  updateSmsSettings: (data: unknown) => api.patch('/tenant/sms-settings', data),
  saveSmsCredentials: (data: unknown) => api.patch('/tenant/sms-credentials', data),
  saveWaCredentials: (data: unknown) => api.patch('/tenant/wa-credentials', data),
  testSms: (to: string) => api.post('/tenant/sms-settings/test-sms', { to }),
  testWhatsapp: (to: string) => api.post('/tenant/sms-settings/test-whatsapp', { to }),
  // Module flags (owner-controlled)
  getModules: () => api.get('/tenant/flags/modules'),
  toggleModule: (flag: string, enabled: boolean) => api.patch('/tenant/flags/module', { flag, enabled }),
  getReferrals: () => api.get('/tenant/referrals'),
  // Team management
  getTeam: () => api.get('/tenant/team'),
  inviteMember: (data: { email: string; role: string }) => api.post('/tenant/team/invite', data),
  changeMemberRole: (userId: string, role: string) => api.patch(`/tenant/team/${userId}/role`, { role }),
  removeMember: (userId: string) => api.delete(`/tenant/team/${userId}`),
  cancelInvite: (inviteId: string) => api.delete(`/tenant/team/invite/${inviteId}`),
  // Room type labels
  getRoomTypeLabels: () => api.get('/tenant/room-types'),
  updateRoomTypeLabels: (labels: Record<string, string>) => api.patch('/tenant/room-types', labels),
  resetRoomTypeLabel: (type: string) => api.delete(`/tenant/room-types/${type}`),
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
  getDispatch: () => api.get('/reports/dispatch'),
  saveDispatch: (data: {
    enabled?: boolean;
    dispatchTime?: string;
    telegramEnabled?: boolean;
    telegramBotToken?: string | null;
    telegramChatId?: string | null;
    whatsappEnabled?: boolean;
    whatsappPhone?: string | null;
  }) => api.put('/reports/dispatch', data),
  testDispatch: (channel: 'telegram' | 'whatsapp') =>
    api.post('/reports/dispatch/test', { channel }),
};

// ── Properties ────────────────────────────────────────────────────────────────
export const propertyApi = {
  list:   (params?: { page?: number; limit?: number }) => api.get('/properties', { params }),
  get:    (id: string) => api.get(`/properties/${id}`),
  create: (data: { name: string; slug: string; address?: string; phone?: string; email?: string; timezone?: string; checkInTime?: string; checkOutTime?: string }) => api.post('/properties', data),
  update: (id: string, data: Partial<Parameters<typeof propertyApi.create>[0]>) => api.patch(`/properties/${id}`, data),
  delete: (id: string) => api.delete(`/properties/${id}`),
  getRooms: (id: string) => api.get(`/properties/${id}/rooms`),
};

// ── Billing ───────────────────────────────────────────────────────────────────
export const billingApi = {
  getStatus: () => api.get('/billing/status'),
  getInvoices: () => api.get('/billing/invoices'),
  createCheckout: (planKey: string) => api.post('/billing/checkout', { planKey }),
  createBkashCheckout: (planKey: string, interval: 'month' | 'year' = 'month') =>
    api.post('/billing/checkout/bkash', { planKey, interval }),
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

// ── Payment Gateway Registry ──────────────────────────────────────────────────
export const paymentGatewayApi = {
  /** GET /payments/config — returns { activeGateway, credentials (masked), enabledMethods, testMode, manualInstructions, availableGateways } */
  getConfig: () => api.get('/payments/config'),
  /** PUT /payments/config — upsert tenant payment config */
  saveConfig: (data: {
    activeGateway?: string;
    credentials?: Record<string, Record<string, string>>;
    enabledMethods?: string[];
    testMode?: boolean;
    manualInstructions?: string;
  }) => api.put('/payments/config', data),
  /** GET /payments/gateways/:countryCode — available gateways for a country */
  getGatewaysForCountry: (countryCode: string) => api.get(`/payments/gateways/${countryCode}`),
  /** GET /payments/gateways/tenant/:slug — public gateways for guest checkout */
  getGatewaysForTenant: (slug: string) => api.get(`/payments/gateways/tenant/${slug}`),
  /** POST /checkout/init — initiate a payment */
  initiate: (data: {
    gateway: string; bookingId: string; currency?: string;
    customerName: string; customerEmail?: string; customerPhone?: string;
    returnUrl: string;
  }) => api.post('/payments/checkout/init', data),
  /** POST /checkout/verify — verify a payment after redirect */
  verify: (data: { gateway: string; gatewayPaymentId: string; orderId: string; queryParams?: Record<string, string> }) =>
    api.post('/payments/checkout/verify', data),
  /** GET /payments/history — paginated payment list */
  getHistory: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/payments/history', { params }),
  // Legacy aliases (still used by old code)
  getSettings: () => api.get('/payments/config'),
  saveSettings: (data: any) => api.put('/payments/config', data),
  getActive: (slug: string) => api.get(`/payments/gateways/tenant/${slug}`),
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

// ── Marketing API ─────────────────────────────────────────────────────────────
export const marketingApi = {
  // Campaigns
  listCampaigns:    (status?: string)              => api.get('/marketing/campaigns', { params: status ? { status } : {} }),
  getCampaign:      (id: string)                   => api.get(`/marketing/campaigns/${id}`),
  createCampaign:   (data: unknown)                => api.post('/marketing/campaigns', data),
  deleteCampaign:   (id: string)                   => api.delete(`/marketing/campaigns/${id}`),
  sendCampaign:     (id: string)                   => api.post(`/marketing/campaigns/${id}/send`, {}),
  cancelCampaign:   (id: string)                   => api.post(`/marketing/campaigns/${id}/cancel`, {}),
  // Audience
  audiencePreview:  (data: unknown)                => api.post('/marketing/audience-preview', data),
  // Templates
  listTemplates:    ()                             => api.get('/marketing/templates'),
  createTemplate:   (data: unknown)                => api.post('/marketing/templates', data),
  updateTemplate:   (id: string, data: unknown)    => api.put(`/marketing/templates/${id}`, data),
  deleteTemplate:   (id: string)                   => api.delete(`/marketing/templates/${id}`),
};

// ── Invoice API ───────────────────────────────────────────────────────────────
export const invoiceApi = {
  list:           (params?: Record<string, string>) => api.get('/invoices', { params }),
  stats:          () => api.get('/invoices/stats'),
  get:            (id: string)  => api.get(`/invoices/${id}`),
  fromBooking:    (bookingId: string) => api.post(`/invoices/from-booking/${bookingId}`),
  create:         (data: unknown) => api.post('/invoices', data),
  update:         (id: string, data: unknown) => api.patch(`/invoices/${id}`, data),
  addItem:        (id: string, data: unknown) => api.post(`/invoices/${id}/items`, data),
  updateItem:     (id: string, itemId: string, data: unknown) => api.patch(`/invoices/${id}/items/${itemId}`, data),
  deleteItem:     (id: string, itemId: string) => api.delete(`/invoices/${id}/items/${itemId}`),
  recordPayment:  (id: string, data: unknown) => api.post(`/invoices/${id}/payment`, data),
  send:           (id: string)  => api.post(`/invoices/${id}/send`),
  pdfUrl:         (id: string)  => `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/invoices/${id}/pdf`,
  delete:         (id: string)  => api.delete(`/invoices/${id}`),
};

// ── Offers API ────────────────────────────────────────────────────────────────
export const offersApi = {
  list:   (status?: string)            => api.get('/offers', { params: status ? { status } : {} }),
  create: (data: unknown)              => api.post('/offers', data),
  update: (id: string, data: unknown)  => api.patch(`/offers/${id}`, data),
  delete: (id: string)                 => api.delete(`/offers/${id}`),
  stats:  (id: string)                 => api.get(`/offers/${id}/stats`),
};
