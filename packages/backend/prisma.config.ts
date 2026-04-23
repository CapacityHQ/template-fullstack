import path from 'node:path';
import process from 'node:process';
import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile();
} catch {
  // .env is optional; env vars may come from the shell in CI/production
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before running Prisma commands');
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  engine: 'classic',
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
