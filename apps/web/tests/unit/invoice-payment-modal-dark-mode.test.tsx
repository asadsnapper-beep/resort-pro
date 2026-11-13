/**
 * The invoice detail page's Record Payment modal goes through `createPortal`
 * to `document.body`, outside `<main>`, so the
 *
 *     .dark main .bg-white { background-color: var(--rp-surface) !important; }
 *
 * patch in globals.css could never reach it and the panel stayed a literal
 * `#ffffff` in dark mode. It now uses `bg-rp-modal`.
 *
 * The panel's heading came along with it: `text-gray-900` was readable only
 * because the panel was white, so leaving it behind would have swapped one
 * unreadable state for another.
 *
 * Everything else inside the modal was already theme-aware — the labels use
 * `text-muted-foreground`, and the fields and footer are the shadcn `Input` /
 * `Button`, which draw from CSS variables.
 *
 * jsdom applies no stylesheet, so this asserts the classes and the premise
 * (that the panel really is outside `<main>`), not computed colours.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'inv-1' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({ tenant: { name: 'Test Resort', currency: 'BDT' }, token: 't' }),
}));

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

// `total` above `paidAmount` is what leaves an outstanding balance, which is
// the condition the Record Payment button renders under.
const invoice = {
  id: 'inv-1',
  invoiceNumber: 'INV-001',
  guestName: 'Arun Das',
  status: 'SENT',
  subtotal: 5000,
  taxRate: 0,
  taxAmount: 0,
  discountAmt: 0,
  total: 5000,
  paidAmount: 1000,
  createdAt: '2026-11-01T00:00:00.000Z',
  items: [],
  payments: [],
};

vi.mock('@/lib/api', () => ({
  invoiceApi: {
    get: () => Promise.resolve({ data: { data: invoice } }),
    pdfUrl: (id: string) => `/pdf/${id}`,
    addItem: vi.fn(),
    deleteItem: vi.fn(),
    recordPayment: vi.fn(),
    update: vi.fn(),
    send: vi.fn(),
    delete: vi.fn(),
  },
}));

import InvoiceDetailPage from '@/app/(dashboard)/dashboard/invoices/[id]/page';

// vitest.config.ts does not set `globals`, so Testing Library registers no
// cleanup of its own, and the portal would otherwise outlive its case.
afterEach(cleanup);

async function openPaymentModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <InvoiceDetailPage />
    </QueryClientProvider>,
  );

  fireEvent.click(await screen.findByText('Record Payment'));
  return await screen.findByRole('heading', { name: 'Record Payment' });
}

/** The panel is the fixed card the modal's heading sits in. */
const panelOf = (heading: HTMLElement) => heading.closest('div.fixed') as HTMLElement;

describe('the Record Payment modal in dark mode', () => {
  it('gives the panel a themed surface rather than a literal white', async () => {
    const panel = panelOf(await openPaymentModal());

    expect(panel).not.toBeNull();
    expect(panel.className).toContain('bg-rp-modal');
    expect(panel.className).not.toContain('bg-white');
  });

  it('still renders outside <main>, which is why the token is needed', async () => {
    const panel = panelOf(await openPaymentModal());

    expect(panel.closest('main')).toBeNull();
  });

  it('puts the heading on a themed colour so it survives the new panel', async () => {
    const heading = await openPaymentModal();

    expect(heading.className).toContain('text-rp-text');
    expect(heading.className).not.toContain('text-gray-900');
  });
});
