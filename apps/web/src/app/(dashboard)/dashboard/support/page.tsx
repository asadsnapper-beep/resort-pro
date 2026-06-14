'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi, ticketWebhooksApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Ticket, MessageSquare, Settings, X, Send, Link2,
  CheckCircle2, XCircle, Copy, Check, Trash2, ExternalLink,
} from 'lucide-react';
import type { SupportTicket } from '@resort-pro/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  LOW:    'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH:   'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

const SOURCE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  WEB:       { label: 'Web',       icon: '🌐', color: 'bg-gray-100 text-gray-600' },
  TELEGRAM:  { label: 'Telegram',  icon: '✈️', color: 'bg-sky-100 text-sky-700' },
  WHATSAPP:  { label: 'WhatsApp',  icon: '💬', color: 'bg-green-100 text-green-700' },
};

// ─── Channel Settings Modal ───────────────────────────────────────────────────

function ChannelSettingsModal({ onClose }: { onClose: () => void }) {
  const { toast: t } = toast ? { toast } : { toast: () => {} };
  const qc = useQueryClient();
  const [tab, setTab] = useState<'telegram' | 'whatsapp'>('telegram');
  const [botToken, setBotToken] = useState('');
  const [notifChatId, setNotifChatId] = useState('');
  const [copied, setCopied] = useState('');

  // Fetch current config
  const { data: tgRes } = useQuery({
    queryKey: ['ticket-webhook-telegram'],
    queryFn: () => ticketWebhooksApi.telegramInfo(),
  });
  const { data: waRes } = useQuery({
    queryKey: ['ticket-webhook-whatsapp'],
    queryFn: () => ticketWebhooksApi.whatsappInfo(),
  });

  const tgInfo = tgRes?.data?.data;
  const waInfo = waRes?.data?.data;

  const saveTelegram = useMutation({
    mutationFn: () => ticketWebhooksApi.telegramSetup({ botToken, notifChatId: notifChatId || undefined }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['ticket-webhook-telegram'] });
      const d = res.data?.data;
      toast({ title: `Telegram connected — @${d?.botUsername}` });
      setBotToken('');
      setNotifChatId('');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-resort-700 to-resort-600 rounded-t-2xl">
          <div className="flex items-center gap-2 text-white">
            <Link2 className="h-5 w-5" />
            <h2 className="text-base font-semibold">Channel Connections</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          {(['telegram', 'whatsapp'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? 'border-b-2 border-resort-600 text-resort-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'telegram' ? '✈️ Telegram' : '💬 WhatsApp'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {tab === 'telegram' && (
            <>
              <div className="rounded-xl bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-800 px-4 py-3 text-sm text-sky-700 dark:text-sky-400 space-y-1">
                <p className="font-semibold">How it works</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Create a Telegram bot via <strong>@BotFather</strong> → <code>/newbot</code></li>
                  <li>Copy the bot token and paste below</li>
                  <li>Guests message your bot → tickets auto-created here</li>
                  <li>Staff replies here → guest receives it on Telegram</li>
                </ol>
              </div>

              {tgInfo?.configured ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300">Telegram connected</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Bot token</span>
                      <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{tgInfo.tokenMasked}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-500 shrink-0">Webhook URL</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <code className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[220px]">{tgInfo.webhookUrl}</code>
                        <button onClick={() => handleCopy(tgInfo.webhookUrl, 'tg-url')} className="shrink-0 text-gray-400 hover:text-gray-600">
                          {copied === 'tg-url' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    {tgInfo.notifChatId && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Staff notify chat</span>
                        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{tgInfo.notifChatId}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => disconnectTelegram.mutate()} disabled={disconnectTelegram.isPending}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" /> Disconnect Telegram
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bot Token <span className="text-red-500">*</span></label>
                    <input value={botToken} onChange={(e) => setBotToken(e.target.value)}
                      placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm font-mono bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                    <p className="mt-1 text-xs text-gray-400">Get from @BotFather on Telegram</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Staff Notification Chat ID <span className="text-gray-400">(optional)</span></label>
                    <input value={notifChatId} onChange={(e) => setNotifChatId(e.target.value)}
                      placeholder="-100123456789 (group/channel chat_id)"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm font-mono bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-resort-500" />
                    <p className="mt-1 text-xs text-gray-400">New tickets will be announced here. Add bot to group first.</p>
                  </div>
                  <Button onClick={() => saveTelegram.mutate()} loading={saveTelegram.isPending} disabled={!botToken}
                    className="w-full">
                    Connect Telegram Bot
                  </Button>
                </div>
              )}
            </>
          )}

          {tab === 'whatsapp' && (
            <>
              <div className="rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400 space-y-1">
                <p className="font-semibold">How it works</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Configure WhatsApp Business API in <strong>Tenant Settings</strong></li>
                  <li>Register the webhook URL below in <strong>Meta Business Manager</strong></li>
                  <li>Use the verify token shown to validate the webhook</li>
                  <li>Guests message your WA number → tickets auto-created here</li>
                </ol>
              </div>

              {waInfo?.configured ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300">WhatsApp connected</p>
                  </div>
                  <p className="text-xs text-gray-500">Phone Number ID: <code className="text-gray-700 dark:text-gray-300">{waInfo.phoneNumberId}</code></p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-3 flex items-start gap-2 text-sm text-amber-700">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>WhatsApp not configured. Set it up in Tenant Settings first.</span>
                </div>
              )}

              {waInfo && (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Webhook URL</p>
                    <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
                      <code className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{waInfo.webhookUrl}</code>
                      <button onClick={() => handleCopy(waInfo.webhookUrl, 'wa-url')} className="shrink-0 text-gray-400 hover:text-gray-600">
                        {copied === 'wa-url' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Verify Token</p>
                    <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
                      <code className="text-xs text-gray-700 dark:text-gray-300 flex-1">{waInfo.verifyToken}</code>
                      <button onClick={() => handleCopy(waInfo.verifyToken, 'wa-token')} className="shrink-0 text-gray-400 hover:text-gray-600">
                        {copied === 'wa-token' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> Open Meta Business Manager
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 pb-5">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState('');
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
      // Update selected state so buttons reflect new status immediately
      if (selected) setSelected({ ...selected, status: status as SupportTicket['status'] });
      toast({ title: 'Ticket updated' });
    },
  });

  const sendMessage = useMutation({
    mutationFn: () => ticketsApi.addMessage(selected!.id, newMessage),
    onSuccess: () => {
      // Invalidate the specific ticket detail query so messages refresh
      queryClient.invalidateQueries({ queryKey: ['ticket', selected?.id] });
      setNewMessage('');
    },
    onError: (e: any) => toast({ title: e?.response?.data?.error ?? 'Failed to send message', variant: 'destructive' }),
  });

  const tickets: (SupportTicket & { guest?: { firstName: string; lastName: string }; _count?: { messages: number }; source?: string })[] = data?.data?.data || [];
  const detail = ticketDetail?.data?.data;

  const sourceCfg = SOURCE_CONFIG[(detail?.source ?? selected?.source ?? 'WEB') as string] ?? SOURCE_CONFIG.WEB;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guest Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage tickets and live chat</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setChannelSettingsOpen(true)}>
          <Link2 className="h-4 w-4" />
          Channels
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === s ? 'bg-resort-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {s.replace(/_/g, ' ') || 'All'}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Ticket List */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-200 animate-pulse" />)
          ) : tickets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Ticket className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-muted-foreground">No tickets found</p>
              </CardContent>
            </Card>
          ) : (
            tickets.map((ticket) => {
              const src = SOURCE_CONFIG[ticket.source ?? 'WEB'] ?? SOURCE_CONFIG.WEB;
              return (
                <Card
                  key={ticket.id}
                  className={`cursor-pointer hover:shadow-md transition-all ${selected?.id === ticket.id ? 'ring-2 ring-resort-500' : ''}`}
                  onClick={() => setSelected(ticket)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {/* Source badge */}
                          {ticket.source && ticket.source !== 'WEB' && (
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${src.color}`}>
                              {src.icon} {src.label}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold truncate">{ticket.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ticket.guest ? `${ticket.guest.firstName} ${ticket.guest.lastName}` : 'Internal'} · {formatDateTime(ticket.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={ticket.status} />
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                      </div>
                    </div>
                    {(ticket._count?.messages || 0) > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        {ticket._count?.messages} message{(ticket._count?.messages || 0) !== 1 ? 's' : ''}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Ticket Detail / Chat */}
        <div className="lg:col-span-3">
          {!selected ? (
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center h-64">
                <MessageSquare className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-sm text-muted-foreground">Select a ticket to view details</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col h-full">
              <CardHeader className="border-b pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-base">{detail?.title || selected.title}</CardTitle>
                      {/* Source pill in detail header */}
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${sourceCfg.color}`}>
                        {sourceCfg.icon} {sourceCfg.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{detail?.description || selected.description}</p>
                    {detail?.externalChatId && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {selected?.source === 'TELEGRAM' ? '🆔 Chat ID: ' : '📱 Phone: '}
                        <code>{detail.externalChatId}</code>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {selected.status === 'OPEN' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: selected.id, status: 'IN_PROGRESS' })}>
                        Start
                      </Button>
                    )}
                    {['OPEN', 'IN_PROGRESS'].includes(selected.status) && (
                      <Button size="sm" onClick={() => updateStatus.mutate({ id: selected.id, status: 'RESOLVED' })}>
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 p-4">
                {/* Messages */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-64 mb-4">
                  {detail?.messages?.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No messages yet</p>
                  ) : (
                    detail?.messages?.map((msg: Record<string, unknown>) => (
                      <div key={msg.id as string} className={`flex gap-2 ${msg.senderType === 'STAFF' ? 'flex-row-reverse' : ''}`}>
                        <div className={`max-w-xs rounded-xl px-3 py-2 text-sm ${
                          msg.senderType === 'STAFF'
                            ? 'bg-resort-600 text-white'
                            : msg.senderType === 'BOT'
                            ? 'bg-gray-50 border border-gray-200 text-gray-600 italic'
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <p>{msg.message as string}</p>
                          <p className={`mt-1 text-xs ${msg.senderType === 'STAFF' ? 'text-resort-200' : 'text-gray-400'}`}>
                            {(msg.sender as { firstName: string })?.firstName} · {formatDateTime(msg.createdAt as string)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Reply input — disabled for RESOLVED/CLOSED */}
                {['RESOLVED', 'CLOSED'].includes(selected.status) ? (
                  <div className="border-t pt-3 text-center text-xs text-muted-foreground">
                    Ticket is {selected.status.toLowerCase()} — reopen to reply
                  </div>
                ) : (
                  <div className="flex gap-2 border-t pt-4">
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
                        selected?.source === 'TELEGRAM' ? 'Reply via Telegram…' :
                        selected?.source === 'WHATSAPP' ? 'Reply via WhatsApp…' :
                        'Type a message…'
                      }
                      className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500"
                    />
                    <Button
                      onClick={() => newMessage.trim() && sendMessage.mutate()}
                      loading={sendMessage.isPending}
                      disabled={!newMessage.trim()}
                      className="gap-1.5"
                    >
                      <Send className="h-4 w-4" />
                      {selected?.source === 'TELEGRAM' ? 'Send via TG' :
                       selected?.source === 'WHATSAPP' ? 'Send via WA' : 'Send'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Channel Settings Modal */}
      {channelSettingsOpen && (
        <ChannelSettingsModal onClose={() => setChannelSettingsOpen(false)} />
      )}
    </div>
  );
}
