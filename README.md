# Fullstack Template

Vite + React 19 · Fastify + tRPC 11 · Prisma 7 + Postgres · Zod 4 · Zustand · pnpm + Turborepo.

## Quickstart

```bash
nvm use                              # Node 22
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
pnpm install
pnpm db:up                           # starts Postgres in docker
pnpm db:migrate                      # applies Prisma migrations
pnpm dev                             # backend :3001 and frontend :5173
```

Open <http://localhost:5173>.

## Layout

```
packages/
  shared/   Zod schemas and types shared between frontend and backend
  backend/  Fastify + tRPC + Prisma server
  frontend/ Vite + React + TanStack Query + Zustand app
```

## Scripts (root)

| Script             | Purpose                              |
| ------------------ | ------------------------------------ |
| `pnpm dev`         | Run backend and frontend in parallel |
| `pnpm build`       | Build all packages for production    |
| `pnpm test`        | Run Vitest in every package          |
| `pnpm typecheck`   | Run `tsc --noEmit` in every package  |
| `pnpm lint`        | Run ESLint in every package          |
| `pnpm db:up`       | Start Postgres via docker-compose    |
| `pnpm db:migrate`  | Run Prisma migrations                |
| `pnpm db:generate` | Regenerate Prisma client             |
| `pnpm db:studio`   | Open Prisma Studio                   |

## Running a single package

```bash
pnpm --filter @capacity/frontend dev
pnpm --filter @capacity/backend dev
```

## Adding a shadcn component

```bash
cd packages/frontend
pnpm dlx shadcn@latest add <component-name>
```

## Adding a tRPC procedure

1. Add the Zod schema to `packages/shared/src/schemas/<feature>.ts`.
2. Add the procedure in `packages/backend/src/router/<feature>.ts`.
3. Register it in `packages/backend/src/router/index.ts`.
4. Use it on the frontend via `trpc.<feature>.<proc>`.

## Architecture

```
frontend (Vite + TanStack Query)
   │  HTTP JSON (/trpc)
   ▼
backend (Fastify + tRPC + pino logger)
   │
   ▼
Prisma 7 → Postgres 16
```

### How the layers compose

Three properties make this stack worth using together:

- **One Zod schema, three uses.** A schema declared in `@capacity/shared` (e.g. `CreatePostInput`) is the source of truth for backend `.input(...)` validation, frontend form validation via `zodResolver(CreatePostInput)`, and the inferred TypeScript type used on both sides. One declaration, three call-sites.
- **End-to-end types without bundling.** The frontend's tRPC client (`packages/frontend/src/lib/trpc.ts`) imports the router type only: `import type { AppRouter } from '@capacity/backend/router'`. tRPC infers procedure inputs and outputs from this type, giving full autocomplete on `trpc.post.list.queryOptions()` etc., without dragging any backend runtime code into the frontend bundle. This import is template infrastructure — feature code does not add it.
- **No build step in dev.** `@capacity/shared`'s `package.json` uses conditional `exports` to resolve `./src/index.ts` in development and `./dist/index.js` in production. Edits to shared schemas are picked up by Vite and `tsx watch` immediately.

### Feature pattern (worked example: Post)

Build features in this order. Each layer below is one file with one responsibility.

#### 1. Shared Zod schema — `packages/shared/src/schemas/post.ts`

Source of truth for the entity shape. Derive input schemas with `.pick()` so field constraints stay in one place.

```ts
import { z } from 'zod';

export const PostSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().max(5000),
  createdAt: z.date(),
});

export const CreatePostInput = PostSchema.pick({ title: true, body: true });
export const DeletePostInput = PostSchema.pick({ id: true });

export type Post = z.infer<typeof PostSchema>;
export type CreatePostInput = z.infer<typeof CreatePostInput>;
export type DeletePostInput = z.infer<typeof DeletePostInput>;
```

#### 2. Shared barrel — `packages/shared/src/index.ts`

Re-export so consumers always import from `@capacity/shared`.

```ts
export * from './schemas/post';
```

#### 3. Prisma model — `packages/backend/prisma/schema.prisma`

Add the model, then run `pnpm db:migrate` to create + apply the migration. `pnpm db:generate` refreshes the typed client.

```prisma
model Post {
  id        String   @id @default(uuid())
  title     String
  body      String
  createdAt DateTime @default(now())
}
```

#### 4. tRPC root — `packages/backend/src/trpc.ts`

Defined once for the app. Exposes `createContext` (returning `{ db, log }`) and an `errorFormatter` that attaches a flattened `zodError` to every failure, so the frontend can render field-level validation errors. Feature routers consume `router` and `publicProcedure` from this file.

