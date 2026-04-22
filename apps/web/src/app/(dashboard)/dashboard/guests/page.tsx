'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { guestsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmModal } from '@/components/ui/modal';
import { GuestModal } from '@/components/guests/GuestModal';
import { GuestDetailSheet } from '@/components/guests/GuestDetailSheet';
import { formatDate, getInitials } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, Users, Mail, Phone, Globe, ChevronLeft, ChevronRight } from 'lucide-react';

interface Guest {
  id: string; firstName: string; lastName: string; email: string;
  phone?: string; nationality?: string; idType?: string; idNumber?: string;
  address?: string; notes?: string; createdAt: string;
}

export default function GuestsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editGuest, setEditGuest] = useState<Guest | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [deleteGuest, setDeleteGuest] = useState<Guest | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout>;

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 350);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['guests', debouncedSearch, page],
    queryFn: () => guestsApi.list({ search: debouncedSearch || undefined, page, limit: 20 }),
  });

  const createMutation = useMutation({
    mutationFn: (d: unknown) => guestsApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['guests'] }); toast({ title: 'Guest added' }); setAddOpen(false); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to add guest', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => guestsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['guests'] }); toast({ title: 'Guest updated' }); setEditGuest(null); setSelectedGuest(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => guestsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['guests'] }); toast({ title: 'Guest deleted' }); setDeleteGuest(null); setSelectedGuest(null); },
    onError: () => toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }),
  });

  const guests: Guest[] = data?.data?.data ?? [];
  const pagination = data?.data?.pagination;
  const total = pagination?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guests</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total > 0 ? `${total} guest${total !== 1 ? 's' : ''} registered` : 'Manage your guest profiles'}</p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Guest</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Guests', value: total || 0, icon: Users, color: 'bg-resort-50 border-resort-200 text-resort-700' },
          { label: 'With Phone', value: guests.filter(g => g.phone).length, icon: Phone, color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Nationalities', value: new Set(guests.filter(g => g.nationality).map(g => g.nationality)).size, icon: Globe, color: 'bg-blue-50 border-blue-200 text-blue-700' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <div className="flex items-center gap-2 mb-1"><Icon className="h-4 w-4 opacity-70" /><p className="text-xs font-medium opacity-70">{label}</p></div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Search by name or email..." className="pl-9" />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-px">{[...Array(6)].map((_, i) => <div key={i} className="h-[68px] bg-gray-50 animate-pulse border-b" />)}</div>
          ) : guests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Users className="h-14 w-14 text-gray-200 mb-4" />
              <p className="font-medium text-gray-500">{debouncedSearch ? 'No guests found' : 'No guests yet'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{debouncedSearch ? 'Try a different search' : 'Add your first guest to get started'}</p>
              {!debouncedSearch && <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Guest</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Guest</th>
                    <th className="px-5 py-3 text-left">Contact</th>
                    <th className="px-5 py-3 text-left">Nationality</th>
                    <th className="px-5 py-3 text-left">ID</th>
                    <th className="px-5 py-3 text-left">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {guests.map((guest) => (
                    <tr key={guest.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedGuest(guest)}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-resort-100 text-sm font-bold text-resort-700">
                            {getInitials(guest.firstName, guest.lastName)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{guest.firstName} {guest.lastName}</p>
                            {guest.notes && <p className="text-xs text-amber-600 truncate max-w-[160px]">📝 {guest.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{guest.email}</div>
                        {guest.phone && <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5"><Phone className="h-3 w-3" />{guest.phone}</div>}
                      </td>
                      <td className="px-5 py-4">
                        {guest.nationality
                          ? <div className="flex items-center gap-1.5 text-sm"><Globe className="h-3.5 w-3.5 text-muted-foreground" />{guest.nationality}</div>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        {guest.idType
                          ? <div><p className="text-xs text-muted-foreground">{guest.idType.replace('_', ' ')}</p><p className="text-sm font-medium">{guest.idNumber ?? '—'}</p></div>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(guest.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Previous</Button>
            <Button variant="outline" size="sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)} className="gap-1">Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <GuestModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={(d) => createMutation.mutate(d)} />
      <GuestModal open={!!editGuest} onClose={() => setEditGuest(null)} guest={editGuest} loading={updateMutation.isPending} onSubmit={(d) => editGuest && updateMutation.mutate({ id: editGuest.id, data: d })} />
      <GuestDetailSheet guest={selectedGuest} onClose={() => setSelectedGuest(null)} onEdit={(g) => { setEditGuest(g); setSelectedGuest(null); }} onDelete={(g) => setDeleteGuest(g)} />
      <ConfirmModal open={!!deleteGuest} onClose={() => setDeleteGuest(null)} onConfirm={() => deleteGuest && deleteMutation.mutate(deleteGuest.id)} loading={deleteMutation.isPending} title="Delete Guest" description={`Are you sure you want to delete ${deleteGuest?.firstName} ${deleteGuest?.lastName}? This cannot be undone.`} />
    </div>
  );
}
