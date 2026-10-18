/**
 * Which property the dashboard is looking at.
 *
 * A resort group can create several properties and assign rooms to each, but
 * every dashboard page showed all of them mixed together — there was no way to
 * look at one. The dashboard now sends the property chosen in its top bar as an
 * `X-Property-Id` header on every request, and each list that should narrow to
 * one property spreads `propertyScope(request)` into its query.
 *
 * No header means "all properties", which is what every page showed before, so
 * a resort with a single property sees no change at all.
 *
 * This is a filter, not a security boundary. Queries still run on the
 * tenant-scoped client, so an id belonging to another tenant simply matches
 * nothing; there is no need to look it up first.
 */
import type { FastifyRequest } from 'fastify';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function selectedPropertyId(request: Pick<FastifyRequest, 'headers'>): string | null {
  const raw = request.headers['x-property-id'];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value && UUID.test(value) ? value : null;
}

/** `{ propertyId }` for a room query, or nothing when every property is wanted. */
export function propertyScope(request: Pick<FastifyRequest, 'headers'>): { propertyId?: string } {
  const id = selectedPropertyId(request);
  return id ? { propertyId: id } : {};
}
