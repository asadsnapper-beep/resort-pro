'use client';

import { ModalShell } from '@/components/ui/modal-shell';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi, ticketWebhooksApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Ticket, MessageSquare, Send, Link2,
  CheckCircle2, XCircle, Copy, Check, Trash2, ExternalLink, Loader2,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';
import type { SupportTicket } from '@resort-pro/types';

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIORITY_META: Record<string, { bg: string; border: string; text: string }> = {
  LOW:    { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)' },
  MEDIUM: { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  HIGH:   { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a' },
  URGENT: { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c' },
};

const STATUS_META: Record<string, { bg: string; border: string; text: string; label: string }> = {
  OPEN:        { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a', label: 'Open' },
  IN_PROGRESS: { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'In Progress' },
  RESOLVED:    { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', label: 'Resolved' },
  CLOSED:      { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-faint)', label: 'Closed' },
};

const SOURCE_META: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  WEB:      { label: 'Web',      icon: '🌐', bg: 'var(--rp-surface-3)', text: 'var(--rp-text-muted)',  border: 'var(--rp-border-md)' },
  TELEGRAM: { label: 'Telegram', icon: '✈️', bg: 'var(--rp-teal-bg)', text: '#23766a',  border: 'rgba(35,118,106,0.2)' },
  WHATSAPP: { label: 'WhatsApp', icon: '💬', bg: 'var(--rp-teal-bg)', text: 'var(--rp-text-accent)',  border: 'rgba(35,118,106,0.15)' },
};

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.OPEN;
  return (
    <span className="rounded-[7px] border px-[8px] py-[3px] text-[11px] font-semibold"
      style={{ background: m.bg, borderColor: m.border, color: m.text }}>{m.label}</span>
  );
}

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';
const codeCls  = 'rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-2 font-mono text-[12px] text-[#18231f]';

// ── Channel Settings Modal ────────────────────────────────────────────────────
function ChannelSettingsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab]               = useState<'telegram' | 'whatsapp'>('telegram');
  const [botToken, setBotToken]     = useState('');
  const [notifChatId, setNotifChatId] = useState('');
  const [copied, setCopied]         = useState('');

  const { data: tgRes } = useQuery({ queryKey: ['ticket-webhook-telegram'], queryFn: () => ticketWebhooksApi.telegramInfo() });
  const { data: waRes } = useQuery({ queryKey: ['ticket-webhook-whatsapp'], queryFn: () => ticketWebhooksApi.whatsappInfo() });
  const tgInfo = tgRes?.data?.data;
  const waInfo = waRes?.data?.data;

  const saveTelegram = useMutation({
    mutationFn: () => ticketWebhooksApi.telegramSetup({ botToken, notifChatId: notifChatId || undefined }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['ticket-webhook-telegram'] });
      const d = res.data?.data;
      toast({ title: `Telegram connected — @${d?.botUsername}` });
      setBotToken(''); setNotifChatId('');
    },
    onError: (e: any) => toast({ title: e?.response?.data?.error ?? 'Failed to connect Telegram', variant: 'destructive' }),
  });

  const disconnectTelegram = useMutation({
    mutationFn: () => ticketWebhooksApi.telegramDisconnect(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket-webhook-telegram'] }); toast({ title: 'Telegram disconnected' }); },
    onError: () => toast({ title: 'Failed to disconnect', variant: 'destructive' }),
  });

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="Channel Connections"
      maxWidth="520px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            className="rounded-[9px] border px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex border-b -mt-2" style={{ borderColor: 'var(--rp-border)' }}>
          {(['telegram', 'whatsapp'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-3 text-[13px] font-medium transition-colors"
              style={tab === t
                ? { borderBottom: '2px solid #23766a', color: '#23766a' }
                : { color: 'var(--rp-text-muted)' }}>
              {t === 'telegram' ? '✈️ Telegram' : '💬 WhatsApp'}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {tab === 'telegram' && (
            <>
              {/* How it works */}
              <div className="rounded-[12px] border px-4 py-3 space-y-1"
                style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }}>
                <p className="text-[12.5px] font-semibold" style={{ color: '#1b342f' }}>How it works</p>
                <ol className="list-decimal list-inside space-y-1 text-[12px]" style={{ color: '#23766a' }}>
                  <li>Create a Telegram bot via <strong>@BotFather</strong> → <code>/newbot</code></li>
                  <li>Copy the bot token and paste below</li>
                  <li>Guests message your bot → tickets auto-created here</li>
                  <li>Staff replies here → guest receives it on Telegram</li>
                </ol>
              </div>

              {tgInfo?.configured ? (
                <div className="rounded-[12px] border p-4 space-y-3"
                  style={{ background: 'var(--rp-teal-soft)', borderColor: 'rgba(35,118,106,0.2)' }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#23766a' }} />
                    <p className="text-[13px] font-semibold" style={{ color: '#1b342f' }}>Telegram connected</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span style={{ color: 'var(--rp-text-muted)' }}>Bot token</span>
                      <code style={{ color: 'var(--rp-text)' }}>{tgInfo.tokenMasked}</code>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="shrink-0 text-[#8aa29a] dark:text-[#94b8b0]">Webhook URL</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <code className="truncate max-w-[200px] text-[#18231f] dark:text-[#dfd9d0]">{tgInfo.webhookUrl}</code>
                        <button onClick={() => handleCopy(tgInfo.webhookUrl, 'tg-url')}
                          className="shrink-0 transition-colors hover:opacity-70 text-[#8aa29a] dark:text-[#94b8b0]">
                          {copied === 'tg-url' ? <Check className="h-3.5 w-3.5" style={{ color: '#23766a' }} /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    {tgInfo.notifChatId && (
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span style={{ color: 'var(--rp-text-muted)' }}>Staff notify chat</span>
                        <code style={{ color: 'var(--rp-text)' }}>{tgInfo.notifChatId}</code>
                      </div>
                    )}
                  </div>
                  <button onClick={() => disconnectTelegram.mutate()} disabled={disconnectTelegram.isPending}
                    className="flex items-center gap-1.5 text-[12px] font-medium transition-colors hover:opacity-70 disabled:opacity-50"
                    style={{ color: '#c43c3c' }}>
                    <Trash2 className="h-3.5 w-3.5" /> Disconnect Telegram
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Bot Token *</label>
                    <input value={botToken} onChange={(e) => setBotToken(e.target.value)}
                      placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                      className={inputCls + ' font-mono'} />
                    <p className="mt-1 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">Get from @BotFather on Telegram</p>
                  </div>
                  <div>
                    <label className={labelCls}>Staff Notification Chat ID <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
                    <input value={notifChatId} onChange={(e) => setNotifChatId(e.target.value)}
                      placeholder="-100123456789 (group/channel chat_id)"
                      className={inputCls + ' font-mono'} />
                    <p className="mt-1 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">New tickets will be announced here. Add bot to group first.</p>
                  </div>
                  <button onClick={() => saveTelegram.mutate()} disabled={saveTelegram.isPending || !botToken}
                    className="w-full flex items-center justify-center gap-2 rounded-[9px] py-2.5 text-[13px] font-medium transition-colors disabled:opacity-50"
                    style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                    {saveTelegram.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Connect Telegram Bot
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'whatsapp' && (
            <>
              <div className="rounded-[12px] border px-4 py-3 space-y-1"
                style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)' }}>
                <p className="text-[12.5px] font-semibold" style={{ color: '#1b342f' }}>How it works</p>
                <ol className="list-decimal list-inside space-y-1 text-[12px]" style={{ color: '#23766a' }}>
                  <li>Configure WhatsApp Business API in <strong>Tenant Settings</strong></li>
                  <li>Register the webhook URL below in <strong>Meta Business Manager</strong></li>
                  <li>Use the verify token shown to validate the webhook</li>
                  <li>Guests message your WA number → tickets auto-created here</li>
                </ol>
              </div>

              {waInfo?.configured ? (
                <div className="rounded-[12px] border p-4 space-y-2"
                  style={{ background: 'var(--rp-teal-soft)', borderColor: 'rgba(35,118,106,0.2)' }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#23766a' }} />
                    <p className="text-[13px] font-semibold" style={{ color: '#1b342f' }}>WhatsApp connected</p>
                  </div>
                  <p className="text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
                    Phone Number ID: <code style={{ color: 'var(--rp-text)' }}>{waInfo.phoneNumberId}</code>
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-[12px] border px-4 py-3"
                  style={{ background: 'var(--rp-amber-bg)', borderColor: 'rgba(184,144,64,0.22)' }}>
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#b89040' }} />
                  <span className="text-[12.5px]" style={{ color: '#7a5c2a' }}>
                    WhatsApp not configured. Set it up in Tenant Settings first.
                  </span>
                </div>
              )}

              {waInfo && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-1.5">Webhook URL</p>
                    <div className={codeCls + ' flex items-center gap-2'}>
                      <span className="flex-1 truncate">{waInfo.webhookUrl}</span>
                      <button onClick={() => handleCopy(waInfo.webhookUrl, 'wa-url')}
                        className="shrink-0 transition-colors hover:opacity-70 text-[#8aa29a] dark:text-[#94b8b0]">
                        {copied === 'wa-url' ? <Check className="h-3.5 w-3.5" style={{ color: '#23766a' }} /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a] mb-1.5">Verify Token</p>
                    <div className={codeCls + ' flex items-center gap-2'}>
                      <span className="flex-1">{waInfo.verifyToken}</span>
                      <button onClick={() => handleCopy(waInfo.verifyToken, 'wa-token')}
                        className="shrink-0 transition-colors hover:opacity-70 text-[#8aa29a] dark:text-[#94b8b0]">
                        {copied === 'wa-token' ? <Check className="h-3.5 w-3.5" style={{ color: '#23766a' }} /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12.5px] font-medium hover:underline" style={{ color: '#23766a' }}>
                    <ExternalLink className="h-3.5 w-3.5" /> Open Meta Business Manager
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SupportPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter]         = useState('');
  const [selected, setSelected]                 = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage]             = useState('');
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', statusFilter],
    queryFn: () => ticketsApi.list({ status: statusFilter || undefined }),
  });

  const { data: ticketDetail } = useQuery({
    queryKey: ['ticket', selected?.id],
    queryFn: () => ticketsApi.get(selected!.id),
    enabled: !!selected,
    refetchInterval: 5000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => ticketsApi.updateStatus(id, status),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', selected?.id] });
      if (selected) setSelected({ ...selected, status: status as SupportTicket['status'] });
      toast({ title: 'Ticket updated' });
    },
  });

  const sendMessage = useMutation({
    mutationFn: () => ticketsApi.addMessage(selected!.id, newMessage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', selected?.id] });
      setNewMessage('');
    },
    onError: (e: any) => toast({ title: e?.response?.data?.error ?? 'Failed to send message', variant: 'destructive' }),
  });

  type ExtTicket = SupportTicket & { guest?: { firstName: string; lastName: string }; _count?: { messages: number }; source?: string };
  const tickets: ExtTicket[] = data?.data?.data || [];
  const detail = ticketDetail?.data?.data;
  const sel = selected as ExtTicket | null;
  const srcCfg = SOURCE_META[(detail?.source ?? sel?.source ?? 'WEB') as string] ?? SOURCE_META.WEB;

  const STATUS_FILTERS = ['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  return (
    <PageShell gap={6}>
      {/* Header */}
      <PageHeader
        title="Guest Support"
        subtitle="Manage tickets and live chat across all channels"
        align="center"
        actions={
          <button onClick={() => setChannelSettingsOpen(true)}
            className="flex items-center gap-2 rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            <Link2 className="h-4 w-4" /> Channels
          </button>
        }
      />

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button key={s || 'all'} onClick={() => setStatusFilter(s)}
            className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
            style={statusFilter === s
              ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
              : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
            {STATUS_META[s]?.label ?? 'All'}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Ticket list */}
        <div className="lg:col-span-2 space-y-2">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-[14px] animate-pulse" style={{ background: 'var(--rp-surface-4)' }} />
            ))
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-[14px] border bg-white gap-3"
              style={{ borderColor: 'var(--rp-border)' }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-teal-bg)' }}>
                <Ticket className="h-7 w-7" style={{ color: '#23766a' }} />
              </div>
              <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">No tickets found</p>
            </div>
          ) : (
            tickets.map((ticket) => {
              const src = SOURCE_META[ticket.source ?? 'WEB'] ?? SOURCE_META.WEB;
              const pri = PRIORITY_META[ticket.priority] ?? PRIORITY_META.LOW;
              const isActive = selected?.id === ticket.id;
              return (
                <div key={ticket.id}
                  className="rounded-[14px] border bg-white p-4 cursor-pointer transition-all hover:shadow-md"
                  style={{
                    borderColor: isActive ? '#23766a' : 'var(--rp-border)',
                    boxShadow: isActive ? '0 0 0 2px rgba(35,118,106,0.2)' : '0 1px 6px rgba(0,0,0,0.04)',
                  }}
                  onClick={() => setSelected(ticket)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {ticket.source && ticket.source !== 'WEB' && (
                          <span className="rounded-[6px] border px-[7px] py-[2px] text-[10.5px] font-semibold"
                            style={{ background: src.bg, borderColor: src.border, color: src.text }}>
                            {src.icon} {src.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-semibold truncate text-[#18231f] dark:text-[#dfd9d0]">{ticket.title}</p>
                      <p className="text-[11.5px] mt-0.5 text-[#8aa29a] dark:text-[#94b8b0]">
                        {ticket.guest ? `${ticket.guest.firstName} ${ticket.guest.lastName}` : 'Internal'} · {formatDateTime(ticket.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusPill status={ticket.status} />
                      <span className="rounded-[6px] border px-[7px] py-[2px] text-[10.5px] font-semibold"
                        style={{ background: pri.bg, borderColor: pri.border, color: pri.text }}>
                        {ticket.priority}
                      </span>
                    </div>
                  </div>
                  {(ticket._count?.messages || 0) > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">
                      <MessageSquare className="h-3 w-3" />
                      {ticket._count?.messages} message{(ticket._count?.messages || 0) !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Ticket detail / chat */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-[14px] border bg-white gap-3"
              style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-teal-bg)' }}>
                <MessageSquare className="h-7 w-7" style={{ color: '#23766a' }} />
              </div>
              <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">Select a ticket to view details</p>
            </div>
          ) : (
            <div className="flex flex-col rounded-[14px] border bg-white overflow-hidden"
              style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>

              {/* Detail header */}
              <div className="border-b p-5" style={{ borderColor: 'var(--rp-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h2 className="text-[15px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">
                        {detail?.title || selected.title}
                      </h2>
                      <span className="rounded-[6px] border px-[7px] py-[2px] text-[10.5px] font-semibold"
                        style={{ background: srcCfg.bg, borderColor: srcCfg.border, color: srcCfg.text }}>
                        {srcCfg.icon} {srcCfg.label}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">{detail?.description || selected.description}</p>
                    {detail?.externalChatId && (
                      <p className="mt-1 text-[12px] text-[#8aa29a] dark:text-[#94b8b0]">
                        {sel?.source === 'TELEGRAM' ? '🆔 Chat ID: ' : '📱 Phone: '}
                        <code style={{ color: 'var(--rp-text)' }}>{detail.externalChatId}</code>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {selected.status === 'OPEN' && (
                      <button onClick={() => updateStatus.mutate({ id: selected.id, status: 'IN_PROGRESS' })}
                        className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[#f4f1eb]"
                        style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
                        Start
                      </button>
                    )}
                    {['OPEN', 'IN_PROGRESS'].includes(selected.status) && (
                      <button onClick={() => updateStatus.mutate({ id: selected.id, status: 'RESOLVED' })}
                        className="rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors"
                        style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-72 p-4">
                {detail?.messages?.length === 0 ? (
                  <p className="text-center text-[12.5px] py-8 text-[#8aa29a] dark:text-[#94b8b0]">No messages yet</p>
                ) : (
                  detail?.messages?.map((msg: Record<string, unknown>) => (
                    <div key={msg.id as string} className={`flex gap-2 ${msg.senderType === 'STAFF' ? 'flex-row-reverse' : ''}`}>
                      <div className="max-w-xs rounded-[12px] px-3 py-2.5"
                        style={msg.senderType === 'STAFF'
                          ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }
                          : msg.senderType === 'BOT'
                          ? { background: 'var(--rp-surface-2)', border: '1px solid rgba(0,0,0,0.06)', color: 'var(--rp-text-muted)', fontStyle: 'italic' }
                          : { background: 'var(--rp-surface-3)', color: 'var(--rp-text)' }}>
                        <p className="text-[13px]">{msg.message as string}</p>
                        <p className="mt-1 text-[11px]"
                          style={{ color: msg.senderType === 'STAFF' ? 'rgba(255,255,255,0.5)' : 'var(--rp-text-muted)' }}>
                          {(msg.sender as { firstName: string })?.firstName} · {formatDateTime(msg.createdAt as string)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply input */}
              {['RESOLVED', 'CLOSED'].includes(selected.status) ? (
                <div className="border-t px-4 py-3 text-center text-[12.5px]"
                  style={{ borderColor: 'var(--rp-border)', color: 'var(--rp-text-muted)' }}>
                  Ticket is {selected.status.toLowerCase()} — reopen to reply
                </div>
              ) : (
                <div className="flex gap-2 border-t p-4" style={{ borderColor: 'var(--rp-border)' }}>
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && newMessage.trim()) {
                        e.preventDefault();
                        sendMessage.mutate();
                      }
                    }}
                    placeholder={
                      sel?.source === 'TELEGRAM' ? 'Reply via Telegram…' :
                      sel?.source === 'WHATSAPP' ? 'Reply via WhatsApp…' :
                      'Type a message…'
                    }
                    className="flex-1 rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30"
                  />
                  <button
                    onClick={() => newMessage.trim() && sendMessage.mutate()}
                    disabled={!newMessage.trim() || sendMessage.isPending}
                    className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
                    style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
                    {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sel?.source === 'TELEGRAM' ? 'TG' : sel?.source === 'WHATSAPP' ? 'WA' : 'Send'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {channelSettingsOpen && (
        <ChannelSettingsModal onClose={() => setChannelSettingsOpen(false)} />
      )}
    </PageShell>
  );
}
