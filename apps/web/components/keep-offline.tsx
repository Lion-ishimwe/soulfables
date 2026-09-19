'use client';

import { useEffect, useState } from 'react';

/**
 * Keep this story offline.
 *
 * Asks the service worker to store the story's page and, when there is
 * one, its narration. Premium only; the page decides that before
 * rendering this. Shown only where a worker can exist.
 */
export function KeepOffline({ pageUrl, audioUrl }: { pageUrl: string; audioUrl: string | null }) {
  const [able, setAble] = useState(false);
  const [state, setState] = useState<'idle' | 'keeping' | 'kept' | 'failed'>('idle');

  useEffect(() => {
    setAble(process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator);
  }, []);

  if (!able) return null;

  async function keep() {
    setState('keeping');
    try {
      const reg = await navigator.serviceWorker.ready;
      const worker = reg.active;
      if (!worker) throw new Error('no worker');
      const urls = audioUrl ? [pageUrl, audioUrl] : [pageUrl];
      const done = new Promise<boolean>((resolve) => {
        const onMessage = (e: MessageEvent) => {
          if (e.data?.type === 'KEPT') {
            navigator.serviceWorker.removeEventListener('message', onMessage);
            resolve(e.data.kept >= 1);
          }
        };
        navigator.serviceWorker.addEventListener('message', onMessage);
        setTimeout(() => resolve(false), 60_000);
      });
      worker.postMessage({ type: 'KEEP', urls });
      setState((await done) ? 'kept' : 'failed');
    } catch {
      setState('failed');
    }
  }

  return (
    <button
      type="button"
      onClick={() => void keep()}
      disabled={state === 'keeping' || state === 'kept'}
      className="border border-rule px-8 py-3.5 font-ui text-xs uppercase tracking-[0.18em] text-grey-muted transition-all duration-base ease-house hover:border-ivory/30 hover:text-ivory disabled:opacity-60"
    >
      {state === 'idle' && 'Keep offline'}
      {state === 'keeping' && 'Keeping…'}
      {state === 'kept' && 'Kept for offline'}
      {state === 'failed' && 'Could not keep it — try again'}
    </button>
  );
}
