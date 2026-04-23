import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { AppRouter } from '@capacity/backend/router';

const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl) {
  throw new Error('VITE_API_URL is not set. Copy .env.example to .env.');
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: `${apiUrl}/trpc` })],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
