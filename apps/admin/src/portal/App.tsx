import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { AdminUser } from '@pawheaven/contracts';
import { useApi } from './lib/api';
import { useRoute } from './lib/router';
import { Shell } from './Shell';
import { Button, Card, Skeleton } from './ui';
import { ToastProvider } from './ui/toast';
import { routes } from './routes';

function Gate() {
  const me = useApi<{ user: AdminUser }>('/admin/me');
  const { path } = useRoute();
  if (me.isLoading) return <div className="mx-auto max-w-md space-y-3 p-10"><Skeleton className="h-8 w-48" /><Skeleton className="h-24 w-full" /></div>;
  if (me.isError || !me.data) {
    return (
      <div className="mx-auto max-w-md p-10">
        <Card>
          <h1 className="text-xl font-semibold text-stone-950">Staff access required</h1>
          <p className="mt-2 text-sm leading-6 text-stone-700">This account is signed in but does not have access to the staff portal, or the shelter database could not be reached.</p>
          <div className="mt-4 flex gap-2"><Button onClick={() => window.location.reload()}>Try again</Button><Button variant="ghost" onClick={() => window.location.assign('/login')}>Sign in as someone else</Button></div>
        </Card>
      </div>
    );
  }
  const Page = (routes.find((route) => (route.path === '/' ? path === '/' : path.startsWith(route.path))) ?? routes[0]).component;
  return <Shell user={me.data.user}><Page user={me.data.user} /></Shell>;
}

export function App() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true } } }));
  return <QueryClientProvider client={client}><ToastProvider><Gate /></ToastProvider></QueryClientProvider>;
}
