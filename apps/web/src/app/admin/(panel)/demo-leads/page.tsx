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
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Mail className="h-6 w-6 text-indigo-500" />
          Demo Leads
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Everyone who entered an email to view the /try demo — plan/demo-gate-and-click-tracking.md
        </p>
      </div>

      {leads.length > 0 && (
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-400">
          {leads.length} lead{leads.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* List */}
      {leads.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-800 bg-gray-900/50 py-16 text-center">
          <Mail className="h-8 w-8 text-gray-700" />
          <p className="text-sm text-gray-500">No demo leads yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden divide-y divide-gray-800">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center gap-4 bg-gray-900/50 px-4 py-4"
            >
              <div className="h-9 w-9 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">
                {lead.email[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{lead.email}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {lead.ipAddress ?? 'IP unknown'}
                </p>
              </div>
              <div className="text-right shrink-0 text-xs text-gray-500">
                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-400">
                  {ROLE_LABEL[lead.role] ?? lead.role}
                </span>
                <p className="flex items-center gap-1 mt-1.5 justify-end">
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
