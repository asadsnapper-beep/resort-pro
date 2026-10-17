/**
 * Tags are reachable from the dashboard.
 *
 * `GET/POST /crm/tags` and `DELETE /crm/tags/:id` have existed all along and
 * no screen called any of them (CRM QA 2026-10-07, finding 016). The Contacts
 * table renders each guest's tags, so the column was there and could never
 * fill — the QA recorded tags as "Fail at assignment", and the reason it could
 * not even get that far is that nothing could create one.
 *
 * This covers managing them. Assigning one to a guest is the other half and is
 * not in this file, because it is not built yet.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    delete: (...a: unknown[]) => del(...a),
    put: vi.fn(),
  },
}));
vi.mock('@/store/auth', () => ({ useAuthStore: () => ({ token: 'tok' }) }));

import CRMPage from '@/app/(dashboard)/dashboard/crm/page';

const tag = (over: Record<string, unknown> = {}) => ({
  id: 't1', name: 'Corporate', color: '#183153', _count: { relations: 12 }, ...over,
});

let alerted: string[] = [];
let confirmed = true;
let confirmText = '';

const openTags = async () => {
  render(<CRMPage />);
  fireEvent.click(screen.getByText('Tags'));
  await waitFor(() => expect(get).toHaveBeenCalledWith('/crm/tags', expect.anything()));
};

beforeEach(() => {
  get.mockReset(); post.mockReset(); del.mockReset();
  alerted = []; confirmed = true; confirmText = '';
  vi.stubGlobal('alert', (m: string) => { alerted.push(m); });
  vi.stubGlobal('confirm', (m: string) => { confirmText = m; return confirmed; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('the tab exists at all', () => {
  it('is in the tab strip and asks the API nobody was asking', async () => {
    get.mockResolvedValue({ data: { data: [tag()] } });
    await openTags();

    expect(await screen.findByText('Corporate')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('says so when there are none, rather than looking broken', async () => {
    get.mockResolvedValue({ data: { data: [] } });
    await openTags();

    expect(await screen.findByText(/No tags yet/)).toBeTruthy();
  });

  it('distinguishes a failed load from an empty one', async () => {
    get.mockRejectedValue(new Error('500'));
    await openTags();

    expect(await screen.findByText('Could not load tags')).toBeTruthy();
    expect(screen.queryByText(/No tags yet/)).toBeNull();
  });
});

describe('creating one', () => {
  beforeEach(() => { get.mockResolvedValue({ data: { data: [] } }); });

  it('sends the name and the chosen colour', async () => {
    await openTags();
    fireEvent.change(screen.getByPlaceholderText('Tag name'), { target: { value: 'Honeymoon' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      '/crm/tags',
      { name: 'Honeymoon', color: '#6b7280' },
      expect.anything(),
    ));
  });

  it('trims, so " VIP " and "VIP" are not two different tags', async () => {
    await openTags();
    fireEvent.change(screen.getByPlaceholderText('Tag name'), { target: { value: '  VIP  ' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      '/crm/tags', { name: 'VIP', color: '#6b7280' }, expect.anything(),
    ));
  });

  it('refuses an empty name without asking the server', async () => {
    await openTags();
    fireEvent.click(screen.getByText('Create'));

    expect(await screen.findByText(/needs a name/)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it('refuses a duplicate, because two "VIP" tags are indistinguishable on a guest', async () => {
    get.mockResolvedValue({ data: { data: [tag({ name: 'VIP' })] } });
    await openTags();
    await screen.findByText('VIP');

    fireEvent.change(screen.getByPlaceholderText('Tag name'), { target: { value: 'vip' } });
    fireEvent.click(screen.getByText('Create'));

    expect(await screen.findByText(/already a tag called "vip"/)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows the reason when the server refuses', async () => {
    post.mockRejectedValue({ response: { data: { error: 'Tag limit reached' } } });
    await openTags();
    fireEvent.change(screen.getByPlaceholderText('Tag name'), { target: { value: 'Repeat' } });
    fireEvent.click(screen.getByText('Create'));

    expect(await screen.findByText('Tag limit reached')).toBeTruthy();
  });
});

describe('deleting one', () => {
  it('says how many guests it is about to untag', async () => {
    get.mockResolvedValue({ data: { data: [tag({ name: 'Corporate', _count: { relations: 12 } })] } });
    await openTags();
    fireEvent.click(await screen.findByLabelText('Delete tag Corporate'));

    await waitFor(() => expect(del).toHaveBeenCalled());
    // The count is the point: "Delete this tag?" does not tell you that twelve
    // guests are about to lose it.
    expect(confirmText).toMatch(/on 12 guests/);
    expect(confirmText).toMatch(/removes it from all of them/);
  });

  it('reads naturally for a single guest', async () => {
    get.mockResolvedValue({ data: { data: [tag({ name: 'Solo', _count: { relations: 1 } })] } });
    await openTags();
    fireEvent.click(await screen.findByLabelText('Delete tag Solo'));

    await waitFor(() => expect(del).toHaveBeenCalled());
    expect(confirmText).toMatch(/on 1 guest\b/);
  });

  it('does not warn about guests when nobody has it', async () => {
    get.mockResolvedValue({ data: { data: [tag({ name: 'Unused', _count: { relations: 0 } })] } });
    await openTags();
    fireEvent.click(await screen.findByLabelText('Delete tag Unused'));

    await waitFor(() => expect(del).toHaveBeenCalled());
    expect(confirmText).toBe('Delete "Unused"?');
  });

  it('sends nothing when the confirm is cancelled', async () => {
    confirmed = false;
    get.mockResolvedValue({ data: { data: [tag()] } });
    await openTags();
    fireEvent.click(await screen.findByLabelText('Delete tag Corporate'));

    await waitFor(() => expect(del).not.toHaveBeenCalled());
  });

  it('reports a refusal instead of doing nothing', async () => {
    get.mockResolvedValue({ data: { data: [tag()] } });
    del.mockRejectedValue({ response: { data: { error: 'Tag not found' } } });
    await openTags();
    fireEvent.click(await screen.findByLabelText('Delete tag Corporate'));

    await waitFor(() => expect(alerted).toContain('Tag not found'));
  });
});
