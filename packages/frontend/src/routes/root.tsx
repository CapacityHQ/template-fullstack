import { useRouteError } from 'react-router-dom';

export function RootErrorBoundary() {
  const err = useRouteError();
  const message = err instanceof Error ? err.message : 'Something went wrong.';
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Error</h1>
      <pre className="mt-3 rounded bg-gray-100 p-3 text-sm">{message}</pre>
    </div>
  );
}
