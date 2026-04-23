import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import HomePage from '@/components/HomePage';
import { Toaster } from '@/components/ui/sonner';
import { queryClient } from '@/lib/trpc';
import { RootErrorBoundary } from '@/routes/root';

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
    errorElement: <RootErrorBoundary />,
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
