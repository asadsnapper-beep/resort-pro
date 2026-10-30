/**
 * Cloudflare for SaaS — custom hostnames
 * Docs: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
 *
 * This is how a resort's own domain (www.theirresort.com) gets a certificate.
 * We never ask Let's Encrypt for a domain we do not own — Cloudflare issues and
 * renews it, and proxies the request to our fallback origin with the original
 * Host header intact. Traefik's catch-all router then hands it to Next.js,
 * whose middleware resolves the hostname to a tenant slug.
 *
 * Full mechanism, including the infrastructure half: docs/custom-domains.md
 *
 * Env:
 *   CLOUDFLARE_API_TOKEN — scoped token with SSL and Certificates: Edit on the zone
 *   CLOUDFLARE_ZONE_ID   — the resortpro.site zone
 *
 * With either unset the integration is simply off: callers get `null` rather
 * than an exception, so a missing token degrades to "no SSL automation"
 * instead of breaking domain verification.
 */

const CF_API = 'https://api.cloudflare.com/client/v4';

/** Our own sslStatus enum, as stored on Tenant.sslStatus. */
export type SslStatus = 'none' | 'pending' | 'provisioning' | 'active' | 'error';

export interface CustomHostname {
  id: string;
  hostname: string;
  /** Raw Cloudflare SSL status, kept for logging/debugging. */
  cfSslStatus: string;
  /** Mapped onto our own enum. */
  sslStatus: SslStatus;
  /** DCV records the owner may need to add, when Cloudflare asks for them. */
  validationRecords: Array<{ txtName?: string; txtValue?: string; httpUrl?: string; httpBody?: string }>;
  error: string | null;
}

interface CfEnvelope<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

export function isCloudflareSaasConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID);
}

function cfConfig(): { token: string; zoneId: string } | null {
  const token  = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) return null;
  return { token, zoneId };
}

/**
 * Cloudflare's SSL states are finer-grained than ours. Anything still working
 * towards a certificate is 'provisioning'; anything that has given up is
 * 'error'. An unrecognised state is treated as still in progress rather than
 * as a failure, so a new Cloudflare state cannot flip a working domain to red.
 */
function mapSslStatus(cf: string): SslStatus {
  switch (cf) {
    case 'active':
      return 'active';
    case 'expired':
    case 'deleted':
    case 'validation_timed_out':
      return 'error';
    default:
      return 'provisioning';
  }
}

async function cfFetch<T>(path: string, init: RequestInit): Promise<CfEnvelope<T>> {
  const cfg = cfConfig();
  if (!cfg) throw new Error('Cloudflare for SaaS is not configured');

  const res = await fetch(`${CF_API}/zones/${cfg.zoneId}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const json = (await res.json()) as CfEnvelope<T>;
  if (!res.ok || !json.success) {
    // Never include the token in an error that may be logged or returned.
    const detail = json.errors?.map(e => `${e.code} ${e.message}`).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Cloudflare: ${detail}`);
  }
  return json;
}

/** Shape a raw Cloudflare custom-hostname record into ours. */
function toCustomHostname(r: any): CustomHostname {
  const cfSslStatus = r?.ssl?.status ?? 'unknown';
  const records = Array.isArray(r?.ssl?.validation_records) ? r.ssl.validation_records : [];
  return {
    id:        r.id,
    hostname:  r.hostname,
    cfSslStatus,
    sslStatus: mapSslStatus(cfSslStatus),
    validationRecords: records.map((v: any) => ({
      txtName:  v.txt_name,
      txtValue: v.txt_value,
      httpUrl:  v.http_url,
      httpBody: v.http_body,
    })),
    error: r?.ssl?.validation_errors?.[0]?.message ?? null,
  };
}

/**
 * Register a hostname with Cloudflare so it gets a certificate.
 *
 * ⚠ Only ever call this for a hostname that is stored in Tenant.customDomain
 * with domainVerified = true. That DNS check is the only thing stopping a
 * stranger from having us register hostnames they do not control.
 */
export async function createCustomHostname(hostname: string): Promise<CustomHostname | null> {
  if (!isCloudflareSaasConfigured()) return null;

  const json = await cfFetch<any>('/custom_hostnames', {
    method: 'POST',
    body: JSON.stringify({
      hostname,
      ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
    }),
  });
  return toCustomHostname(json.result);
}

/** Look a hostname up by name. Returns null when Cloudflare has no record of it. */
export async function getCustomHostname(hostname: string): Promise<CustomHostname | null> {
  if (!isCloudflareSaasConfigured()) return null;

  const json = await cfFetch<any[]>(`/custom_hostnames?hostname=${encodeURIComponent(hostname)}`, {
    method: 'GET',
  });
  const first = Array.isArray(json.result) ? json.result[0] : null;
  return first ? toCustomHostname(first) : null;
}

/**
 * Remove a hostname from Cloudflare. Called when an owner clears their custom
 * domain — leaving it registered would keep consuming the zone's hostname
 * allowance and keep renewing a certificate nobody uses.
 */
export async function deleteCustomHostname(hostname: string): Promise<boolean> {
  if (!isCloudflareSaasConfigured()) return false;

  const existing = await getCustomHostname(hostname);
  if (!existing) return false;

  await cfFetch<unknown>(`/custom_hostnames/${existing.id}`, { method: 'DELETE' });
  return true;
}
