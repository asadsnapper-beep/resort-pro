'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { Mail, Loader2, Clock } from 'lucide-react';

interface DemoLead {
  id: string;
  email: string;
  role: string;
  ipAddress: string | null;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER:        'Resort Owner',
  MANAGER:      'General Manager',
  SHAREHOLDER:  'Shareholder',
  RECEPTIONIST: 'Receptionist',
  MARKETER:     'Marketing Manager',
  DEVELOPER:    'Developer',
  STAFF:        'Housekeeping Staff',
  CHEF:         'Chef',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminDemoLeadsPage() {
  const { data, isLoading } = useQuery<DemoLead[]>({
    queryKey: ['admin-demo-leads'],
    queryFn: () => adminApi.get('/demo-leads').then((r) => r.data.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const leads = data ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="admin-page-title flex items-center gap-2.5 text-rp-text">
          <Mail className="h-6 w-6 text-rp-brand" />
          Demo Leads
        </h1>
        <p className="mt-1 text-sm text-rp-muted">
          Everyone who entered an email to view the /try demo — plan/demo-gate-and-click-tracking.md
        </p>
      </div>

      {leads.length > 0 && (
        <div className="inline-flex items-center gap-2 border border-rp-brand bg-rp-teal-bg px-3 py-1.5 text-sm font-semibold text-rp-brand-deep">
          {leads.length} lead{leads.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* List */}
      {leads.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border border-rp-border-md bg-rp-surface py-16 text-center">
          <Mail className="h-8 w-8 text-rp-faint" />
          <p className="text-sm text-rp-muted">No demo leads yet</p>
        </div>
      ) : (
        <div className="divide-y divide-rp-border-md overflow-hidden border border-rp-border-md bg-rp-surface">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center gap-4 bg-rp-surface px-4 py-4 transition-colors hover:bg-rp-surface-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-rp-border-md bg-rp-surface-3 text-xs font-bold text-rp-subtle">
                {lead.email[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-rp-text">{lead.email}</p>
                <p className="mt-0.5 truncate text-xs text-rp-muted">
                  {lead.ipAddress ?? 'IP unknown'}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-rp-muted">
                <span className="border border-rp-brand bg-rp-teal-bg px-2 py-0.5 text-[11px] font-semibold text-rp-brand-deep">
                  {ROLE_LABEL[lead.role] ?? lead.role}
                </span>
                <p className="mt-1.5 flex items-center justify-end gap-1">
                  <Clock className="h-3 w-3" /> {timeAgo(lead.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
