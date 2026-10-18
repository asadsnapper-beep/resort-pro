/**
 * A campaign can say who it is for, and when to go.
 *
 * `POST /crm/campaigns` has always accepted `templateId`, `segment` and
 * `scheduledAt`, and the form sent none of them (CRM QA 2026-10-07, finding
 * 016). The scheduled dispatcher has existed since baef93b, so scheduling was
 * a working feature with no way to ask for it.
 *
 * The test that matters most is the one about what the audience does *not*
 * offer. `campaign-sender.ts` reads exactly `segment.tier` and `segment.tag`
 * and ignores every other key, so a filter the form invented would be dropped
 * on the floor — the campaign would advertise a narrow audience and mail
 * everybody. The demo seed had three such shapes, which is how we know this is
 * not hypothetical.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();

vi.mock('@/lib/api', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), delete: vi.fn(), put: vi.fn() },
}));
vi.mock('@/store/auth', () => ({ useAuthStore: () => ({ token: 'tok' }) }));

import CRMPage from '@/app/(dashboard)/dashboard/crm/page';

const TAGS = [{ id: 'tg1', name: 'Corporate', color: '#183153', _count: { relations: 3 } }];
const TEMPLATES = [{
  id: 'tp1', name: 'Newsletter', subject: 'Monthly news',
  html: '<p>news</p>', createdAt: '2026-01-01', isDefault: true,
}];

const route = () => {
  get.mockImplementation((url: string) => {
    if (url === '/crm/tags') return Promise.resolve({ data: { data: TAGS } });
    if (url === '/crm/templates') return Promise.resolve({ data: { data: TEMPLATES } });
    return Promise.resolve({ data: { data: [] } });
  });
};

const fill = () => {
  fireEvent.change(screen.getByPlaceholderText('Summer Promo 2026'),
    { target: { value: 'Eid Promo' } });
  fireEvent.change(screen.getByPlaceholderText('Special offer just for you 🌴'),
    { target: { value: 'Eid Mubarak' } });
  fireEvent.change(screen.getByPlaceholderText(/<h2>Hi \{\{guestName\}\}/),
    { target: { value: '<p>Hi</p>' } });
};

const openForm = async () => {
  render(<CRMPage />);
  fireEvent.click(screen.getByText('Campaigns'));
  fireEvent.click(await screen.findByText('New Campaign'));
  // The form loads the tag and template choices when it opens.
  await waitFor(() => expect(get).toHaveBeenCalledWith('/crm/tags', expect.anything()));
};

beforeEach(() => {
  get.mockReset(); post.mockReset();
  route();
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('confirm', () => true);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('the audience', () => {
  it('offers only tier and tag — the two keys the sender reads', async () => {
    await openForm();

    expect(await screen.findByText('Who gets this')).toBeTruthy();
    // Exactly two selects inside the audience box. Anything else would be a
    // filter campaign-sender.ts silently ignores.
    const box = screen.getByText('Who gets this').closest('div')!;
    expect(box.querySelectorAll('select')).toHaveLength(2);
    expect(screen.getByText('Any tier')).toBeTruthy();
    expect(screen.getByText('Any tag')).toBeTruthy();
  });

  it('sends no segment at all when both are left blank', async () => {
    await openForm();
    fill();
    fireEvent.click(screen.getByText(/Save as Draft|Schedule/));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, body] = post.mock.calls.find(([u]) => u === '/crm/campaigns')!;
    // Not `{ segment: {} }` — absent, so the intent "everyone" is unambiguous.
    expect(body).not.toHaveProperty('segment');
  });

  it('sends the tier when one is chosen', async () => {
    await openForm();
    fill();
    const tierSelect = screen.getByText('Who gets this').closest('div')!.querySelectorAll('select')[0];
    fireEvent.change(tierSelect, { target: { value: 'GOLD' } });
    fireEvent.click(screen.getByText(/Save as Draft|Schedule/));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, body] = post.mock.calls.find(([u]) => u === '/crm/campaigns')!;
    expect(body.segment).toEqual({ tier: 'GOLD' });
  });

  it('sends the tag by name, which is what the sender matches on', async () => {
    await openForm();
    fill();
    const selects = screen.getByText('Who gets this').closest('div')!.querySelectorAll('select');
    fireEvent.change(selects[1], { target: { value: 'Corporate' } });
    fireEvent.click(screen.getByText(/Save as Draft|Schedule/));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, body] = post.mock.calls.find(([u]) => u === '/crm/campaigns')!;
    // `tag`, singular, a name — not `tags: ['Corporate']`, which the sender
    // ignores and which the demo seed used to write.
    expect(body.segment).toEqual({ tag: 'Corporate' });
  });

  it('points at the Tags tab when there is no tag to pick', async () => {
    get.mockImplementation((url: string) => {
      if (url === '/crm/tags') return Promise.resolve({ data: { data: [] } });
      if (url === '/crm/templates') return Promise.resolve({ data: { data: TEMPLATES } });
      return Promise.resolve({ data: { data: [] } });
    });
    await openForm();

    expect(await screen.findByText(/No tags yet/)).toBeTruthy();
  });
});

describe('scheduling', () => {
  it('sends scheduledAt as an ISO instant', async () => {
    await openForm();
    fill();
    const when = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    fireEvent.change(when, { target: { value: '2030-06-01T09:00' } });
    fireEvent.click(screen.getByText(/Save as Draft|Schedule/));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, body] = post.mock.calls.find(([u]) => u === '/crm/campaigns')!;
    expect(body.scheduledAt).toBe(new Date('2030-06-01T09:00').toISOString());
  });

  it('refuses a time in the past instead of saving a campaign that never goes', async () => {
    await openForm();
    fill();
    const when = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    fireEvent.change(when, { target: { value: '2020-01-01T09:00' } });
    fireEvent.click(screen.getByText(/Save as Draft|Schedule/));

    expect(await screen.findByText(/already passed/)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it('the button says what it will do, not always "Draft"', async () => {
    // Adding scheduling made the old label a lie: with a time set the API
    // stores the campaign as SCHEDULED, so a button reading "Save as Draft"
    // would be telling the owner the opposite of what it did.
    await openForm();
    fill();
    expect(screen.getByText('Save as Draft')).toBeTruthy();

    const when = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    fireEvent.change(when, { target: { value: '2030-06-01T09:00' } });

    expect(await screen.findByText('Schedule')).toBeTruthy();
    expect(screen.queryByText('Save as Draft')).toBeNull();
  });

  it('omits scheduledAt entirely for a draft', async () => {
    await openForm();
    fill();
    fireEvent.click(screen.getByText(/Save as Draft|Schedule/));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, body] = post.mock.calls.find(([u]) => u === '/crm/campaigns')!;
    expect(body).not.toHaveProperty('scheduledAt');
  });
});

describe('starting from a template', () => {
  it('copies the wording in rather than linking to it', async () => {
    await openForm();

    const picker = screen.getByText(/Start from a template/).closest('div')!.querySelector('select')!;
    fireEvent.change(picker, { target: { value: 'tp1' } });

    // The body is in the box, editable, which is the point: editing the
    // template later must not rewrite a campaign that was already approved.
    await waitFor(() => expect(
      (screen.getByPlaceholderText(/<h2>Hi \{\{guestName\}\}/) as HTMLTextAreaElement).value,
    ).toBe('<p>news</p>'));
  });
});
