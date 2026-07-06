/**
 * POST /api/upload
 *
 * Accepts a single multipart image field named "file".
 * Query param: ?folder=profiles|rooms|menu|website|misc
 *
 * Returns: { url, key, size }
 */

import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { uploadToStorage } from '../services/storage';
import type { JwtPayload } from '@resort-pro/types';

const ALLOWED_FOLDERS = new Set(['profiles', 'rooms', 'menu', 'website', 'misc']);

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/', {
    schema: { tags: ['upload'], summary: 'Upload an image', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { folder = 'misc' } = request.query as { folder?: string };

      if (!ALLOWED_FOLDERS.has(folder)) {
        return reply.status(400).send({ success: false, error: `Invalid folder. Use: ${[...ALLOWED_FOLDERS].join(', ')}` });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }

      // Read into buffer (limit enforced by @fastify/multipart options in app.ts)
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk as Buffer);
      }
      const buffer = Buffer.concat(chunks);

      if (buffer.byteLength === 0) {
        return reply.status(400).send({ success: false, error: 'Uploaded file is empty' });
      }

      try {
        const requestOrigin = `${request.protocol}://${request.hostname}`;
        const result = await uploadToStorage(buffer, data.mimetype, folder, tenantId, requestOrigin);
        return reply.status(201).send({ success: true, data: result });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        return reply.status(400).send({ success: false, error: msg });
      }
    },
  });
}
