/*
 * The House, offline.
 *
 * What this keeps: the page you were on, the scripts and styles it
 * needs, and any story a Premium reader asked to keep — its page and
 * its narration. What it never keeps: anything under /api except a
 * narration that was asked for, anything from another origin except
 * that narration's file, and nothing at all on a sign-in page.
 *
 * Navigations go to the network first and fall back to what is kept,
 * then to the offline page. Static assets are kept as they are used.
 */
const VERSION = 'soulfables-v1';
const SHELL = ['/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const isStatic = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/house/') || url.pathname === '/manifest.webmanifest');

const isNarration = (url) => url.origin === self.location.origin && /^\/api\/story\/[^/]+\/audio$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        return res;
      })),
    );
    return;
  }

  if (isNarration(url)) {
    // A kept narration answers from the cache even with the network up,
    // so a signed link that has expired does not matter.
    event.respondWith(caches.match(url.pathname).then((hit) => hit || fetch(req)));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        // Only pages a reader may keep are put back: never sign-in, never the account.
        if (res.ok && !/^\/(signin|signup|account|admin|api)/.test(url.pathname)) {
          caches.open(VERSION).then((c) => c.put(url.pathname, res.clone()));
        }
        return res;
      }).catch(() => caches.match(url.pathname).then((hit) => hit || caches.match('/offline'))),
    );
  }
});

/*
 * "Keep offline": the page asks for a story and its narration to be
 * kept. The narration route redirects to a signed file; the file is
 * fetched and stored under the route's own address, so the player's
 * request finds it later.
 */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'KEEP' || !Array.isArray(data.urls)) return;
  const reply = (payload) => event.source && event.source.postMessage(payload);
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      let kept = 0;
      for (const u of data.urls) {
        try {
          const url = new URL(u, self.location.origin);
          const res = await fetch(url.href, { credentials: 'include', redirect: 'follow' });
          if (!res.ok) continue;
          await cache.put(url.pathname, res);
          kept += 1;
        } catch (e) {
          /* the next one may still work */
        }
      }
      reply({ type: 'KEPT', kept, of: data.urls.length });
    }),
  );
});
