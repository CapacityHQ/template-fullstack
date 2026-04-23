import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from './logger.js';

export const prisma = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('query', (e) => {
  logger.debug({ query: e.query, params: e.params, durationMs: e.duration }, 'prisma query');
});
prisma.$on('info', (e) => logger.info({ message: e.message }, 'prisma info'));
prisma.$on('warn', (e) => logger.warn({ message: e.message }, 'prisma warn'));
prisma.$on('error', (e) => logger.error({ message: e.message }, 'prisma error'));
