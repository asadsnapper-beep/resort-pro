'use client';

import { useState, useRef, useCallback } from 'react';
import {
  X, Camera, Upload, Loader2, CheckCircle2, AlertCircle,
  ScanLine, RefreshCw, User, CreditCard,
} from 'lucide-react';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScannedFields {
  firstName?:     string;
  lastName?:      string;
  dateOfBirth?:   string;
  nationality?:   string;
  documentNumber?: string;
  expiryDate?:    string;
  gender?:        string;
}

interface IdScanModalProps {
  guestId:    string;
  guestName?: string;
  onConfirm:  (fields: ScannedFields) => void;
  onClose:    () => void;
}

type Step = 'capture' | 'scanning' | 'review' | 'error';

const DOC_TYPES = [
  { value: 'PASSPORT',        label: 'Passport' },
  { value: 'NATIONAL_ID',     label: 'National ID (NID)' },
  { value: 'DRIVERS_LICENSE', label: "Driver's License" },
  { value: 'OTHER',           label: 'Other' },
];

const FIELD_LABELS: Record<keyof ScannedFields, string> = {
  firstName:      'First Name',
  lastName:       'Last Name',
  dateOfBirth:    'Date of Birth',
  nationality:    'Nationality',
  documentNumber: 'Document Number',
  expiryDate:     'Expiry Date',
  gender:         'Gender',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function IdScanModal({ guestId, guestName, onConfirm, onClose }: IdScanModalProps) {
  const [step,       setStep]       = useState<Step>('capture');
  const [docType,    setDocType]    = useState('PASSPORT');
  const [preview,    setPreview]    = useState<string | null>(null);
  const [fileObj,    setFileObj]    = useState<File | null>(null);
  const [fields,     setFields]     = useState<ScannedFields>({});
  const [editFields, setEditFields] = useState<ScannedFields>({});
  const [confidence, setConfidence] = useState(0);
  const [method,     setMethod]     = useState<'mrz' | 'ocr'>('ocr');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [useCamera,  setUseCamera]  = useState(false);
  const [cameraOn,   setCameraOn]   = useState(false);

  const fileRef   = useRef<HTMLInputElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Camera helpers ────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setErrorMsg('Camera access denied. Use file upload instead.');
      setUseCamera(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      setFileObj(file);
      setPreview(URL.createObjectURL(blob));
      stopCamera();
    }, 'image/jpeg', 0.95);
  }, [stopCamera]);

  // ── File select ───────────────────────────────────────────────────────────

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileObj(file);
    setPreview(URL.createObjectURL(file));
  };

  // ── OCR scan ─────────────────────────────────────────────────────────────

  const runScan = async () => {
    if (!fileObj) return;
    setStep('scanning');
    setErrorMsg('');
    try {
      const form = new FormData();
      form.append('file',    fileObj);
      form.append('docType', docType);

      const res = await api.post('/guests/scan-id', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { fields: f, confidence: c, method: m } = res.data.data as {
        fields: ScannedFields; confidence: number; method: 'mrz' | 'ocr';
      };
      setFields(f);
      setEditFields({ ...f });
      setConfidence(c);
      setMethod(m);
      setStep('review');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error ?? 'OCR failed. Try a clearer image.');
      setStep('error');
    }
  };

  const reset = () => {
    setStep('capture');
    setPreview(null);
    setFileObj(null);
    setFields({});
    setEditFields({});
    setErrorMsg('');
  };

  // ── Confirm ───────────────────────────────────────────────────────────────

  const confirm = () => {
    const nonEmpty = Object.fromEntries(
      Object.entries(editFields).filter(([, v]) => v && String(v).trim()),
    ) as ScannedFields;
    onConfirm(nonEmpty);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-[#1a6b5e]" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Scan ID Document</p>
              {guestName && <p className="text-xs text-gray-500">{guestName}</p>}
            </div>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">

          {/* ── Step: capture ─────────────────────────────────────────────── */}
          {step === 'capture' && (
            <>
              {/* Doc type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Document Type</label>
                <div className="flex flex-wrap gap-2">
                  {DOC_TYPES.map(dt => (
                    <button
                      key={dt.value}
                      onClick={() => setDocType(dt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        docType === dt.value
                          ? 'bg-[#1a6b5e] text-white border-[#1a6b5e]'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#1a6b5e]'
                      }`}
                    >
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera or file */}
              {!preview && !cameraOn && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setUseCamera(true); startCamera(); }}
                    className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 hover:border-[#1a6b5e] hover:bg-[#f0faf8] transition-colors"
                  >
                    <Camera className="w-7 h-7 text-[#1a6b5e]" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Use Camera</span>
                    <span className="text-xs text-gray-400">Take a photo</span>
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 hover:border-[#1a6b5e] hover:bg-[#f0faf8] transition-colors"
                  >
                    <Upload className="w-7 h-7 text-[#1a6b5e]" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload Image</span>
                    <span className="text-xs text-gray-400">JPG, PNG, WEBP</span>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                </div>
              )}

              {/* Camera live view */}
              {cameraOn && (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <div className="absolute inset-0 border-2 border-white/30 rounded-xl pointer-events-none" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/2 border-2 border-[#d4a853] rounded-lg pointer-events-none" />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2">
                    <button onClick={capturePhoto}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#1a6b5e] hover:bg-[#145a4f] text-white rounded-xl py-3 text-sm font-semibold">
                      <Camera className="w-4 h-4" /> Capture
                    </button>
                    <button onClick={() => { stopCamera(); setUseCamera(false); }}
                      className="px-4 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Image preview */}
              {preview && !cameraOn && (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="ID preview" className="w-full object-contain max-h-56" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={runScan}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#1a6b5e] hover:bg-[#145a4f] text-white rounded-xl py-3 text-sm font-semibold">
                      <ScanLine className="w-4 h-4" /> Scan & Extract
                    </button>
                    <button onClick={reset}
                      className="px-4 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                      Retake
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">
                Place the document flat, ensure good lighting and sharp focus
              </p>
            </>
          )}

          {/* ── Step: scanning ─────────────────────────────────────────────── */}
          {step === 'scanning' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#f0faf8] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#1a6b5e] animate-spin" />
              </div>
              <p className="font-semibold text-gray-800 dark:text-white">Reading document...</p>
              <p className="text-xs text-gray-400">Running OCR — this takes a few seconds</p>
            </div>
          )}

          {/* ── Step: review ──────────────────────────────────────────────── */}
          {step === 'review' && (
            <>
              {/* Confidence badge */}
              <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${
                confidence >= 70
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
              }`}>
                {confidence >= 70
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  : <AlertCircle   className="w-4 h-4 flex-shrink-0" />}
                <span>
                  {method === 'mrz' ? 'MRZ barcode detected' : 'OCR text extracted'} —
                  confidence {confidence}%.
                  {confidence < 70 && ' Review fields carefully.'}
                </span>
              </div>

              {/* Editable fields */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Extracted Fields — edit if needed</p>
                {(Object.keys(FIELD_LABELS) as (keyof ScannedFields)[]).map(key => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{FIELD_LABELS[key]}</label>
                    <input
                      type="text"
                      value={editFields[key] ?? ''}
                      onChange={e => setEditFields(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`Enter ${FIELD_LABELS[key].toLowerCase()}...`}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a6b5e] focus:border-transparent"
                    />
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button onClick={reset}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Rescan
                </button>
                <button onClick={confirm}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#1a6b5e] hover:bg-[#145a4f] text-white rounded-xl py-2.5 text-sm font-semibold">
                  <User className="w-4 h-4" /> Apply to Guest Profile
                </button>
              </div>
            </>
          )}

          {/* ── Step: error ───────────────────────────────────────────────── */}
          {step === 'error' && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white mb-1">Scan Failed</p>
                <p className="text-sm text-gray-500">{errorMsg}</p>
              </div>
              <div className="flex gap-2 w-full">
                <button onClick={reset}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#1a6b5e] hover:bg-[#145a4f] text-white rounded-xl py-2.5 text-sm font-semibold">
                  <RefreshCw className="w-4 h-4" /> Try Again
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
