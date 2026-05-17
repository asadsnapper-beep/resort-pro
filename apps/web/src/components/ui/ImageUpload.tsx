'use client';

import { useRef, useState, useCallback } from 'react';
import { Upload, X, ImageIcon, Loader2, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: 'profiles' | 'rooms' | 'menu' | 'website' | 'misc';
  label?: string;
  hint?: string;
  aspectRatio?: 'square' | 'video' | 'wide' | 'free';
  className?: string;
  disabled?: boolean;
}

const ASPECT: Record<string, string> = {
  square: 'aspect-square',
  video:  'aspect-video',
  wide:   'aspect-[3/1]',
  free:   '',
};

const MAX_MB = 5;

export function ImageUpload({
  value,
  onChange,
  folder = 'misc',
  label = 'Upload image',
  hint,
  aspectRatio = 'square',
  className,
  disabled = false,
}: ImageUploadProps) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [urlMode, setUrlMode]     = useState(false);
  const [urlInput, setUrlInput]   = useState('');

  const upload = useCallback(async (file: File) => {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed (JPEG, PNG, WebP, GIF)');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${MAX_MB} MB.`);
      return;
    }

    const form = new FormData();
    form.append('file', file);

    setUploading(true);
    try {
      const res = await api.post(`/upload?folder=${folder}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.data.url);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [folder, onChange]);

  const handleFile = useCallback((file: File | null | undefined) => {
    if (file) upload(file);
  }, [upload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }, [disabled, uploading, handleFile]);

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setUrlMode(false);
    setUrlInput('');
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const aspectClass = ASPECT[aspectRatio] ?? '';

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">{label}</span>
          <button
            type="button"
            onClick={() => { setUrlMode(v => !v); setError(null); }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1a6b5e] transition-colors"
          >
            <Link2 className="h-3 w-3" />
            {urlMode ? 'Upload file' : 'Use URL'}
          </button>
        </div>
      )}

      {/* ── URL input mode ──────────────────────────────────────────────── */}
      {urlMode ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
            placeholder="https://example.com/image.jpg"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1a6b5e] focus:outline-none focus:ring-2 focus:ring-[#1a6b5e]/20"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim()}
            className="rounded-lg bg-[#1a6b5e] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-[#145a4f]"
          >
            Apply
          </button>
        </div>
      ) : (
        /* ── Drop zone ──────────────────────────────────────────────────── */
        <div
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); if (!disabled && !uploading) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'relative overflow-hidden rounded-xl border-2 border-dashed transition-all cursor-pointer',
            aspectClass,
            !value && 'flex items-center justify-center',
            dragging ? 'border-[#1a6b5e] bg-[#f0faf8] scale-[1.01]' : 'border-gray-200 hover:border-[#1a6b5e]/50 hover:bg-gray-50',
            (disabled || uploading) && 'cursor-not-allowed opacity-60',
          )}
        >
          {/* Preview */}
          {value && !uploading && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="Preview"
                className={cn(
                  'w-full object-cover',
                  aspectClass || 'max-h-48',
                )}
                onError={() => { onChange(null); setError('Could not load image from that URL'); }}
              />
              {/* Clear button */}
              {!disabled && (
                <button
                  type="button"
                  onClick={clear}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}

          {/* Upload state */}
          {uploading && (
            <div className="flex flex-col items-center gap-2 p-6 text-[#1a6b5e]">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-xs font-medium">Uploading…</p>
            </div>
          )}

          {/* Empty state */}
          {!value && !uploading && (
            <div className="flex flex-col items-center gap-2 p-6 text-gray-400 select-none">
              {dragging ? (
                <>
                  <ImageIcon className="h-8 w-8 text-[#1a6b5e]" />
                  <p className="text-xs font-medium text-[#1a6b5e]">Drop to upload</p>
                </>
              ) : (
                <>
                  <Upload className="h-7 w-7" />
                  <div className="text-center">
                    <p className="text-xs font-medium text-gray-600">Click or drag & drop</p>
                    <p className="text-[11px] text-gray-400">JPEG, PNG, WebP · max {MAX_MB} MB</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hint / error */}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {!error && hint && <p className="text-xs text-gray-400">{hint}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        disabled={disabled || uploading}
        onChange={e => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
