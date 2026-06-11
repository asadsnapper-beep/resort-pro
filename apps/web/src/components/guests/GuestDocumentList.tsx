'use client';

/**
 * GuestDocumentList.tsx
 * Shows uploaded documents for a guest as a thumbnail grid.
 * Has a "+ Scan Document" button that opens the DocumentScannerModal.
 */

import { useEffect, useState } from 'react';
import { FileText, Trash2, ScanLine, ExternalLink, Loader2 } from 'lucide-react';
import { guestsApi } from '@/lib/api';
import { DocumentScannerModal, type DocType } from './DocumentScannerModal';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GuestDoc {
  id: string;
  docType: DocType;
  imageUrl: string;
  notes?: string | null;
  uploadedAt: string;
}

const DOC_LABELS: Record<DocType, string> = {
  PASSPORT:        'Passport',
  NATIONAL_ID:     'National ID',
  DRIVERS_LICENSE: 'Driver\'s License',
  VISA:            'Visa',
  OTHER:           'Other',
};

interface Props {
  guestId: string;
  guestName: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GuestDocumentList({ guestId, guestName }: Props) {
  const [docs, setDocs]           = useState<GuestDoc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [scanOpen, setScanOpen]   = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  // ── Fetch documents ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchDocs();
  }, [guestId]);

  async function fetchDocs() {
    setLoading(true);
    try {
      const res = await guestsApi.listDocuments(guestId);
      setDocs(res.data.data ?? []);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(docId: string) {
    setDeleting(docId);
    try {
      await guestsApi.deleteDocument(guestId, docId);
      setDocs(prev => prev.filter(d => d.id !== docId));
      toast({ title: 'Document deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  }

  // ── After scanner uploads ───────────────────────────────────────────────────
  function handleUploaded(doc: { id: string; imageUrl: string; docType: DocType }) {
    setDocs(prev => [{ ...doc, uploadedAt: new Date().toISOString() }, ...prev]);
    setScanOpen(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documents
          {docs.length > 0 && (
            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-normal text-gray-500">
              {docs.length}
            </span>
          )}
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setScanOpen(true)}
          className="h-8 gap-1.5 text-xs"
        >
          <ScanLine className="h-3.5 w-3.5" />
          Scan Document
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-400 dark:text-gray-500">No documents scanned yet</p>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
            Click "Scan Document" to capture ID or passport
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {docs.map(doc => (
            <div
              key={doc.id}
              className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
            >
              {/* Thumbnail */}
              <div className="aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img
                  src={doc.imageUrl}
                  alt={DOC_LABELS[doc.docType]}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>

              {/* Label */}
              <div className="p-2">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {DOC_LABELS[doc.docType]}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </p>
              </div>

              {/* Hover actions */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={doc.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-white/20 p-2 hover:bg-white/30 transition-colors"
                  title="View full size"
                >
                  <ExternalLink className="h-4 w-4 text-white" />
                </a>
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deleting === doc.id}
                  className="rounded-lg bg-red-500/80 p-2 hover:bg-red-500 transition-colors disabled:opacity-50"
                  title="Delete document"
                >
                  {deleting === doc.id
                    ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                    : <Trash2 className="h-4 w-4 text-white" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scanner modal */}
      {scanOpen && (
        <DocumentScannerModal
          guestId={guestId}
          guestName={guestName}
          onClose={() => setScanOpen(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
}
