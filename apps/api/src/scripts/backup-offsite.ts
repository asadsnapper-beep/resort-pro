/**
 * Copy the night's backups somewhere the server is not.
 *
 * The third leg of backup-db.sh. The other two take a verified database dump
 * and an archive of the guest documents, and both land in `/backups` on the
 * same machine as the database they protect — so the one failure they do not
 * cover is the one that takes the host (review M-06 / RC-M09).
 *
 * Encrypted here rather than relying on the bucket's own encryption at rest:
 * these dumps hold every guest's name, phone number and passport scan, and
 * "the provider encrypts it" means the provider can read it. AES-256-GCM, one
 * key, held outside the bucket.
 *
 * It can also put a backup back — `--restore` downloads and decrypts. A backup
 * nobody can decrypt is not a backup, and an incident is the wrong time to be
 * composing an openssl command from memory.
 *
 * Not configured is not a failure. Without the bucket variables it says so and
 * exits 0, because the nightly loop reporting a failure for a feature nobody
 * has set up yet is how real failures stop being read.
 */
import 'dotenv/config';
import { createReadStream, createWriteStream } from 'fs';
import { readdir, stat, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { pipeline } from 'stream/promises';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import {
  S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command,
  DeleteObjectsCommand, GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

interface Config {
  bucket: string;
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  key: Buffer;
  prefix: string;
  retentionDays: number;
  backupDir: string;
}

/** What the environment says, or the first thing it is missing. */
function readConfig(env = process.env): Config | { missing: string[] } {
  const required = {
    BACKUP_S3_BUCKET: env.BACKUP_S3_BUCKET,
    BACKUP_S3_ACCESS_KEY: env.BACKUP_S3_ACCESS_KEY,
    BACKUP_S3_SECRET_KEY: env.BACKUP_S3_SECRET_KEY,
    BACKUP_ENCRYPTION_KEY: env.BACKUP_ENCRYPTION_KEY,
  };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) return { missing };

  const raw = env.BACKUP_ENCRYPTION_KEY!.trim();
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `BACKUP_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}. `
      + 'Use `openssl rand -base64 32`.',
    );
  }

  return {
    bucket: required.BACKUP_S3_BUCKET!,
    endpoint: env.BACKUP_S3_ENDPOINT || undefined,
    region: env.BACKUP_S3_REGION || 'auto',
    accessKeyId: required.BACKUP_S3_ACCESS_KEY!,
    secretAccessKey: required.BACKUP_S3_SECRET_KEY!,
    key,
    prefix: (env.BACKUP_S3_PREFIX || 'resortpro').replace(/\/+$/, ''),
    retentionDays: Number(env.BACKUP_OFFSITE_RETENTION_DAYS || 30),
    backupDir: env.BACKUP_DIR || '/backups',
  };
}

const makeClient = (c: Config) => new S3Client({
  region: c.region,
  endpoint: c.endpoint,
  forcePathStyle: !!c.endpoint, // R2 and MinIO want it; AWS does not care.
  credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
});

/**
 * Encrypt a file to `<iv><ciphertext><tag>`.
 *
 * Written to disk before upload rather than streamed straight through: GCM's
 * auth tag only exists once the whole stream has been read, and a multipart
 * upload that has already started cannot go back and prepend it.
 */
async function encryptToFile(source: string, destination: string, key: Buffer): Promise<void> {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const out = createWriteStream(destination);

  out.write(iv);
  await pipeline(createReadStream(source), cipher, out, { end: false });

  await new Promise<void>((resolve, reject) => {
    out.end(cipher.getAuthTag(), () => resolve());
    out.on('error', reject);
  });
}

async function decryptToFile(source: string, destination: string, key: Buffer): Promise<void> {
  const { size } = await stat(source);
  if (size <= IV_BYTES + TAG_BYTES) {
    throw new Error('That file is too small to be one of ours.');
  }

  const iv = await readRange(source, 0, IV_BYTES - 1);
  const tag = await readRange(source, size - TAG_BYTES, size - 1);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  await pipeline(
    createReadStream(source, { start: IV_BYTES, end: size - TAG_BYTES - 1 }),
    decipher,
    createWriteStream(destination),
  );
}

