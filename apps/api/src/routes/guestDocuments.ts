/**
 * Guest Document endpoints
 *
 * POST   /api/guests/:id/documents        — upload document image (multipart)
 * GET    /api/guests/:id/documents        — list all documents for a guest
 * DELETE /api/guests/:id/documents/:docId — delete a document
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth';
import { uploadToStorage, deleteFromStorage } from '../services/storage';
import type { JwtPayload } from '@resort-pro/types';

const ALLOWED_DOC_TYPES = new Set([
  'PASSPORT',
  'NATIONAL_ID',
  'DRIVERS_LICENSE',
  'VISA',
  'OTHER',
]);

export async function guestDocumentRoutes(app: FastifyInstance) {
  // ── Upload document ───────────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>('/:id/documents', {
    schema: { tags: ['guests'], summary: 'Upload guest document', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId, id: uploadedBy } = request.user as JwtPayload;
      const { id: guestId } = request.params;

      // Verify guest belongs to tenant
      const guest = await db.guest.findFirst({ where: { id: guestId } });
      if (!guest) {
        return reply.status(404).send({ success: false, error: 'Guest not found' });
      }

      // Parse multipart
      const parts = request.parts();
      let fileBuffer: Buffer | null = null;
      let mimeType = 'image/jpeg';
      let docType = 'OTHER';

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
        }
      }

      if (!fileBuffer || fileBuffer.byteLength === 0) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }

      if (fileBuffer.byteLength > 10 * 1024 * 1024) {
        return reply.status(400).send({ success: false, error: 'File too large (max 10 MB)' });
      }

      if (!ALLOWED_DOC_TYPES.has(docType)) {
        docType = 'OTHER';
      }

      // Save to storage (guest-docs folder)
      const result = await uploadToStorage(fileBuffer, mimeType, 'guest-docs', tenantId);

      // Create DB record
      const doc = await db.guestDocument.create({
        data: {
          guestId,
          docType,
          imageUrl: result.url,
          uploadedBy,
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          id:         doc.id,
          imageUrl:   doc.imageUrl,
          docType:    doc.docType,
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
        },
      });

      return reply.send({ success: true, data: docs });
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
