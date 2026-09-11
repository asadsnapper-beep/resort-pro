import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

/**
 * The response interceptor sends an owner to the upgrade screen when the
 * server refuses a request for want of entitlement.
 *
 * That is right for a feature the user chose, and wrong for a call that only
 * asks whether a feature exists. The early/late panel probes its entitlement
 * as the check-out modal mounts, so the redirect threw the desk out of
 * check-out before any money could be collected — on every tenant, because no
 * plan grants `stay_time_policy` by default.
 */
describe('the upgrade redirect', () => {
  // The interceptor is registered when the module loads; this is the rejection
  // half of it, invoked directly so no HTTP is needed.
  const rejected = (
    api.interceptors.response as unknown as {
      handlers: { rejected: (error: unknown) => Promise<unknown> }[];
    }
  ).handlers[0].rejected;

  let assign: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    assign = vi.fn();
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/dashboard/front-desk', assign },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  const refusal = (config: Record<string, unknown>) => ({
    response: { status: 403, data: { upgradeRequired: true } },
    config,
  });

  it('sends the owner to the upgrade screen when they chose a paid feature', async () => {
    await expect(rejected(refusal({}))).rejects.toBeDefined();
    expect(assign).toHaveBeenCalledWith('/dashboard/upgrade?reason=feature');
  });

  it('leaves the page alone when the call was only asking whether a feature exists', async () => {
    await expect(rejected(refusal({ suppressUpgradeRedirect: true }))).rejects.toBeDefined();
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not touch a refusal that is not about entitlement', async () => {
    const forbidden = { response: { status: 403, data: {} }, config: {} };
    await expect(rejected(forbidden)).rejects.toBeDefined();
    expect(assign).not.toHaveBeenCalled();
  });
});
