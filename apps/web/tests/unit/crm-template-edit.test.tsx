/**
 * Templates can be edited, and a deleted default can come back.
 *
 * `PUT /crm/templates/:id` has existed since the CRM shipped and nothing
 * called it, so fixing a typo in a subject line meant deleting the template
 * and typing the whole thing again (CRM QA 2026-10-07, finding 016).
 *
 * The QA also noted that default templates can be deleted with "no protection
 * or restore control". The protection is not a lock — a resort that does not
 * send win-back offers should be able to remove that one. What was missing is
 * the way back: `GET /templates` re-creates the defaults only when the list is
 * completely empty, so deleting *one* left it gone for good.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    put: (...a: unknown[]) => put(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));
vi.mock('@/store/auth', () => ({ useAuthStore: () => ({ token: 'tok' }) }));

import CRMPage from '@/app/(dashboard)/dashboard/crm/page';

const tpl = (over: Record<string, unknown> = {}) => ({
  id: 'tp1', name: 'Booking Confirmation', subject: 'Your booking is confirmd!',
  html: '<p>Hi</p>', preheader: 'See you soon', createdAt: '2026-01-01T00:00:00.000Z',
  isDefault: true, ...over,
});

let alerted: string[] = [];
let confirmed = true;
let confirmText = '';

const openTemplates = async () => {
  render(<CRMPage />);
  fireEvent.click(screen.getByText('Templates'));
  await waitFor(() => expect(get).toHaveBeenCalledWith('/crm/templates', expect.anything()));
};

beforeEach(() => {
  get.mockReset(); post.mockReset(); put.mockReset(); del.mockReset();
  alerted = []; confirmed = true; confirmText = '';
  vi.stubGlobal('alert', (m: string) => { alerted.push(m); });
  vi.stubGlobal('confirm', (m: string) => { confirmText = m; return confirmed; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('editing a template', () => {
  beforeEach(() => { get.mockResolvedValue({ data: { data: [tpl()] } }); });

  it('opens the form already filled in, rather than blank', async () => {
    await openTemplates();
    fireEvent.click(await screen.findByLabelText('Edit template Booking Confirmation'));

    // The typo is in the box, which is the whole point — you came to fix it.
    expect((screen.getByPlaceholderText('Welcome Email') as HTMLInputElement).value)
      .toBe('Booking Confirmation');
    expect((screen.getByPlaceholderText('Welcome to {{tenantName}}!') as HTMLInputElement).value)
      .toBe('Your booking is confirmd!');
    expect(screen.getByText(/Edit/)).toBeTruthy();
  });

  it('PUTs to the endpoint nobody was calling, and does not create a second copy', async () => {
    await openTemplates();
    fireEvent.click(await screen.findByLabelText('Edit template Booking Confirmation'));

    fireEvent.change(screen.getByPlaceholderText('Welcome to {{tenantName}}!'),
      { target: { value: 'Your booking is confirmed!' } });
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(put).toHaveBeenCalledWith(
      '/crm/templates/tp1',
      expect.objectContaining({ subject: 'Your booking is confirmed!' }),
      expect.anything(),
    ));
    expect(post).not.toHaveBeenCalled();
  });

  it('creating still POSTs, and the form starts empty', async () => {
    await openTemplates();
    await screen.findByText('Booking Confirmation');
    fireEvent.click(screen.getByText('New Template'));

    expect((screen.getByPlaceholderText('Welcome Email') as HTMLInputElement).value).toBe('');

    fireEvent.change(screen.getByPlaceholderText('Welcome Email'), { target: { value: 'Mine' } });
    fireEvent.change(screen.getByPlaceholderText('Welcome to {{tenantName}}!'), { target: { value: 'Hi' } });
    fireEvent.change(screen.getByPlaceholderText('<h2>Hi {{guestName}},</h2>'), { target: { value: '<p>x</p>' } });
    fireEvent.click(screen.getByText('Save Template'));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(put).not.toHaveBeenCalled();
  });

  // Named for the outcome, not the mechanism. Two separate lines clear the
  // edit state — closeForm and the New Template button — so removing either
  // alone leaves this green. That is belt and braces working, not a weak
  // test: what a user needs is that New Template is never secretly an edit of
  // whatever they last looked at, and only removing both breaks it.
  it('New Template is blank after an edit was opened and cancelled', async () => {
    await openTemplates();
    fireEvent.click(await screen.findByLabelText('Edit template Booking Confirmation'));
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('New Template'));

    // Were `editing` still set, this would say "Save changes" and PUT over
    // the template the owner had merely looked at.
    expect(screen.getByText('Save Template')).toBeTruthy();
    expect((screen.getByPlaceholderText('Welcome Email') as HTMLInputElement).value).toBe('');
  });

  it('shows the reason when the server refuses the edit', async () => {
    put.mockRejectedValue({ response: { data: { error: 'Template not found' } } });
    await openTemplates();
    fireEvent.click(await screen.findByLabelText('Edit template Booking Confirmation'));
    fireEvent.click(screen.getByText('Save changes'));

    expect(await screen.findByText('Template not found')).toBeTruthy();
  });
});

describe('deleting, and what the warning admits', () => {
  it('a default says it can be brought back', async () => {
    get.mockResolvedValue({ data: { data: [tpl({ isDefault: true })] } });
    await openTemplates();
    fireEvent.click(await screen.findByLabelText('Delete template Booking Confirmation'));

    await waitFor(() => expect(del).toHaveBeenCalled());
    expect(confirmText).toMatch(/one of the default templates/);
    expect(confirmText).toMatch(/Restore defaults/);
  });

  it("one the owner wrote says it cannot", async () => {
    get.mockResolvedValue({ data: { data: [tpl({ name: 'My Offer', isDefault: false })] } });
    await openTemplates();
    fireEvent.click(await screen.findByLabelText('Delete template My Offer'));

    await waitFor(() => expect(del).toHaveBeenCalled());
    expect(confirmText).toMatch(/cannot be restored/);
    expect(confirmText).not.toMatch(/Restore defaults/);
  });
});

describe('restoring the defaults', () => {
  beforeEach(() => { get.mockResolvedValue({ data: { data: [] } }); });

  it('calls the endpoint and reports what came back', async () => {
    post.mockResolvedValue({ data: {
      message: 'Restored 2 default templates: Birthday Greeting, Win-Back Offer.',
      data: { restored: 2, names: ['Birthday Greeting', 'Win-Back Offer'] },
    } });
    await openTemplates();
    fireEvent.click(screen.getByText('Restore defaults'));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      '/crm/templates/restore-defaults', {}, expect.anything(),
    ));
    // The server's own sentence, naming them — not "done".
    expect(alerted[0]).toMatch(/Restored 2 default templates/);
    expect(alerted[0]).toMatch(/Birthday Greeting/);
  });

  it('says plainly when nothing was missing', async () => {
    post.mockResolvedValue({ data: {
      message: 'Nothing was missing — all default templates are present.',
      data: { restored: 0, names: [] },
    } });
    await openTemplates();
    fireEvent.click(screen.getByText('Restore defaults'));

    await waitFor(() => expect(alerted[0]).toMatch(/Nothing was missing/));
  });

  it('re-reads the list afterwards, so the restored ones appear', async () => {
    post.mockResolvedValue({ data: { message: 'Restored 1 default template: X.', data: { restored: 1 } } });
    await openTemplates();
    const before = get.mock.calls.filter(([u]) => u === '/crm/templates').length;

    fireEvent.click(screen.getByText('Restore defaults'));

    await waitFor(() => expect(
      get.mock.calls.filter(([u]) => u === '/crm/templates').length,
    ).toBeGreaterThan(before));
  });
});
