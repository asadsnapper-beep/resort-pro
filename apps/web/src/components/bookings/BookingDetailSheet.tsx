'use client';

'use client';

import { useState } from 'react';
import {
  X, CalendarDays, Users, CreditCard, BedDouble, MessageSquare,
  XCircle, LogIn, LogOut, Plus, Link2, CheckCircle2, Clock, AlertTriangle,
  FileText, Gift, Trash2, ChevronDown, ChevronUp, Check, ExternalLink, ScanLine,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, bookingPaymentApi, packagesApi, guestsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { IdScanModal, type ScannedFields } from '@/components/guests/IdScanModal';
import { PrintReceiptButton } from '@/components/bookings/PrintReceiptButton';

interface Booking {
  id: string;
  confirmationNo: string;
  status: string;
  paymentStatus: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalAmount: number;
  paidAmount: number;
  specialRequests?: string;
  notes?: string;
  createdAt: string;
  actualCheckIn?: string | null;
  actualCheckOut?: string | null;
  guest: { id?: string; firstName: string; lastName: string; email: string; phone?: string };
  room: { number: string; name: string; type: string };
  payments?: { amount: number; method: string; status: string; processedAt: string; reference?: string }[];
}

interface Props {
  booking: Booking | null;
  onClose: () => void;
}

const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE'];

// ── Confirmation Modal ──────────────────────────────────────────────────────

function ConfirmModal({
  type,
  booking,
  onConfirm,
  onCancel,
  loading,
}: {
  type: 'checkin' | 'checkout';
  booking: Booking;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const nights = Math.ceil(
    (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86_400_000
  );
  const outstanding = Number(booking.totalAmount) - Number(booking.paidAmount);

  // Check-in date mismatch detection
  const todayStr = new Date().toISOString().slice(0, 10);
  const scheduledCheckIn = booking.checkIn.slice(0, 10);
  const daysDiff = Math.round(
    (new Date(scheduledCheckIn).getTime() - new Date(todayStr).getTime()) / 86_400_000
  );
  const isEarlyCheckIn = daysDiff > 0;
  const isLateCheckIn  = daysDiff < 0;

  if (type === 'checkin') {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 px-5 py-4 border-b border-emerald-100 dark:border-emerald-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
                <LogIn className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Confirm Check-In</p>
                <p className="text-xs text-gray-500">This will assign the room and mark guest as arrived</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Guest</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {booking.guest.firstName} {booking.guest.lastName}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Room</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                #{booking.room.number} — {booking.room.name}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Stay</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)} ({nights} nights)
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Guests</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {booking.adults} adult{booking.adults !== 1 ? 's' : ''}
                {booking.children > 0 ? ` + ${booking.children} child` : ''}
              </span>
            </div>

            {/* Date mismatch warning */}
            {isEarlyCheckIn && (
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  <strong>Early check-in:</strong> Scheduled arrival is {daysDiff} day{daysDiff > 1 ? 's' : ''} from now ({formatDate(booking.checkIn)}).
                </p>
              </div>
            )}
            {isLateCheckIn && (
              <div className="flex items-start gap-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700 dark:text-orange-400">
                  <strong>Late check-in:</strong> Scheduled arrival was {Math.abs(daysDiff)} day{Math.abs(daysDiff) > 1 ? 's' : ''} ago ({formatDate(booking.checkIn)}).
                </p>
              </div>
            )}

            {outstanding > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Outstanding balance: <strong>{formatCurrency(outstanding)}</strong>
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Clock className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {loading ? 'Checking in…' : 'Check In Guest'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Checkout modal
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 px-5 py-4 border-b border-indigo-100 dark:border-indigo-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center">
              <LogOut className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Confirm Check-Out</p>
              <p className="text-xs text-gray-500">Room will be sent to housekeeping</p>
            </div>
          </div>
        </div>

        {/* Cost summary */}
        <div className="p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Stay Summary</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                {booking.room.name} × {nights} nights
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(Number(booking.totalAmount))}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Amount paid</span>
              <span className="font-medium text-emerald-600">
                − {formatCurrency(Number(booking.paidAmount))}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between">
            <span className="font-semibold text-gray-900 dark:text-white">Balance Due</span>
            <span className={cn(
              'font-bold text-base',
              outstanding > 0 ? 'text-red-600' : 'text-emerald-600'
            )}>
              {outstanding > 0 ? formatCurrency(outstanding) : '✓ Fully Paid'}
            </span>
          </div>

          {outstanding > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">
                Collect payment before checking out
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Clock className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {loading ? 'Checking out…' : 'Check Out'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Packages Section ──────────────────────────────────────────────────────────

function PackagesSection({ booking }: { booking: Booking }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const nights = Math.max(
    1,
    Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86_400_000),
  );

  // Applied packages on this booking
  const { data: appliedRes, isLoading: loadingApplied } = useQuery({
    queryKey: ['booking-packages', booking.id],
    queryFn: () => packagesApi.getForBooking(booking.id),
  });

  // All available packages
  const { data: allRes } = useQuery({
    queryKey: ['packages'],
    queryFn: () => packagesApi.list(),
    enabled: showAdd,
  });

  const applied: any[] = appliedRes?.data?.data ?? [];
  const all: any[] = allRes?.data?.data ?? [];
  const appliedIds = new Set(applied.map((a: any) => a.packageId));
  const available = all.filter((p: any) => p.isActive && !appliedIds.has(p.id));

  const applyMut = useMutation({
    mutationFn: (packageId: string) => packagesApi.apply(booking.id, packageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking-packages', booking.id] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Package added to booking' });
    },
    onError: () => toast({ title: 'Failed to add package', variant: 'destructive' }),
  });

  const removeMut = useMutation({
    mutationFn: (packageId: string) => packagesApi.remove(booking.id, packageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking-packages', booking.id] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Package removed' });
    },
    onError: () => toast({ title: 'Failed to remove package', variant: 'destructive' }),
  });

  const canEdit = !['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(booking.status);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <Gift className="h-4 w-4 text-resort-600" />
          Packages
          {applied.length > 0 && (
            <span className="ml-1 rounded-full bg-resort-100 dark:bg-resort-900/30 px-1.5 py-0.5 text-xs font-bold text-resort-700 dark:text-resort-400">
              {applied.length}
            </span>
          )}
        </h3>
        {canEdit && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 text-xs text-resort-600 hover:text-resort-700 font-medium"
          >
            {showAdd ? <><ChevronUp className="h-3.5 w-3.5" /> Close</> : <><Plus className="h-3.5 w-3.5" /> Add</>}
          </button>
        )}
      </div>

      {/* Applied packages */}
      {loadingApplied ? (
        <div className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      ) : applied.length === 0 && !showAdd ? (
        <p className="text-xs text-muted-foreground py-2">No packages added yet.</p>
      ) : (
        <div className="space-y-2">
          {applied.map((bp: any) => {
            const cost = bp.priceType === 'PER_NIGHT' ? bp.price * bp.nights : bp.price;
            return (
              <div key={bp.id} className="flex items-center justify-between rounded-lg border border-resort-100 dark:border-resort-800 bg-resort-50 dark:bg-resort-900/10 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{bp.packageName}</p>
                  <p className="text-xs text-resort-600 dark:text-resort-400">
                    +{formatCurrency(cost)}
                    {bp.priceType === 'PER_NIGHT' ? ` (${formatCurrency(bp.price)}/night × ${bp.nights}n)` : ' flat rate'}
                  </p>
                  {bp.package?.inclusions?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {bp.package.inclusions.slice(0, 3).map((inc: string, i: number) => (
                        <span key={i} className="text-xs text-gray-500 flex items-center gap-0.5">
                          <Check className="h-2.5 w-2.5 text-emerald-500" />{inc}
                        </span>
                      ))}
                      {bp.package.inclusions.length > 3 && (
                        <span className="text-xs text-gray-400">+{bp.package.inclusions.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => removeMut.mutate(bp.packageId)}
                    disabled={removeMut.isPending}
                    className="ml-2 p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add package panel */}
      {showAdd && (
        <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
            Available Packages
          </div>
          {available.length === 0 ? (
            <p className="px-3 py-4 text-xs text-center text-muted-foreground">
              {all.length === 0 ? 'No packages created yet.' : 'All packages already added.'}
            </p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {available.map((pkg: any) => {
                const cost = pkg.priceType === 'PER_NIGHT' ? pkg.price * nights : pkg.price;
                return (
                  <div key={pkg.id} className="flex items-start justify-between gap-3 px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{pkg.name}</p>
                      <p className="text-xs text-muted-foreground">
                        +{formatCurrency(cost)}
                        {pkg.priceType === 'PER_NIGHT' ? ` (${formatCurrency(pkg.price)}/night)` : ' per stay'}
                      </p>
                      {pkg.inclusions.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {pkg.inclusions.slice(0, 2).join(' · ')}{pkg.inclusions.length > 2 ? ` +${pkg.inclusions.length - 2}` : ''}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => applyMut.mutate(pkg.id)}
                      disabled={applyMut.isPending}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-resort-600 text-white hover:bg-resort-700 transition-colors disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BookingDetailSheet({ booking, onClose }: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [confirmModal, setConfirmModal] = useState<'checkin' | 'checkout' | null>(null);
  const [showIdScan,   setShowIdScan]   = useState(false);

  const checkInMutation = useMutation({
    mutationFn: () => bookingsApi.checkIn(booking!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['today'] });
      toast({ title: '✅ Guest checked in!', description: `${booking?.guest.firstName} is now in Room ${booking?.room.number}` });
      setConfirmModal(null);
      onClose();
    },
    onError: () => toast({ title: 'Check-in failed', variant: 'destructive' }),
  });

  const checkOutMutation = useMutation({
    mutationFn: () => bookingsApi.checkOut(booking!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['today'] });
      toast({ title: '✅ Guest checked out', description: 'Room sent to housekeeping.' });
      setConfirmModal(null);
      onClose();
    },
    onError: () => toast({ title: 'Check-out failed', variant: 'destructive' }),
  });

  const cancel = useMutation({
    mutationFn: () => bookingsApi.cancel(booking!.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bookings'] }); toast({ title: 'Booking cancelled' }); onClose(); },
    onError: () => toast({ title: 'Cancel failed', variant: 'destructive' }),
  });

  const addPayment = useMutation({
    mutationFn: () => bookingsApi.addPayment(booking!.id, { amount: Number(payAmount), method: payMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: `Payment of ${formatCurrency(Number(payAmount))} recorded` });
      setShowPayment(false); setPayAmount('');
    },
    onError: () => toast({ title: 'Payment failed', variant: 'destructive' }),
  });

  const sendPaymentLink = useMutation({
    mutationFn: () => bookingPaymentApi.createPaymentLink(booking!.id),
    onSuccess: (res) => {
      const { url, amount } = res.data.data;
      toast({ title: 'Payment link sent!', description: `Guest link for ${formatCurrency(amount)} copied to clipboard.` });
      navigator.clipboard.writeText(url).catch(() => {});
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.response?.data?.error || 'Failed to generate link', variant: 'destructive' });
    },
  });

  if (!booking) return null;

  const nights = Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86_400_000);
  const outstanding = Number(booking.totalAmount) - Number(booking.paidAmount);
  const paymentPct = Math.min(100, Math.round((Number(booking.paidAmount) / Number(booking.totalAmount)) * 100));

  // Status timeline
  const isCheckedIn  = booking.status === 'CHECKED_IN';
  const isCheckedOut = booking.status === 'CHECKED_OUT';
  const isConfirmed  = booking.status === 'CONFIRMED';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white dark:bg-gray-900 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <div>
            <p className="font-mono text-sm font-bold text-resort-600">{booking.confirmationNo}</p>
            <p className="text-xs text-gray-400">Created {formatDate(booking.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={booking.status} />
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* Status timeline */}
            <div className="flex items-center gap-1 text-xs">
              {[
                { label: 'Booked', done: true },
                { label: 'Confirmed', done: isConfirmed || isCheckedIn || isCheckedOut },
                { label: 'Checked In', done: isCheckedIn || isCheckedOut },
                { label: 'Checked Out', done: isCheckedOut },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center gap-1">
                  <div className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-full font-medium',
                    step.done
                      ? 'bg-resort-100 dark:bg-resort-900/30 text-resort-700 dark:text-resort-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  )}>
                    {step.done && <CheckCircle2 className="w-3 h-3" />}
                    {step.label}
                  </div>
                  {i < arr.length - 1 && <div className={cn('h-px w-3', step.done ? 'bg-resort-300' : 'bg-gray-200')} />}
                </div>
              ))}
            </div>

            {/* Actual timestamps */}
            {(booking.actualCheckIn || booking.actualCheckOut) && (
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {booking.actualCheckIn && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-gray-500 flex items-center gap-1"><LogIn className="w-3.5 h-3.5" /> Actual check-in</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(booking.actualCheckIn).toLocaleString()}
                    </span>
                  </div>
                )}
                {booking.actualCheckOut && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-gray-500 flex items-center gap-1"><LogOut className="w-3.5 h-3.5" /> Actual check-out</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(booking.actualCheckOut).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Guest */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-resort-100 dark:bg-resort-900/30 text-base font-bold text-resort-700 dark:text-resort-400 shrink-0">
                {booking.guest.firstName[0]}{booking.guest.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 dark:text-white">{booking.guest.firstName} {booking.guest.lastName}</p>
                  {booking.guest.id && (
                    <button
                      onClick={() => { onClose(); router.push(`/dashboard/guests?id=${booking.guest.id}`); }}
                      className="rounded p-0.5 text-gray-400 hover:text-resort-600 hover:bg-resort-50 dark:hover:bg-resort-900/20 transition-colors"
                      title="View guest profile"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{booking.guest.email}</p>
                {booking.guest.phone && <p className="text-sm text-gray-500">{booking.guest.phone}</p>}
              </div>
              {booking.guest.id && (
                <button
                  onClick={() => setShowIdScan(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1a6b5e]/30 text-[#1a6b5e] hover:bg-[#f0faf8] text-xs font-medium transition-colors shrink-0"
                  title="Scan guest ID / passport"
                >
                  <ScanLine className="w-3.5 h-3.5" /> Scan ID
                </button>
              )}
            </div>

            {/* ID Scan Modal */}
            {showIdScan && booking.guest.id && (
              <IdScanModal
                guestId={booking.guest.id}
                guestName={`${booking.guest.firstName} ${booking.guest.lastName}`}
                onClose={() => setShowIdScan(false)}
                onConfirm={async (fields: ScannedFields) => {
                  try {
                    await guestsApi.update(booking.guest.id!, {
                      ...(fields.firstName     ? { firstName:   fields.firstName }     : {}),
                      ...(fields.lastName      ? { lastName:    fields.lastName }      : {}),
                      ...(fields.nationality   ? { nationality: fields.nationality }   : {}),
                      ...(fields.dateOfBirth   ? { dateOfBirth: fields.dateOfBirth }   : {}),
                      ...(fields.documentNumber ? { passportNumber: fields.documentNumber } : {}),
                    });
                    queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
                    toast({ title: '✅ Guest profile updated', description: 'ID scan applied successfully.' });
                  } catch {
                    toast({ title: 'Update failed', description: 'Could not update guest profile.', variant: 'destructive' });
                  }
                  setShowIdScan(false);
                }}
              />
            )}

            {/* Stay Details */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-700">
                <div className="p-3 text-center">
                  <p className="text-xs text-gray-500 flex items-center justify-center gap-1"><LogIn className="h-3 w-3" /> Check-in</p>
                  <p className="mt-1 font-semibold text-sm text-gray-900 dark:text-white">{formatDate(booking.checkIn)}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-xs text-gray-500 flex items-center justify-center gap-1"><LogOut className="h-3 w-3" /> Check-out</p>
                  <p className="mt-1 font-semibold text-sm text-gray-900 dark:text-white">{formatDate(booking.checkOut)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700">
                <div className="p-3 text-center">
                  <p className="text-xs text-gray-500">Nights</p>
                  <p className="mt-1 font-bold text-gray-900 dark:text-white">{nights}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-xs text-gray-500"><Users className="inline h-3 w-3" /> Guests</p>
                  <p className="mt-1 font-bold text-gray-900 dark:text-white">{booking.adults + (booking.children ?? 0)}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-xs text-gray-500"><BedDouble className="inline h-3 w-3" /> Room</p>
                  <p className="mt-1 font-bold text-xs text-gray-900 dark:text-white">#{booking.room.number}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 dark:border-gray-800 px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Room</p>
              <p className="font-semibold text-gray-900 dark:text-white">{booking.room.name}</p>
              <p className="text-xs text-gray-500 capitalize">{booking.room.type.toLowerCase()}</p>
            </div>

            {/* Payment */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" /> Payment
                </h3>
                <StatusBadge status={booking.paymentStatus} />
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(booking.totalAmount))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Paid</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(Number(booking.paidAmount))}</span>
                </div>
                {outstanding > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Outstanding</span>
                    <span className="font-semibold text-red-500">{formatCurrency(outstanding)}</span>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                    <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${paymentPct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 text-right">{paymentPct}% paid</p>
                </div>
              </div>

              {booking.payments && booking.payments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {booking.payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium capitalize text-gray-800 dark:text-gray-200">{p.method.toLowerCase().replace('_', ' ')}</span>
                        <span className="ml-2 text-xs text-gray-400">{formatDate(p.processedAt)}</span>
                      </div>
                      <span className="font-semibold text-emerald-600">+{formatCurrency(Number(p.amount))}</span>
                    </div>
                  ))}
                </div>
              )}

              {outstanding > 0 && !showPayment && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    onClick={() => { setShowPayment(true); setPayAmount(outstanding.toString()); }}
                    className="flex items-center gap-1.5 text-sm text-resort-600 hover:text-resort-700 font-medium"
                  >
                    <Plus className="h-4 w-4" /> Record Payment
                  </button>
                  <button
                    onClick={() => sendPaymentLink.mutate()}
                    disabled={sendPaymentLink.isPending}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                  >
                    <Link2 className="h-4 w-4" />
                    {sendPaymentLink.isPending ? 'Sending…' : 'Send Payment Link'}
                  </button>
                </div>
              )}

              {showPayment && (
                <div className="mt-3 space-y-3 rounded-xl border border-resort-200 dark:border-resort-800 bg-resort-50 dark:bg-resort-900/20 p-4">
                  <p className="text-sm font-medium text-resort-700 dark:text-resort-400">Record Payment</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Amount</label>
                      <Input value={payAmount} onChange={e => setPayAmount(e.target.value)} type="number" step="0.01" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Method</label>
                      <select
                        value={payMethod}
                        onChange={e => setPayMethod(e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-white dark:bg-gray-800 px-3 text-sm"
                      >
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" loading={addPayment.isPending} onClick={() => addPayment.mutate()} disabled={!payAmount}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Packages */}
            <PackagesSection booking={booking} />

            {/* Special Requests */}
            {booking.specialRequests && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1">
                  <MessageSquare className="h-3.5 w-3.5" /> Special Requests
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300">{booking.specialRequests}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 space-y-2">
          {isConfirmed && (
            <button
              onClick={() => setConfirmModal('checkin')}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <LogIn className="h-4 w-4" /> Check In Guest
            </button>
          )}
          {isCheckedIn && (
            <button
              onClick={() => setConfirmModal('checkout')}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <LogOut className="h-4 w-4" /> Check Out Guest
            </button>
          )}
          {['PENDING', 'CONFIRMED'].includes(booking.status) && (
            <Button
              variant="outline"
              className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20"
              onClick={() => cancel.mutate()}
              loading={cancel.isPending}
            >
              <XCircle className="h-4 w-4" /> Cancel Booking
            </Button>
          )}
          {isCheckedOut && (
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              Stay completed
            </div>
          )}
          {(isCheckedIn || isCheckedOut) && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2 text-resort-600 border-resort-200 hover:bg-resort-50 dark:border-resort-900 dark:hover:bg-resort-900/20"
                onClick={() => { onClose(); router.push(`/dashboard/bookings/${booking.id}/invoice`); }}
              >
                <FileText className="h-4 w-4" /> View Invoice
              </Button>
              <PrintReceiptButton bookingId={booking.id} />
            </div>
          )}
        </div>
      </div>

      {/* Confirmation modals */}
      {confirmModal && (
        <ConfirmModal
          type={confirmModal}
          booking={booking}
          onConfirm={() => confirmModal === 'checkin' ? checkInMutation.mutate() : checkOutMutation.mutate()}
          onCancel={() => setConfirmModal(null)}
          loading={checkInMutation.isPending || checkOutMutation.isPending}
        />
      )}
    </>
  );
}
