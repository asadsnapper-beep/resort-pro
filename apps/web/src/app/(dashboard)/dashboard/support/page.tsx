'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Ticket, MessageSquare } from 'lucide-react';
import type { SupportTicket } from '@resort-pro/types';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

export default function SupportPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState('');

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets'] }); toast({ title: 'Ticket updated' }); },
  });

  const sendMessage = useMutation({
    mutationFn: () => ticketsApi.addMessage(selected!.id, newMessage),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ticket'] }); setNewMessage(''); },
    onError: () => toast({ title: 'Failed to send message', variant: 'destructive' }),
  });

  const tickets: (SupportTicket & { guest?: { firstName: string; lastName: string }; _count?: { messages: number } })[] = data?.data?.data || [];
  const detail = ticketDetail?.data?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guest Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage tickets and live chat</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
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
            tickets.map((ticket) => (
              <Card
                key={ticket.id}
                className={`cursor-pointer hover:shadow-md transition-all ${selected?.id === ticket.id ? 'ring-2 ring-resort-500' : ''}`}
                onClick={() => setSelected(ticket)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
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
            ))
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
                    <CardTitle className="text-base">{detail?.title || selected.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{detail?.description || selected.description}</p>
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
                          msg.senderType === 'STAFF' ? 'bg-resort-600 text-white' : 'bg-gray-100 text-gray-900'
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

                {/* Reply */}
                <div className="flex gap-2 border-t pt-4">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && newMessage.trim() && sendMessage.mutate()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500"
                  />
                  <Button onClick={() => newMessage.trim() && sendMessage.mutate()} loading={sendMessage.isPending}>
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
