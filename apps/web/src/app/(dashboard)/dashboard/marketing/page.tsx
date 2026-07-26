'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  Megaphone, Plus, Send, Clock, FileText, CheckCircle2,
  XCircle, Loader2, Trash2, MessageSquare,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';

interface Campaign {
  id: string; name: string; channel: 'sms' | 'whatsapp' | 'both';
  status: string; audienceType: string; recipientCount: number;
  deliveredCount: number; failedCount: number;
  scheduledAt: string | null; sentAt: string | null;
  createdAt: string; message: string;
}

const STATUS_TABS = [
  { id: 'all',       label: 'All' },
  { id: 'draft',     label: 'Draft' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'sending',   label: 'Sending' },
  { id: 'sent',      label: 'Sent' },
  { id: 'failed',    label: 'Failed' },
];

const CHANNEL_ICON: Record<string, string>  = { sms: '📱', whatsapp: '💬', both: '📱💬' };
const CHANNEL_LABEL: Record<string, string> = { sms: 'SMS', whatsapp: 'WhatsApp', both: 'SMS + WhatsApp' };

const STATUS_META: Record<string, { label: string; bg: string; border: string; text: string; Icon: React.ElementType }> = {
  draft:     { label: 'Draft',     bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)',  Icon: FileText    },
  scheduled: { label: 'Scheduled', bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040',  Icon: Clock       },
  sending:   { label: 'Sending',   bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a',  Icon: Loader2     },
  sent:      { label: 'Sent',      bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a',  Icon: CheckCircle2 },
  failed:    { label: 'Failed',    bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c',  Icon: XCircle     },
  cancelled: { label: 'Cancelled', bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-faint)',  Icon: XCircle     },
};

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span className="inline-flex items-center gap-1 rounded-[7px] border px-[8px] py-[3px] text-[11px] font-semibold"
      style={{ background: m.bg, borderColor: m.border, color: m.text }}>
      <m.Icon className={`h-3 w-3 ${status === 'sending' ? 'animate-spin' : ''}`} />
      {m.label}
    </span>
  );
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MarketingPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [sendingId,    setSendingId]    = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-campaigns', statusFilter],
    queryFn: () => marketingApi.listCampaigns(statusFilter === 'all' ? undefined : statusFilter),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => marketingApi.deleteCampaign(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing-campaigns'] }); toast({ title: '✓ Campaign deleted' }); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast({ title: 'Error', description: e?.response?.data?.error ?? 'Could not delete', variant: 'destructive' }),
    onSettled: () => setDeletingId(null),
  });

  const sendMut = useMutation({
    mutationFn: (id: string) => marketingApi.sendCampaign(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing-campaigns'] }); toast({ title: '🚀 Campaign is sending!', description: 'Recipients will receive messages shortly.' }); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast({ title: 'Cannot Send', description: e?.response?.data?.error ?? 'Error sending campaign', variant: 'destructive' }),
    onSettled: () => setSendingId(null),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => marketingApi.cancelCampaign(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketing-campaigns'] }); toast({ title: '✓ Campaign cancelled' }); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast({ title: 'Error', description: e?.response?.data?.error ?? 'Could not cancel', variant: 'destructive' }),
    onSettled: () => setCancellingId(null),
  });

  const campaigns: Campaign[] = data?.data?.data ?? [];

  return (
    <PageShell gap={6}>
      {/* Header */}
      <PageHeader
        icon={
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-teal-bg)' }}>
            <Megaphone className="h-4.5 w-4.5" style={{ color: '#23766a' }} />
          </div>
        }
        title="SMS & WhatsApp Marketing"
        subtitle="Send bulk messages to guests — offers, reminders, announcements"
        align="center"
        actions={
          <Link href="/dashboard/marketing/new">
            <button className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium hover:opacity-90"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              <Plus className="h-4 w-4" /> New Campaign
            </button>
          </Link>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(t => (
          <button key={t.id} onClick={() => setStatusFilter(t.id)}
            className="rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
            style={statusFilter === t.id
              ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
              : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Campaign list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#9bbdb7' }} />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center rounded-[14px] border"
          style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-teal-bg)' }}>
            <MessageSquare className="h-7 w-7" style={{ color: '#23766a' }} />
          </div>
          <p className="text-[14px] font-medium text-[#18231f] dark:text-[#dfd9d0]">No campaigns yet</p>
          <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Create your first campaign to reach your guests</p>
          <Link href="/dashboard/marketing/new">
            <button className="mt-2 flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium hover:opacity-90"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              <Plus className="h-4 w-4" /> New Campaign
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="rounded-[14px] border bg-white p-5 transition-all hover:shadow-md"
              style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <Link href={`/dashboard/marketing/${c.id}`}
                      className="text-[13.5px] font-semibold truncate hover:underline text-[#18231f] dark:text-[#dfd9d0]">
                      {c.name}
                    </Link>
                    <StatusPill status={c.status} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">
                    <span>{CHANNEL_ICON[c.channel]} {CHANNEL_LABEL[c.channel]}</span>
                    <span>·</span>
                    <span>{c.recipientCount} recipients</span>
                    {c.status === 'sent' && (
                      <>
                        <span>·</span>
                        <span style={{ color: '#23766a' }}>{c.deliveredCount} delivered</span>
                        {c.failedCount > 0 && <>
                          <span>·</span>
                          <span style={{ color: '#c43c3c' }}>{c.failedCount} failed</span>
                        </>}
                      </>
                    )}
                    {c.scheduledAt && c.status === 'scheduled' && (
                      <>
                        <span>·</span>
                        <span style={{ color: '#b89040' }}><Clock className="h-3 w-3 inline mr-0.5" />{formatDate(c.scheduledAt)}</span>
                      </>
                    )}
                    {c.sentAt && <><span>·</span><span>{formatDate(c.sentAt)}</span></>}
                  </div>
                  <p className="text-[12px] mt-1.5 truncate text-[#c5bdb4] dark:text-[#6e8580]">"{c.message}"</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {c.status === 'draft' && (
                    <>
                      <button
                        onClick={() => { setSendingId(c.id); sendMut.mutate(c.id); }}
                        disabled={sendingId !== null && sendingId !== c.id}
                        className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40 hover:bg-[#f5faf9]"
                        style={{ borderColor: 'rgba(35,118,106,0.25)', color: '#23766a' }}>
                        {sendingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Send
                      </button>
                      <button
                        onClick={() => { setDeletingId(c.id); deleteMut.mutate(c.id); }}
                        disabled={deletingId !== null && deletingId !== c.id}
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] transition-colors disabled:opacity-40 hover:bg-[#fef2f2] text-[#c5bdb4] dark:text-[#6e8580]">
                        {deletingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </>
                  )}
                  {c.status === 'scheduled' && (
                    <button
                      onClick={() => { setCancellingId(c.id); cancelMut.mutate(c.id); }}
                      disabled={cancellingId !== null && cancellingId !== c.id}
                      className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40 hover:bg-[#fef2f2]"
                      style={{ borderColor: 'rgba(200,60,60,0.2)', color: '#c43c3c' }}>
                      {cancellingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                      Cancel
                    </button>
                  )}
                  <Link href={`/dashboard/marketing/${c.id}`}
                    className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[#f4f1eb]"
                    style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                    Details →
                  </Link>
                </div>
              </div>

              {c.status === 'sent' && c.recipientCount > 0 && (
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#e8e5e0' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.round(c.deliveredCount / c.recipientCount * 100))}%`, background: '#23766a' }} />
                  </div>
                  <p className="text-[11.5px] mt-1 text-[#8aa29a] dark:text-[#94b8b0]">
                    {Math.round(c.deliveredCount / c.recipientCount * 100)}% delivery rate
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