function readRange(path: string, start: number, end: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    createReadStream(path, { start, end })
      .on('data', (c) => chunks.push(c as Buffer))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

/**
 * The newest of each kind, which is what the night just produced.
 *
 * `.tar`, not `.tar.gz`: backup-uploads.sh writes a plain tar because the
 * contents are already-compressed JPEG and PNG. The first version of this
 * looked for `.tar.gz`, found nothing, and would have copied the database off
 * site every night while silently leaving every passport and ID photo on the
 * one machine — a restore that looks complete until someone opens a document.
 *
 * Names are timestamped `...-20260301T000000Z`, so sorting them is sorting by
 * time.
 */
export function newestOfEachKind(files: string[]): string[] {
  const dump = files.filter((f) => f.endsWith('.dump')).sort().pop();
  const uploads = files.filter((f) => f.endsWith('.tar')).sort().pop();
  return [dump, uploads].filter((f): f is string => !!f);
}

/** Which remote copies are old enough to drop. */
export function expiredKeys(
  objects: { Key?: string; LastModified?: Date }[],
  retentionDays: number,
  now = new Date(),
): string[] {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return objects
    .filter((o) => o.Key && o.LastModified && o.LastModified.getTime() < cutoff)
    .map((o) => o.Key!);
}

async function upload(config: Config): Promise<number> {
  const client = makeClient(config);
  const files = newestOfEachKind(await readdir(config.backupDir));

  if (files.length === 0) {
    console.error('[offsite] nothing in', config.backupDir, '— has the nightly backup run?');
    return 1;
  }

  const tmp = join(config.backupDir, '.offsite');
  await mkdir(tmp, { recursive: true });

  for (const name of files) {
    const source = join(config.backupDir, name);
    const encrypted = join(tmp, `${name}.enc`);
    const remoteKey = `${config.prefix}/${name}.enc`;

    await encryptToFile(source, encrypted, config.key);
    const { size } = await stat(encrypted);

    await client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: remoteKey,
      Body: createReadStream(encrypted),
      ContentLength: size,
    }));

    // Ask for it back. An upload that reports success and stores nothing is the
    // failure this whole leg exists to rule out, and it costs one request.
    const head = await client.send(new HeadObjectCommand({
      Bucket: config.bucket, Key: remoteKey,
    }));
    if (head.ContentLength !== size) {
      console.error(
        `[offsite] ${remoteKey} is ${head.ContentLength} bytes there and ${size} here — not keeping that`,
      );
      return 1;
    }

    console.log(`[offsite] ${remoteKey} — ${size} bytes, encrypted, confirmed`);
  }

  const listed = await client.send(new ListObjectsV2Command({
    Bucket: config.bucket, Prefix: `${config.prefix}/`,
  }));
  const expired = expiredKeys(listed.Contents ?? [], config.retentionDays);
  if (expired.length > 0) {
    await client.send(new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: { Objects: expired.map((Key) => ({ Key })) },
    }));
    console.log(`[offsite] removed ${expired.length} copy(ies) older than ${config.retentionDays} days`);
  }

  return 0;
}

async function restore(config: Config, remoteKey: string, destination: string): Promise<number> {
  const client = makeClient(config);

  console.log(`[offsite] fetching ${remoteKey}`);
  const object = await client.send(new GetObjectCommand({
    Bucket: config.bucket, Key: remoteKey,
  }));

  const encrypted = `${destination}.enc`;
  await pipeline(object.Body as Readable, createWriteStream(encrypted));
  await decryptToFile(encrypted, destination, config.key);

  console.log(`[offsite] wrote ${destination}`);
  console.log('[offsite] restore it with:');
  console.log(`  pg_restore -h <host> -U <user> -d <database> --clean --if-exists ${destination}`);
  return 0;
}

async function main() {
  const config = readConfig();

  if ('missing' in config) {
    console.log(
      '[offsite] off-site copies are not set up — missing '
      + `${config.missing.join(', ')}.\n`
      + '[offsite] the local backups still ran; they just all live on this machine,\n'
      + '[offsite] so losing it loses them. See plan/handover-checklist.md.',
    );
    return 0;
  }

  const [mode, remoteKey, destination] = process.argv.slice(2);

  if (mode === '--restore') {
    if (!remoteKey || !destination) {
      console.error('Usage: backup-offsite --restore <remote-key> <local-path>');
      return 1;
    }
    return restore(config, remoteKey, destination);
  }

  return upload(config);
}

// Only when run as the script, so the helpers above stay testable.
const runningAsScript = typeof require !== 'undefined'
  && typeof module !== 'undefined'
  && require.main === module;

if (runningAsScript) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      // Never the key, never the credentials — just what went wrong.
      console.error('[offsite] failed:', err instanceof Error ? err.message : 'unknown error');
      process.exit(1);
    });
}

export { readConfig, encryptToFile, decryptToFile };
