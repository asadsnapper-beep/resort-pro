/**
 * Where the dashboard lives, for links inside emails.
 *
 * Shared rather than copied: a link in an approval email that points somewhere
 * different from the one in a verification email is a support ticket nobody can
 * reproduce.
 */
export function webAppUrl(): string {
  return (
    process.env.WEB_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.CORS_ORIGIN?.split(',')[0]
    || 'http://localhost:3000'
  ).replace(/\/$/, '');
}
