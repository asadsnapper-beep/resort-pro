'use client';

import { use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Send, XCircle, CheckCircle2, Clock, Loader2,
  Users, AlertTriangle, MessageSquare, Phone,
} from 'lucide-react';

interface CampaignLog {
  id:        string;
  guestName: string | null;
  phone:     string;
  channel:   string;
  status:    string;
  errorMsg:  string | null;
  sentAt:    string | null;
}

interface Campaign {
  id:             string;
  name:           string;
  channel:        string;
  status:         string;
  audienceType:   string;
  recipientCount: number;
  deliveredCount: number;
  failedCount:    number;
  message:        string;
  scheduledAt:    string | null;
  sentAt:         string | null;
  createdAt:      string;
  logs:           CampaignLog[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-600' },
    scheduled: { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700' },
    sending:   { label: 'Sending…',  cls: 'bg-amber-100 text-amber-700' },
    sent:      { label: 'Sent',      cls: 'bg-green-100 text-green-700' },
    failed:    { label: 'Failed',    cls: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
  };
  const s = map[status] ?? map.draft;
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

const LOG_STATUS_ICON: Record<string, React.ReactNode> = {
  queued:    <Clock className="h-4 w-4 text-gray-400" />,
  sent:      <Send className="h-4 w-4 text-blue-500" />,
  delivered: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed:    <XCircle className="h-4 w-4 text-red-500" />,
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
    onError:    (e: any) => toast({ title: 'Cannot Send', description: e?.response?.data?.error ?? 'Error sending campaign', variant: 'destructive' }),
  });

  const cancelMut = useMutation({
    mutationFn: () => marketingApi.cancelCampaign(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['marketing-campaign', id] }); toast({ title: '✓ Campaign cancelled' }); },
    onError:    (e: any) => toast({ title: 'Error', description: e?.response?.data?.error ?? 'Could not cancel campaign', variant: 'destructive' }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-resort-600" />
    </div>
  );

  if (!campaign) return (
    <div className="p-6">
      <p className="text-gray-500">Campaign not found.</p>
      <Link href="/dashboard/marketing"><Button variant="outline" className="mt-4">← Back</Button></Link>
    </div>
  );

  const deliveryPct = campaign.recipientCount > 0
    ? Math.round((campaign.deliveredCount / campaign.recipientCount) * 100)
    : 0;

  const channelIcon = campaign.channel === 'sms' ? '📱' : campaign.channel === 'whatsapp' ? '💬' : '📱💬';

  return (
    <div className="p-6 max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/marketing" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Campaigns
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {channelIcon} {campaign.channel.toUpperCase()} · Created {new Date(campaign.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          {campaign.status === 'draft' && (
            <Button onClick={() => sendMut.mutate()}
              loading={sendMut.isPending}
              className="gap-2 bg-resort-600 hover:bg-resort-700">
              <Send className="h-4 w-4" /> Send Now
            </Button>
          )}
          {campaign.status === 'scheduled' && (
            <Button variant="outline" onClick={() => cancelMut.mutate()}
              loading={cancelMut.isPending}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      {['sent', 'sending', 'failed'].includes(campaign.status) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Recipients', value: campaign.recipientCount, icon: <Users className="h-5 w-5 text-gray-400" />,       cls: '' },
            { label: 'Delivered',  value: campaign.deliveredCount, icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, cls: 'text-green-700' },
            { label: 'Failed',     value: campaign.failedCount,    icon: <XCircle className="h-5 w-5 text-red-400" />,        cls: 'text-red-600' },
            { label: 'Delivery %', value: `${deliveryPct}%`,       icon: <Send className="h-5 w-5 text-resort-500" />,        cls: 'text-resort-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">{s.label}</span>
                {s.icon}
              </div>
              <p className={`text-2xl font-bold text-gray-900 ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Delivery bar */}
      {campaign.status === 'sent' && (
        <div className="bg-white rounded-2xl border p-5 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 font-medium">Delivery Rate</span>
            <span className="font-semibold text-gray-900">{deliveryPct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${deliveryPct}%` }} />
          </div>
        </div>
      )}

      {/* Message preview */}
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gray-400" /> Message
        </p>
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono border">
          {campaign.message}
        </div>
        {campaign.scheduledAt && campaign.status === 'scheduled' && (
          <p className="text-sm text-blue-600">
            <Clock className="h-3.5 w-3.5 inline mr-1" />
            Scheduled for {new Date(campaign.scheduledAt).toLocaleString('en-GB')}
          </p>
        )}
        {campaign.sentAt && (
          <p className="text-sm text-gray-500">
            Sent on {new Date(campaign.sentAt).toLocaleString('en-GB')}
          </p>
        )}
      </div>

      {/* Recipient log */}
      {campaign.logs.length > 0 && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
            <p className="font-semibold text-gray-800">Recipient Log</p>
            <span className="text-sm text-gray-500">{campaign.logs.length} entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Guest</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-24">Channel</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {campaign.logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-700">{log.guestName ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{log.phone}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm">{log.channel === 'sms' ? '📱' : '💬'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {LOG_STATUS_ICON[log.status] ?? LOG_STATUS_ICON.queued}
                        <span className={`text-xs font-medium capitalize ${
                          log.status === 'delivered' ? 'text-green-600' :
                          log.status === 'failed'    ? 'text-red-500'   :
                          log.status === 'sent'      ? 'text-blue-500'  : 'text-gray-400'
                        }`}>{log.status}</span>
                      </div>
                      {log.errorMsg && (
                        <p className="text-xs text-red-400 text-center mt-0.5 truncate max-w-32">{log.errorMsg}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
