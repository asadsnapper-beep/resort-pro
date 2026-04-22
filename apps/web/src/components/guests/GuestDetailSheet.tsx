'use client';

import { useQuery } from '@tanstack/react-query';
import { guestsApi } from '@/lib/api';
import { X, Mail, Phone, Globe, CreditCard, MapPin, FileText, Pencil, Trash2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

interface Props {
  guest: Guest | null;
  onClose: () => void;
  onEdit: (guest: Guest) => void;
  onDelete: (guest: Guest) => void;
}

export function GuestDetailSheet({ guest, onClose, onEdit, onDelete }: Props) {
  const { data } = useQuery({
    queryKey: ['guest', guest?.id],
    queryFn: () => guestsApi.get(guest!.id),
    enabled: !!guest?.id,
  });

  if (!guest) return null;

  const fullGuest = data?.data?.data ?? guest;
  const bookings: Record<string, unknown>[] = fullGuest.bookings ?? [];
  const totalSpend = bookings.reduce((sum: number, b: Record<string, unknown>) => sum + Number(b.totalAmount ?? 0), 0);
  const initials = getInitials(guest.firstName, guest.lastName);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-resort-100 text-lg font-bold text-resort-700">
              {initials}
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{guest.firstName} {guest.lastName}</h2>
              <p className="text-xs text-muted-foreground">Guest since {formatDate(guest.createdAt)}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* Stay Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Stays', value: bookings.length },
                { label: 'Total Spend', value: formatCurrency(totalSpend) },
                { label: 'Nationality', value: guest.nationality ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-gray-50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold truncate">{value}</p>
                </div>
              ))}
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Contact Details</h3>
              <div className="space-y-2.5">
                {[
                  { icon: Mail, label: guest.email },
                  { icon: Phone, label: guest.phone ?? '—' },
                  { icon: MapPin, label: guest.address ?? '—' },
                  { icon: Globe, label: guest.nationality ?? '—' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className={label === '—' ? 'text-muted-foreground' : 'text-gray-900'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ID Info */}
            {(guest.idType || guest.idNumber) && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-700">Identity</h3>
                <div className="rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{guest.idType?.replace('_', ' ')}</p>
                    <p className="text-sm font-medium">{guest.idNumber ?? '—'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {guest.notes && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Notes
                </h3>
                <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-lg p-3">{guest.notes}</p>
              </div>
            )}

            {/* Booking History */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> Booking History
              </h3>
              {bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                  No bookings yet
                </p>
              ) : (
                <div className="space-y-2">
                  {bookings.map((b) => (
                    <div key={b.id as string} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-resort-600">{b.confirmationNo as string}</span>
                        <StatusBadge status={b.status as string} />
                      </div>
                      <p className="text-sm font-medium">{(b.room as { name: string })?.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(b.checkIn as string)} → {formatDate(b.checkOut as string)}
                        </p>
                        <p className="text-xs font-semibold text-resort-700">{formatCurrency(Number(b.totalAmount))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t px-6 py-4">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => onEdit(guest)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="destructive" size="icon" onClick={() => onDelete(guest)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
