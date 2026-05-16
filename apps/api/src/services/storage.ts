/**
 * ResortPro — Storage Service
 *
 * Driver is chosen by env vars:
 *   STORAGE_DRIVER=local  → saves files to disk (dev/test)
 *   STORAGE_DRIVER=s3     → uploads to Cloudflare R2 or AWS S3 (production)
 *
 * Local driver env vars:
 *   STORAGE_LOCAL_DIR     — absolute path to uploads dir (default: <project>/uploads)
 *   APP_URL               — used to build public URLs (default: http://localhost:4000)
 *
 * S3/R2 driver env vars:
 *   STORAGE_ENDPOINT      — R2: https://<accountid>.r2.cloudflarestorage.com | S3: leave empty
 *   STORAGE_REGION        — R2: auto | S3: us-east-1
 *   STORAGE_ACCESS_KEY    — Access key ID
 *   STORAGE_SECRET_KEY    — Secret access key
 *   STORAGE_BUCKET        — Bucket name
 *   STORAGE_PUBLIC_URL    — Public CDN base URL (e.g. https://cdn.yourresort.com)
 */

import { randomBytes } from 'crypto';
import { join } from 'path';
import { mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { prisma } from '@resort-pro/database';

// ─── StorageConfig shape (stored in PlatformSettings.storageConfig) ───────────
export interface StorageConfig {
  driver:     'local' | 's3';
  endpoint?:  string;
  region?:    string;
  bucket?:    string;
  publicUrl?: string;
  accessKey?: string;
  secretKey?: string;
}

// Cache the config in memory (refreshed on each request in getConfig())
let _cachedConfig: StorageConfig | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function getStorageConfig(): Promise<StorageConfig> {
  const now = Date.now();
  if (_cachedConfig && now - _cacheTime < CACHE_TTL) return _cachedConfig;

  try {
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    if (settings?.storageConfig) {
      _cachedConfig = settings.storageConfig as unknown as StorageConfig;
      _cacheTime = now;
      return _cachedConfig;
    }
  } catch { /* DB not ready — fall back to env */ }

  // Fallback: read from environment variables
  _cachedConfig = {
    driver:    (process.env.STORAGE_DRIVER as 'local' | 's3') ?? 'local',
    endpoint:  process.env.STORAGE_ENDPOINT,
    region:    process.env.STORAGE_REGION ?? 'auto',
    bucket:    process.env.STORAGE_BUCKET,
    publicUrl: process.env.STORAGE_PUBLIC_URL,
    accessKey: process.env.STORAGE_ACCESS_KEY,
    secretKey: process.env.STORAGE_SECRET_KEY,
  };
  _cacheTime = now;
  return _cachedConfig;
}

/** Call after saving new config to DB so it takes effect immediately */
export function invalidateStorageCache() {
  _cachedConfig = null;
  _cacheTime = 0;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UploadResult {
  url:  string;
  key:  string;
  size: number;
}

// ─── Validation ───────────────────────────────────────────────────────────────
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function validate(buffer: Buffer, mimetype: string) {
  if (!ALLOWED_TYPES.has(mimetype))
    throw new Error(`File type "${mimetype}" not allowed. Use JPEG, PNG, WebP, GIF, or AVIF.`);
  if (buffer.byteLength > MAX_SIZE_BYTES)
    throw new Error(`File too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). Max is 5 MB.`);
}

function ext(mimetype: string) {
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') return 'jpg';
  return mimetype.split('/')[1]!;
}

// ─── Local driver ─────────────────────────────────────────────────────────────
function localDir(): string {
  return process.env.STORAGE_LOCAL_DIR
    ?? join(process.cwd(), 'uploads');
}

function localBaseUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

async function uploadLocal(
  buffer: Buffer, mimetype: string, folder: string, tenantId: string,
): Promise<UploadResult> {
  const filename = `${randomBytes(12).toString('hex')}.${ext(mimetype)}`;
  const subdir   = join(localDir(), tenantId, folder);
  const filepath  = join(subdir, filename);
  const key       = `${tenantId}/${folder}/${filename}`;

  mkdirSync(subdir, { recursive: true });
  writeFileSync(filepath, buffer);

  return {
    url:  `${localBaseUrl()}/uploads/${key}`,
    key,
    size: buffer.byteLength,
  };
}

async function deleteLocal(key: string): Promise<void> {
  try { unlinkSync(join(localDir(), key)); } catch { /* file may not exist */ }
}

// ─── S3 / R2 driver ───────────────────────────────────────────────────────────
async function uploadS3(
  buffer: Buffer, mimetype: string, folder: string, tenantId: string,
  cfg: StorageConfig,
): Promise<UploadResult> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

  const client = new S3Client({
    endpoint:    cfg.endpoint,
    region:      cfg.region ?? 'auto',
    credentials: { accessKeyId: cfg.accessKey!, secretAccessKey: cfg.secretKey! },
    forcePathStyle: !!cfg.endpoint,
  });

  const key = `${tenantId}/${folder}/${randomBytes(12).toString('hex')}.${ext(mimetype)}`;
  await client.send(new PutObjectCommand({
    Bucket:      cfg.bucket!,
    Key:         key,
    Body:        buffer,
    ContentType: mimetype,
    ACL:         cfg.endpoint ? undefined : 'public-read',
  }));

  const base = (cfg.publicUrl ?? '').replace(/\/$/, '');
  return { url: `${base}/${key}`, key, size: buffer.byteLength };
}

async function deleteS3(key: string, cfg: StorageConfig): Promise<void> {
  try {
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      endpoint:    cfg.endpoint,
      region:      cfg.region ?? 'auto',
      credentials: { accessKeyId: cfg.accessKey!, secretAccessKey: cfg.secretKey! },
      forcePathStyle: !!cfg.endpoint,
    });
    await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket!, Key: key }));
  } catch { /* ignore */ }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function uploadToStorage(
  buffer:   Buffer,
  mimetype: string,
  folder:   string,
  tenantId: string,
): Promise<UploadResult> {
  validate(buffer, mimetype);
  const cfg = await getStorageConfig();
  return cfg.driver === 's3'
    ? uploadS3(buffer, mimetype, folder, tenantId, cfg)
    : uploadLocal(buffer, mimetype, folder, tenantId);
}

export async function deleteFromStorage(key: string): Promise<void> {
  const cfg = await getStorageConfig();
  return cfg.driver === 's3' ? deleteS3(key, cfg) : deleteLocal(key);
}
