/**
 * Guest Document endpoints
 *
 * POST   /api/guests/:id/documents        — upload document image (multipart)
 * GET    /api/guests/:id/documents        — list all documents for a guest
 * DELETE /api/guests/:id/documents/:docId — delete a document
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth';
import { uploadToStorage, deleteFromStorage, getStorageConfig } from '../services/storage';
import { signUploadUrl } from '../utils/signed-upload-url';
import type { JwtPayload } from '@resort-pro/types';

const ALLOWED_DOC_TYPES = new Set([
  'PASSPORT',
  'NATIONAL_ID',
  'DRIVERS_LICENSE',
  'VISA',
  'GUEST_PHOTO',
  'OTHER',
]);

export async function guestDocumentRoutes(app: FastifyInstance) {
  app.get('/document-upload-capabilities', {
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (_request, reply) => reply.send({ success: true, data: { idempotencyVersion: 1 } }),
  });
  // ── Upload document ───────────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>('/:id/documents', {
    schema: { tags: ['guests'], summary: 'Upload guest document', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId, sub: uploadedBy } = request.user as JwtPayload;
      const { id: guestId } = request.params;

      // Verify guest belongs to tenant
      const guest = await db.guest.findFirst({ where: { id: guestId } });
      if (!guest) {
        return reply.status(404).send({ success: false, error: 'Guest not found' });
      }

      // The local /uploads route verifies short-lived signatures. A public
      // S3/R2 URL does not go through that route, so never put identity
      // images there until private object delivery is configured separately.
      if ((await getStorageConfig()).driver !== 'local') {
        return reply.status(503).send({ success: false, error: 'Private guest image storage is not configured.' });
      }

      // Parse multipart
      const parts = request.parts();
      let fileBuffer: Buffer | null = null;
      let mimeType = 'image/jpeg';
      let docType = 'OTHER';
      let bookingId: string | undefined;
      const uploadId = request.headers['idempotency-key'];
      if (uploadId !== undefined && (typeof uploadId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId))) {
        return reply.status(400).send({ success: false, error: 'Invalid idempotency key' });
      }

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          mimeType = part.mimetype;

          if (!mimeType.startsWith('image/')) {
            return reply.status(400).send({ success: false, error: 'Only image files are allowed' });
          }

          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk as Buffer);
          }
          fileBuffer = Buffer.concat(chunks);

        } else if (part.type === 'field' && part.fieldname === 'docType') {
          docType = String(part.value);
        } else if (part.type === 'field' && part.fieldname === 'bookingId') {
          bookingId = String(part.value) || undefined;
        }
      }

      // If a bookingId was supplied (walk-in / new-booking flows attach the
      // doc at creation time), confirm it actually belongs to this guest.
      // Reject a mismatch so the client cannot mistake an unlinked upload
      // for a photo attached to the intended stay.
      if (bookingId) {
        const booking = await db.booking.findFirst({ where: { id: bookingId, guestId } });
        if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found for guest' });
      }

      if (!fileBuffer || fileBuffer.byteLength === 0) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }

      if (fileBuffer.byteLength > 5 * 1024 * 1024) {
        return reply.status(400).send({ success: false, error: 'File too large (max 5 MB)' });
      }

      if (!ALLOWED_DOC_TYPES.has(docType)) {
        docType = 'OTHER';
      }

      // A client-generated UUID doubles as the document primary key. The
      // unique database constraint arbitrates concurrent retries as well as
      // retries after the server committed but the response was lost.
      const existingUpload = async () => uploadId
        ? db.guestDocument.findFirst({ where: { id: uploadId } })
        : null;
      const respondToExisting = (doc: NonNullable<Awaited<ReturnType<typeof existingUpload>>>) => {
        if (doc.guestId !== guestId || doc.docType !== docType || (doc.bookingId ?? undefined) !== bookingId) {
          return reply.status(409).send({ success: false, error: 'Idempotency key already used for another document' });
        }
        return reply.status(200).send({ success: true, data: {
          id: doc.id, imageUrl: signUploadUrl(doc.imageUrl), docType: doc.docType,
          bookingId: doc.bookingId, uploadedAt: doc.uploadedAt,
        } });
      };
      const existing = await existingUpload();
      if (existing) return respondToExisting(existing);

      // Save to storage (guest-docs folder)
      const result = await uploadToStorage(fileBuffer, mimeType, 'guest-docs', tenantId, `${request.protocol}://${request.hostname}`);

      // Create DB record
      let doc;
      try {
        doc = await db.guestDocument.create({
          data: { ...(uploadId ? { id: uploadId } : {}), guestId, docType, imageUrl: result.url, uploadedBy, bookingId },
        });
      } catch (error) {
        await deleteFromStorage(result.key);
        if (uploadId && typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
          const winner = await existingUpload();
          if (winner) return respondToExisting(winner);
          return reply.status(409).send({ success: false, error: 'Idempotency key already in use' });
        }
        throw error;
      }

      return reply.status(201).send({
        success: true,
        data: {
          id:         doc.id,
          // Signed on the way out. The stored URL is not usable on its own —
          // the static route refuses guest-docs without a live signature.
          imageUrl:   signUploadUrl(doc.imageUrl),
          docType:    doc.docType,
          bookingId:  doc.bookingId,
          uploadedAt: doc.uploadedAt,
        },
      });
    },
  });

  // ── List documents ────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id/documents', {
    schema: { tags: ['guests'], summary: 'List guest documents', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id: guestId } = request.params;

      // Verify guest belongs to tenant
      const guest = await db.guest.findFirst({ where: { id: guestId } });
      if (!guest) {
        return reply.status(404).send({ success: false, error: 'Guest not found' });
      }

      const docs = await db.guestDocument.findMany({
        where: { guestId },
        orderBy: { uploadedAt: 'desc' },
        select: {
          id:         true,
          docType:    true,
          imageUrl:   true,
          notes:      true,
          uploadedAt: true,
          uploadedBy: true,
          bookingId:  true,
        },
      });

      return reply.send({
        success: true,
        data: docs.map((d) => ({ ...d, imageUrl: signUploadUrl(d.imageUrl) })),
      });
    },
  });

  // ── Delete document ───────────────────────────────────────────────────────
  app.delete<{ Params: { id: string; docId: string } }>('/:id/documents/:docId', {
    schema: { tags: ['guests'], summary: 'Delete guest document', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id: guestId, docId } = request.params;

      const doc = await db.guestDocument.findFirst({
        where: { id: docId, guestId },
      });

      if (!doc) {
        return reply.status(404).send({ success: false, error: 'Document not found' });
      }

      // Delete from storage (best-effort)
      try {
        // Extract key from URL: last two path segments = folder/filename
        const url = new URL(doc.imageUrl);
        const key = url.pathname.replace(/^\/uploads\//, '');
        await deleteFromStorage(key);
      } catch {
        // Non-fatal — just remove the DB record
      }

      await db.guestDocument.delete({ where: { id: docId } });

      return reply.send({ success: true, data: { id: docId } });
    },
  });
}
