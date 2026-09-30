/**
 * Telling the admin when something happens to their own account.
 *
 * The last part of M-03. Two-factor makes an account harder to take; revocable
 * sessions and re-authentication limit what a taken one can do. None of them
 * tell anyone it happened — and an account nobody is watching can be used for
 * eight hours before the first sign that anything is wrong.
 *
 * Two events are worth an email, and only two:
 *
 *  - a sign-in from an address this account has not used before, which is what
 *    a stolen password looks like from here;
 *  - two-factor being turned off, which is what an attacker does next.
 *
 * Every sign-in would be noise — the founder signs in most days from the same
 * place, and an alert people learn to ignore is worse than none, because it
 * still costs attention and no longer buys anything.
 *
 * Nothing here is allowed to break the thing it is reporting on. Sending is
 * best-effort: a sign-in does not fail because an email did.
 */
import { prisma } from '@resort-pro/database';
import { sendEmail, wrapEmail } from './email';
import { webAppUrl } from '../utils/web-url';

interface SignInFacts {
  adminUserId: string;
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  at?: Date;
}

/**
 * Has this account signed in from this address before?
 *
 * Looks at sessions other than the one just made. An address is a weak signal —
 * mobile networks move, home addresses change — which is why the email says
 * "if this was you, nothing to do" rather than raising an alarm.
 */
export async function isNewLocation(
  adminUserId: string,
  ipAddress: string | null | undefined,
  exceptSessionId: string,
): Promise<boolean> {
  if (!ipAddress) return false; // Nothing to compare; silence beats a guess.

  const seen = await prisma.adminSession.count({
    where: { adminUserId, ipAddress, id: { not: exceptSessionId } },
  });
  return seen === 0;
}

function factsTable(rows: [string, string][]): string {
  return rows.map(([label, value]) => `
    <tr>
      <td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px;">${label}</td>
      <td style="padding:4px 0;color:#18231f;font-size:14px;">${value}</td>
    </tr>`).join('');
}

/** The footer both emails share: what to do if it was not you. */
function whatToDo(): string {
  return `
  <p style="margin:20px 0 8px;color:#18231f;font-size:15px;"><strong>If this was not you</strong></p>
  <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.7;">
    <li>Change the password.</li>
    <li>Open <a href="${webAppUrl()}/admin/security" style="color:#1a6b5e;">Security</a> and sign out everywhere else.</li>
    <li>Turn two-factor on, if it is not already.</li>
  </ol>`;
}

export async function alertNewSignInLocation(facts: SignInFacts): Promise<void> {
  const at = facts.at ?? new Date();
  const body = `
    <h2 style="margin:0 0 12px;color:#18231f;font-size:20px;">A new sign-in to your admin account</h2>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
      Someone signed in to the ResortPro admin panel from an address this account
      has not used before. If that was you, there is nothing to do.
    </p>
    <table style="border-collapse:collapse;margin:0 0 4px;">
      ${factsTable([
        ['When', at.toUTCString()],
        ['Address', facts.ipAddress || 'not recorded'],
        ['Browser', facts.userAgent || 'not recorded'],
      ])}
    </table>
    ${whatToDo()}`;

  const { error } = await sendEmail({
    to: facts.email,
    subject: 'New sign-in to your ResortPro admin account',
    html: wrapEmail({ body, tenantName: 'ResortPro' }),
  });

  if (error && error !== 'email_disabled') {
    console.error(`[admin-alerts] could not send the new-sign-in email: ${error}`);
  }
}

export async function alertTwoFactorDisabled(facts: SignInFacts): Promise<void> {
  const at = facts.at ?? new Date();
  const body = `
    <h2 style="margin:0 0 12px;color:#18231f;font-size:20px;">Two-factor sign-in was turned off</h2>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
      Your ResortPro admin account no longer asks for a code from your
      authenticator app. A password is now enough to sign in.
    </p>
    <table style="border-collapse:collapse;margin:0 0 4px;">
      ${factsTable([
        ['When', at.toUTCString()],
        ['Address', facts.ipAddress || 'not recorded'],
      ])}
    </table>
    ${whatToDo()}`;

  const { error } = await sendEmail({
    to: facts.email,
    subject: 'Two-factor was turned off on your ResortPro admin account',
    html: wrapEmail({ body, tenantName: 'ResortPro' }),
  });

  if (error && error !== 'email_disabled') {
    console.error(`[admin-alerts] could not send the two-factor-off email: ${error}`);
  }
}
