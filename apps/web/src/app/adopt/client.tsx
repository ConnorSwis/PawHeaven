import { useEffect, useState, type ReactNode } from 'react';

/**
 * Renders `fallback` while the page is being built and on the first client render, then the real
 * content. Anything that reads the address, local storage, or the data the Worker inlined belongs
 * inside, so the server and browser agree on the first paint.
 */
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <>{ready ? children : fallback}</>;
}
