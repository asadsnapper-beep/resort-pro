'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  Megaphone, Plus, Send, Clock, FileText, CheckCircle2,
  XCircle, Loader2, Trash2, AlertTriangle, MessageSquare,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Campaign {
  id:             string;
  name:           string;
  channel:        'sms' | 'whatsapp' | 'both';
  status:         string;
  audienceType:   string;
  recipientCount: number;
  deliveredCount: number;
  failedCount:    number;
  scheduledAt:    string | null;
  sentAt:         string | null;
  createdAt:      string;
  message:        string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { id: 'all',       label: 'All' },
  { id: 'draft',     label: 'Draft' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'sending',   label: 'Sending' },
  { id: 'sent',      label: 'Sent' },
  { id: 'failed',    label: 'Failed' },
];

const CHANNEL_ICON: Record<string, string> = {
  sms:       '📱',
  whatsapp:  '💬',
  both:      '📱💬',
};

const CHANNEL_LABEL: Record<string, string> = {
  sms:      'SMS',
  whatsapp: 'WhatsApp',
  both:     'SMS + WhatsApp',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-600',   icon: <FileText className="h-3 w-3" /> },
    scheduled: { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700',   icon: <Clock className="h-3 w-3" /> },
    sending:   { label: 'Sending',   cls: 'bg-amber-100 text-amber-700', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    sent:      { label: 'Sent',      cls: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
    failed:    { label: 'Failed',    cls: 'bg-red-100 text-red-700',     icon: <XCircle className="h-3 w-3" /> },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500',   icon: <XCircle className="h-3 w-3" /> },
  };
  const s = map[status] ?? map.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MarketingPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-campaigns', statusFilter],
    queryFn: () => marketingApi.listCampaigns(statusFilter === 'all' ? undefined : statusFilter),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => marketingApi.deleteCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-campaigns'] });
      toast({ title: '✓ Campaign deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.error ?? 'Could not delete', variant: 'destructive' }),
  });

  const sendMut = useMutation({
    mutationFn: (id: string) => marketingApi.sendCampaign(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['marketing-campaigns'] });
      toast({ title: '🚀 Campaign is sending!', description: 'Recipients will receive messages shortly.' });
    },
    onError: (e: any) => toast({ title: 'Cannot Send', description: e?.response?.data?.error ?? 'Error sending campaign', variant: 'destructive' }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => marketingApi.cancelCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-campaigns'] });
      toast({ title: '✓ Campaign cancelled' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.error, variant: 'destructive' }),
  });

  const campaigns: Campaign[] = data?.data?.data ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-resort-600" />
            SMS & WhatsApp Marketing
          </h1>
          <p className="text-gray-500 text-sm mt-1">Guests-দের bulk message পাঠাও — offer, reminder, announcement</p>
        </div>
        <Link href="/dashboard/marketing/new">
          <Button className="gap-2 bg-resort-600 hover:bg-resort-700">
            <Plus className="h-4 w-4" /> New Campaign
          </Button>
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {STATUS_TABS.map(t => (
          <button key={t.id} onClick={() => setStatusFilter(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === t.id ? 'bg-white text-resort-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Campaign list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-resort-600" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No campaigns yet</p>
          <p className="text-sm mt-1">Create your first campaign to reach your guests</p>
          <Link href="/dashboard/marketing/new">
            <Button className="mt-4 gap-2 bg-resort-600 hover:bg-resort-700">
              <Plus className="h-4 w-4" /> New Campaign
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-resort-200 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-4">
                {/* Left: info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/dashboard/marketing/${c.id}`}
                      className="font-semibold text-gray-900 hover:text-resort-700 truncate">
                      {c.name}
                    </Link>
                    <StatusBadge status={c.status} />
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500 flex-wrap">
                    <span>{CHANNEL_ICON[c.channel]} {CHANNEL_LABEL[c.channel]}</span>
                    <span>·</span>
                    <span>{c.recipientCount} recipients</span>
                    {c.status === 'sent' && (
                      <>
                        <span>·</span>
                        <span className="text-green-600 font-medium">{c.deliveredCount} delivered</span>
                        {c.failedCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-red-500">{c.failedCount} failed</span>
                          </>
                        )}
                      </>
                    )}
                    {c.scheduledAt && c.status === 'scheduled' && (
                      <>
                        <span>·</span>
                        <span className="text-blue-600"><Clock className="h-3.5 w-3.5 inline mr-0.5" />{formatDate(c.scheduledAt)}</span>
                      </>
                    )}
                    {c.sentAt && (
                      <>
                        <span>·</span>
                        <span>{formatDate(c.sentAt)}</span>
                      </>
                    )}
                  </div>

                  {/* Message preview */}
                  <p className="text-xs text-gray-400 mt-2 line-clamp-1">"{c.message}"</p>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {c.status === 'draft' && (
                    <>
                      <Button size="sm" variant="outline"
                        onClick={() => { if (confirm('Send this campaign now?')) sendMut.mutate(c.id); }}
                        loading={sendMut.isPending}
                        className="gap-1.5 text-resort-700 border-resort-200 hover:bg-resort-50">
                        <Send className="h-3.5 w-3.5" /> Send
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => { if (confirm('Delete this draft?')) deleteMut.mutate(c.id); }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {c.status === 'scheduled' && (
                    <Button size="sm" variant="outline"
                      onClick={() => { if (confirm('Cancel this scheduled campaign?')) cancelMut.mutate(c.id); }}
                      className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
                      <XCircle className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  )}
                  <Link href={`/dashboard/marketing/${c.id}`}>
                    <Button size="sm" variant="ghost" className="text-gray-500">Details →</Button>
                  </Link>
                </div>
              </div>

              {/* Progress bar for sent campaigns */}
              {c.status === 'sent' && c.recipientCount > 0 && (
                <div className="mt-3">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round((c.deliveredCount / c.recipientCount) * 100))}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {Math.round((c.deliveredCount / c.recipientCount) * 100)}% delivery rate
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
