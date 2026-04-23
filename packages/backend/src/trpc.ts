import { initTRPC } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { ZodError } from 'zod';
import { prisma } from './db.js';

export interface CtxLogger {
  debug: (obj: unknown, msg?: string) => void;
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

export interface Context {
  db: typeof prisma;
  log: CtxLogger;
}

export function createContext({ req }: CreateFastifyContextOptions): Context {
  return {
    db: prisma,
    log: req.log,
  };
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
