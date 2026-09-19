/**
 * The numbers behind the 360 dashboard.
 *
 * One request produces every connected resort's figures side by side. Three
 * things about it are not obvious and are all deliberate:
 *
 *  - **Each resort's "today" is its own.** A group can hold resorts in Dhaka
 *    and Colombo; asking one server-local question would hand a resort
 *    yesterday's arrivals.
 *  - **Money is only added up within one currency.** Resorts can bill in BDT
 *    and USD. There are several total rows rather than one invented sum, and
 *    no exchange rate is imagined anywhere.
 *  - **One resort failing does not empty the page.** Each resort is gathered on
 *    its own; a failure marks that card and leaves the rest standing.
 *
 * Nothing here returns a guest name, a phone number or a booking. A resort
 * shared as NUMBERS_ONLY contributes exactly the same aggregates as any other,
 * because aggregates are all this produces — there is no parameter that could
 * widen it.
 */
import { prisma, tenantPrisma } from '@resort-pro/database';
import { round2 } from './billing';
import {
  tenantTodayRange, tenantMonthStartDate, tenantMonthStartInstant, tenantToday,
} from '../utils/tenant-day';

export interface ResortNumbers {
  rooms: number;
  occupied: number;
  /** occupied ÷ rooms × 100, and 0 — never NaN — for a resort with no rooms. */
  occupancyPct: number;
  arrivals: number;
  departures: number;
  revenueMonth: number;
  expensesMonth: number;
  /** Revenue minus expenses. Before tax and salary, which is what it is. */
  profitMonth: number;
  /** Issued invoices not yet settled: total minus what has been paid. */
  outstanding: number;
}

export interface ResortCard {
  tenantId: string;
  name: string;
  slug: string;
  access: 'FULL' | 'NUMBERS_ONLY';
  canOpen: boolean;
  planStatus: string;
  isActive: boolean;
  currency: string;
  timezone: string;
  /** The date it is at that resort right now, YYYY-MM-DD. */
  localDate: string;
  numbers: ResortNumbers | null;
  /** True when this resort's figures could not be read; the rest still render. */
  failed: boolean;
}

export interface CurrencyTotals {
  currency: string;
  resorts: number;
  totals: ResortNumbers;
}

export interface ResortOverview {
  group: { id: string; name: string };
  resorts: ResortCard[];
  currencies: CurrencyTotals[];
  generatedAt: string;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: ResortOverview }>();

/** Tests and the disconnect path need the next read to be a real one. */
export function clearResortOverviewCache() {
  cache.clear();
}

const emptyNumbers = (): ResortNumbers => ({
  rooms: 0, occupied: 0, occupancyPct: 0, arrivals: 0, departures: 0,
  revenueMonth: 0, expensesMonth: 0, profitMonth: 0, outstanding: 0,
});

