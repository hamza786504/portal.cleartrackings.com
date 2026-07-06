// One-time script to create the seed admin account.
// Run with: node scripts/seedAdmin.mjs
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// No 'dotenv' package in this project — load .env.local by hand.
function loadEnvLocal() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.join(dir, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]+|['"]+$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'Admin@123';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set — check .env.local');

  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`Admin account already exists (${ADMIN_EMAIL}). Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
      firstName: 'Admin',
      lastName: '',
      isApproved: true,
    },
  });

  console.log(`Admin account created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
