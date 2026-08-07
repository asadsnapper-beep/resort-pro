import { redirect } from 'next/navigation';

/**
 * Keeps previously shared referral links working after registration moved
 * under the auth route.
 */
export default function RegisterRedirect({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  redirect(`/auth/register${query ? `?${query}` : ''}`);
}
