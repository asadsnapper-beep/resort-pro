'use client';

import { useTranslations } from 'next-intl';
import { Building2, TrendingUp, BedDouble, Wallet } from 'lucide-react';
import { PageShell, PageHeader, StatCard, StatGrid, EmptyState } from '@/components/patterns';
import {
  useResortGroup, useResortOverview, useSwitchResort,
  type ResortCard, type ResortNumbers,
} from '@/hooks/use-resort-group';

/**
 * Every connected resort, side by side.
 *
 * An owner with four resorts has four separate ResortPro accounts. This is the
 * one page that looks at all of them at once. A resort shared as figures only
 * appears here with its numbers and cannot be opened — that is exactly the
 * arrangement its owner agreed to.
 *
 * Totals are per currency. Two resorts billing in different money are never
 * added together and no exchange rate is invented; see plan/multi-resort.md.
 */

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // An unrecognised currency code must not blank the page.
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-rp-micro text-rp-muted">{label}</p>
      <p className="truncate text-rp-body font-semibold text-rp-text">{value}</p>
    </div>
  );
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'bg-rp-surface-3 text-rp-muted',
    warning: 'bg-rp-amber-bg text-amber-700 dark:text-amber-300',
    danger: 'bg-rp-red-bg text-rp-danger',
  };
  return (
    <span className={`shrink-0 rounded-rp-xs px-1.5 py-0.5 text-rp-micro font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function ResortsPage() {
  const t = useTranslations('common') as (key: string) => string;
  const say = (key: string, fallback: string) => {
    const value = t(`resorts360.${key}`);
    return value.endsWith(`resorts360.${key}`) ? fallback : value;
  };

  const { data: group } = useResortGroup();
  const connected = (group?.resorts.length ?? 0) > 1;
  const { data, isLoading, isError } = useResortOverview(connected);
  const { switchTo, switching, failed } = useSwitchResort();

  if (!connected) {
    return (
      <PageShell gap={6}>
        <PageHeader
          title={say('title', 'All resorts')}
          subtitle={say('subtitle', 'Every resort connected to this account')}
          align="center"
        />
        <EmptyState
          icon={Building2}
          title={say('emptyTitle', 'No other resorts are connected yet')}
          description={say('emptyBody', 'Connect a resort you own and its figures will appear here beside this one.')}
        />
      </PageShell>
    );
  }

  const figures = (n: ResortNumbers, currency: string) => [
    { label: say('occupancy', 'Occupancy'), value: `${n.occupancyPct}%` },
    { label: say('arrivals', 'Arrivals'), value: String(n.arrivals) },
    { label: say('departures', 'Departures'), value: String(n.departures) },
    { label: say('revenue', 'Revenue'), value: money(n.revenueMonth, currency) },
    { label: say('profit', 'Profit'), value: money(n.profitMonth, currency) },
    { label: say('outstanding', 'Owed'), value: money(n.outstanding, currency) },
  ];

  const card = (resort: ResortCard) => {
    const body = (
      <>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-rp-13-5 font-semibold text-rp-text">{resort.name}</p>
          {!resort.isActive && <Badge tone="danger">{say('suspended', 'Suspended')}</Badge>}
          {resort.planStatus === 'past_due' && <Badge tone="warning">{say('pastDue', 'Payment due')}</Badge>}
          {resort.access === 'NUMBERS_ONLY' && <Badge>{say('figuresOnly', 'Figures only')}</Badge>}
        </div>
        <p className="mt-0.5 text-rp-micro text-rp-muted">{resort.localDate}</p>

        {resort.numbers ? (
          <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2">
            {figures(resort.numbers, resort.currency).map((f) => (
              <Figure key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-rp-body text-rp-muted">
            {say('unreadable', 'These figures could not be loaded just now.')}
          </p>
        )}

        {!resort.canOpen && resort.access === 'NUMBERS_ONLY' && (
          <p className="mt-3 text-rp-micro text-rp-muted">
            {say('cannotOpen', 'This resort’s owner shares its figures, not the resort itself.')}
          </p>
        )}
      </>
    );

    const shell = 'rounded-rp-card border border-rp-border bg-rp-surface p-4 text-left shadow-rp-card';

    return resort.canOpen ? (
      <button
        key={resort.tenantId}
        type="button"
        disabled={switching}
        onClick={() => void switchTo(resort.tenantId)}
        className={`${shell} transition-colors hover:border-rp-border-md disabled:opacity-60`}
      >
        {body}
      </button>
    ) : (
      <div key={resort.tenantId} className={shell}>{body}</div>
    );
  };

  return (
    <PageShell gap={6}>
      <PageHeader
        title={group?.name ?? say('title', 'All resorts')}
        subtitle={say('subtitle', 'Every resort connected to this account')}
        align="center"
      />

      {failed && (
        <p role="alert" className="text-rp-body text-rp-danger">
          {say('switchFailed', 'Could not open that resort. Try again.')}
        </p>
      )}

      {isError && (
        <EmptyState
          icon={Building2}
          title={say('errorTitle', 'These figures could not be loaded')}
          description={say('errorBody', 'Reload the page to try again.')}
        />
      )}

      {isLoading && <p className="text-rp-body text-rp-muted">{say('loading', 'Loading…')}</p>}

      {data?.currencies.map((c) => (
        <section key={c.currency} className="space-y-3">
          {/* One row of totals per currency. Different money is never added
              together, so a group billing in two currencies sees two rows. */}
          {data.currencies.length > 1 && (
            <p className="text-rp-meta font-medium text-rp-muted">
              {say('totalIn', 'Total in')} {c.currency}
            </p>
          )}
          <StatGrid>
            <StatCard
              label={say('rooms', 'Rooms')}
              value={c.totals.rooms}
              icon={BedDouble}
              description={`${c.totals.occupied} ${say('occupied', 'occupied')}`}
            />
            <StatCard
              label={say('occupancy', 'Occupancy')}
              value={`${c.totals.occupancyPct}%`}
              icon={TrendingUp}
            />
            <StatCard
              label={say('revenueMonth', 'Revenue this month')}
              value={money(c.totals.revenueMonth, c.currency)}
              icon={Wallet}
            />
            <StatCard
              label={say('profitMonth', 'Profit this month')}
              value={money(c.totals.profitMonth, c.currency)}
              icon={Wallet}
              description={say('beforeTax', 'Before tax and salary')}
              tone={c.totals.profitMonth < 0 ? 'danger' : 'brand'}
            />
          </StatGrid>
        </section>
      ))}

      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.resorts.map(card)}
        </div>
      )}
    </PageShell>
  );
}
