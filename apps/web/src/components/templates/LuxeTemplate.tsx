'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Star, Phone, Mail, MapPin, ChevronDown, Bed, Users, Calendar,
  ArrowRight, CheckCircle, Menu, X, Send,
  Wifi, Car, Coffee, Waves, Dumbbell, Utensils, Shield, Wind,
  ShoppingCart, Plus, Minus, Trash2, ChefHat, UtensilsCrossed,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Room {
  id: string; name: string; type: string; number: string;
  basePrice: number; maxOccupancy: number; floor?: number;
  images: string[]; videos: string[];
  amenities: string[]; description?: string;
}

interface ResortData {
  tenant: {
    name: string; slug: string; phone?: string; email?: string;
    address?: string; currency: string; checkInTime: string; checkOutTime: string; logoUrl?: string;
  };
  website: {
    heroTitle: string; heroSubtitle?: string; heroImage?: string;
    aboutTitle?: string; aboutText?: string; aboutImage?: string;
    galleryImages?: string[];
    testimonials?: { name: string; text: string; rating: number; avatar?: string }[];
    primaryColor?: string; accentColor?: string;
  };
  rooms: Room[];
}

interface MenuItem {
  id: string; name: string; description?: string;
  category: string; price: number; image?: string;
}

interface CartItem { item: MenuItem; quantity: number; notes: string; }

/* ── Amenity icon map ───────────────────────────────────────────────────────── */
const AMENITY_ICONS: Record<string, React.ElementType> = {
  wifi: Wifi, parking: Car, breakfast: Coffee, pool: Waves,
  gym: Dumbbell, restaurant: Utensils, security: Shield, ac: Wind,
};

function AmenityIcon({ amenity }: { amenity: string }) {
  const lower = amenity.toLowerCase();
  const Icon = Object.entries(AMENITY_ICONS).find(([k]) => lower.includes(k))?.[1] ?? CheckCircle;
  return <Icon className="h-3.5 w-3.5" />;
}

/* ── Currency formatter ─────────────────────────────────────────────────────── */
function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

/* ── Room type labels ──────────────────────────────────────────────────────── */
const ROOM_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard Room', DELUXE: 'Deluxe Room', SUITE: 'Suite',
  VILLA: 'Villa', PENTHOUSE: 'Penthouse', BUNGALOW: 'Bungalow',
  FAMILY: 'Family Room', TWIN: 'Twin Room',
};

