/**
 * Walk-in returning-guest matching.
 *
 * A resort's walk-ins are largely people who have stayed before. The route
 * used to create a brand-new guest on every single walk-in, so the same
 * person accumulated a duplicate record — and lost their history, preferences
 * and loyalty balance — on each visit. These tests pin the matching rules,
 * including the ones that deliberately refuse to match.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { prisma } from '@resort-pro/database';
import { verifyOwnerAndLogin } from '../helpers/auth';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
const slug = `walkin-guest-${Date.now()}`;
const password = 'TestPass123!';
let ownerToken: string;
let tenantId: string;
const rooms: string[] = [];
let karimGuestId: string;

const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

async function makeRoom(number: string) {
  const res = await app.inject({
    method: 'POST', url: '/api/rooms', headers: auth(),
    payload: { number, name: `Room ${number}`, type: 'DELUXE', basePrice: 5000, maxOccupancy: 2 },
  });
  expect(res.statusCode).toBe(201);
  const id = JSON.parse(res.body).data.id as string;
  rooms.push(id);
  return id;
}

function walkIn(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/bookings/walk-in', headers: auth(), payload });
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      resortName: 'Walk-in Guest Test Resort', slug,
      firstName: 'Owner', lastName: 'Test',
      email: `owner-${slug}@test.com`, password,
    },
  });
  expect(reg.statusCode).toBe(201);
  tenantId = JSON.parse(reg.body).data.tenant.id;
  ownerToken = await verifyOwnerAndLogin(app, { tenantId, email: `owner-${slug}@test.com`, password, slug });
  await prisma.tenant.update({ where: { id: tenantId }, data: { planStatus: 'active', plan: 'ENTERPRISE' } });

  for (const n of ['201', '202', '203', '204', '205', '206']) await makeRoom(n);
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
  await app.close();
});

describe('Walk-in guest matching', () => {
  it('creates a guest on a first-time walk-in', async () => {
    const res = await walkIn({
      guestName: 'Karim Hossain', guestPhone: '01711-002200',
      roomId: rooms[0], checkIn: '2026-11-01', checkOut: '2026-11-03',
      idType: 'NATIONAL_ID', idNumber: 'NID-111',
    });
    expect(res.statusCode).toBe(201);
    karimGuestId = JSON.parse(res.body).data.guestId;
    expect(karimGuestId).toBeTruthy();
  });

  it('reuses that guest when the same person walks in again, however the number is punctuated', async () => {
    const res = await walkIn({
      guestName: 'Karim Hossain', guestPhone: '+880 1711 002200',
      roomId: rooms[1], checkIn: '2026-11-05', checkOut: '2026-11-06',
    });
    expect(res.statusCode).toBe(201);
    // The whole point: same person, one record.
    expect(JSON.parse(res.body).data.guestId).toBe(karimGuestId);

    const count = await prisma.guest.count({ where: { tenantId, firstName: 'Karim' } });
    expect(count).toBe(1);
  });

  it('does not overwrite an ID already on file', async () => {
    await walkIn({
      guestName: 'Karim Hossain', guestPhone: '01711002200',
      roomId: rooms[2], checkIn: '2026-11-08', checkOut: '2026-11-09',
      idType: 'PASSPORT', idNumber: 'TYPO-999',
    });
    const guest = await prisma.guest.findUniqueOrThrow({ where: { id: karimGuestId } });
    expect(guest.idNumber).toBe('NID-111');
  });

  it('refuses to match a different name on a shared family phone', async () => {
    const res = await walkIn({
      guestName: 'Rahima Hossain', guestPhone: '01711-002200',
      roomId: rooms[3], checkIn: '2026-11-11', checkOut: '2026-11-12',
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).data.guestId).not.toBe(karimGuestId);
  });

  it('honours an explicit guestId even when the typed name differs', async () => {
    const res = await walkIn({
      guestName: 'K. Hossain', guestId: karimGuestId, guestPhone: '01711002200',
      roomId: rooms[4], checkIn: '2026-11-14', checkOut: '2026-11-15',
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).data.guestId).toBe(karimGuestId);
  });

  it('rejects a guestId that is not ours', async () => {
    const res = await walkIn({
      guestName: 'Someone Else', guestId: '00000000-0000-0000-0000-000000000000',
      roomId: rooms[5], checkIn: '2026-11-17', checkOut: '2026-11-18',
    });
    expect(res.statusCode).toBe(404);
  });

  it('still creates a fresh guest when no phone number is given', async () => {
    const res = await walkIn({
      guestName: 'Karim Hossain',
      roomId: rooms[0], checkIn: '2026-12-01', checkOut: '2026-12-02',
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).data.guestId).not.toBe(karimGuestId);
  });
});

describe('GET /api/guests/lookup', () => {
  it('reports the returning guest with their stay count', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/guests/lookup?phone=01711002200', headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const matches = JSON.parse(res.body).data.matches as Array<Record<string, unknown>>;
    const karim = matches.find((m) => m.id === karimGuestId);
    expect(karim).toBeDefined();
    // Four walk-ins landed on this record: the original plus three reuses.
    expect(karim!.stayCount).toBe(4);
    // The generated walkin-…@resortpro.local placeholder is not an address.
    expect(karim!.email).toBeNull();
  });

  it('returns nothing for a number we have never seen', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/guests/lookup?phone=01999888777', headers: auth(),
    });
    expect(JSON.parse(res.body).data.matches).toEqual([]);
  });

  it('ignores a fragment too short to be a phone number', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/guests/lookup?phone=0171', headers: auth(),
    });
    expect(JSON.parse(res.body).data.matches).toEqual([]);
  });
});
