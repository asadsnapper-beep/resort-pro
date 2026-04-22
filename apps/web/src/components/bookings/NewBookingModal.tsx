'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { roomsApi, guestsApi } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Search, BedDouble, Users, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Record<string, unknown> | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<Record<string, unknown> | null>(null);
  const [guestSearch, setGuestSearch] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

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

  const totalAmount = selectedRoom ? Number(selectedRoom.basePrice) * nights : 0;

  useEffect(() => {
    if (!open) {
      setStep(1); setStep1Data(null); setSelectedRoom(null);
      setSelectedGuest(null); setGuestSearch(''); setSpecialRequests('');
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
    <Modal open={open} onClose={onClose} title="New Booking" className="max-w-2xl">
      {/* Step Indicator */}
      <div className="mb-6 flex items-center gap-2">
        {stepTitles.map((title, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
              step > i + 1 ? 'bg-resort-600 text-white' :
              step === i + 1 ? 'bg-resort-600 text-white ring-4 ring-resort-100' :
              'bg-gray-100 text-gray-400'
            )}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={cn('text-xs font-medium', step === i + 1 ? 'text-resort-700' : 'text-gray-400')}>
              {title}
            </span>
            {i < 3 && <div className={cn('h-px w-6 flex-1', step > i + 1 ? 'bg-resort-400' : 'bg-gray-200')} />}
          </div>
        ))}
      </div>

      {/* Step 1 – Dates */}
      {step === 1 && (
        <form onSubmit={hs1(handleStep1)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Check-in Date</label>
              <Input {...reg1('checkIn')} type="date" min={new Date().toISOString().split('T')[0]} />
              {e1.checkIn && <p className="mt-1 text-xs text-red-500">{e1.checkIn.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Check-out Date</label>
              <Input {...reg1('checkOut')} type="date" min={checkIn || new Date().toISOString().split('T')[0]} />
              {e1.checkOut && <p className="mt-1 text-xs text-red-500">{e1.checkOut.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Adults</label>
              <Input {...reg1('adults')} type="number" min={1} max={10} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Children</label>
              <Input {...reg1('children')} type="number" min={0} max={10} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" className="gap-2">Next <ChevronRight className="h-4 w-4" /></Button>
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
                      <p className="text-xs text-muted-foreground">per night</p>
                      <p className="text-sm font-semibold text-gray-700 mt-1">{formatCurrency(Number(room.basePrice) * nights)} total</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-2"><ChevronLeft className="h-4 w-4" /> Back</Button>
          </div>
        </div>
      )}

      {/* Step 3 – Guest */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg bg-resort-50 border border-resort-100 px-4 py-2 text-sm text-resort-700">
            Room: <span className="font-semibold">{selectedRoom?.name as string}</span> · {formatCurrency(totalAmount)} total
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={guestSearch}
              onChange={(e) => setGuestSearch(e.target.value)}
              placeholder="Search guest by name or email..."
              className="pl-9"
            />
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {guests.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
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

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)} className="gap-2"><ChevronLeft className="h-4 w-4" /> Back</Button>
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
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-gray-900">{value as string}</span>
              </div>
            ))}
            <div className="flex justify-between bg-resort-50 px-4 py-3">
              <span className="font-semibold text-resort-700">Total Amount</span>
              <span className="text-lg font-bold text-resort-700">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Special Requests (optional)</label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={2}
              placeholder="Early check-in, high floor, extra pillows..."
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(3)} className="gap-2"><ChevronLeft className="h-4 w-4" /> Back</Button>
            <Button onClick={handleSubmit} loading={loading} className="gap-2 min-w-32">
              Confirm Booking
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
