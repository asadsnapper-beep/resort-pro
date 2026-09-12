import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Tenant columns that must never appear in a response body.
 *
 * Read out of schema.prisma rather than written down here, so a secret added
 * next month is covered without anyone remembering to update a list. A
 * hand-maintained list of secrets is a list that goes stale exactly when it
 * matters.
 *
 * The names are matched, not the values: a test can then assert on the raw
 * response text and catch a leak even when the field is empty or null.
 */

const SECRET_NAME = /secret|token|apikey|password|credential|privatekey/i;

/**
 * Deliberate exceptions. `waPhoneNumberId` is an identifier, not a credential,
 * and `resetToken`-style fields on other models are out of scope here.
 */
const NOT_SECRETS = new Set<string>([]);

export function tenantSecretFields(schemaPath?: string): string[] {
  const path = schemaPath
    ?? join(__dirname, '../../../../packages/database/prisma/schema.prisma');
  return secretFieldsOf(readFileSync(path, 'utf8'), 'Tenant');
}

/** Exported separately so the parser itself can be tested on a fixture. */
export function secretFieldsOf(schema: string, modelName: string): string[] {
  const start = schema.indexOf(`model ${modelName} {`);
  if (start === -1) {
    throw new Error(`model ${modelName} not found — has the schema been restructured?`);
  }
  const end = schema.indexOf('\n}', start);
  const block = schema.slice(start, end === -1 ? undefined : end);

  const fields: string[] = [];
  for (const line of block.split('\n').slice(1)) {
    // Field lines look like `  smsApiKey  String?`. Skip blanks, comments,
    // attributes (`@@index`) and relations written across lines.
    const match = /^\s{2}([A-Za-z][A-Za-z0-9_]*)\s+\S/.exec(line);
    if (!match) continue;
    const name = match[1];
    if (NOT_SECRETS.has(name)) continue;
    if (SECRET_NAME.test(name)) fields.push(name);
  }
  return fields;
}
