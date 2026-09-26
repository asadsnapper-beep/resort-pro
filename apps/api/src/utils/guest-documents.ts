/**
 * Getting rid of a guest's identity documents, not just the rows naming them.
 *
 * `GuestDocument` cascades from `Guest` and from `Tenant`, so deleting either
 * takes the rows — and leaves the passport and NID photographs sitting on disk
 * with nothing pointing at them. That is not wasted space, it is the one kind
 * of data that most needs to actually go: a guest asking to be deleted is not
 * deleted, and a resort put through GDPR erasure still holds its guests' ID
 * scans in full.
 *
 * Files first, always. If a file will not delete, the caller can try again,
 * because the rows naming it are still there. The other order loses the only
 * record of where the file is.
 */
import { prisma } from '@resort-pro/database';
import { deleteFromStorage, storageKeyFromUrl } from '../services/storage';

export interface PurgeResult {
  removed: number;
  /** Files that would not delete. The rows are deliberately left alone. */
  failed: number;
}

/** Delete the stored image behind every guest document in scope. */
export async function purgeGuestDocumentFiles(
  scope: { tenantId: string } | { guestId: string },
): Promise<PurgeResult> {
  const documents = await prisma.guestDocument.findMany({
    where: scope,
    select: { imageUrl: true, tenantId: true },
  });

  let removed = 0;
  let failed = 0;
  for (const doc of documents) {
    const key = storageKeyFromUrl(doc.imageUrl, doc.tenantId);
    if (!key) {
      // A URL this tenant has no business owning, or an unparseable one.
      // Counted as failed rather than skipped: somebody should look.
      failed += 1;
      continue;
    }
    try {
      await deleteFromStorage(key);
      removed += 1;
    } catch {
      failed += 1;
    }
  }
  return { removed, failed };
}
