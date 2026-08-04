import { redirect } from 'next/navigation';

/**
 * Compatibility redirect for welcome emails sent before dashboard URLs became
 * platform-level. It preserves the workspace context without exposing users
 * to a dead or misleading `/{slug}/dashboard` page.
 */
export default function LegacyDashboardLink({ params }: { params: { slug: string } }) {
  redirect(`/auth/login?workspace=${encodeURIComponent(params.slug)}`);
}
