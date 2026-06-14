'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Film } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import type { Room } from '@resort-pro/types';

const ROOM_TYPES = ['STANDARD', 'DELUXE', 'SUITE', 'VILLA', 'COTTAGE', 'BUNGALOW'] as const;

const schema = z.object({
  number:       z.string().min(1, 'Room number required').max(10),
  name:         z.string().min(1, 'Room name required').max(100),
  type:         z.enum(ROOM_TYPES),
  floor:        z.coerce.number().int().optional(),
  maxOccupancy: z.coerce.number().int().min(1, 'At least 1 guest').max(20),
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
  'AC', 'WiFi', 'TV', 'Mini Bar', 'Balcony', 'Ocean View', 'Pool View', 'Jacuzzi',
  'Kitchen', 'Living Room', 'Private Pool', 'Garden View', 'Safe Box', 'Bathtub',
];

function isValidUrl(s: string) {
  try { new URL(s); return true; } catch { return false; }
}

export function RoomModal({ open, onClose, onSubmit, loading, room }: Props) {
  const [amenities,    setAmenities]    = useState<string[]>([]);
  const [amenityInput, setAmenityInput] = useState('');
  const [images,       setImages]       = useState<string[]>([]);
  const [videos,       setVideos]       = useState<string[]>([]);
  const [videoInput,   setVideoInput]   = useState('');
  const [videoError,   setVideoError]   = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'STANDARD', maxOccupancy: 2, basePrice: 100 },
  });

  useEffect(() => {
    if (room) {
      reset({
        number:       room.number,
        name:         room.name,
        type:         room.type as typeof ROOM_TYPES[number],
        floor:        room.floor ?? undefined,
        maxOccupancy: room.maxOccupancy,
        basePrice:    Number(room.basePrice),
        description:  room.description ?? '',
      });
      setAmenities(room.amenities ?? []);
      setImages(room.images ?? []);
      setVideos(room.videos ?? []);
    } else {
      reset({ type: 'STANDARD', maxOccupancy: 2, basePrice: 100 });
      setAmenities([]);
      setImages([]);
      setVideos([]);
    }
    setAmenityInput('');
    setVideoInput('');
    setVideoError('');
  }, [room, reset, open]);

  const addAmenity = (a: string) => {
    const trimmed = a.trim();
    if (trimmed && !amenities.includes(trimmed)) setAmenities(p => [...p, trimmed]);
    setAmenityInput('');
  };

  const addVideo = () => {
    const trimmed = videoInput.trim();
    if (!trimmed) return;
    if (!isValidUrl(trimmed)) { setVideoError('Please enter a valid URL (https://...)'); return; }
    if (videos.includes(trimmed)) { setVideoError('This URL is already added'); return; }
    setVideos(p => [...p, trimmed]);
    setVideoInput('');
    setVideoError('');
  };

  const submit = (data: FormData) => onSubmit({ ...data, amenities, images, videos });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={room ? 'Edit Room' : 'Add Room'}
      description={room ? `Editing ${room.name}` : 'Add a new room or villa to your resort'}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-5">

        {/* Row 1: Number + Name */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Room #</label>
            <Input {...register('number')} placeholder="101" />
            {errors.number && <p className="mt-1 text-xs text-red-500">{errors.number.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <Input {...register('name')} placeholder="Ocean View Suite" />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
        </div>

        {/* Row 2: Type + Floor */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
            <select
              {...register('type')}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {ROOM_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Floor</label>
            <Input {...register('floor')} type="number" placeholder="1" />
          </div>
        </div>

        {/* Row 3: Occupancy + Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Max Guests</label>
            <Input {...register('maxOccupancy')} type="number" min={1} max={20} />
            {errors.maxOccupancy && <p className="mt-1 text-xs text-red-500">{errors.maxOccupancy.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Price / Night</label>
            <Input {...register('basePrice')} type="number" step="0.01" min={0} />
            {errors.basePrice && <p className="mt-1 text-xs text-red-500">{errors.basePrice.message}</p>}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Describe the room experience..."
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

        {/* Amenities */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Amenities</label>
          <div className="flex gap-2">
            <Input
              value={amenityInput}
              onChange={e => setAmenityInput(e.target.value)}
              placeholder="Add amenity..."
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAmenity(amenityInput); } }}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => addAmenity(amenityInput)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {/* Suggestions */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {AMENITY_SUGGESTIONS.filter(a => !amenities.includes(a)).map(a => (
              <button key={a} type="button" onClick={() => addAmenity(a)}
                className="rounded-md border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-resort-400 hover:text-resort-600 transition-colors">
                + {a}
              </button>
            ))}
          </div>
          {amenities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {amenities.map(a => (
                <span key={a} className="flex items-center gap-1 rounded-md bg-resort-100 px-2 py-0.5 text-xs font-medium text-resort-700">
                  {a}
                  <button type="button" onClick={() => setAmenities(p => p.filter(x => x !== a))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Room Photos */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Room Photos</label>
            <span className="text-xs text-gray-400">{images.length} / 8 photos</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={i} className="group relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages(p => p.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < 8 && (
              <ImageUpload
                value={null}
                onChange={url => { if (url) setImages(p => [...p, url]); }}
                folder="rooms"
                aspectRatio="video"
                className="col-span-1"
              />
            )}
          </div>
        </div>

        {/* Room Videos (URL only) */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Film className="h-4 w-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Room Videos</label>
            <span className="text-xs text-gray-400 ml-auto">{videos.length} / 4 videos</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Paste a YouTube, Vimeo, or direct MP4 link
          </p>
          {videos.length < 4 && (
            <div className="flex gap-2">
              <Input
                value={videoInput}
                onChange={e => { setVideoInput(e.target.value); setVideoError(''); }}
                placeholder="https://youtube.com/watch?v=... or https://..."
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVideo(); } }}
                className={videoError ? 'border-red-400' : ''}
              />
              <Button type="button" variant="outline" size="icon" onClick={addVideo}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
          {videoError && <p className="mt-1 text-xs text-red-500">{videoError}</p>}
          {videos.length > 0 && (
            <div className="mt-2 space-y-2">
              {videos.map((url, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <Film className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-xs text-blue-600 hover:underline truncate">
                    {url}
                  </a>
                  <button type="button" onClick={() => setVideos(p => p.filter((_, idx) => idx !== i))}
                    className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>
            {room ? 'Save Changes' : 'Add Room'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
