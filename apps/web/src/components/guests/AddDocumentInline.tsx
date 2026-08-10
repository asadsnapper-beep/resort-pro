'use client';

import { useRef, useState, useCallback } from 'react';
import { Camera, Upload, X, FileImage, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// A plain "attach a photo of the ID" picker — no OCR, no field extraction,
// no nested modal (avoids the z-index/scroll-lock class of bugs a full
// second modal-on-modal brings). Two explicit buttons — Use Camera / Upload
// Image — same split as the original scan-capture step, just without OCR
// after. The parent uploads the held file (via guestsApi.uploadDocument)
// once the guest + booking actually exist, tagging it with both IDs.
export interface PendingDocument {
  file: File;
  docType: string;
  previewUrl: string;
}

interface Props {
  value: PendingDocument | null;
  onChange: (doc: PendingDocument | null) => void;
  className?: string;
}

const DOC_TYPES = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'NATIONAL_ID', label: 'National ID' },
  { value: 'DRIVERS_LICENSE', label: "Driver's License" },
  { value: 'OTHER', label: 'Other' },
];

export function AddDocumentInline({ value, onChange, className }: Props) {
  const [docType, setDocType] = useState(value?.docType ?? 'PASSPORT');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const selectDocType = (dt: string) => {
    setDocType(dt);
    if (value) onChange({ ...value, docType: dt });
  };

  const setFile = useCallback((file: File) => {
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange({ file, docType, previewUrl: URL.createObjectURL(file) });
  }, [value, docType, onChange]);

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setCameraOn(true);
      // videoRef isn't mounted until cameraOn flips true and React re-renders
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      });
    } catch {
      setCameraError('Camera access denied. Use "Upload Image" instead.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      setFile(new File([blob], 'document.jpg', { type: 'image/jpeg' }));
      stopCamera();
    }, 'image/jpeg', 0.95);
  }, [setFile, stopCamera]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFile(file);
    e.target.value = '';
  };

  const clear = () => {
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
  };

  return (
    <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3', className)}>
      <div className="flex flex-wrap gap-1.5">
        {DOC_TYPES.map(dt => (
          <button key={dt.value} type="button" onClick={() => selectDocType(dt.value)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
              docType === dt.value
                ? 'border-[#1a6b5e] bg-[#f0faf8] text-[#1a6b5e]'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#1a6b5e]/50',
            )}>
            {dt.label}
          </button>
        ))}
      </div>

      {value ? (
        <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.previewUrl} alt="Document preview" className="w-full max-h-40 object-contain" />
          <button type="button" onClick={clear}
            className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : cameraOn ? (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <button type="button" onClick={capturePhoto}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#1a6b5e] hover:bg-[#145a4f] text-white rounded-lg py-2 text-sm font-semibold">
              <Camera className="h-3.5 w-3.5" /> Capture
            </button>
            <button type="button" onClick={stopCamera}
              className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={startCamera}
              className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 py-4 text-gray-500 dark:text-gray-400 hover:border-[#1a6b5e]/60 hover:bg-[#f0faf8] dark:hover:bg-transparent transition-colors">
              <Camera className="h-5 w-5" />
              <span className="text-xs font-medium">Use Camera</span>
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 py-4 text-gray-500 dark:text-gray-400 hover:border-[#1a6b5e]/60 hover:bg-[#f0faf8] dark:hover:bg-transparent transition-colors">
              <Upload className="h-5 w-5" />
              <span className="text-xs font-medium">Upload Image</span>
            </button>
          </div>
          {cameraError && (
            <p className="flex items-center gap-1 text-[11px] text-red-500">
              <RefreshCw className="h-3 w-3" /> {cameraError}
            </p>
          )}
          <p className="flex items-center gap-1 text-[11px] text-gray-400">
            <FileImage className="h-3 w-3" /> JPG, PNG, WebP — kept with this booking
          </p>
        </>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </div>
  );
}
