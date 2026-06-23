'use client';

/**
 * DocumentScannerModal.tsx
 * Camera-based guest document scanner.
 *
 * Works on:
 *   - Desktop (Electron + web): webcam via getUserMedia
 *   - Tablet (iPad/Android): rear camera via facingMode: 'environment'
 *
 * Flow:
 *   Open → Camera preview → Capture → Preview → Confirm/Retake → Upload
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, CameraOff, RefreshCw, X, RotateCcw, Check, Upload, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { guestsApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocType = 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE' | 'VISA' | 'OTHER';

const DOC_LABELS: Record<DocType, string> = {
  PASSPORT:        'Passport',
  NATIONAL_ID:     'National ID',
  DRIVERS_LICENSE: 'Driver\'s License',
  VISA:            'Visa',
  OTHER:           'Other Document',
};

interface Props {
  guestId: string;
  guestName: string;
  onClose: () => void;
  onUploaded: (doc: { id: string; imageUrl: string; docType: DocType }) => void;
}

type Step = 'preview' | 'captured' | 'uploading' | 'done';

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentScannerModal({ guestId, guestName, onClose, onUploaded }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [step, setStep]               = useState<Step>('preview');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl]   = useState<string | null>(null);
  const [docType, setDocType]           = useState<DocType>('NATIONAL_ID');
  const [facingMode, setFacingMode]     = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError]   = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);

  // ── Start camera ────────────────────────────────────────────────────────────
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    // Stop existing stream first
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Check if multiple cameras exist (to show switch button)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setHasMultipleCameras(videoInputs.length > 1);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access denied';
      setCameraError(msg.includes('Permission') || msg.includes('denied')
        ? 'Camera permission denied. Please allow camera access in browser settings.'
        : 'Could not access camera. Make sure it is connected and not in use.');
    }
  }, []);

  // Start camera on mount
  useEffect(() => {
    setIsMounted(true);
    document.body.style.overflow = 'hidden';
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      document.body.style.overflow = '';
    };
  }, []);

  // Switch front / rear camera
  const switchCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    await startCamera(next);
  };

  // ── Capture frame ───────────────────────────────────────────────────────────
  const capture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Shutter flash effect
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 150);

    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setCapturedBlob(blob);
      setCapturedUrl(url);
      setStep('captured');

      // Stop live feed
      streamRef.current?.getTracks().forEach(t => t.stop());
    }, 'image/jpeg', 0.92);
  };

  // ── Retake ──────────────────────────────────────────────────────────────────
  const retake = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
    setStep('preview');
    startCamera(facingMode);
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  const upload = async () => {
    if (!capturedBlob) return;
    setStep('uploading');

    try {
      const formData = new FormData();
      formData.append('file', capturedBlob, `document-${Date.now()}.jpg`);
      formData.append('docType', docType);

      const res = await guestsApi.uploadDocument(guestId, formData);
      const doc = res.data.data;

      toast({ title: 'Document saved', description: `${DOC_LABELS[docType]} uploaded successfully` });
      onUploaded(doc);
      setStep('done');

    } catch {
      toast({ title: 'Upload failed', description: 'Could not save document. Please try again.', variant: 'destructive' });
      setStep('captured');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-gray-950 text-white overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="font-semibold text-base flex items-center gap-2">
              <Camera className="h-4 w-4 text-resort-400" />
              Scan Document
            </h2>
            <p className="text-xs text-white/50 mt-0.5">{guestName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Doc type selector */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(DOC_LABELS) as DocType[]).map(type => (
              <button
                key={type}
                onClick={() => setDocType(type)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  docType === type
                    ? 'bg-resort-600 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/15'
                }`}
              >
                {DOC_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Camera / preview area */}
        <div className="relative mx-5 my-3 rounded-xl overflow-hidden bg-black aspect-[4/3]">

          {/* Live video */}
          {step === 'preview' && (
            <>
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <CameraOff className="h-10 w-10 text-white/30" />
                  <p className="text-sm text-white/50">{cameraError}</p>
                  <button
                    onClick={() => startCamera(facingMode)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '9px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'transparent',
                      color: 'var(--rp-surface)',
                      fontSize: '13px',
                      fontWeight: 500,
                      padding: '9px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Try again
                  </button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}

              {/* Document outline guide */}
              {!cameraError && (
                <div className="absolute inset-6 border-2 border-resort-400/60 rounded-lg pointer-events-none">
                  <div className="absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2 border-resort-400 rounded-tl" />
                  <div className="absolute -top-px -right-px w-6 h-6 border-t-2 border-r-2 border-resort-400 rounded-tr" />
                  <div className="absolute -bottom-px -left-px w-6 h-6 border-b-2 border-l-2 border-resort-400 rounded-bl" />
                  <div className="absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2 border-resort-400 rounded-br" />
                  <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-resort-300/80">
                    Align document inside the frame
                  </p>
                </div>
              )}

              {/* Shutter flash overlay */}
              {shutterFlash && (
                <div className="absolute inset-0 bg-white/70 pointer-events-none" />
              )}

              {/* Camera switch button */}
              {hasMultipleCameras && (
                <button
                  onClick={switchCamera}
                  className="absolute top-3 right-3 rounded-full bg-black/50 p-2 hover:bg-black/70 transition-colors"
                >
                  <RotateCcw className="h-4 w-4 text-white" />
                </button>
              )}
            </>
          )}

          {/* Captured image preview */}
          {(step === 'captured' || step === 'uploading') && capturedUrl && (
            <img
              src={capturedUrl}
              alt="Captured document"
              className="w-full h-full object-contain"
            />
          )}

          {/* Done state */}
          {step === 'done' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-emerald-950/80">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500">
                <Check className="h-7 w-7 text-white" />
              </div>
              <p className="font-medium text-emerald-300">Document saved!</p>
            </div>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Action buttons */}
        <div className="px-5 pb-5 space-y-3">
          {step === 'preview' && !cameraError && (
            <button
              onClick={capture}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-resort-600 hover:bg-resort-500 py-3.5 font-semibold text-white transition-colors active:scale-95"
            >
              <Camera className="h-5 w-5" />
              Capture
            </button>
          )}

          {step === 'captured' && (
            <div className="flex gap-3">
              <button
                onClick={retake}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderRadius: '9px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent',
                  color: 'var(--rp-surface)',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '9px 12px',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw className="h-4 w-4" /> Retake
              </button>
              <button
                onClick={upload}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderRadius: '9px',
                  border: 'none',
                  background: '#059669',
                  color: 'var(--rp-surface)',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '9px 12px',
                  cursor: 'pointer',
                }}
              >
                <Upload className="h-4 w-4" /> Use This
              </button>
            </div>
          )}

          {step === 'uploading' && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading document…
            </div>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderRadius: '9px',
                border: 'none',
                background: '#1a6b5e',
                color: 'var(--rp-surface)',
                fontSize: '13px',
                fontWeight: 500,
                padding: '9px 12px',
                cursor: 'pointer',
              }}
            >
              <Check className="h-4 w-4" /> Done
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
