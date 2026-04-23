import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify, { type FastifyError } from 'fastify';
import { prisma } from './db.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { appRouter } from './router/index.js';
import { createContext } from './trpc.js';

async function main() {
  const app = Fastify({ loggerInstance: logger });

  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });

  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ error, path }: { error: unknown; path?: string }) {
        logger.error({ err: error, path }, 'tRPC error');
      },
    },
  });

  app.get('/health', async () => ({ ok: true }));

  app.setErrorHandler((err: FastifyError, req, reply) => {
    req.log.error({ err }, 'unhandled error');
    const payload =
      env.NODE_ENV === 'production'
        ? { error: 'Internal Server Error' }
        : { error: err.message, stack: err.stack };
    reply.status(err.statusCode ?? 500).send(payload);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    try {
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ port: env.PORT }, 'server listening');
}

main().catch((err) => {
  logger.error({ err }, 'fatal startup error');
  process.exit(1);
});
