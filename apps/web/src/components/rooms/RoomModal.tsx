'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Film, Loader2, BedDouble, Zap, Crown, Home, Leaf, Waves } from 'lucide-react';
import { ImageUpload } from '@/components/ui/ImageUpload';
import type { Room } from '@resort-pro/types';

const ROOM_TYPES = ['STANDARD', 'DELUXE', 'SUITE', 'VILLA', 'COTTAGE', 'BUNGALOW'] as const;

const TYPE_META: Record<string, { label: string; Icon: React.ElementType; bg: string; border: string; text: string }> = {
  STANDARD: { label: 'Standard', Icon: BedDouble, bg: 'var(--rp-surface-3)', border: 'rgba(0,0,0,0.12)',       text: 'var(--rp-text-subtle)' },
  DELUXE:   { label: 'Deluxe',   Icon: Zap,       bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.3)',   text: '#23766a' },
  SUITE:    { label: 'Suite',    Icon: Crown,     bg: '#f5f0fe', border: 'rgba(120,70,200,0.2)',   text: '#7846c8' },
  VILLA:    { label: 'Villa',    Icon: Home,      bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.3)',   text: '#23766a' },
  COTTAGE:  { label: 'Cottage',  Icon: Leaf,      bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.3)',   text: '#23766a' },
  BUNGALOW: { label: 'Bungalow', Icon: Waves,     bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.3)',   text: '#b89040' },
};

const schema = z.object({
  number:       z.string().min(1, 'Room number required').max(10),
  name:         z.string().min(1, 'Room name required').max(100),
  type:         z.enum(ROOM_TYPES),
  floor:        z.coerce.number().int().optional(),
  maxOccupancy: z.coerce.number().int().min(1).max(20),
  basePrice:    z.coerce.number().positive('Price must be positive'),
  description:  z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData & { amenities: string[]; images: string[]; videos: string[] }) => void;
  loading: boolean;
  room?: Room | null;
}

const AMENITY_SUGGESTIONS = [
  'AC', 'WiFi', 'TV', 'Mini Bar', 'Balcony', 'Ocean View', 'Pool View',
  'Jacuzzi', 'Kitchen', 'Living Room', 'Private Pool', 'Garden View', 'Safe Box', 'Bathtub',
];

function isValidUrl(s: string) {
  try { new URL(s); return true; } catch { return false; }
}

const inp = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const lbl = 'block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5 text-[#8aa29a]';
const err = 'mt-1 text-[11.5px] text-[#c43c3c]';

