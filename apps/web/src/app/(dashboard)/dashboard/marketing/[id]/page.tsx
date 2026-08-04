'use client';

import { use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Send, XCircle, CheckCircle2, Clock, Loader2,
  Users, MessageSquare,
} from 'lucide-react';

interface CampaignLog {
  id: string; guestName: string | null; phone: string;
  channel: string; status: string; errorMsg: string | null; sentAt: string | null;
}

interface Campaign {
  id: string; name: string; channel: string; status: string;
  audienceType: string; recipientCount: number; deliveredCount: number;
  failedCount: number; message: string; scheduledAt: string | null;
  sentAt: string | null; createdAt: string; logs: CampaignLog[];
}

const STATUS_META: Record<string, { label: string; bg: string; border: string; text: string }> = {
  draft:     { label: 'Draft',     bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)' },
  scheduled: { label: 'Scheduled', bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  sending:   { label: 'Sending…',  bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a' },
  sent:      { label: 'Sent',      bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',  text: '#183153' },
  failed:    { label: 'Failed',    bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c' },
  cancelled: { label: 'Cancelled', bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-faint)' },
};

const LOG_STATUS_META: Record<string, { color: string; Icon: React.ElementType }> = {
  queued:    { color: 'var(--rp-text-faint)', Icon: Clock       },
  sent:      { color: '#183153', Icon: Send        },
  delivered: { color: '#183153', Icon: CheckCircle2 },
  failed:    { color: '#c43c3c', Icon: XCircle     },
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-campaign', id],
    queryFn:  () => marketingApi.getCampaign(id),
    refetchInterval: (q) => {
      const status = q.state.data?.data?.data?.status;
      return status === 'sending' ? 3000 : false;
    },
  });

  const campaign: Campaign | undefined = data?.data?.data;

  const sendMut = useMutation({
    mutationFn: () => marketingApi.sendCampaign(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['marketing-campaign', id] }); toast({ title: '🚀 Campaign is sending!' }); },
    onError:    (e: { response?: { data?: { error?: string } } }) => toast({ title: 'Cannot Send', description: e?.response?.data?.error ?? 'Error sending', variant: 'destructive' }),
  });

  const cancelMut = useMutation({
    mutationFn: () => marketingApi.cancelCampaign(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['marketing-campaign', id] }); toast({ title: '✓ Campaign cancelled' }); },
    onError:    (e: { response?: { data?: { error?: string } } }) => toast({ title: 'Error', description: e?.response?.data?.error ?? 'Could not cancel', variant: 'destructive' }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#aac0d0' }} />
    </div>
  );

  if (!campaign) return (
    <div className="space-y-4">
      <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">Campaign not found.</p>
      <Link href="/dashboard/marketing">
        <button className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]"
          style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>← Back</button>
      </Link>
    </div>
  );

  const deliveryPct = campaign.recipientCount > 0
    ? Math.round(campaign.deliveredCount / campaign.recipientCount * 100) : 0;
  const channelIcon = campaign.channel === 'sms' ? '📱' : campaign.channel === 'whatsapp' ? '💬' : '📱💬';
  const sm = STATUS_META[campaign.status] ?? STATUS_META.draft;

  return (
    <div className="max-w-4xl space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/marketing"
            className="flex items-center gap-1 text-[12.5px] mb-2 hover:underline text-[#64748b] dark:text-[#a9c1d0]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Campaigns
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-[24px] font-medium tracking-[-0.01em] text-[#183153] dark:text-[#f8fafc]">
              {campaign.name}
            </h1>
            <span className="inline-flex items-center rounded-[7px] border px-[9px] py-[3px] text-[11.5px] font-semibold"
              style={{ background: sm.bg, borderColor: sm.border, color: sm.text }}>{sm.label}</span>
          </div>
          <p className="text-[12.5px] mt-1 text-[#64748b] dark:text-[#a9c1d0]">
            {channelIcon} {campaign.channel.toUpperCase()} · Created {new Date(campaign.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {campaign.status === 'draft' && (
            <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending}
              className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-60 hover:opacity-90"
              style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
              {sendMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Now
            </button>
          )}
          {campaign.status === 'scheduled' && (
            <button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}
              className="flex items-center gap-2 rounded-[9px] border px-4 py-2 text-[13px] font-medium disabled:opacity-60 hover:bg-[#fef2f2]"
              style={{ borderColor: 'rgba(200,60,60,0.2)', color: '#c43c3c' }}>
              {cancelMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      {['sent', 'sending', 'failed'].includes(campaign.status) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Recipients', value: campaign.recipientCount, bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text)', Icon: Users        },
            { label: 'Delivered',  value: campaign.deliveredCount, bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.2)',  text: '#183153', Icon: CheckCircle2 },
            { label: 'Failed',     value: campaign.failedCount,    bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c', Icon: XCircle      },
            { label: 'Delivery %', value: `${deliveryPct}%`,       bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', Icon: Send         },
          ].map(s => (
            <div key={s.label} className="rounded-[14px] border p-4"
              style={{ background: s.bg, borderColor: s.border }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px]" style={{ color: s.text, opacity: 0.7 }}>{s.label}</span>
                <s.Icon className="h-4 w-4" style={{ color: s.text, opacity: 0.6 }} />
              </div>
              <p className="text-[24px] font-bold" style={{ color: s.text }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Delivery bar */}
      {campaign.status === 'sent' && (
        <div className="rounded-[14px] border bg-white p-5 space-y-2"
          style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between text-[13px]">
            <span style={{ color: 'var(--rp-text-subtle)' }}>Delivery Rate</span>
            <span className="font-semibold text-[#183153] dark:text-[#f8fafc]">{deliveryPct}%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#e8e5e0' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${deliveryPct}%`, background: '#183153' }} />
          </div>
        </div>
      )}

      {/* Message preview */}
      <div className="rounded-[14px] border bg-white p-5 space-y-3"
        style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[#183153] dark:text-[#f8fafc]">
          <MessageSquare className="h-4 w-4" style={{ color: '#aac0d0' }} /> Message
        </p>
        <div className="rounded-[10px] border p-4 text-[13px] whitespace-pre-wrap font-mono"
          style={{ background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text)' }}>
          {campaign.message}
        </div>
        {campaign.scheduledAt && campaign.status === 'scheduled' && (
          <p className="text-[12.5px]" style={{ color: '#b89040' }}>
            <Clock className="h-3.5 w-3.5 inline mr-1" />
            Scheduled for {new Date(campaign.scheduledAt).toLocaleString('en-GB')}
          </p>
        )}
        {campaign.sentAt && (
          <p className="text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">
            Sent on {new Date(campaign.sentAt).toLocaleString('en-GB')}
          </p>
        )}
      </div>

      {/* Recipient log */}
      {campaign.logs.length > 0 && (
        <div className="rounded-[14px] border bg-white overflow-hidden"
          style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ background: 'var(--rp-surface-2)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <p className="text-[13.5px] font-semibold text-[#183153] dark:text-[#f8fafc]">Recipient Log</p>
            <span className="text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">{campaign.logs.length} entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--rp-surface-2)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  {['Guest', 'Phone', 'Ch', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#a9c1d0]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaign.logs.map(log => {
                  const ls = LOG_STATUS_META[log.status] ?? LOG_STATUS_META.queued;
                  return (
                    <tr key={log.id} className="transition-colors hover:bg-[#fafaf8]"
                      style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td className="px-5 py-3 text-[13px] font-medium text-[#183153] dark:text-[#f8fafc]">{log.guestName ?? '—'}</td>
                      <td className="px-5 py-3 text-[12px] font-mono text-[#64748b] dark:text-[#a9c1d0]">{log.phone}</td>
                      <td className="px-5 py-3 text-center text-[15px]">{log.channel === 'sms' ? '📱' : '💬'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <ls.Icon className="h-3.5 w-3.5" style={{ color: ls.color }} />
                          <span className="text-[12px] font-medium capitalize" style={{ color: ls.color }}>{log.status}</span>
                        </div>
                        {log.errorMsg && (
                          <p className="text-[11px] mt-0.5 truncate max-w-32" style={{ color: '#c43c3c' }}>{log.errorMsg}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
