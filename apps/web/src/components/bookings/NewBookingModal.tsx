'use client';

import { useState, useEffect } from 'react';
import { ModalShell } from '@/components/ui/modal-shell';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsApi, guestsApi, ratePlansApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Search, BedDouble, ChevronRight, ChevronLeft, Tags, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const step1Schema = z.object({
  checkIn: z.string().min(1, 'Check-in date required'),
  checkOut: z.string().min(1, 'Check-out date required'),
  adults: z.coerce.number().int().min(1),
  children: z.coerce.number().int().min(0),
}).refine(d => new Date(d.checkOut) > new Date(d.checkIn), {
  message: 'Check-out must be after check-in',
  path: ['checkOut'],
});

type Step1Data = z.infer<typeof step1Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { roomId: string; guestId: string; checkIn: string; checkOut: string; adults: number; children: number; specialRequests?: string }) => void;
  loading: boolean;
}

const ROOM_TYPE_COLORS: Record<string, string> = {
  STANDARD: 'bg-gray-100 text-gray-700', DELUXE: 'bg-blue-100 text-blue-700',
  SUITE: 'bg-purple-100 text-purple-700', VILLA: 'bg-resort-100 text-resort-700',
  COTTAGE: 'bg-green-100 text-green-700', BUNGALOW: 'bg-orange-100 text-orange-700',
};