export function RoomModal({ open, onClose, onSubmit, loading, room }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [mounted, setMounted] = useState(false);
  const [amenities,    setAmenities]    = useState<string[]>([]);
  const [amenityInput, setAmenityInput] = useState('');
  const [images,       setImages]       = useState<string[]>([]);
  const [videos,       setVideos]       = useState<string[]>([]);
  const [videoInput,   setVideoInput]   = useState('');
  const [videoError,   setVideoError]   = useState('');
  const [selectedType, setSelectedType] = useState<typeof ROOM_TYPES[number]>('STANDARD');

  useEffect(() => { setMounted(true); }, []);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'STANDARD', maxOccupancy: 2, basePrice: 100 },
  });

  useEffect(() => {
    if (!open) return;
    if (room) {
      reset({
        number: room.number, name: room.name,
        type: room.type as typeof ROOM_TYPES[number],
        floor: room.floor ?? undefined,
        maxOccupancy: room.maxOccupancy,
        basePrice: Number(room.basePrice),
        description: room.description ?? '',
      });
      setSelectedType(room.type as typeof ROOM_TYPES[number]);
      setAmenities(room.amenities ?? []);
      setImages(room.images ?? []);
      setVideos(room.videos ?? []);
    } else {
      reset({ type: 'STANDARD', maxOccupancy: 2, basePrice: 100 });
      setSelectedType('STANDARD');
      setAmenities([]); setImages([]); setVideos([]);
    }
    setAmenityInput(''); setVideoInput(''); setVideoError('');
  }, [room, reset, open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const addAmenity = (a: string) => {
    const t = a.trim();
    if (t && !amenities.includes(t)) setAmenities(p => [...p, t]);
    setAmenityInput('');
  };

  const addVideo = () => {
    const t = videoInput.trim();
    if (!t) return;
    if (!isValidUrl(t)) { setVideoError('Enter a valid URL'); return; }
    if (videos.includes(t)) { setVideoError('Already added'); return; }
    setVideos(p => [...p, t]); setVideoInput(''); setVideoError('');
  };

  const submit = (data: FormData) => onSubmit({ ...data, amenities, images, videos });

  if (!mounted || !open) return null;

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        background: 'rgba(27,52,47,0.5)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '680px',
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '18px',
          background: isDark ? '#1a2e2a' : 'var(--rp-surface)',
          boxShadow: '0 32px 80px rgba(27,52,47,0.35)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{ background: 'var(--rp-btn-accent)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display, serif)', fontSize: '17px', fontWeight: 500, color: 'var(--rp-btn-accent-text)', margin: 0 }}>
              {room ? `Edit — ${room.name}` : 'Add Room'}
            </h2>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
              {room ? 'Update room details and media' : 'Add a new room or villa to your resort'}
            </p>
          </div>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px', width: '28px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)') }
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent') }>
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <form onSubmit={handleSubmit(submit)} id="room-form">
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Row 1: Number + Name + Floor + Guests + Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 90px 110px', gap: '12px', alignItems: 'start' }}>
                <div>
                  <label className={lbl}>Room #</label>
                  <input {...register('number')} placeholder="101" className={inp} />
                  {errors.number && <p className={err}>{errors.number.message}</p>}
                </div>
                <div>
                  <label className={lbl}>Name</label>
                  <input {...register('name')} placeholder="Ocean View Suite" className={inp} />
                  {errors.name && <p className={err}>{errors.name.message}</p>}
                </div>
                <div>
                  <label className={lbl}>Floor</label>
                  <input {...register('floor')} type="number" placeholder="1" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Guests</label>
                  <input {...register('maxOccupancy')} type="number" min={1} max={20} className={inp} />
                  {errors.maxOccupancy && <p className={err}>{errors.maxOccupancy.message}</p>}
                </div>
                <div>
                  <label className={lbl}>Price/Night</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--rp-text-muted)' }}>$</span>
                    <input {...register('basePrice')} type="number" step="0.01" min={0}
                      className={inp} style={{ paddingLeft: '24px' }} />
                  </div>
                  {errors.basePrice && <p className={err}>{errors.basePrice.message}</p>}
                </div>
              </div>

              {/* Room Type */}
              <div>
                <label className={lbl}>Room Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  {ROOM_TYPES.map(t => {
                    const m = TYPE_META[t];
                    const active = selectedType === t;
                    return (
                      <button key={t} type="button"
                        onClick={() => { setSelectedType(t); setValue('type', t); }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                          padding: '10px 6px', borderRadius: '10px', border: `2px solid ${active ? m.border : 'var(--rp-border)'}`,
                          background: active ? m.bg : 'var(--rp-surface-2)', cursor: 'pointer',
                          boxShadow: active ? `0 0 0 2px ${m.border}` : 'none',
                          transition: 'all 0.15s',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '7px', background: active ? 'rgba(255,255,255,0.6)' : 'var(--rp-surface-4)' }}>
                          <m.Icon style={{ width: '14px', height: '14px', color: active ? m.text : 'var(--rp-text-faint)' }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: active ? m.text : 'var(--rp-text-muted)' }}>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                <input type="hidden" {...register('type')} value={selectedType} />
              </div>

              {/* Description */}
              <div>
                <label className={lbl}>Description</label>
                <textarea {...register('description')} rows={2}
                  placeholder="Describe the room experience…"
                  className={inp} style={{ resize: 'none' }} />
              </div>

              {/* Amenities */}
              <div>
                <label className={lbl}>Amenities</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <input value={amenityInput} onChange={e => setAmenityInput(e.target.value)}
                    placeholder="Type custom amenity…"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAmenity(amenityInput); } }}
                    className={inp} />
                  <button type="button" onClick={() => addAmenity(amenityInput)}
                    style={{ flexShrink: 0, width: '38px', height: '38px', borderRadius: '8px', border: 'none', background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {AMENITY_SUGGESTIONS.map(a => {
                    const selected = amenities.includes(a);
                    return (
                      <button key={a} type="button"
                        onClick={() => selected ? setAmenities(p => p.filter(x => x !== a)) : addAmenity(a)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                          cursor: 'pointer', transition: 'all 0.12s',
                          background: selected ? 'var(--rp-teal-bg)' : 'var(--rp-surface-3)',
                          border: `1px solid ${selected ? 'rgba(35,118,106,0.3)' : 'var(--rp-border-md)'}`,
                          color: selected ? '#23766a' : 'var(--rp-text-muted)',
                        }}>
                        {selected ? <X style={{ width: '10px', height: '10px' }} /> : '+'}
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Photos */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label className={lbl} style={{ margin: 0 }}>Photos</label>
                  <span style={{ fontSize: '11.5px', color: 'var(--rp-text-faint)' }}>{images.length} / 8</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {images.map((img, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', background: 'var(--rp-surface-4)' }}
                      className="group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => setImages(p => p.filter((_, idx) => idx !== i))}
                        style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: 'var(--rp-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X style={{ width: '10px', height: '10px' }} />
                      </button>
                    </div>
                  ))}
                  {images.length < 8 && (
                    <ImageUpload value={null} onChange={url => { if (url) setImages(p => [...p, url]); }}
                      folder="rooms" aspectRatio="video" className="col-span-1" />
                  )}
                </div>
              </div>

              {/* Videos */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Film style={{ width: '13px', height: '13px', color: '#9bbdb7' }} />
                    <label className={lbl} style={{ margin: 0 }}>Videos</label>
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--rp-text-faint)' }}>{videos.length} / 4</span>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--rp-text-faint)', marginBottom: '8px' }}>YouTube, Vimeo, or direct MP4 link</p>
                {videos.length < 4 && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: videoError ? '4px' : '8px' }}>
                    <input value={videoInput}
                      onChange={e => { setVideoInput(e.target.value); setVideoError(''); }}
                      placeholder="https://youtube.com/watch?v=…"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVideo(); } }}
                      className={inp} />
                    <button type="button" onClick={addVideo}
                      style={{ flexShrink: 0, width: '38px', height: '38px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', background: 'var(--rp-surface-3)', color: 'var(--rp-text-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus style={{ width: '16px', height: '16px' }} />
                    </button>
                  </div>
                )}
                {videoError && <p className={err} style={{ marginBottom: '6px' }}>{videoError}</p>}
                {videos.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {videos.map((url, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '9px', border: '1px solid rgba(0,0,0,0.06)', background: 'var(--rp-surface-3)' }}>
                        <Film style={{ width: '13px', height: '13px', color: '#9bbdb7', flexShrink: 0 }} />
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, fontSize: '12px', color: '#23766a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                          {url}
                        </a>
                        <button type="button" onClick={() => setVideos(p => p.filter((_, idx) => idx !== i))}
                          style={{ flexShrink: 0, border: 'none', background: 'transparent', color: 'var(--rp-text-faint)', cursor: 'pointer', display: 'flex' }}>
                          <X style={{ width: '13px', height: '13px' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', borderTop: '1px solid rgba(0,0,0,0.06)', background: 'var(--rp-surface-2)' }}>
          <button type="button" onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: '9px', border: '1px solid rgba(0,0,0,0.09)', background: 'transparent', fontSize: '13px', fontWeight: 500, color: 'var(--rp-text-subtle)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" form="room-form" disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', borderRadius: '9px', border: 'none', background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)', fontSize: '13px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading && <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />}
            {room ? 'Save Changes' : 'Add Room'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