function isoDate(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/**
 * The date at that resort, falling back to UTC.
 *
 * `Tenant.timezone` is a free-text column, and `Intl` throws on a value it does
 * not recognise. That belongs in the failed card for that one resort, not in a
 * 500 that takes the whole page down with it.
 */
function localDateFor(timezone: string): string {
  try {
    return isoDate(tenantToday(timezone));
  } catch {
    return isoDate(tenantToday('UTC'));
  }
}

async function numbersFor(tenant: { id: string; timezone: string }): Promise<ResortNumbers> {
  const db = tenantPrisma(tenant.id);
  const today = tenantTodayRange(tenant.timezone);
  const monthDate = tenantMonthStartDate(tenant.timezone);
  const monthInstant = tenantMonthStartInstant(tenant.timezone);

  const [rooms, occupied, arrivals, departures, revenue, expenses, invoices] = await Promise.all([
    db.room.count({ where: { isActive: true } }),
    db.room.count({ where: { isActive: true, status: 'OCCUPIED' } }),
    db.booking.count({ where: { checkIn: today, status: { in: ['CONFIRMED', 'PENDING'] } } }),
    db.booking.count({ where: { checkOut: today, status: 'CHECKED_IN' } }),
    db.payment.aggregate({
      where: { status: 'PAID', processedAt: { gte: monthInstant } }, _sum: { amount: true },
    }),
    db.expense.aggregate({ where: { date: { gte: monthDate } }, _sum: { amount: true } }),
    // The invoice is the billing contract's own artefact, so "what is still
    // owed" is read from it rather than totalled a second way here. Drafts are
    // not owed yet; cancelled and paid ones are not owed at all.
    db.invoice.aggregate({
      where: { status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
      _sum: { total: true, paidAmount: true },
    }),
  ]);

  const revenueMonth = round2(Number(revenue._sum.amount ?? 0));
  const expensesMonth = round2(Number(expenses._sum.amount ?? 0));
  const outstanding = round2(
    Number(invoices._sum.total ?? 0) - Number(invoices._sum.paidAmount ?? 0),
  );

  return {
    rooms,
    occupied,
    occupancyPct: rooms > 0 ? Math.round((occupied / rooms) * 1000) / 10 : 0,
    arrivals,
    departures,
    revenueMonth,
    expensesMonth,
    profitMonth: round2(revenueMonth - expensesMonth),
    outstanding: Math.max(0, outstanding),
  };
}

/**
 * Totals per currency.
 *
 * Occupancy is recomputed from the summed rooms, not averaged across resorts:
 * a 100-room resort at 20% and a 2-room resort at 100% is 21.6% occupancy, not
 * 60%.
 */
function totalsByCurrency(cards: ResortCard[]): CurrencyTotals[] {
  const buckets = new Map<string, ResortCard[]>();
  for (const card of cards) {
    const list = buckets.get(card.currency);
    if (list) list.push(card);
    else buckets.set(card.currency, [card]);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, group]) => {
      const totals = emptyNumbers();
      for (const card of group) {
        const n = card.numbers;
        if (!n) continue;
        totals.rooms += n.rooms;
        totals.occupied += n.occupied;
        totals.arrivals += n.arrivals;
        totals.departures += n.departures;
        totals.revenueMonth += n.revenueMonth;
        totals.expensesMonth += n.expensesMonth;
        totals.outstanding += n.outstanding;
      }
      totals.revenueMonth = round2(totals.revenueMonth);
      totals.expensesMonth = round2(totals.expensesMonth);
      totals.outstanding = round2(totals.outstanding);
      totals.profitMonth = round2(totals.revenueMonth - totals.expensesMonth);
      totals.occupancyPct = totals.rooms > 0
        ? Math.round((totals.occupied / totals.rooms) * 1000) / 10
        : 0;
      return { currency, resorts: group.length, totals };
    });
}

export async function resortOverview(group: { id: string; name: string }): Promise<ResortOverview> {
  const hit = cache.get(group.id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const members = await prisma.resortGroupTenant.findMany({
    where: { groupId: group.id },
    orderBy: { createdAt: 'asc' },
    include: {
      tenant: {
        select: {
          id: true, name: true, slug: true, planStatus: true, isActive: true,
          currency: true, timezone: true,
        },
      },
    },
  });

  const settled = await Promise.allSettled(members.map((m) => numbersFor(m.tenant)));

  const resorts: ResortCard[] = members.map((m, i) => {
    const result = settled[i];
    return {
      tenantId: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      access: m.access,
      canOpen: m.access === 'FULL' && m.tenant.isActive,
      planStatus: m.tenant.planStatus,
      isActive: m.tenant.isActive,
      currency: m.tenant.currency,
      timezone: m.tenant.timezone,
      localDate: localDateFor(m.tenant.timezone),
      numbers: result.status === 'fulfilled' ? result.value : null,
      failed: result.status === 'rejected',
    };
  });

  const value: ResortOverview = {
    group: { id: group.id, name: group.name },
    resorts,
    currencies: totalsByCurrency(resorts),
    generatedAt: new Date().toISOString(),
  };
  cache.set(group.id, { at: Date.now(), value });
  return value;
}
