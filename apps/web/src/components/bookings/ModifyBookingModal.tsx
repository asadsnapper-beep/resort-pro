'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Plus, X } from 'lucide-react';
import { ModalShell } from '@/components/ui/modal-shell';
import { roomsApi, packagesApi, ratePlansApi, offersApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface RoomOption {
  id: string;
  number: string;
  name: string;
  basePrice: number | string;
}

interface PackageOption {
  id: string;
  name: string;
  price: number;
  priceType: 'PER_STAY' | 'PER_NIGHT';
}

interface AttachedPackage {
  packageId: string;
  packageName: string;
  price: number;
  priceType: 'PER_STAY' | 'PER_NIGHT';
  nights: number;
}

interface OfferOption {
  id: string;
  title: string;
  type: 'PERCENTAGE' | 'FIXED' | 'FREE_NIGHT';
  value: number;
  minStay: number;
  roomIds: string[];
}

interface AttachedOffer {
  offerId: string;
  discount: number;
  offer: { id: string; title: string; type: string; value: number };
}

export interface ModifyBookingPayload {
  checkIn?: string;
  checkOut?: string;
  roomId?: string;
  adults?: number;
  children?: number;
  specialRequests?: string;
  notifyGuest?: boolean;
}

interface Booking {
  id: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalAmount: number;
  specialRequests?: string;
  roomId: string;
  room: { number: string; name: string };
}

/**
 * ModifyBookingModal — reschedule, change room, or update guest count.
 * Fetches live room availability for the chosen dates so the room picker and
 * the price-diff preview are never stale; the server re-validates everything
 * again on submit (this is a convenience preview, not the source of truth).
 */
export function ModifyBookingModal({
  open,
  onClose,
  onConfirm,
  booking,
  loading,
  error,
  onPackagesChanged,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: ModifyBookingPayload) => void;
  booking: Booking;
  loading: boolean;
  error?: string;
  /** Called after a package is added/removed — those save immediately, independent of "Save changes". */
  onPackagesChanged?: () => void;
}) {
  const [checkIn, setCheckIn] = useState(booking.checkIn.slice(0, 10));
  const [checkOut, setCheckOut] = useState(booking.checkOut.slice(0, 10));
  const [roomId, setRoomId] = useState(booking.roomId);
  const [adults, setAdults] = useState(String(booking.adults));
  const [children, setChildren] = useState(String(booking.children));
  const [specialRequests, setSpecialRequests] = useState(booking.specialRequests ?? '');
  const [notifyGuest, setNotifyGuest] = useState(true);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // ── Packages ────────────────────────────────────────────────────────────
  // These save immediately on add/remove (each is its own API call) — they
  // aren't part of the "Save changes" batch below.
  const [allPackages, setAllPackages] = useState<PackageOption[]>([]);
  const [attached, setAttached] = useState<AttachedPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packageActionId, setPackageActionId] = useState<string | null>(null);
  const [packageToAdd, setPackageToAdd] = useState('');

  function loadPackages() {
    setPackagesLoading(true);
    Promise.all([packagesApi.list(), packagesApi.getForBooking(booking.id)])
      .then(([allRes, attachedRes]) => {
        setAllPackages(allRes.data.data ?? []);
        setAttached(attachedRes.data.data ?? []);
      })
      .catch(() => {})
      .finally(() => setPackagesLoading(false));
  }
  useEffect(loadPackages, [booking.id]);

  const packageCost = (p: { price: number; priceType: string; nights?: number }) =>
    p.priceType === 'PER_NIGHT' ? p.price * (p.nights ?? nights) : p.price;
  const packagesTotal = attached.reduce((sum, p) => sum + packageCost(p), 0);
  const addablePackages = allPackages.filter((p) => !attached.some((a) => a.packageId === p.id));

  async function handleAddPackage() {
    if (!packageToAdd) return;
    setPackageActionId(packageToAdd);
    try {
      await packagesApi.apply(booking.id, packageToAdd);
      setPackageToAdd('');
      loadPackages();
      onPackagesChanged?.();
    } catch (err: any) {
      toast({ title: 'Could not add package', description: err?.response?.data?.error, variant: 'destructive' });
    } finally {
      setPackageActionId(null);
    }
  }

  async function handleRemovePackage(packageId: string) {
    setPackageActionId(packageId);
    try {
      await packagesApi.remove(booking.id, packageId);
      loadPackages();
      onPackagesChanged?.();
    } catch (err: any) {
      toast({ title: 'Could not remove package', description: err?.response?.data?.error, variant: 'destructive' });
    } finally {
      setPackageActionId(null);
    }
  }

  // ── Offers ──────────────────────────────────────────────────────────────
  // Same immediate-save pattern as Packages above — not part of "Save changes".
  const [allOffers, setAllOffers] = useState<OfferOption[]>([]);
  const [attachedOffers, setAttachedOffers] = useState<AttachedOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offerActionId, setOfferActionId] = useState<string | null>(null);
  const [offerToAdd, setOfferToAdd] = useState('');

  function loadOffers() {
    setOffersLoading(true);
    Promise.all([offersApi.list(), offersApi.getForBooking(booking.id)])
      .then(([allRes, attachedRes]) => {
        setAllOffers(allRes.data.data ?? []);
        setAttachedOffers(attachedRes.data.data ?? []);
      })
      .catch(() => {})
      .finally(() => setOffersLoading(false));
  }
  useEffect(loadOffers, [booking.id]);

  const offersTotal = attachedOffers.reduce((sum, o) => sum + o.discount, 0);
  const addableOffers = allOffers.filter((o) => !attachedOffers.some((a) => a.offerId === o.id));

  async function handleAddOffer() {
    if (!offerToAdd) return;
    setOfferActionId(offerToAdd);
    try {
      await offersApi.apply(booking.id, offerToAdd);
      setOfferToAdd('');
      loadOffers();
      onPackagesChanged?.();
    } catch (err: any) {
      toast({ title: 'Could not add offer', description: err?.response?.data?.error, variant: 'destructive' });
    } finally {
      setOfferActionId(null);
    }
  }

  async function handleRemoveOffer(offerId: string) {
    setOfferActionId(offerId);
    try {
      await offersApi.remove(booking.id, offerId);
      loadOffers();
      onPackagesChanged?.();
    } catch (err: any) {
      toast({ title: 'Could not remove offer', description: err?.response?.data?.error, variant: 'destructive' });
    } finally {
      setOfferActionId(null);
    }
  }

  // The room's own current reservation isn't excluded by the availability
  // endpoint (it has no concept of "this booking"), so it always looks
  // "unavailable" for its own dates. Fetch its real price directly instead
  // of trusting whatever (or nothing) the availability list says about it.
  const [currentRoomPrice, setCurrentRoomPrice] = useState<number | null>(null);
  useEffect(() => {
    roomsApi.get(booking.roomId).then((res) => setCurrentRoomPrice(Number(res.data.data.basePrice))).catch(() => {});
  }, [booking.roomId]);

  // Re-check availability whenever the dates change — always keep the
  // booking's current room selectable in the dropdown even when the
  // endpoint's own-booking exclusion hides it from "available".
  useEffect(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return;
    setRoomsLoading(true);
    roomsApi.availability(checkIn, checkOut)
      .then((res) => {
        const available: RoomOption[] = res.data.data ?? [];
        const hasCurrent = available.some((r) => r.id === booking.roomId);
        setRooms(hasCurrent ? available : [
          { id: booking.roomId, number: booking.room.number, name: booking.room.name, basePrice: currentRoomPrice ?? 0 },
          ...available,
        ]);
      })
      .catch(() => setRooms([{ id: booking.roomId, number: booking.room.number, name: booking.room.name, basePrice: currentRoomPrice ?? 0 }]))
      .finally(() => setRoomsLoading(false));
  }, [checkIn, checkOut, booking.roomId, booking.room.number, booking.room.name, currentRoomPrice]);

  const nights = checkIn && checkOut && checkOut > checkIn
    ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000)
    : 0;
  const selectedRoom = rooms.find((r) => r.id === roomId);
  const selectedRoomPrice = roomId === booking.roomId ? (currentRoomPrice ?? (Number(selectedRoom?.basePrice) || 0)) : (Number(selectedRoom?.basePrice) || 0);
  const datesOrRoomChanged = checkIn !== booking.checkIn.slice(0, 10) || checkOut !== booking.checkOut.slice(0, 10) || roomId !== booking.roomId;

  // Server pricing (create + modify) applies the best matching rate plan for
  // the room/dates, not just the room's plain nightly price — mirror that
  // here so the preview actually matches what gets charged on save.
  const [effectiveRate, setEffectiveRate] = useState<{ price: number; planName: string } | null>(null);
  useEffect(() => {
    if (!roomId || !checkIn || !checkOut || checkOut <= checkIn) { setEffectiveRate(null); return; }
    ratePlansApi.resolve(roomId, checkIn, checkOut)
      .then((res) => {
        const { resolved } = res.data.data;
        setEffectiveRate(resolved ? { price: resolved.price, planName: resolved.planName } : null);
      })
      .catch(() => setEffectiveRate(null));
  }, [roomId, checkIn, checkOut]);

  const nightlyRate = effectiveRate?.price ?? selectedRoomPrice;
  const estimatedNewTotal = datesOrRoomChanged && nightlyRate > 0
    ? nightlyRate * nights
    : Number(booking.totalAmount);
  const diff = estimatedNewTotal - Number(booking.totalAmount);

  function handleSubmit() {
    onConfirm({
      checkIn: checkIn !== booking.checkIn.slice(0, 10) ? checkIn : undefined,
      checkOut: checkOut !== booking.checkOut.slice(0, 10) ? checkOut : undefined,
      roomId: roomId !== booking.roomId ? roomId : undefined,
      adults: Number(adults) !== booking.adults ? Number(adults) : undefined,
      children: Number(children) !== booking.children ? Number(children) : undefined,
      specialRequests: specialRequests !== (booking.specialRequests ?? '') ? specialRequests : undefined,
      notifyGuest,
    });
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Modify booking"
      description="Change dates, room, or guest details."
      variant="resort"
      maxWidth="520px"
      showCloseButton={!loading}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading || nights < 1} className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save changes
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">Check-in</span>
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">Check-out</span>
            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </label>
        </div>
        {nights < 1 && checkIn && checkOut && (
          <p className="text-xs font-semibold text-red-600">Check-out must be after check-in.</p>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
            Room {roomsLoading && <span className="text-gray-400">(checking availability…)</span>}
          </span>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={roomsLoading} className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50">
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.number} — {r.name}{r.id === booking.roomId ? ' (current)' : Number(r.basePrice) > 0 ? ` — ${formatCurrency(Number(r.basePrice))}/night` : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">Adults</span>
            <input type="number" min={1} value={adults} onChange={(e) => setAdults(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">Children</span>
            <input type="number" min={0} value={children} onChange={(e) => setChildren(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">Special requests</span>
          <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Packages</span>
            {packagesTotal > 0 && <span className="text-xs font-semibold text-gray-500">{formatCurrency(packagesTotal)} added</span>}
          </div>
          <p className="mb-2 text-xs text-gray-400">Adding or removing a package saves immediately — it doesn&apos;t wait for &quot;Save changes&quot;.</p>

          {packagesLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> Loading packages…</div>
          ) : (
            <div className="space-y-1.5">
              {attached.map((p) => (
                <div key={p.packageId} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-1.5 text-sm">
                  <span className="text-gray-800 dark:text-gray-200">{p.packageName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">{formatCurrency(packageCost(p))}</span>
                    <button onClick={() => handleRemovePackage(p.packageId)} disabled={packageActionId === p.packageId} title="Remove package" className="text-gray-400 hover:text-red-600 disabled:opacity-40">
                      {packageActionId === p.packageId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
              {attached.length === 0 && <p className="text-xs text-gray-400">No packages added yet.</p>}

              {addablePackages.length > 0 && (
                <div className="flex gap-2 pt-1">
                  <select value={packageToAdd} onChange={(e) => setPackageToAdd(e.target.value)} className="h-9 flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                    <option value="">Add a package…</option>
                    {addablePackages.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}{p.priceType === 'PER_NIGHT' ? '/night' : '/stay'}</option>
                    ))}
                  </select>
                  <button onClick={handleAddPackage} disabled={!packageToAdd || packageActionId === packageToAdd} className="inline-flex h-9 items-center gap-1 rounded-lg border border-indigo-300 dark:border-indigo-700 px-3 text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50">
                    {packageActionId === packageToAdd ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Offers</span>
            {offersTotal > 0 && <span className="text-xs font-semibold text-emerald-600">-{formatCurrency(offersTotal)} applied</span>}
          </div>
          <p className="mb-2 text-xs text-gray-400">Adding or removing an offer saves immediately — it doesn&apos;t wait for &quot;Save changes&quot;.</p>

          {offersLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> Loading offers…</div>
          ) : (
            <div className="space-y-1.5">
              {attachedOffers.map((o) => (
                <div key={o.offerId} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-1.5 text-sm">
                  <span className="text-gray-800 dark:text-gray-200">{o.offer.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600">-{formatCurrency(o.discount)}</span>
                    <button onClick={() => handleRemoveOffer(o.offerId)} disabled={offerActionId === o.offerId} title="Remove offer" className="text-gray-400 hover:text-red-600 disabled:opacity-40">
                      {offerActionId === o.offerId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
              {attachedOffers.length === 0 && <p className="text-xs text-gray-400">No offers applied yet.</p>}

              {addableOffers.length > 0 && (
                <div className="flex gap-2 pt-1">
                  <select value={offerToAdd} onChange={(e) => setOfferToAdd(e.target.value)} className="h-9 flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                    <option value="">Apply an offer…</option>
                    {addableOffers.map((o) => (
                      <option key={o.id} value={o.id}>{o.title} — {o.type === 'PERCENTAGE' ? `${o.value}% off` : o.type === 'FIXED' ? `${formatCurrency(o.value)} off` : `${o.value} free night(s)`}</option>
                    ))}
                  </select>
                  <button onClick={handleAddOffer} disabled={!offerToAdd || offerActionId === offerToAdd} className="inline-flex h-9 items-center gap-1 rounded-lg border border-indigo-300 dark:border-indigo-700 px-3 text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50">
                    {offerActionId === offerToAdd ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Apply
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {datesOrRoomChanged && nights >= 1 && (
          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-3 py-2.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Current total</span><span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(booking.totalAmount))}</span></div>
            <div className="flex justify-between mt-1"><span className="text-gray-500 dark:text-gray-400">New total ({nights} night{nights !== 1 ? 's' : ''}{effectiveRate ? ` · ${effectiveRate.planName} rate` : ''})</span><span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(estimatedNewTotal)}</span></div>
            <div className="flex justify-between mt-1 pt-1 border-t border-indigo-200 dark:border-indigo-800">
              <span className="font-semibold text-indigo-700 dark:text-indigo-400">Difference</span>
              <span className={`font-bold ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-600' : 'text-gray-700 dark:text-gray-300'}`}>
                {diff > 0 ? '+' : ''}{formatCurrency(diff)}
              </span>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={notifyGuest} onChange={(e) => setNotifyGuest(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          Email the guest an updated confirmation
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