export function NewBookingModal({ open, onClose, onSubmit, loading }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Record<string, unknown> | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<Record<string, unknown> | null>(null);
  const [guestSearch, setGuestSearch] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  // New guest quick-create
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [newGuestForm, setNewGuestForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [newGuestError, setNewGuestError] = useState<string | null>(null);

  const { register: reg1, handleSubmit: hs1, formState: { errors: e1 }, reset: reset1, watch } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { adults: 2, children: 0 },
  });

  const checkIn = watch('checkIn');
  const checkOut = watch('checkOut');

  // Load available rooms when dates selected
  const { data: availableData, isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms-available', checkIn, checkOut],
    queryFn: () => roomsApi.availability(checkIn, checkOut),
    enabled: !!checkIn && !!checkOut && new Date(checkOut) > new Date(checkIn),
  });

  const { data: guestsData } = useQuery({
    queryKey: ['guests-search', guestSearch],
    queryFn: () => guestsApi.list({ search: guestSearch, limit: 20 }),
    enabled: step === 3,
  });

  const availableRooms: Record<string, unknown>[] = availableData?.data?.data ?? [];
  const guests: Record<string, unknown>[] = guestsData?.data?.data ?? [];

  const nights = step1Data
    ? Math.ceil((new Date(step1Data.checkOut).getTime() - new Date(step1Data.checkIn).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Resolve rate plan when room + dates are selected
  const { data: resolvedRate } = useQuery({
    queryKey: ['rate-resolve', selectedRoom?.id, step1Data?.checkIn, step1Data?.checkOut],
    queryFn: () => ratePlansApi.resolve(
      selectedRoom!.id as string,
      step1Data!.checkIn,
      step1Data!.checkOut,
    ),
    enabled: !!selectedRoom && !!step1Data?.checkIn && !!step1Data?.checkOut,
    select: r => r.data.data as { effectivePrice: number; basePrice: number; resolved: { price: number; planName: string; planType: string } | null },
  });

  const effectivePrice = resolvedRate?.effectivePrice ?? (selectedRoom ? Number(selectedRoom.basePrice) : 0);
  const totalAmount = effectivePrice * nights;

  // Create new guest mutation
  const createGuestMut = useMutation({
    mutationFn: (data: typeof newGuestForm) => guestsApi.create(data),
    onSuccess: (res) => {
      const guest = res.data.data;
      queryClient.invalidateQueries({ queryKey: ['guests-search'] });
      setSelectedGuest(guest);
      setShowNewGuest(false);
      setNewGuestForm({ firstName: '', lastName: '', email: '', phone: '' });
      toast({ title: 'Guest created', description: `${guest.firstName} ${guest.lastName} added` });
      setStep(4);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setNewGuestError(err?.response?.data?.error ?? 'Could not create guest');
    },
  });

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setStep(1); setStep1Data(null); setSelectedRoom(null);
      setSelectedGuest(null); setGuestSearch(''); setSpecialRequests('');
      setShowNewGuest(false); setNewGuestForm({ firstName: '', lastName: '', email: '', phone: '' });
      setNewGuestError(null);
      reset1({ adults: 2, children: 0 });
    }
  }, [open, reset1]);

  const handleStep1 = (data: Step1Data) => {
    setStep1Data(data);
    setStep(2);
  };

  const handleSubmit = () => {
    if (!step1Data || !selectedRoom || !selectedGuest) return;
    onSubmit({
      roomId: selectedRoom.id as string,
      guestId: selectedGuest.id as string,
      checkIn: step1Data.checkIn,
      checkOut: step1Data.checkOut,
      adults: step1Data.adults,
      children: step1Data.children,
      specialRequests: specialRequests || undefined,
    });
  };

  const stepTitles = ['Select Dates', 'Choose Room', 'Select Guest', 'Confirm'];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="New Booking"
      description="Create a new room reservation"
      maxWidth="680px"
    >
      <div>
      {/* Step Indicator */}
      <div className="mb-6 flex items-center gap-2">
        {stepTitles.map((title, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
              step > i + 1 ? 'bg-resort-600 text-white' :
              step === i + 1 ? 'bg-resort-600 text-white ring-4 ring-resort-100' :
              'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-white/40'
            )}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={cn('text-xs font-medium', step === i + 1 ? 'text-resort-700 dark:text-[#4db6ac]' : 'text-gray-400 dark:text-white/30')}>
              {title}
            </span>
            {i < 3 && <div className={cn('h-px w-6 flex-1', step > i + 1 ? 'bg-resort-400' : 'bg-gray-200 dark:bg-white/10')} />}
          </div>
        ))}
      </div>

      {/* Step 1 – Dates */}
      {step === 1 && (
        <form onSubmit={hs1(handleStep1)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-[#94b8b0]">Check-in Date</label>
              <input
                {...reg1('checkIn')}
                type="date"
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid rgba(0,0,0,0.05)',
                  background: 'var(--rp-surface-3)',
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: 'var(--rp-text)',
                  outline: 'none',
                }}
              />
              {e1.checkIn && <p className="mt-1 text-xs text-red-500">{e1.checkIn.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-[#94b8b0]">Check-out Date</label>
              <input
                {...reg1('checkOut')}
                type="date"
                min={checkIn || new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid rgba(0,0,0,0.05)',
                  background: 'var(--rp-surface-3)',
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: 'var(--rp-text)',
                  outline: 'none',
                }}
              />
              {e1.checkOut && <p className="mt-1 text-xs text-red-500">{e1.checkOut.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-[#94b8b0]">Adults</label>
              <input
                {...reg1('adults')}
                type="number"
                min={1}
                max={10}
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid rgba(0,0,0,0.05)',
                  background: 'var(--rp-surface-3)',
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: 'var(--rp-text)',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-[#94b8b0]">Children</label>
              <input
                {...reg1('children')}
                type="number"
                min={0}
                max={10}
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid rgba(0,0,0,0.05)',
                  background: 'var(--rp-surface-3)',
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: 'var(--rp-text)',
                  outline: 'none',
                }}
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '9px',
                border: 'none',
                background: 'var(--rp-btn-accent)',
                color: 'var(--rp-btn-accent-text)',
                fontSize: '13px',
                fontWeight: 500,
                padding: '9px 12px',
                cursor: 'pointer',
              }}
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* Step 2 – Room */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg bg-resort-50 border border-resort-100 px-4 py-2 text-sm text-resort-700">
            {step1Data?.checkIn} → {step1Data?.checkOut} · {nights} night{nights !== 1 ? 's' : ''} · {step1Data?.adults} adults{step1Data?.children ? `, ${step1Data.children} children` : ''}
          </div>

          {roomsLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}</div>
          ) : availableRooms.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
              <BedDouble className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p className="text-gray-500 font-medium">No rooms available for these dates</p>
              <button onClick={() => setStep(1)} className="mt-2 text-sm text-resort-600 hover:underline">Change dates</button>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {availableRooms.map((room) => (
                <button
                  key={room.id as string}
                  onClick={() => { setSelectedRoom(room); setStep(3); }}
                  className={cn(
                    'w-full rounded-xl border-2 p-4 text-left transition-all hover:border-resort-400 hover:bg-resort-50',
                    selectedRoom?.id === room.id ? 'border-resort-500 bg-resort-50' : 'border-gray-200 bg-white'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">#{room.number as string}</span>
                        <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', ROOM_TYPE_COLORS[room.type as string])}>
                          {(room.type as string).charAt(0) + (room.type as string).slice(1).toLowerCase()}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">{room.name as string}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Max {room.maxOccupancy as number} guests</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-resort-700">{formatCurrency(Number(room.basePrice))}</p>
                      <p className="text-xs text-muted-foreground">base / night</p>
                      <p className="text-sm font-semibold text-gray-700 mt-1">{formatCurrency(Number(room.basePrice) * nights)} est.</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '9px',
                border: '1px solid rgba(0,0,0,0.08)',
                background: 'transparent',
                color: 'var(--rp-text-subtle)',
                fontSize: '13px',
                fontWeight: 500,
                padding: '9px 12px',
                cursor: 'pointer',
              }}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3 – Guest */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg bg-resort-50 border border-resort-100 px-4 py-2 text-sm text-resort-700">
            Room: <span className="font-semibold">{selectedRoom?.name as string}</span> · {formatCurrency(totalAmount)} total
          </div>

          {!showNewGuest ? (
            <>
              {/* Search existing guest */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  placeholder="Search guest by name or email..."
                  style={{
                    width: '100%',
                    paddingLeft: '36px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0,0,0,0.05)',
                    background: 'var(--rp-surface-3)',
                    padding: '9px 12px 9px 36px',
                    fontSize: '13px',
                    color: 'var(--rp-text)',
                    outline: 'none',
                  }}
                />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {guests.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {guestSearch ? 'No guests found' : 'Search or scroll to find a guest'}
                  </div>
                ) : guests.map((guest) => (
                  <button
                    key={guest.id as string}
                    onClick={() => { setSelectedGuest(guest); setStep(4); }}
                    className={cn(
                      'w-full rounded-xl border-2 p-3 text-left transition-all hover:border-resort-400 hover:bg-resort-50',
                      selectedGuest?.id === guest.id ? 'border-resort-500 bg-resort-50' : 'border-gray-200 bg-white'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-resort-100 text-sm font-bold text-resort-700">
                        {(guest.firstName as string)[0]}{(guest.lastName as string)[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{guest.firstName as string} {guest.lastName as string}</p>
                        <p className="text-xs text-muted-foreground">{guest.email as string}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Divider + new guest button */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <button
                  onClick={() => setShowNewGuest(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-resort-600 hover:text-resort-700 whitespace-nowrap"
                >
                  <UserPlus className="h-3.5 w-3.5" /> New guest
                </button>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            </>
          ) : (
            /* Quick new-guest form */
            <div className="rounded-xl border-2 border-resort-200 bg-resort-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-resort-700 flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4" /> New Guest
                </p>
                <button onClick={() => { setShowNewGuest(false); setNewGuestError(null); }}
                  className="rounded-lg p-1 text-gray-400 hover:bg-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">First name *</label>
                  <input
                    value={newGuestForm.firstName}
                    onChange={e => setNewGuestForm(p => ({ ...p, firstName: e.target.value }))}
                    placeholder="John"
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid rgba(0,0,0,0.05)',
                      background: 'var(--rp-surface-3)',
                      padding: '9px 12px',
                      fontSize: '13px',
                      color: 'var(--rp-text)',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Last name *</label>
                  <input
                    value={newGuestForm.lastName}
                    onChange={e => setNewGuestForm(p => ({ ...p, lastName: e.target.value }))}
                    placeholder="Doe"
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid rgba(0,0,0,0.05)',
                      background: 'var(--rp-surface-3)',
                      padding: '9px 12px',
                      fontSize: '13px',
                      color: 'var(--rp-text)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Email *</label>
                <input
                  type="email"
                  value={newGuestForm.email}
                  onChange={e => setNewGuestForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="guest@email.com"
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid rgba(0,0,0,0.05)',
                    background: 'var(--rp-surface-3)',
                    padding: '9px 12px',
                    fontSize: '13px',
                    color: 'var(--rp-text)',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">Phone</label>
                <input
                  type="tel"
                  value={newGuestForm.phone}
                  onChange={e => setNewGuestForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+880..."
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid rgba(0,0,0,0.05)',
                    background: 'var(--rp-surface-3)',
                    padding: '9px 12px',
                    fontSize: '13px',
                    color: 'var(--rp-text)',
                    outline: 'none',
                  }}
                />
              </div>
              {newGuestError && <p className="text-xs text-red-500">{newGuestError}</p>}
              <button
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderRadius: '9px',
                  border: 'none',
                  background: 'var(--rp-btn-accent)',
                  color: 'var(--rp-btn-accent-text)',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '9px 12px',
                  cursor: 'pointer',
                  opacity: createGuestMut.isPending || !newGuestForm.firstName || !newGuestForm.lastName || !newGuestForm.email ? 0.6 : 1,
                }}
                disabled={!newGuestForm.firstName || !newGuestForm.lastName || !newGuestForm.email || createGuestMut.isPending}
                onClick={() => { setNewGuestError(null); createGuestMut.mutate(newGuestForm); }}
              >
                <UserPlus className="h-4 w-4" /> Create & Select Guest
              </button>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '9px',
                border: '1px solid rgba(0,0,0,0.08)',
                background: 'transparent',
                color: 'var(--rp-text-subtle)',
                fontSize: '13px',
                fontWeight: 500,
                padding: '9px 12px',
                cursor: 'pointer',
              }}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          </div>
        </div>
      )}

      {/* Step 4 – Confirm */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 divide-y overflow-hidden">
            {[
              { label: 'Guest', value: `${selectedGuest?.firstName} ${selectedGuest?.lastName}` },
              { label: 'Email', value: selectedGuest?.email as string },
              { label: 'Room', value: `#${selectedRoom?.number} – ${selectedRoom?.name}` },
              { label: 'Check-in', value: step1Data?.checkIn },
              { label: 'Check-out', value: step1Data?.checkOut },
              { label: 'Duration', value: `${nights} night${nights !== 1 ? 's' : ''}` },
              { label: 'Guests', value: `${step1Data?.adults} adults${step1Data?.children ? `, ${step1Data.children} children` : ''}` },
              { label: 'Rate / night', value: formatCurrency(effectivePrice) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-gray-900">{value as string}</span>
              </div>
            ))}
            {resolvedRate?.resolved && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20">
                <Tags className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  Rate plan applied: <strong>{resolvedRate.resolved.planName}</strong>
                  {resolvedRate.resolved.price !== resolvedRate.basePrice && (
                    <span className="ml-1 text-gray-500">(base: {formatCurrency(resolvedRate.basePrice)})</span>
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between bg-resort-50 px-4 py-3">
              <span className="font-semibold text-resort-700">Total Amount</span>
              <span className="text-lg font-bold text-resort-700">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-[#94b8b0]">Special Requests (optional)</label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={2}
              placeholder="Early check-in, high floor, extra pillows..."
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(3)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '9px',
                border: '1px solid rgba(0,0,0,0.08)',
                background: 'transparent',
                color: 'var(--rp-text-subtle)',
                fontSize: '13px',
                fontWeight: 500,
                padding: '9px 12px',
                cursor: 'pointer',
              }}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={handleSubmit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '9px',
                border: 'none',
                background: 'var(--rp-btn-accent)',
                color: 'var(--rp-btn-accent-text)',
                fontSize: '13px',
                fontWeight: 500,
                padding: '9px 12px',
                cursor: 'pointer',
                minWidth: '128px',
                opacity: loading ? 0.6 : 1,
              }}
              disabled={loading}
            >
              Confirm Booking
            </button>
          </div>
        </div>
      )}
      </div>
    </ModalShell>
  );
}
