/**
 * Seed initial AdminUser records from SUPER_ADMIN_EMAILS env var.
 * Run once after T-16 migration: npx tsx src/scripts/seed-admin.ts
 *
 * Creates SUPER_ADMIN accounts using the bcrypt hash of SUPER_ADMIN_PASSWORD
 * (default: "Admin@123456" — CHANGE IT after first login).
 */
import bcrypt from 'bcryptjs';
import { prisma } from '@resort-pro/database';

async function main() {
  const emails = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const defaultPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123456';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  for (const email of emails) {
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      console.log(`⏭  Already exists: ${email} (role: ${existing.role})`);
      continue;
    }

    await prisma.adminUser.create({
      data: { email, passwordHash, role: 'SUPER_ADMIN', firstName: 'Super', lastName: 'Admin' },
    });
    console.log(`✅  Created SUPER_ADMIN: ${email}`);
  }

  if (emails.length === 0) {
    console.log('⚠️  No SUPER_ADMIN_EMAILS set in env. Nothing to seed.');
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
