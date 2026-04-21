import type { FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';

export function validate<T>(schema: ZodSchema<T>, data: unknown, reply: FastifyReply): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    reply.status(400).send({
      success: false,
      error: 'Validation failed',
      details: result.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return null;
  }
  return result.data;
}

export function ok<T>(data: T, message?: string) {
  return { success: true, data, ...(message && { message }) };
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export function parsePageParams(query: { page?: unknown; limit?: unknown }) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
