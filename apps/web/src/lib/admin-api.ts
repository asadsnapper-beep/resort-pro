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
  // Was calling DELETE /tenants/:id — harmless while that route only ever
  // soft-suspended, but DELETE now permanently erases the tenant, so
  // "Suspend" has to go through the same PATCH path reactivate already uses.
  suspendTenant: (id: string) => adminApi.patch(`/tenants/${id}`, { isActive: false }),
  reactivateTenant: (id: string) => adminApi.patch(`/tenants/${id}`, { isActive: true }),
  // Permanent, irreversible. confirmName must exactly match the tenant's
  // current name — the server rejects anything else.
  deleteTenant: (id: string, confirmName: string) =>
    adminApi.delete(`/tenants/${id}`, { data: { confirmName } }),
  impersonate: (id: string) => adminApi.post(`/tenants/${id}/impersonate`),
  exportTenant: (id: string) => adminApi.get(`/tenants/${id}/export`, { responseType: 'blob' }),
  extendTrial: (id: string, days: number) => adminApi.post(`/tenants/${id}/extend-trial`, { days }),
  // Owner-submitted requests to permanently delete their own tenant.
  deletionRequests: (status: string = 'PENDING') =>
    adminApi.get('/tenant-deletion-requests', { params: { status } }),
  approveDeletionRequest: (id: string) =>
    adminApi.post(`/tenant-deletion-requests/${id}/approve`),
  rejectDeletionRequest: (id: string, adminNotes?: string) =>
    adminApi.post(`/tenant-deletion-requests/${id}/reject`, { adminNotes }),
  // Users
  users: (params?: Record<string, string>) =>
    adminApi.get('/users', { params }),
  // Billing
  billing: () => adminApi.get('/billing'),
  // Platform settings
  getSettings: () => adminApi.get('/settings'),
  updateSettings: (data: { trialDays?: number; plans?: unknown[]; aiEnabledGlobal?: boolean }) => adminApi.put('/settings', data),
  // CSV Exports
  exportTenantsCsv: () => adminApi.get('/export/tenants-csv', { responseType: 'blob' }),
  exportRevenueCsv: () => adminApi.get('/export/revenue-csv', { responseType: 'blob' }),
  exportTenantCsv: (id: string) => adminApi.get(`/tenants/${id}/export-csv`, { responseType: 'blob' }),
  // MRR Growth
  getMrrGrowth: () => adminApi.get('/mrr-growth'),
  // Failed Payments
  getFailedPayments: () => adminApi.get('/failed-payments'),
  // Referrals
  getReferrals: () => adminApi.get('/referrals'),
  rewardReferral: (id: string, data: { type: 'CREDIT' | 'FREE_PLAN' | 'NONE'; amount?: number; plan?: string; months?: number; note?: string }) =>
    adminApi.patch(`/referrals/${id}/reward`, data),
  createCustomLink: (data: { tenantId: string; code?: string }) =>
    adminApi.post('/referrals/custom-link', data),
  getReferralTenantsList: () => adminApi.get('/referrals/tenants-list'),
  // Campaign links (marketing attribution)
  getCampaignLinks: () => adminApi.get('/campaign-links'),
  createCampaignLink: (data: { label: string; code?: string }) =>
    adminApi.post('/campaign-links', data),
  updateCampaignLink: (id: string, data: { label?: string; isActive?: boolean }) =>
    adminApi.patch(`/campaign-links/${id}`, data),
  deleteCampaignLink: (id: string) => adminApi.delete(`/campaign-links/${id}`),
  getCampaignLinkSignups: (id: string) => adminApi.get(`/campaign-links/${id}/signups`),
  // Churn Risk
  getChurnRisk: () => adminApi.get('/churn-risk'),
  // Notifications
  getNotifications: () => adminApi.get('/notifications'),
  markNotificationRead: (id: string) => adminApi.patch(`/notifications/${id}/read`),
  markAllNotificationsRead: () => adminApi.patch('/notifications/read-all'),
  // Audit Log
  getAuditLog: (params?: {
    page?: number; action?: string; adminEmail?: string;
    targetType?: string; from?: string; to?: string;
  }) => adminApi.get('/audit-log', { params }),
  // Health
  getHealth: () => adminApi.get('/health'),
  // GDPR
  getGdprRequests: () => adminApi.get('/gdpr/requests'),
  requestErasure: (id: string) => adminApi.post(`/tenants/${id}/gdpr/request-erasure`),
  anonymizeNow: (id: string) => adminApi.post(`/tenants/${id}/gdpr/anonymize-now`),
  cancelErasure: (id: string) => adminApi.post(`/tenants/${id}/gdpr/cancel-erasure`),
  gdprExport: (id: string) => adminApi.get(`/tenants/${id}/gdpr/export`, { responseType: 'blob' }),
  // Announcements
  getAnnouncements: () => adminApi.get('/announcements'),
  createAnnouncement: (data: {
    title: string; body: string; type?: string;
    targetPlans?: string[]; isDismissible?: boolean;
    startsAt?: string; endsAt?: string;
  }) => adminApi.post('/announcements', data),
  updateAnnouncement: (id: string, data: {
    title?: string; body?: string; type?: string; targetPlans?: string[];
    isDismissible?: boolean; startsAt?: string; endsAt?: string | null; isActive?: boolean;
  }) => adminApi.patch(`/announcements/${id}`, data),
  deleteAnnouncement: (id: string) => adminApi.delete(`/announcements/${id}`),
  broadcastAnnouncement: (id: string) => adminApi.post(`/announcements/${id}/broadcast`),
  // Feature Flags
  getFeatureFlagRegistry: () => adminApi.get('/feature-flags'),
  getTenantFlags: (id: string) => adminApi.get(`/tenants/${id}/flags`),
  toggleTenantFlag: (id: string, flag: string, enabled: boolean) =>
    adminApi.patch(`/tenants/${id}/flags/${flag}`, { enabled }),
  bulkUpdateTenantFlags: (id: string, flags: Record<string, boolean>) =>
    adminApi.patch(`/tenants/${id}/flags`, { flags }),
  // Admin Team
  getTeam: () => adminApi.get('/team'),
  createTeamMember: (data: { email: string; password: string; role: string; firstName?: string; lastName?: string }) =>
    adminApi.post('/team', data),
  updateTeamMember: (id: string, data: { role?: string; isActive?: boolean; firstName?: string; lastName?: string }) =>
    adminApi.patch(`/team/${id}`, data),
  deleteTeamMember: (id: string) => adminApi.delete(`/team/${id}`),
  // Domain management (T-27)
  getDomains: () => adminApi.get('/domains'),
  forceVerifyDomain: (id: string) => adminApi.post(`/domains/${id}/force-verify`),
  removeDomain: (id: string) => adminApi.delete(`/domains/${id}`),
  updateSslStatus: (id: string, data: { sslStatus: string; sslExpiresAt?: string; sslError?: string }) =>
    adminApi.patch(`/domains/${id}/ssl`, data),
  // Enterprise / SLA / White-label / SSO
  getEnterpriseSummary: () => adminApi.get('/enterprise'),
  getTenantEnterprise: (id: string) => adminApi.get(`/tenants/${id}/enterprise`),
  upsertSla: (id: string, data: {
    tier?: string; uptimePercent?: number; responseTimeH?: number;
    contractStart?: string; contractEnd?: string | null;
    autoRenew?: boolean; notes?: string; signedBy?: string; signedAt?: string;
  }) => adminApi.put(`/tenants/${id}/sla`, data),
  deleteSla: (id: string) => adminApi.delete(`/tenants/${id}/sla`),
  updateWhitelabel: (id: string, data: {
    whitelabelEnabled?: boolean; brandLogoUrl?: string | null;
    brandPrimaryColor?: string | null; brandAccentColor?: string | null;
    companyDisplayName?: string | null;
  }) => adminApi.put(`/tenants/${id}/whitelabel`, data),
  updateSso: (id: string, data: {
    ssoEnabled?: boolean; ssoProvider?: string | null;
    ssoClientId?: string | null; ssoClientSecret?: string | null;
    ssoConfig?: Record<string, unknown> | null;
  }) => adminApi.put(`/tenants/${id}/sso`, data),
  updateOnboarding: (id: string, data: { step?: number; notes?: string; complete?: boolean }) =>
    adminApi.patch(`/tenants/${id}/onboarding`, data),
  // Themes — existing
  getThemes: () => adminApi.get('/themes'),
  updateTheme: (key: string, data: {
    name?: string; description?: string; previewImage?: string; screenshots?: string[];
    author?: string; version?: string; tags?: string[];
    isActive?: boolean; isPremium?: boolean; isDefault?: boolean;
    requiredPlan?: string; sortOrder?: number;
    /** One-time sale price. 0 = free theme. See plan/theme-studio-and-design-service.md. */
    priceUsd?: number; priceBdt?: number;
    /** Temporary discount — send null to clear a running offer. */
    offerPriceUsd?: number | null; offerPriceBdt?: number | null; offerEndsAt?: string | null;
  }) => adminApi.put(`/themes/${key}`, data),
  toggleTheme: (key: string) => adminApi.patch(`/themes/${key}/toggle`),
  // Themes — dynamic (upload + AI)
  uploadTheme: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return adminApi.post('/themes/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  generateTheme: (data: { prompt: string; provider?: string; quickOptions?: string[] }) =>
    adminApi.post('/themes/generate', data),
  publishTheme: (key: string, status: 'DRAFT' | 'PREVIEW' | 'PUBLISHED') =>
    adminApi.put(`/themes/${key}/publish`, { status }),
  deleteTheme: (key: string) => adminApi.delete(`/themes/${key}`),
  // AI settings
  getAiSettings: () => adminApi.get('/settings/ai'),
  saveAiApiKey: (apiKey: string, provider?: string) =>
    adminApi.put('/settings/ai', { apiKey, provider }),
  disconnectAi: () => adminApi.delete('/settings/ai'),
};
