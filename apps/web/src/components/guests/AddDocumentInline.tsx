'use client';

import { useRef, useState } from 'react';
import { Camera, X, FileImage } from 'lucide-react';
import { cn } from '@/lib/utils';

// A plain "attach a photo of the ID" picker — no OCR, no field extraction,
// no nested modal (avoids the z-index/scroll-lock class of bugs a full
// second modal-on-modal brings). Just: pick a doc type, take/upload a
// photo, hold it locally. The parent uploads it (via guestsApi.uploadDocument)
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
  const fileRef = useRef<HTMLInputElement>(null);

  const selectDocType = (dt: string) => {
    setDocType(dt);
    if (value) onChange({ ...value, docType: dt });
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange({ file, docType, previewUrl: URL.createObjectURL(file) });
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
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 py-4 text-sm text-gray-500 dark:text-gray-400 hover:border-[#1a6b5e]/60 hover:bg-[#f0faf8] dark:hover:bg-transparent transition-colors">
          <Camera className="h-4 w-4" /> Take or upload a photo
        </button>
      )}

      {!value && (
        <p className="flex items-center gap-1 text-[11px] text-gray-400">
          <FileImage className="h-3 w-3" /> JPG, PNG, WebP — kept with this booking
        </p>
      )}

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
    </div>
  );
}
