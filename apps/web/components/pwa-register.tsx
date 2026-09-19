'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker, once, in production.
 *
 * Nothing in development: a worker that caches pages would hand a
 * developer yesterday's build with a straight face.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* offline is a courtesy, not a requirement */
    });
  }, []);
  return null;
}
