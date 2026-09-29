/**
 * Convert the credentials already in the database to encrypted ones.
 *
 * Every secret a resort handed us before this shipped is sitting in the table
 * as plain text — payment gateway keys, SMS and WhatsApp credentials, the
 * Telegram bot token, the SSO client secret — and so are the platform's own:
 * the AI API key and the object-storage credentials. New writes are encrypted
 * now; this is the rest, the rows written while `schema.prisma` only *claimed*
 * they were encrypted.
 *
 * Run it in this order:
 *
 *   pnpm --filter @resort-pro/api encrypt:credentials            # says what it would do
 *   pnpm --filter @resort-pro/api encrypt:credentials -- --apply # does it
 *
 * Read the dry run before applying, and take a database backup first. The
 * conversion is not reversible without CREDENTIALS_KEY: if that key is lost
 * afterwards, every resort has to paste their credentials in again.
 *
 * It is safe to run twice. A value that is already encrypted is skipped, so an
 * interrupted run is finished by running it again.
 *
 * It never prints a secret — counts and column names only.
 */
import 'dotenv/config';
import { prisma } from '@resort-pro/database';
import {
  encryptSecret, isEncrypted, hasEncryptionKey, encryptRecord,
} from '../utils/secret-box';

/**
 * The columns on `Tenant` that hold a secret.
 *
 * The bkash* and ssl* ones look dead — the live path for a resort's own gateway
 * is `TenantPaymentConfig.credentials`, and nothing in the API reads these. They
 * are encrypted here rather than cleared: emptying a column nobody has proven
 * unused cannot be undone, and encrypting it costs nothing. Clearing them is a
 * separate decision for a day when someone has looked at what is in them.
 */
const TENANT_SECRET_COLUMNS = [
  'smsApiKey',
  'smsApiSecret',
  'waApiToken',
  'telegramBotToken',
  'ssoClientSecret',
  'bkashAppKey',
  'bkashAppSecret',
  'bkashUsername',
  'bkashPassword',
  'sslStoreId',
  'sslStorePassword',
] as const;

type TenantSecretColumn = (typeof TENANT_SECRET_COLUMNS)[number];

interface Tally {
  converted: number;
  alreadyDone: number;
  empty: number;
}

const blank = (): Tally => ({ converted: 0, alreadyDone: 0, empty: 0 });

async function convertTenantColumns(apply: boolean) {
  const tallies = new Map<TenantSecretColumn, Tally>(
    TENANT_SECRET_COLUMNS.map((column) => [column, blank()]),
  );

  const select = Object.fromEntries(
    ['id', ...TENANT_SECRET_COLUMNS].map((column) => [column, true]),
  ) as Record<string, true>;

  const tenants = (await prisma.tenant.findMany({ select })) as unknown as (
    { id: string } & Record<TenantSecretColumn, string | null>
  )[];

  for (const tenant of tenants) {
    const update: Partial<Record<TenantSecretColumn, string>> = {};

    for (const column of TENANT_SECRET_COLUMNS) {
      const value = tenant[column];
      const tally = tallies.get(column)!;

      if (!value) { tally.empty += 1; continue; }
      if (isEncrypted(value)) { tally.alreadyDone += 1; continue; }

      tally.converted += 1;
      if (apply) update[column] = encryptSecret(value);
    }

    if (apply && Object.keys(update).length > 0) {
      await prisma.tenant.update({ where: { id: tenant.id }, data: update });
    }
  }

  return { tallies, rows: tenants.length };
}

async function convertPaymentConfigs(apply: boolean) {
  const tally = blank();

  const configs = await prisma.tenantPaymentConfig.findMany({
    select: { id: true, credentials: true },
  });

  for (const config of configs) {
    const bag = config.credentials as Record<string, unknown> | null;

    if (!bag || Object.keys(bag).length === 0) { tally.empty += 1; continue; }
    // `encryptRecord` produces `{ enc }` — that is what "already done" looks like.
    if ('enc' in bag) { tally.alreadyDone += 1; continue; }

    tally.converted += 1;
    if (apply) {
      await prisma.tenantPaymentConfig.update({
        where: { id: config.id },
        data: { credentials: encryptRecord(bag) },
      });
    }
  }

  return { tally, rows: configs.length };
}

