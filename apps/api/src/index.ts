import 'dotenv/config';
import { buildApp } from './app';

// Refuse to start in production without a real JWT secret
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required in production.');
  process.exit(1);
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
