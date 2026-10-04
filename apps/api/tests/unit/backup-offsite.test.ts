/**
 * The off-site copy, and the part of it that actually matters.
 *
 * Daily dumps are verified and they sit on the same host as the database they
 * protect, so the one failure they do not cover is the one that takes the host
 * (review M-06 / RC-M09). This adds an encrypted copy somewhere else.
 *
 * The round trip is the whole test. An encrypted backup that cannot be
 * decrypted is not a backup, and that is not something to discover during the
 * incident — so these write a file, encrypt it, decrypt it, and compare bytes.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, stat } from 'fs/promises';
import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  readConfig, encryptToFile, decryptToFile, newestOfEachKind, expiredKeys,
} from '../../src/scripts/backup-offsite';

const KEY = randomBytes(32);
let dir: string;

const fullEnv = () => ({
  BACKUP_S3_BUCKET: 'resortpro-backups',
  BACKUP_S3_ACCESS_KEY: 'an-access-key',
  BACKUP_S3_SECRET_KEY: 'a-secret-key',
  BACKUP_ENCRYPTION_KEY: KEY.toString('base64'),
});

beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'offsite-')); });
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

describe('encrypting a backup', () => {
  it('gives back exactly what went in', async () => {
    // Bigger than one stream chunk, so this exercises the streaming path
    // rather than a single buffer that happens to work.
    const original = randomBytes(5 * 1024 * 1024);
    const source = join(dir, 'db.dump');
    const encrypted = join(dir, 'db.dump.enc');
    const restored = join(dir, 'db.restored');

    await writeFile(source, original);
    await encryptToFile(source, encrypted, KEY);
    await decryptToFile(encrypted, restored, KEY);

    expect(await readFile(restored)).toEqual(original);
  });

  it('does not leave the contents readable', async () => {
    const source = join(dir, 'plain.dump');
    const encrypted = join(dir, 'plain.dump.enc');
    await writeFile(source, 'PGDMP guest passport number 1234567');

    await encryptToFile(source, encrypted, KEY);
    const onDisk = await readFile(encrypted);

    expect(onDisk.includes(Buffer.from('passport'))).toBe(false);
    expect(onDisk.includes(Buffer.from('PGDMP'))).toBe(false);
    // 12-byte IV and 16-byte tag around the ciphertext.
    expect((await stat(encrypted)).size).toBe(35 + 12 + 16);
  });

  it('refuses the wrong key rather than returning rubbish', async () => {
    const source = join(dir, 'wrongkey.dump');
    const encrypted = join(dir, 'wrongkey.enc');
    await writeFile(source, 'something worth protecting');
    await encryptToFile(source, encrypted, KEY);

    await expect(
      decryptToFile(encrypted, join(dir, 'nope'), randomBytes(32)),
    ).rejects.toThrow();
  });

  it('refuses a file that has been altered', async () => {
    const source = join(dir, 'tamper.dump');
    const encrypted = join(dir, 'tamper.enc');
    await writeFile(source, 'the original contents of a backup');
    await encryptToFile(source, encrypted, KEY);

    const bytes = await readFile(encrypted);
    bytes[20] ^= 0xff; // one bit, in the middle of the ciphertext
    await writeFile(encrypted, bytes);

    await expect(
      decryptToFile(encrypted, join(dir, 'nope2'), KEY),
    ).rejects.toThrow();
  });
});

describe('what gets copied', () => {
  it('takes the newest of each kind, not everything ever made', () => {
    expect(newestOfEachKind([
      'resortpro-20260101T000000Z.dump',
      'resortpro-20260301T000000Z.dump',
      'resortpro-20260201T000000Z.dump',
      'uploads-20260101T000000Z.tar',
      'uploads-20260301T000000Z.tar',
      '.offsite',
    ])).toEqual([
      'resortpro-20260301T000000Z.dump',
      'uploads-20260301T000000Z.tar',
    ]);
  });

  it('takes the uploads archive, which is a plain tar', () => {
    // backup-uploads.sh writes `.tar`, not `.tar.gz`, because JPEGs are
    // already compressed. Looking for the wrong extension would have copied
    // the database off site every night and left every passport photo behind.
    expect(newestOfEachKind(['uploads-20260301T000000Z.tar']))
      .toEqual(['uploads-20260301T000000Z.tar']);
  });

  it('copes with a night where one leg produced nothing', () => {
    expect(newestOfEachKind(['resortpro-20260301T000000Z.dump']))
      .toEqual(['resortpro-20260301T000000Z.dump']);
    expect(newestOfEachKind([])).toEqual([]);
  });
});

describe('what gets dropped', () => {
  const now = new Date('2026-10-04T00:00:00Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it('drops only what is past the retention window', () => {
    const expired = expiredKeys([
      { Key: 'resortpro/old.dump.enc', LastModified: daysAgo(40) },
      { Key: 'resortpro/edge.dump.enc', LastModified: daysAgo(31) },
      { Key: 'resortpro/recent.dump.enc', LastModified: daysAgo(29) },
      { Key: 'resortpro/today.dump.enc', LastModified: daysAgo(0) },
    ], 30, now);

    expect(expired).toEqual(['resortpro/old.dump.enc', 'resortpro/edge.dump.enc']);
  });

  it('ignores an object with no date rather than guessing it is old', () => {
    expect(expiredKeys([{ Key: 'resortpro/mystery.enc' }], 30, now)).toEqual([]);
  });
});

describe('configuration', () => {
  it('names everything that is missing, not just the first one', () => {
    const result = readConfig({} as NodeJS.ProcessEnv);
    expect(result).toHaveProperty('missing');
    expect((result as { missing: string[] }).missing).toEqual([
      'BACKUP_S3_BUCKET', 'BACKUP_S3_ACCESS_KEY',
      'BACKUP_S3_SECRET_KEY', 'BACKUP_ENCRYPTION_KEY',
    ]);
  });

  it('accepts a base64 key and a hex one', () => {
    for (const key of [KEY.toString('base64'), KEY.toString('hex')]) {
      const config = readConfig({ ...fullEnv(), BACKUP_ENCRYPTION_KEY: key } as NodeJS.ProcessEnv);
      expect(config).not.toHaveProperty('missing');
      expect((config as { key: Buffer }).key).toEqual(KEY);
    }
  });

  it('refuses a key that is not 32 bytes, rather than padding it', () => {
    expect(() => readConfig({
      ...fullEnv(), BACKUP_ENCRYPTION_KEY: randomBytes(16).toString('base64'),
    } as NodeJS.ProcessEnv)).toThrow(/32 bytes/);
  });

  it('defaults the things that have a sensible default', () => {
    const config = readConfig(fullEnv() as NodeJS.ProcessEnv) as {
      region: string; prefix: string; retentionDays: number; backupDir: string;
    };
    expect(config).toMatchObject({
      region: 'auto', prefix: 'resortpro', retentionDays: 30, backupDir: '/backups',
    });
  });
});
