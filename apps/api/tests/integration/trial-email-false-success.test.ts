/**
 * The trial cron may not report sends that did not happen.
 *
 * Each stage is one-per-tenant-for-ever, enforced by a unique constraint on
 * (tenantId, stage), and the row is written *before* the send so two workers
 * cannot both pass a read-then-check. That trade is deliberate and stays.
 *
 * What was not deliberate: the result of `sendEmail` was discarded. So the
 * counter said "1 email(s) sent" and the log said "Sent trial-7-day to …"
 * whether or not the provider had taken the message — and because the stage
 * was already claimed, the owner could never be warned again. On a server
 * with no provider at all that applied to every tenant and every stage at
 * once: the entire lifecycle schedule burned, nothing attempted, nobody told.
 *
 * Found 2026-11-12 from plan/email-delivery-smtp-master-plan.md §10 step 2.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { prisma } from '@resort-pro/database';

/**
 * Flipped per test; read inside the mock factory, so it must be hoisted-safe.
 *
 * `outcome` applies to this suite's own owner address only. The dev database
 * is shared and holds trialing tenants left by other suites, so this run's
 * aggregate counters are not ours to assert on — every assertion below is
 * about our own address, and the mock must not make other tenants fail.
 */
const state = vi.hoisted(() => ({
  configured: true,
  target: '',
  outcome: 'ok' as 'ok' | 'rejected' | 'unconfirmed',
}));
const sent: string[] = [];

vi.mock('../../src/services/email', () => ({
  isEmailConfigured: () => state.configured,
  sendEmail: vi.fn(async (m: any) => {
    sent.push(m.to);
    if (m.to === state.target) {
      if (state.outcome === 'rejected') return { id: null, error: 'Recipient address is invalid' };
      if (state.outcome === 'unconfirmed') return { id: null, error: null };
    }
    return { id: `mock-${sent.length}`, error: null };
  }),
}));

const notified: { type: string; title: string }[] = [];
vi.mock('../../src/utils/notifications', () => ({
  createAdminNotification: vi.fn(async (a: any) => { notified.push({ type: a.type, title: a.title }); }),
}));

const { runTrialEmailCron } = await import('../../src/services/trial-emails');

const slug = `trial-false-${Date.now()}`;
let tenantId: string;
const ownerEmail = `owner-${slug}@test.com`;
/** The cron's own label for the warn7 stage, as it appears in its log lines. */
const LABEL = '7-day warning (Trial False Success)';

/** A trial ending in 7 days: a forward stage, which backlog suppression leaves alone. */
beforeAll(async () => {
  const t = await prisma.tenant.create({
    data: {
      name: 'Trial False Success', slug, plan: 'FREE', planStatus: 'trialing',
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      users: {
        create: {
          email: ownerEmail, passwordHash: 'x', firstName: 'Owner', lastName: 'Test',
          role: 'OWNER', isActive: true,
        },
      },
    },
  });
  tenantId = t.id;
}, 30000);

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { slug } });
});

beforeEach(async () => {
  await prisma.trialEmailLog.deleteMany({ where: { tenantId } });
  sent.length = 0;
  notified.length = 0;
  state.configured = true;
  state.target = ownerEmail;
  state.outcome = 'ok';
});

const logLines = async () => {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { lines.push(a.join(' ')); });
  try { await runTrialEmailCron(); } finally { spy.mockRestore(); }
  return lines.join('\n');
};

const myRows = () => prisma.trialEmailLog.findMany({ where: { tenantId } });

describe('the provider refuses one message', () => {
  it('does not count it as sent', async () => {
    state.outcome = 'rejected';
    const out = await logLines();

    expect(sent).toContain(ownerEmail);                                  // it really was attempted
    expect(out).toContain(`FAILED ${LABEL} to ${ownerEmail}`);        // and recorded as a failure
    expect(out).toContain('Recipient address is invalid');
    expect(out).not.toContain(`Sent ${LABEL} to ${ownerEmail}`);      // never claimed as sent
  });

  it('reports the failure in the run summary', async () => {
    state.outcome = 'rejected';
    const out = await logLines();
    // The count is the run's, so match our own line inside the block rather
    // than a total another suite's leftover tenant could move.
    expect(out).toMatch(/\d+ email\(s\) FAILED:/);
    expect(out).toContain(`warn7 → ${ownerEmail}: `);
    expect(out).toMatch(/Done — .* failed/);
  });

  it('raises an admin notification so somebody can follow it up', async () => {
    state.outcome = 'rejected';
    await runTrialEmailCron();

    expect(notified.map(n => n.type)).toContain('trial_email_failed');
    expect(notified.find(n => n.type === 'trial_email_failed')!.title).toContain('failed to send');
  });

  it('leaves the stage claimed, because a retry is how an owner gets it twice', async () => {
    // This is the documented trade, not an oversight: the claim is what stops
    // the next tick re-sending. Pinning it so a later "fix" has to argue.
    state.outcome = 'rejected';
    await runTrialEmailCron();

    const rows = await myRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.stage).toBe('warn7');
  });
});

describe('the server has no email provider at all', () => {
  it('claims nothing, so the whole schedule survives', async () => {
    state.configured = false;
    await runTrialEmailCron();

    expect(sent).toHaveLength(0);
    // The bug: every stage marked sent for ever, with nothing attempted.
    expect(await myRows()).toHaveLength(0);
  });

  it('says so instead of reporting a quiet successful run', async () => {
    state.configured = false;
    const out = await logLines();

    expect(out).toContain('No email provider configured');
    expect(out).not.toContain('email(s) sent');
  });

  it('raises an admin notification, which does not depend on email working', async () => {
    state.configured = false;
    await runTrialEmailCron();

    const alert = notified.find(n => n.type === 'trial_email_failed');
    expect(alert).toBeDefined();
    expect(alert!.title).toContain('not being sent');
  });

  it('still sends once a provider appears, proving nothing was burned', async () => {
    state.configured = false;
    await runTrialEmailCron();
    expect(sent).toHaveLength(0);

    state.configured = true;
    const out = await logLines();

    expect(sent).toContain(ownerEmail);
    expect(out).toContain(`Sent ${LABEL} to ${ownerEmail}`);
    expect(await myRows()).toHaveLength(1);
  });
});

describe('a provider that answers with neither an id nor an error', () => {
  it('is not treated as a send', async () => {
    // deliveryVerdict's rule: nothing came back to point at, so there is
    // nothing to claim. Worth pinning here because the old mocks in the
    // sibling suites returned exactly this shape.
    state.outcome = 'unconfirmed';

    const out = await logLines();
    expect(out).toContain(`FAILED ${LABEL} to ${ownerEmail}`);
    expect(out).toContain('returned no confirmation');
    expect(out).not.toContain(`Sent ${LABEL} to ${ownerEmail}`);
  });
});