```ts
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
```

#### 5. tRPC feature router — `packages/backend/src/router/post.ts`

`list` query plus `create` / `delete` mutations. Procedures use `ctx.db` for Prisma and `ctx.log` for the per-request pino child logger. Inputs use the shared schemas.

```ts
import { CreatePostInput, DeletePostInput } from '@capacity/shared';
import { TRPCError } from '@trpc/server';
import { publicProcedure, router } from '../trpc.js';

function isPrismaKnownError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}

export const postRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    ctx.log.debug('post.list');
    return ctx.db.post.findMany({ orderBy: { createdAt: 'desc' } });
  }),

  create: publicProcedure.input(CreatePostInput).mutation(({ ctx, input }) => {
    ctx.log.debug({ input }, 'post.create');
    return ctx.db.post.create({ data: input });
  }),

  delete: publicProcedure.input(DeletePostInput).mutation(async ({ ctx, input }) => {
    ctx.log.debug({ input }, 'post.delete');
    try {
      await ctx.db.post.delete({ where: { id: input.id } });
    } catch (err) {
      if (isPrismaKnownError(err) && err.code === 'P2025') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      }
      throw err;
    }
  }),
});
```

**Prisma error mapping convention.** Wrap Prisma calls that can fail on missing or duplicate rows and translate Prisma's known error codes to tRPC errors. The Post router demonstrates `P2025`; apply `P2002` the same way wherever a unique constraint exists.

| Prisma code | Meaning                     | tRPC code   |
| ----------- | --------------------------- | ----------- |
| `P2025`     | record not found            | `NOT_FOUND` |
| `P2002`     | unique constraint violation | `CONFLICT`  |

Other codes bubble up to the global Fastify error handler.

#### 6. Router registration — `packages/backend/src/router/index.ts`

Mount the feature router under its name. The exported `AppRouter` type is what the frontend consumes.

```ts
import { router } from '../trpc.js';
import { postRouter } from './post.js';

export const appRouter = router({
  post: postRouter,
});

export type AppRouter = typeof appRouter;
```

#### 7. Frontend route — `packages/frontend/src/routes/posts.tsx`

Reads with `useQuery(trpc.post.list.queryOptions())`. Writes with `useMutation` and invalidate the list on success; add an `onError` handler to surface `err.message` via a `sonner` toast. Validate the form against the **same** schema the backend uses.

```tsx
const { data, isLoading } = useQuery(trpc.post.list.queryOptions());

const form = useForm<FormValues>({
  resolver: zodResolver(CreatePostInput),
  defaultValues: { title: '', body: '' },
});

const createMutation = useMutation(
  trpc.post.create.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.post.list.queryFilter());
      form.reset();
    },
  }),
);
```

UI-only state (e.g. composer open/closed) belongs in the Zustand store at `src/store/ui.ts`. Server state stays in TanStack Query.

### Testing pattern

Two canonical shapes used in this template:

**Backend procedure tests** (e.g. `packages/backend/src/router/post.test.ts`)

Build an in-memory caller with `postRouter.createCaller({ db, log })` (substitute your own router name for new features) where `db` is a plain object whose Prisma method calls are `vi.fn()` mocks and `log` is a silent pino instance. Assert that procedures call Prisma with the expected arguments, return the expected shape, reject invalid input, and map known Prisma errors to the documented tRPC codes.

```ts
const silent = pino({ level: 'silent' });

function makeCaller(dbOverrides: Record<string, unknown> = {}) {
  const db = {
    post: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      ...dbOverrides,
    },
  };
  const caller = postRouter.createCaller({
    db: db as never,
    log: silent as never,
  });
  return { caller, db };
}
```

**Frontend route tests** (e.g. `packages/frontend/src/routes/posts.test.tsx`)

`vi.mock('@/lib/trpc', () => ({ ... }))` to return a fake `trpc` proxy whose procedure objects expose `queryOptions`, `mutationOptions`, and `queryFilter` as plain functions. Render the component inside a fresh `QueryClientProvider` (with `retry: false`) and exercise it via `@testing-library/react` and `userEvent`.

```tsx
vi.mock('@/lib/trpc', () => ({
  queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  trpc: {
    post: {
      list: {
        queryOptions: () => ({ queryKey: ['post.list'], queryFn: async () => posts }),
        queryFilter: () => ({ queryKey: ['post.list'] }),
      },
      // ...
    },
  },
}));
```

> The pattern above is the canonical way to add a new feature in this template — copy the file shapes when introducing your own models.
