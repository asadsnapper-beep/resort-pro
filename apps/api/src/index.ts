import 'dotenv/config';
import { buildApp } from './app';
import { hasEncryptionKey } from './utils/secret-box';
import { preflightEnv } from './utils/env-preflight';

// Everything production needs, checked before anything listens. This replaces
// a lone JWT_SECRET check that asked only whether it was defined — and so said
// nothing about a database URL pointing at localhost, or a secret still set to
// the dev default. Fatal problems stop the process here; the rest are printed
// loudly and the API carries on. See utils/env-preflight.ts for which is which.
preflightEnv();

// Outside production the preflight stays quiet, but this one case is worth
// saying everywhere: it is the difference between "saving credentials works"
// and "saving credentials is refused", and it is easy to hit locally.
if (!hasEncryptionKey()) {
  console.warn(
    '[secrets] CREDENTIALS_KEY is not set — payment, SMS and SSO credentials cannot be '
    + 'encrypted, so saving them will be refused. Generate one with `openssl rand -base64 32`.',
  );
}

const start = async () => {
  const app = await buildApp();

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    console.log(`\n🚀 ResortPro API running at http://${host}:${port}`);
    console.log(`📖 API Docs: http://localhost:${port}/docs`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
