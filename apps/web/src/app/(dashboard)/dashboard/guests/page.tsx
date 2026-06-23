'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { guestsApi } from '@/lib/api';
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
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 350);
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
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Cannot delete guest', description: err?.response?.data?.error ?? 'Failed to delete', variant: 'destructive' }),
  });

  const guests: Guest[] = data?.data?.data ?? [];
  const pagination = data?.data?.pagination;
  const total = pagination?.total ?? 0;
  const nationalities = new Set(guests.filter(g => g.nationality).map(g => g.nationality)).size;
  const withPhone = guests.filter(g => g.phone).length;

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f]">Guests</h1>
          <p className="mt-[4px] text-[13px] text-[#7a9890]">
            {total > 0 ? `${total} guest${total !== 1 ? 's' : ''} registered` : 'Manage your guest profiles'}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80"
          style={{ background: 'var(--rp-btn-accent)' }}
        >
          <Plus className="h-[13px] w-[13px]" strokeWidth={2.5} />
          Add Guest
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Guests',   value: total,       icon: Users, bg: 'var(--rp-teal-bg)', color: '#23766a' },
          { label: 'With Phone',     value: withPhone,   icon: Phone, bg: 'var(--rp-amber-bg)', color: '#b89040' },
          { label: 'Nationalities',  value: nationalities, icon: Globe, bg: 'var(--rp-coral-bg)', color: '#b8724a' },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="flex items-center gap-[11px] rounded-[12px] border px-[18px] py-[15px] bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: bg }}>
              <Icon className="h-[14px] w-[14px]" strokeWidth={2} style={{ color }} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8aa29a]">{label}</div>
              <div className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#18231f]">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8aa29a]" />
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] py-[8px] pl-9 pr-4 text-[13px] text-[#18231f] placeholder:text-[#8aa29a] focus:outline-none focus:ring-1 focus:ring-resort-600/20"
        />
      </div>

      {/* Table */}
      <div className="rounded-[14px] border overflow-hidden bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="space-y-px">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[68px] animate-pulse" style={{ background: i % 2 === 0 ? 'var(--rp-surface-2)' : 'var(--rp-surface)' }} />
            ))}
          </div>
        ) : guests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f4f1]">
              <Users className="h-7 w-7 text-[#c5bdb4]" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium text-[#18231f]">{debouncedSearch ? 'No guests found' : 'No guests yet'}</p>
              <p className="mt-1 text-[13px] text-[#8aa29a]">{debouncedSearch ? 'Try a different search' : 'Add your first guest to get started'}</p>
            </div>
            {!debouncedSearch && (
              <button
                onClick={() => setAddOpen(true)}
                className="mt-1 flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#dfd9d0]"
                style={{ background: 'var(--rp-btn-accent)' }}
              >
                <Plus className="h-[13px] w-[13px]" /> Add Guest
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a]"
                  style={{ borderColor: 'var(--rp-border)', background: 'var(--rp-surface-2)' }}>
                  <th className="px-5 py-3 text-left">Guest</th>
                  <th className="px-5 py-3 text-left">Contact</th>
                  <th className="px-5 py-3 text-left">Nationality</th>
                  <th className="px-5 py-3 text-left">ID</th>
                  <th className="px-5 py-3 text-left">Added</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <tr
                    key={guest.id}
                    className="cursor-pointer border-b transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5"
                    style={{ borderColor: 'rgba(0,0,0,0.04)' }}
                    onClick={() => setSelectedGuest(guest)}
                  >
                    <td className="px-5 py-[14px]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#e3f2ef] text-[12px] font-semibold text-[#23766a]">
                          {getInitials(guest.firstName, guest.lastName)}
                        </div>
                        <div>
                          <p className="text-[13.5px] font-medium text-[#18231f]">{guest.firstName} {guest.lastName}</p>
                          {guest.notes && (
                            <p className="mt-px max-w-[160px] truncate text-[11.5px] text-[#b89040]">📝 {guest.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-[14px]">
                      <div className="flex items-center gap-1.5 text-[13px] text-[#18231f]">
                        <Mail className="h-3.5 w-3.5 text-[#8aa29a]" />{guest.email}
                      </div>
                      {guest.phone && (
                        <div className="mt-[3px] flex items-center gap-1.5 text-[11.5px] text-[#8aa29a]">
                          <Phone className="h-3 w-3" />{guest.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-[14px]">
                      {guest.nationality ? (
                        <div className="flex items-center gap-1.5 text-[13px] text-[#18231f]">
                          <Globe className="h-3.5 w-3.5 text-[#8aa29a]" />{guest.nationality}
                        </div>
                      ) : <span className="text-[#c5bdb4]">—</span>}
                    </td>
                    <td className="px-5 py-[14px]">
                      {guest.idType ? (
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#8aa29a]">{guest.idType.replace('_', ' ')}</p>
                          <p className="text-[13px] font-medium text-[#18231f]">{guest.idNumber ?? '—'}</p>
                        </div>
                      ) : <span className="text-[#c5bdb4]">—</span>}
                    </td>
                    <td className="px-5 py-[14px] text-[13px] text-[#8aa29a]">{formatDate(guest.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] text-[#8aa29a]">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 rounded-[8px] border px-4 py-[7px] text-[12.5px] font-medium transition-colors disabled:opacity-40 bg-white dark:bg-white/5" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text)' }}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              disabled={page === pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 rounded-[8px] border px-4 py-[7px] text-[12.5px] font-medium transition-colors disabled:opacity-40"
              style={{ background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
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