/* ── Room Detail Modal ─────────────────────────────────────────────────────── */
function RoomModal({ room, currency, primaryColor, accentColor, onClose, onBook }: {
  room: Room; currency: string; primaryColor: string; accentColor: string;
  onClose: () => void; onBook: (room: Room) => void;
}) {
  const [activeMedia, setActiveMedia] = useState(0);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const allPhotos = room.images.length > 0 ? room.images : [];
  const allVideos = room.videos ?? [];
  const totalPhotos = allPhotos.length;
  const hasMedia = totalPhotos > 0 || allVideos.length > 0;

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && mediaType === 'photo' && totalPhotos > 1)
        setActiveMedia(p => (p - 1 + totalPhotos) % totalPhotos);
      if (e.key === 'ArrowRight' && mediaType === 'photo' && totalPhotos > 1)
        setActiveMedia(p => (p + 1) % totalPhotos);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, mediaType, totalPhotos]);

  const isYouTube = (url: string) => url.includes('youtube.com') || url.includes('youtu.be');
  const getYouTubeId = (url: string) => {
    const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    return m ? m[1] : '';
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col lg:flex-row overflow-hidden flex-1 min-h-0">

            {/* ── LEFT: Media Viewer ─────────────────────────── */}
            <div className="lg:w-[55%] flex-shrink-0 bg-gray-900 flex flex-col">

              {/* Media tabs (Photos / Videos) */}
              {allVideos.length > 0 && (
                <div className="flex gap-1 p-3 bg-black/30">
                  <button
                    onClick={() => setMediaType('photo')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${mediaType === 'photo' ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'}`}
                  >
                    📷 Photos {totalPhotos > 0 && `(${totalPhotos})`}
                  </button>
                  <button
                    onClick={() => setMediaType('video')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${mediaType === 'video' ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'}`}
                  >
                    🎬 Videos ({allVideos.length})
                  </button>
                </div>
              )}

              {/* Main media display */}
              <div className="relative flex-1 min-h-[250px] lg:min-h-0 overflow-hidden">
                {!hasMedia ? (
                  /* No media placeholder */
                  <div className="w-full h-full flex flex-col items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}30, ${accentColor}30)` }}>
                    <Bed className="h-16 w-16 opacity-20 text-white mb-3" />
                    <p className="text-white/40 text-sm">No photos available</p>
                  </div>
                ) : mediaType === 'photo' && allPhotos.length > 0 ? (
                  <>
                    {/* Photo */}
                    <img
                      key={activeMedia}
                      src={allPhotos[activeMedia]}
                      alt={`${room.name} — photo ${activeMedia + 1}`}
                      className="w-full h-full object-cover animate-fade-in"
                      style={{ animation: 'fadeIn 0.3s ease' }}
                    />

                    {/* Photo counter */}
                    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full">
                      {activeMedia + 1} / {totalPhotos}
                    </div>

                    {/* Prev/Next arrows */}
                    {totalPhotos > 1 && (
                      <>
                        <button
                          onClick={() => setActiveMedia(p => (p - 1 + totalPhotos) % totalPhotos)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-all hover:scale-110"
                        >
                          <ChevronDown className="h-5 w-5 rotate-90" />
                        </button>
                        <button
                          onClick={() => setActiveMedia(p => (p + 1) % totalPhotos)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-all hover:scale-110"
                        >
                          <ChevronDown className="h-5 w-5 -rotate-90" />
                        </button>
                      </>
                    )}
                  </>
                ) : mediaType === 'video' && allVideos.length > 0 ? (
                  /* Video */
                  <div className="w-full h-full">
                    {isYouTube(allVideos[0]) ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${getYouTubeId(allVideos[0])}?autoplay=0&rel=0`}
                        className="w-full h-full"
                        frameBorder="0"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    ) : (
                      <video src={allVideos[0]} controls className="w-full h-full object-contain bg-black">
                        Your browser does not support the video tag.
                      </video>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Thumbnail strip */}
              {mediaType === 'photo' && totalPhotos > 1 && (
                <div className="flex gap-2 p-3 bg-black/60 overflow-x-auto">
                  {allPhotos.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveMedia(i)}
                      className={`flex-shrink-0 h-14 w-20 rounded-lg overflow-hidden border-2 transition-all hover:opacity-100 ${
                        activeMedia === i ? 'border-white opacity-100 scale-105' : 'border-transparent opacity-60'
                      }`}
                    >
                      <img src={img} alt={`thumb ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Video thumbnail strip */}
              {mediaType === 'video' && allVideos.length > 1 && (
                <div className="flex gap-2 p-3 bg-black/60 overflow-x-auto">
                  {allVideos.map((vid, i) => (
                    <button key={i} onClick={() => {}}
                      className="flex-shrink-0 h-14 w-20 rounded-lg bg-gray-700 flex items-center justify-center text-white/60 border-2 border-white/30">
                      ▶
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── RIGHT: Room Details ────────────────────────── */}
            <div className="lg:flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">

                {/* Room name + type */}
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-bold text-white px-3 py-1 rounded-full"
                      style={{ backgroundColor: primaryColor }}>
                      {ROOM_TYPE_LABELS[room.type] ?? room.type}
                    </span>
                    {room.floor && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                        Floor {room.floor}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{room.name}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Room #{room.number}</p>
                </div>

                {/* Price */}
                <div className="flex items-end gap-2 py-3 border-y border-gray-100">
                  <span className="text-3xl font-bold" style={{ color: primaryColor }}>
                    {fmt(Number(room.basePrice), currency)}
                  </span>
                  <span className="text-gray-400 text-sm mb-1">per night</span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Users, label: 'Max Guests', value: `${room.maxOccupancy} ${room.maxOccupancy === 1 ? 'guest' : 'guests'}` },
                    { icon: Bed, label: 'Room Type', value: ROOM_TYPE_LABELS[room.type] ?? room.type },
                    { icon: ChevronDown, label: 'Floor', value: room.floor ? `Floor ${room.floor}` : 'Ground Floor' },
                    { icon: CheckCircle, label: 'Status', value: 'Available' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="rounded-xl p-3" style={{ backgroundColor: `${primaryColor}08` }}>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Description */}
                {room.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">About this room</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{room.description}</p>
                  </div>
                )}

                {/* Amenities */}
                {room.amenities.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Amenities</h4>
                    <div className="flex flex-wrap gap-2">
                      {room.amenities.map(amenity => (
                        <span key={amenity}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border"
                          style={{ borderColor: `${primaryColor}40`, color: primaryColor, backgroundColor: `${primaryColor}08` }}>
                          <AmenityIcon amenity={amenity} />
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Policies */}
                <div className="rounded-xl bg-gray-50 p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Room Policies</h4>
                  <div className="grid grid-cols-2 gap-y-1.5 text-xs text-gray-500">
                    <span>✓ Free cancellation (48h)</span>
                    <span>✓ Complimentary Wi-Fi</span>
                    <span>✓ Daily housekeeping</span>
                    <span>✓ 24/7 room service</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Footer CTA */}
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-t bg-white">
            <div>
              <p className="text-xs text-gray-400">Starting from</p>
              <p className="text-xl font-bold" style={{ color: primaryColor }}>
                {fmt(Number(room.basePrice), currency)}
                <span className="text-sm font-normal text-gray-400"> / night</span>
              </p>
            </div>
            <button
              onClick={() => { onBook(room); onClose(); }}
              className="flex items-center gap-2 px-8 py-3.5 rounded-full text-white font-semibold text-sm transition-all hover:opacity-90 hover:scale-105 shadow-lg"
              style={{ backgroundColor: accentColor, color: '#1a1a1a' }}
            >
              <Calendar className="h-4 w-4" />
              Book This Room
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Menu category helpers ─────────────────────────────────────────────────── */
const CAT_COLORS: Record<string, string> = {
  BREAKFAST: '#f59e0b', LUNCH: '#f97316', DINNER: '#ef4444',
  APPETIZER: '#22c55e', DESSERT: '#ec4899', BEVERAGE: '#3b82f6', SPECIAL: '#8b5cf6',
};
const CAT_ICONS: Record<string, React.ElementType> = {
  BREAKFAST: Coffee, LUNCH: UtensilsCrossed, DINNER: ChefHat,
  APPETIZER: Utensils, DESSERT: Star, BEVERAGE: Coffee, SPECIAL: Star,
};

/* ── Menu + Order Section ──────────────────────────────────────────────────── */
function MenuSection({ data, primaryColor, accentColor }: {
  data: ResortData; primaryColor: string; accentColor: string;
}) {
  const slug = data.tenant.slug;
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({ guestName: '', roomNumber: '', bookingRef: '', email: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ orderId: string; totalAmount: number; itemCount: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/site/${slug}/menu`)
      .then(r => r.json())
      .then(j => { setMenuItems(j.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  const categories = ['ALL', ...Array.from(new Set(menuItems.map(i => i.category)))];
  const filtered = activeCategory === 'ALL' ? menuItems : menuItems.filter(i => i.category === activeCategory);

  const addToCart = (item: MenuItem) => {
    setCart(c => {
      const existing = c.find(ci => ci.item.id === item.id);
      if (existing) return c.map(ci => ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      return [...c, { item, quantity: 1, notes: '' }];
    });
    setCartOpen(true);
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) setCart(c => c.filter(ci => ci.item.id !== id));
    else setCart(c => c.map(ci => ci.item.id === id ? { ...ci, quantity: qty } : ci));
  };

  const cartTotal = cart.reduce((s, ci) => s + Number(ci.item.price) * ci.quantity, 0);
  const cartCount = cart.reduce((s, ci) => s + ci.quantity, 0);

  const submitOrder = async () => {
    if (!orderForm.guestName) { setError('Please enter your name'); return; }
    if (!orderForm.roomNumber && !orderForm.bookingRef) { setError('Please provide your room number or booking reference'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/site/${slug}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: orderForm.guestName,
          roomNumber: orderForm.roomNumber || undefined,
          bookingRef: orderForm.bookingRef || undefined,
          email: orderForm.email || undefined,
          notes: orderForm.notes || undefined,
          items: cart.map(ci => ({ menuItemId: ci.item.id, quantity: ci.quantity, notes: ci.notes || undefined })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Order failed'); setSubmitting(false); return; }
      setOrderSuccess(json.data);
      setCart([]);
    } catch { setError('Something went wrong.'); }
    setSubmitting(false);
  };

  if (loading) return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200" style={{ borderTopColor: primaryColor }} />
      </div>
    </section>
  );

  if (menuItems.length === 0) return null;

  return (
    <section id="menu" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accentColor }}>Restaurant</p>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900">Our Menu</h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto">
            Freshly prepared dishes available for in-room dining and restaurant service
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 flex-wrap justify-center mb-10">
          {categories.map(cat => {
            const CatIcon = cat !== 'ALL' ? (CAT_ICONS[cat] ?? Utensils) : UtensilsCrossed;
            const isActive = activeCategory === cat;
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border-2"
                style={{
                  backgroundColor: isActive ? primaryColor : 'transparent',
                  borderColor: isActive ? primaryColor : '#e5e7eb',
                  color: isActive ? 'white' : '#6b7280',
                }}>
                <CatIcon className="h-3.5 w-3.5" />
                {cat === 'ALL' ? 'All Items' : cat}
              </button>
            );
          })}
        </div>

        {/* Menu Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(item => {
            const inCart = cart.find(ci => ci.item.id === item.id);
            const catColor = CAT_COLORS[item.category] ?? '#6b7280';
            return (
              <div key={item.id}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col">
                {/* Image or color block */}
                <div className="relative h-40 overflow-hidden flex-shrink-0">
                  {item.image ? (
                    <img src={item.image} alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${catColor}20, ${catColor}40)` }}>
                      {(() => { const Icon = CAT_ICONS[item.category] ?? Utensils; return <Icon className="h-10 w-10 opacity-40" style={{ color: catColor }} />; })()}
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: catColor + 'dd' }}>
                      {item.category}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.name}</h3>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <span className="text-lg font-bold" style={{ color: primaryColor }}>
                      {fmt(Number(item.price), data.tenant.currency)}
                    </span>

                    {inCart ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateQty(item.id, inCart.quantity - 1)}
                          className="h-7 w-7 rounded-full border-2 flex items-center justify-center transition-colors hover:bg-gray-100"
                          style={{ borderColor: primaryColor }}>
                          <Minus className="h-3 w-3" style={{ color: primaryColor }} />
                        </button>
                        <span className="w-5 text-center text-sm font-bold" style={{ color: primaryColor }}>
                          {inCart.quantity}
                        </span>
                        <button onClick={() => addToCart(item)}
                          className="h-7 w-7 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90"
                          style={{ backgroundColor: primaryColor }}>
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-all hover:opacity-90 hover:scale-105"
                        style={{ backgroundColor: primaryColor }}>
                        <Plus className="h-3 w-3" /> Add
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Cart Button */}
        {cartCount > 0 && !cartOpen && (
          <button onClick={() => setCartOpen(true)}
            className="fixed bottom-8 right-8 z-40 flex items-center gap-3 px-5 py-3.5 rounded-full text-white shadow-2xl transition-all hover:scale-105 hover:shadow-xl"
            style={{ backgroundColor: primaryColor }}>
            <ShoppingCart className="h-5 w-5" />
            <span className="font-semibold text-sm">View Order</span>
            <span className="flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold"
              style={{ backgroundColor: accentColor, color: '#1a1a1a' }}>
              {cartCount}
            </span>
          </button>
        )}

        {/* Cart Drawer */}
        {cartOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
            <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
              {/* Cart Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b"
                style={{ backgroundColor: primaryColor }}>
                <div className="flex items-center gap-2 text-white">
                  <ShoppingCart className="h-5 w-5" />
                  <h3 className="font-bold">Your Order</h3>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{cartCount} items</span>
                </div>
                <button onClick={() => setCartOpen(false)} className="text-white/80 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {orderSuccess ? (
                  /* Success State */
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                      style={{ backgroundColor: primaryColor + '20' }}>
                      <CheckCircle className="h-8 w-8" style={{ color: primaryColor }} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Order Placed!</h3>
                    <p className="text-gray-500 mt-2 text-sm">
                      Our kitchen has received your order and will deliver to your room shortly.
                    </p>
                    <div className="mt-6 w-full rounded-2xl p-4 text-left space-y-2"
                      style={{ backgroundColor: primaryColor + '10' }}>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Order ID</span>
                        <span className="font-mono font-bold text-xs" style={{ color: primaryColor }}>
                          {orderSuccess.orderId.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Items</span>
                        <span className="font-medium">{orderSuccess.itemCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total</span>
                        <span className="font-bold text-base">{fmt(orderSuccess.totalAmount, data.tenant.currency)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { setOrderSuccess(null); setCartOpen(false); setOrderForm({ guestName: '', roomNumber: '', bookingRef: '', email: '', notes: '' }); }}
                      className="mt-6 px-6 py-3 rounded-full text-white font-semibold text-sm"
                      style={{ backgroundColor: primaryColor }}>
                      Order More
                    </button>
                  </div>
                ) : (
                  <div className="p-6 space-y-5">
                    {/* Cart Items */}
                    {cart.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Your cart is empty</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {cart.map(ci => (
                            <div key={ci.item.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                              {ci.item.image && (
                                <img src={ci.item.image} alt={ci.item.name}
                                  className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{ci.item.name}</p>
                                <p className="text-xs text-gray-500">{fmt(Number(ci.item.price), data.tenant.currency)} each</p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button onClick={() => updateQty(ci.item.id, ci.quantity - 1)}
                                  className="h-6 w-6 rounded-full border flex items-center justify-center hover:bg-white transition-colors">
                                  <Minus className="h-3 w-3 text-gray-500" />
                                </button>
                                <span className="w-5 text-center text-sm font-bold text-gray-900">{ci.quantity}</span>
                                <button onClick={() => updateQty(ci.item.id, ci.quantity + 1)}
                                  className="h-6 w-6 rounded-full border flex items-center justify-center hover:bg-white transition-colors">
                                  <Plus className="h-3 w-3 text-gray-500" />
                                </button>
                                <button onClick={() => updateQty(ci.item.id, 0)}
                                  className="h-6 w-6 rounded-full flex items-center justify-center ml-1 hover:bg-red-50 transition-colors">
                                  <Trash2 className="h-3 w-3 text-red-400" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Order Total */}
                        <div className="flex justify-between items-center py-3 border-t border-gray-100">
                          <span className="font-semibold text-gray-700">Total</span>
                          <span className="text-xl font-bold" style={{ color: primaryColor }}>
                            {fmt(cartTotal, data.tenant.currency)}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Delivery Details */}
                    {cart.length > 0 && (
                      <div className="space-y-4 pt-2 border-t border-gray-100">
                        <h4 className="font-semibold text-gray-900 text-sm">Delivery Details</h4>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Your Name *</label>
                          <input value={orderForm.guestName}
                            onChange={e => setOrderForm(p => ({ ...p, guestName: e.target.value }))}
                            placeholder="John Smith"
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all"
                            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Room Number</label>
                            <input value={orderForm.roomNumber}
                              onChange={e => setOrderForm(p => ({ ...p, roomNumber: e.target.value }))}
                              placeholder="e.g. 201"
                              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Booking Ref</label>
                            <input value={orderForm.bookingRef}
                              onChange={e => setOrderForm(p => ({ ...p, bookingRef: e.target.value }))}
                              placeholder="e.g. BK-12345"
                              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 -mt-2">Provide either your room number or booking reference</p>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Email (optional)</label>
                          <input type="email" value={orderForm.email}
                            onChange={e => setOrderForm(p => ({ ...p, email: e.target.value }))}
                            placeholder="For order updates"
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2" />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">Special Instructions</label>
                          <textarea value={orderForm.notes}
                            onChange={e => setOrderForm(p => ({ ...p, notes: e.target.value }))}
                            rows={2} placeholder="Allergies, spice level, dietary needs..."
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none" />
                        </div>

                        {error && <p className="text-red-500 text-xs">{error}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && !orderSuccess && (
                <div className="border-t px-6 py-4">
                  <button onClick={submitOrder} disabled={submitting}
                    className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: primaryColor }}>
                    {submitting ? 'Placing Order...' : (
                      <><Send className="h-4 w-4" /> Place Order · {fmt(cartTotal, data.tenant.currency)}</>
                    )}
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Payment at delivery or charged to your room
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ── Booking Form ────────────────────────────────────────────────────────────── */
function BookingSection({ data }: { data: ResortData }) {
  const { tenant, rooms } = data;
  const slug = tenant.slug;
  const primary = data.website.primaryColor || '#1a6b5e';
  const accent = data.website.accentColor || '#d4a853';

  const [step, setStep] = useState<'dates' | 'rooms' | 'details' | 'success'>('dates');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(2);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', specialRequests: '' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ confirmationNo: string; totalAmount: number; nights: number } | null>(null);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const checkAvailability = async () => {
    if (!checkIn || !checkOut) { setError('Please select dates'); return; }
    setError(''); setLoadingRooms(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/site/${slug}/availability?checkIn=${checkIn}&checkOut=${checkOut}`);
      const json = await res.json();
      setAvailableRooms(json.data || []);
      setStep('rooms');
    } catch { setError('Failed to check availability'); }
    setLoadingRooms(false);
  };

  const submitBooking = async () => {
    if (!selectedRoom || !form.firstName || !form.lastName || !form.email) { setError('Please fill all required fields'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/site/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, roomId: selectedRoom.id, checkIn, checkOut, adults }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Booking failed'); setSubmitting(false); return; }
      setConfirmation(json.data);
      setStep('success');
    } catch { setError('Something went wrong. Please try again.'); }
    setSubmitting(false);
  };

  return (
    <section id="booking" className="py-24 bg-gray-50">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>Reserve</p>
          <h2 className="text-4xl font-bold text-gray-900">Book Your Stay</h2>
          <p className="mt-3 text-gray-500">Check-in: {tenant.checkInTime} · Check-out: {tenant.checkOutTime}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Step Indicator */}
          <div className="flex border-b">
            {[
              { id: 'dates', label: '1. Dates' },
              { id: 'rooms', label: '2. Room' },
              { id: 'details', label: '3. Details' },
            ].map(({ id, label }) => (
              <div key={id} className="flex-1 py-4 text-center text-sm font-medium transition-colors"
                style={{
                  borderBottom: step === id ? `3px solid ${primary}` : '3px solid transparent',
                  color: step === id ? primary : '#9ca3af',
                }}>
                {label}
              </div>
            ))}
          </div>

          <div className="p-8">
            {/* Step 1: Dates */}
            {step === 'dates' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Check-In Date</label>
                    <input type="date" value={checkIn} min={today} onChange={e => setCheckIn(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': primary } as React.CSSProperties} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Check-Out Date</label>
                    <input type="date" value={checkOut} min={checkIn || today} onChange={e => setCheckOut(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': primary } as React.CSSProperties} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Guests</label>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setAdults(Math.max(1, adults - 1))}
                      className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-lg hover:bg-gray-50 transition-colors">−</button>
                    <span className="text-lg font-semibold w-8 text-center">{adults}</span>
                    <button onClick={() => setAdults(Math.min(10, adults + 1))}
                      className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center text-lg hover:bg-gray-50 transition-colors">+</button>
                    <span className="text-sm text-gray-500">{adults === 1 ? '1 adult' : `${adults} adults`}</span>
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button onClick={checkAvailability} disabled={loadingRooms}
                  className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: primary }}>
                  {loadingRooms ? 'Checking...' : <><Calendar className="h-4 w-4" /> Check Availability</>}
                </button>
              </div>
            )}

            {/* Step 2: Room Selection */}
            {step === 'rooms' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">{availableRooms.length} room{availableRooms.length !== 1 ? 's' : ''} available</p>
                  <button onClick={() => setStep('dates')} className="text-sm underline text-gray-400 hover:text-gray-600">← Change dates</button>
                </div>
                {availableRooms.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 font-medium">No rooms available for these dates</p>
                    <button onClick={() => setStep('dates')} className="mt-3 text-sm underline" style={{ color: primary }}>Try different dates</button>
                  </div>
                ) : (
                  availableRooms.map(room => {
                    const nights = checkIn && checkOut ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000) : 1;
                    const isSelected = selectedRoom?.id === room.id;
                    return (
                      <div key={room.id} onClick={() => setSelectedRoom(room)}
                        className="rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-md"
                        style={{ borderColor: isSelected ? primary : '#e5e7eb', backgroundColor: isSelected ? `${primary}08` : 'white' }}>
                        <div className="flex gap-4">
                          {room.images[0] && (
                            <img src={room.images[0]} alt={room.name} className="w-24 h-20 object-cover rounded-xl flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-gray-900">{room.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{room.type.replace('_', ' ')} · Up to {room.maxOccupancy} guests</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-lg" style={{ color: primary }}>{fmt(Number(room.basePrice), tenant.currency)}</p>
                                <p className="text-xs text-gray-400">per night</p>
                                {nights > 1 && <p className="text-xs font-medium text-gray-600 mt-0.5">{fmt(Number(room.basePrice) * nights, tenant.currency)} total</p>}
                              </div>
                            </div>
                            {room.amenities.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {room.amenities.slice(0, 4).map(a => (
                                  <span key={a} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-600">
                                    <AmenityIcon amenity={a} /> {a}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t flex items-center justify-between">
                            <span className="text-xs font-semibold" style={{ color: primary }}>✓ Selected</span>
                            <button onClick={(e) => { e.stopPropagation(); setStep('details'); }}
                              className="text-sm font-semibold text-white px-4 py-1.5 rounded-lg transition-all hover:opacity-90"
                              style={{ backgroundColor: primary }}>
                              Continue →
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Step 3: Guest Details */}
            {step === 'details' && selectedRoom && (
              <div className="space-y-5">
                <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: `${primary}10` }}>
                  <Bed className="h-5 w-5 flex-shrink-0" style={{ color: primary }} />
                  <div>
                    <p className="font-semibold text-sm">{selectedRoom.name}</p>
                    <p className="text-xs text-gray-500">{checkIn} → {checkOut} · {adults} guest{adults !== 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={() => setStep('rooms')} className="ml-auto text-xs underline text-gray-400">Change</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[{ key: 'firstName', label: 'First Name', ph: 'John' }, { key: 'lastName', label: 'Last Name', ph: 'Smith' }].map(f => (
                    <div key={f.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label} *</label>
                      <input value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.ph} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="john@example.com" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                    <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+1 234 567 8900" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Special Requests</label>
                  <textarea value={form.specialRequests} onChange={e => setForm(p => ({ ...p, specialRequests: e.target.value }))}
                    rows={2} placeholder="Dietary needs, room preferences, celebrations..."
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-none" />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button onClick={submitBooking} disabled={submitting}
                  className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: primary }}>
                  {submitting ? 'Confirming...' : `Confirm Booking · ${fmt(Number(selectedRoom.basePrice) * Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)), tenant.currency)}`}
                </button>
              </div>
            )}

            {/* Success */}
            {step === 'success' && confirmation && (
              <div className="text-center py-8">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-4" style={{ backgroundColor: `${primary}15` }}>
                  <CheckCircle className="h-8 w-8" style={{ color: primary }} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Booking Confirmed!</h3>
                <p className="mt-2 text-gray-500">We'll contact you shortly to finalize your reservation.</p>
                <div className="mt-6 rounded-2xl p-5 text-left space-y-2" style={{ backgroundColor: `${primary}08` }}>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Confirmation #</span><span className="font-mono font-bold" style={{ color: primary }}>{confirmation.confirmationNo}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Nights</span><span className="font-medium">{confirmation.nights}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Total</span><span className="font-bold text-lg">{fmt(confirmation.totalAmount, tenant.currency)}</span></div>
                </div>
                <button onClick={() => { setStep('dates'); setCheckIn(''); setCheckOut(''); setSelectedRoom(null); setConfirmation(null); setForm({ firstName: '', lastName: '', email: '', phone: '', specialRequests: '' }); }}
                  className="mt-6 text-sm underline" style={{ color: primary }}>
                  Make another reservation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Feedback Section ─────────────────────────────────────────────────────── */
function FeedbackSection({ data }: { data: ResortData }) {
  const { tenant } = data;
  const primary = data.website.primaryColor || '#1a6b5e';
  const accent = data.website.accentColor || '#d4a853';
  const [type, setType] = useState<'FEEDBACK' | 'COMPLAINT' | 'REQUEST' | 'OTHER'>('FEEDBACK');
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) { setError('Please fill all fields'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/site/${tenant.slug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type }),
      });
      if (res.ok) { setSent(true); }
      else { const j = await res.json(); setError(j.error || 'Submission failed'); }
    } catch { setError('Something went wrong.'); }
    setSubmitting(false);
  };

  return (
    <section id="feedback" className="py-24 bg-white">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>We Listen</p>
          <h2 className="text-4xl font-bold text-gray-900">Share Your Thoughts</h2>
          <p className="mt-3 text-gray-500">Your feedback helps us create exceptional experiences</p>
        </div>

        {sent ? (
          <div className="text-center py-16 rounded-3xl border-2 border-dashed border-gray-200">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-4" style={{ backgroundColor: `${primary}15` }}>
              <Send className="h-7 w-7" style={{ color: primary }} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Thank you!</h3>
            <p className="mt-2 text-gray-500">Our team will review your message and respond promptly.</p>
            <button onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
              className="mt-6 text-sm font-medium underline" style={{ color: primary }}>Send another message</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 bg-gray-50 rounded-3xl p-8">
            {/* Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { v: 'FEEDBACK', label: '💬 Feedback' },
                  { v: 'COMPLAINT', label: '⚠️ Complaint' },
                  { v: 'REQUEST', label: '🙏 Request' },
                  { v: 'OTHER', label: '📝 Other' },
                ] as const).map(opt => (
                  <button key={opt.v} type="button" onClick={() => setType(opt.v)}
                    className="py-2.5 rounded-xl text-xs font-medium border-2 transition-all"
                    style={{
                      borderColor: type === opt.v ? primary : '#e5e7eb',
                      backgroundColor: type === opt.v ? `${primary}10` : 'white',
                      color: type === opt.v ? primary : '#6b7280',
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Jane Doe" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="jane@example.com" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject *</label>
              <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="Brief subject of your message" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
              <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                rows={5} placeholder="Tell us about your experience or request in detail..."
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-none" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: primary }}>
              {submitting ? 'Sending...' : <><Send className="h-4 w-4" /> Send Message</>}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

/* ── Main Luxe Template ─────────────────────────────────────────────────────── */
export function LuxeTemplate({ data }: { data: ResortData }) {
  const { tenant, website, rooms } = data;
  const primary = website.primaryColor || '#1a6b5e';
  const accent = website.accentColor || '#d4a853';
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { id: 'about', label: 'About' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'menu', label: 'Menu' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'booking', label: 'Book Now' },
    { id: 'feedback', label: 'Contact' },
  ].filter(item => {
    if (item.id === 'gallery') return (website.galleryImages ?? []).length > 0;
    return true;
  });

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setNavOpen(false);
    setActiveSection(id);
  };

  return (
    <div className="font-sans antialiased" style={{ '--primary': primary, '--accent': accent } as React.CSSProperties}>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {tenant.logoUrl
              ? <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-auto" />
              : <span className="text-xl font-bold" style={{ color: scrolled ? primary : 'white' }}>{tenant.name}</span>
            }
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <button key={item.id} onClick={() => scrollTo(item.id)}
                className={`text-sm font-medium transition-colors ${item.id === 'booking' ? 'text-white px-5 py-2 rounded-full' : `${scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/80 hover:text-white'}`}`}
                style={item.id === 'booking' ? { backgroundColor: accent } : {}}>
                {item.label}
              </button>
            ))}
          </div>

          {/* Mobile menu */}
          <button onClick={() => setNavOpen(!navOpen)} className="md:hidden" style={{ color: scrolled ? '#374151' : 'white' }}>
            {navOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {navOpen && (
          <div className="md:hidden bg-white border-t shadow-lg px-6 py-4 space-y-3">
            {navItems.map(item => (
              <button key={item.id} onClick={() => scrollTo(item.id)}
                className="block w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 py-2">
                {item.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section id="hero" className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
        {website.heroImage ? (
          <>
            <div className="absolute inset-0">
              <img src={website.heroImage} alt={website.heroTitle} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primary} 0%, #0d4037 50%, #071f1c 100%)` }} />
        )}

        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] mb-6 opacity-80" style={{ color: accent }}>
            {tenant.name}
          </p>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">{website.heroTitle}</h1>
          {website.heroSubtitle && (
            <p className="text-xl md:text-2xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">{website.heroSubtitle}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => scrollTo('booking')}
              className="px-8 py-4 rounded-full font-semibold text-sm tracking-wide transition-all hover:scale-105 shadow-lg"
              style={{ backgroundColor: accent, color: '#1a1a1a' }}>
              Book Your Stay <ArrowRight className="inline h-4 w-4 ml-1" />
            </button>
            <button onClick={() => scrollTo('rooms')}
              className="px-8 py-4 rounded-full font-semibold text-sm tracking-wide border-2 border-white/40 text-white backdrop-blur-sm hover:bg-white/10 transition-all">
              Explore Rooms
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <button onClick={() => scrollTo('about')}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 animate-bounce">
          <ChevronDown className="h-8 w-8" />
        </button>
      </section>

      {/* ── About ────────────────────────────────────────────────────────────── */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: accent }}>
                Our Story
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                {website.aboutTitle || `Welcome to ${tenant.name}`}
              </h2>
              <p className="text-lg text-gray-500 leading-relaxed mb-8">
                {website.aboutText || 'Experience unparalleled luxury and comfort in our world-class resort, where every detail is crafted to make your stay unforgettable.'}
              </p>
              <div className="grid grid-cols-3 gap-6">
                {[
                  { label: 'Check-In', value: tenant.checkInTime || '14:00' },
                  { label: 'Check-Out', value: tenant.checkOutTime || '11:00' },
                  { label: 'Rooms', value: `${rooms.length}+` },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center p-4 rounded-2xl" style={{ backgroundColor: `${primary}08` }}>
                    <p className="text-2xl font-bold" style={{ color: primary }}>{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              {website.aboutImage ? (
                <img src={website.aboutImage} alt="About" className="w-full h-96 object-cover rounded-3xl shadow-2xl" />
              ) : (
                <div className="w-full h-96 rounded-3xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primary}20, ${accent}20)` }}>
                  <p className="text-gray-400">About image</p>
                </div>
              )}
              {/* Floating badge */}
              <div className="absolute -bottom-6 -left-6 rounded-2xl p-4 shadow-xl bg-white">
                <div className="flex items-center gap-2">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" style={{ color: accent }} />)}
                </div>
                <p className="text-xs font-medium text-gray-700 mt-1">5-Star Experience</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Rooms ────────────────────────────────────────────────────────────── */}
      <section id="rooms" className="py-24" style={{ backgroundColor: `${primary}05` }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>Accommodations</p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">Rooms & Villas</h2>
            <p className="mt-4 text-gray-500 max-w-xl mx-auto">Each space is designed to offer the perfect blend of luxury and comfort</p>
          </div>

          {rooms.length === 0 ? (
            <div className="text-center py-16 text-gray-400">Rooms coming soon</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className="group bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                >
                  <div className="relative h-56 overflow-hidden">
                    {room.images[0] ? (
                      <img src={room.images[0]} alt={room.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${primary}15` }}>
                        <Bed className="h-12 w-12 opacity-30" style={{ color: primary }} />
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                      <span className="text-xs font-semibold text-white px-3 py-1 rounded-full backdrop-blur-sm" style={{ backgroundColor: `${primary}CC` }}>
                        {room.type.replace('_', ' ')}
                      </span>
                    </div>
                    {/* Photo count badge */}
                    {room.images.length > 0 && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
                        📷 {room.images.length}
                        {room.videos?.length > 0 && <> · 🎬 {room.videos.length}</>}
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
                        View Details
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{room.name}</h3>
                    {room.description && <p className="text-sm text-gray-500 mb-4 line-clamp-2">{room.description}</p>}

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {room.maxOccupancy} guests</span>
                    </div>

                    {room.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {room.amenities.slice(0, 4).map(a => (
                          <span key={a} className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1" style={{ backgroundColor: `${primary}10`, color: primary }}>
                            <AmenityIcon amenity={a} /> {a}
                          </span>
                        ))}
                        {room.amenities.length > 4 && (
                          <span className="text-xs text-gray-400">+{room.amenities.length - 4} more</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div>
                        <span className="text-2xl font-bold" style={{ color: primary }}>{fmt(Number(room.basePrice), tenant.currency)}</span>
                        <span className="text-sm text-gray-400"> / night</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedRoom(room); }}
                          className="px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-all hover:bg-gray-50"
                          style={{ borderColor: primary, color: primary }}>
                          Details
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); scrollTo('booking'); }}
                          className="px-4 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 hover:scale-105"
                          style={{ backgroundColor: primary }}>
                          Book
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Menu ─────────────────────────────────────────────────────────────── */}
      <MenuSection data={data} primaryColor={primary} accentColor={accent} />

      {/* ── Gallery ──────────────────────────────────────────────────────────── */}
      {(website.galleryImages ?? []).length > 0 && (
        <section id="gallery" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>Gallery</p>
              <h2 className="text-4xl font-bold text-gray-900">Visual Journey</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(website.galleryImages ?? []).map((img, i) => (
                <div key={i} className={`overflow-hidden rounded-2xl ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                  <img src={img} alt={`Gallery ${i + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    style={{ height: i === 0 ? '400px' : '190px' }} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      {(website.testimonials ?? []).length > 0 && (
        <section className="py-24" style={{ backgroundColor: `${primary}05` }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>Reviews</p>
              <h2 className="text-4xl font-bold text-gray-900">Guest Experiences</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(website.testimonials ?? []).map((t, i) => (
                <div key={i} className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className={`h-4 w-4 ${j < t.rating ? 'fill-current' : 'text-gray-200'}`}
                        style={{ color: j < t.rating ? accent : undefined }} />
                    ))}
                  </div>
                  <p className="text-gray-600 italic leading-relaxed mb-5">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    {t.avatar ? (
                      <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: primary }}>
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Booking ──────────────────────────────────────────────────────────── */}
      <BookingSection data={data} />

      {/* ── Feedback ─────────────────────────────────────────────────────────── */}
      <FeedbackSection data={data} />

      {/* ── Room Detail Modal ────────────────────────────────────────────────── */}
      {selectedRoom && (
        <RoomModal
          room={selectedRoom}
          currency={tenant.currency}
          primaryColor={primary}
          accentColor={accent}
          onClose={() => setSelectedRoom(null)}
          onBook={(room) => {
            setSelectedRoom(null);
            // Small delay so modal closes before scrolling
            setTimeout(() => {
              document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
            }, 150);
          }}
        />
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="py-16 text-white" style={{ backgroundColor: primary }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div>
              <p className="text-xl font-bold mb-4">{tenant.name}</p>
              <p className="text-white/60 text-sm leading-relaxed">
                {website.aboutText?.substring(0, 120) || 'Experience luxury at its finest.'}
                {(website.aboutText?.length ?? 0) > 120 ? '...' : ''}
              </p>
            </div>
            <div>
              <p className="font-semibold text-white/80 mb-4 text-sm uppercase tracking-wider">Quick Links</p>
              <div className="space-y-2">
                {navItems.map(item => (
                  <button key={item.id} onClick={() => scrollTo(item.id)}
                    className="block text-sm text-white/60 hover:text-white transition-colors text-left">{item.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-white/80 mb-4 text-sm uppercase tracking-wider">Contact</p>
              <div className="space-y-3 text-sm text-white/60">
                {tenant.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 flex-shrink-0" />{tenant.phone}</p>}
                {tenant.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 flex-shrink-0" />{tenant.email}</p>}
                {tenant.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 flex-shrink-0" />{tenant.address}</p>}
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-xs">© {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
            <p className="text-white/30 text-xs">Powered by ResortPro</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