/**
 * The platform's own credentials, as opposed to a resort's: the AI API key that
 * bills us, and the object-storage access/secret pair. One row, and the two
 * storage values live inside a JSON object beside fields that are not secret
 * and stay readable.
 */
async function convertPlatformSettings(apply: boolean) {
  const ai = blank();
  const storage = blank();

  const settings = await prisma.platformSettings.findUnique({
    where: { id: 'singleton' },
    select: { aiApiKey: true, storageConfig: true },
  });

  if (!settings) return { ai, storage, rows: 0 };

  const data: { aiApiKey?: string; storageConfig?: unknown } = {};

  if (!settings.aiApiKey) ai.empty += 1;
  else if (isEncrypted(settings.aiApiKey)) ai.alreadyDone += 1;
  else {
    ai.converted += 1;
    if (apply) data.aiApiKey = encryptSecret(settings.aiApiKey);
  }

  const cfg = settings.storageConfig as Record<string, unknown> | null;
  const secretFields = ['accessKey', 'secretKey'] as const;
  const plain = secretFields.filter((f) => typeof cfg?.[f] === 'string' && cfg[f] !== ''
    && !isEncrypted(cfg[f] as string));
  const done = secretFields.filter((f) => isEncrypted(cfg?.[f] as string | undefined));

  storage.converted += plain.length;
  storage.alreadyDone += done.length;
  storage.empty += secretFields.length - plain.length - done.length;

  if (apply && plain.length > 0 && cfg) {
    data.storageConfig = {
      ...cfg,
      ...Object.fromEntries(plain.map((f) => [f, encryptSecret(cfg[f] as string)])),
    };
  }

  if (apply && Object.keys(data).length > 0) {
    await prisma.platformSettings.update({ where: { id: 'singleton' }, data: data as never });
  }

  return { ai, storage, rows: 1 };
}

function line(name: string, tally: Tally, apply: boolean): string {
  return `  ${name.padEnd(18)}`
    + `${String(tally.converted).padStart(4)} ${apply ? 'encrypted' : 'to encrypt'}`
    + `   ${String(tally.alreadyDone).padStart(4)} already done`
    + `   ${String(tally.empty).padStart(4)} empty`;
}

async function main() {
  const apply = process.argv.includes('--apply');

  if (!hasEncryptionKey()) {
    console.error(
      'CREDENTIALS_KEY is not set, so nothing can be encrypted.\n'
      + 'Generate one with `openssl rand -base64 32`, set it on this API, and keep\n'
      + 'a copy somewhere the database backups are not — losing it afterwards makes\n'
      + 'every converted credential unreadable.',
    );
    process.exit(1);
  }

  console.log(apply
    ? '── Encrypting stored credentials ──────────────────────────'
    : '── Dry run: nothing is written. Add --apply to do it. ─────');

  const tenants = await convertTenantColumns(apply);
  const configs = await convertPaymentConfigs(apply);

  let total = 0;
  console.log(`\nTenant rows read: ${tenants.rows}`);
  for (const column of TENANT_SECRET_COLUMNS) {
    const tally = tenants.tallies.get(column)!;
    total += tally.converted;
    console.log(line(column, tally, apply));
  }

  total += configs.tally.converted;
  console.log(`\nPayment config rows read: ${configs.rows}`);
  console.log(line('credentials', configs.tally, apply));

  const platform = await convertPlatformSettings(apply);
  total += platform.ai.converted + platform.storage.converted;
  console.log(`\nPlatform settings rows read: ${platform.rows}`);
  console.log(line('aiApiKey', platform.ai, apply));
  console.log(line('storage keys', platform.storage, apply));

  const plural = total === 1 ? '' : 's';
  if (apply) {
    console.log(`\nDone. ${total} value${plural} encrypted.`);
  } else if (total > 0) {
    console.log(
      `\n${total} value${plural} would be encrypted.`
      + ' Take a database backup, then run again with --apply.',
    );
  } else {
    console.log('\nNothing left to convert.');
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  // Deliberately terse. A Prisma error can carry the row it was working on, and
  // that row is full of the secrets this script exists to stop exposing.
  console.error('Conversion failed:', err instanceof Error ? err.message : 'unknown error');
  console.error(
    'Nothing further was written. Fix the cause and run it again —'
    + ' values already converted are skipped.',
  );
  await prisma.$disconnect();
  process.exit(1);
});
