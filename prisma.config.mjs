import { defineConfig, env } from 'prisma/config';
import fs from 'node:fs';
import path from 'node:path';

// No 'dotenv' package in this project — load .env.local by hand so the
// Prisma CLI (migrate/studio/etc.) can see DATABASE_URL.
const envPath = path.join(import.meta.dirname, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]+|['"]+$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
