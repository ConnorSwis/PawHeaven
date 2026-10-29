import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Toast = { id: number; tone: 'success' | 'error'; text: string };
type Api = { success: (text: string) => void; error: (text: string) => void };
const Context = createContext<Api>({ success: () => undefined, error: () => undefined });
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = ++counter;
    setToasts((current) => [...current.slice(-3), { id, tone, text }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), tone === 'error' ? 7000 : 3500);
  }, []);
  const api = useMemo<Api>(() => ({ success: (text) => push('success', text), error: (text) => push('error', text) }), [push]);
  return (
    <Context.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`pointer-events-auto max-w-md border px-4 py-3 text-sm shadow-md ${toast.tone === 'error' ? 'border-red-300 bg-red-50 text-red-900' : 'border-green-300 bg-green-50 text-green-900'}`}>
            {toast.text}
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}

export const useToast = () => useContext(Context);
