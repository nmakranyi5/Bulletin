// bulletin. service worker: lets the web app be installed and open its shell offline.
// It only caches this site's own files. Data (Supabase), maps and other sites always go to the
// network, so nothing private is ever stored here.

const CACHE = 'bulletin-shell-v1';

// On install, save the page and the files it points at, so the app also opens offline right
// after the first visit (the page that registered us loaded before we could cache anything).
async function precache() {
  const cache = await caches.open(CACHE);
  const home = new URL('./', self.registration.scope).href;
  const res = await fetch(home, { cache: 'reload' });
  if (!res.ok) return;
  await cache.put(home, res.clone());
  const html = await res.text();
  const files = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = new URL(m[1], home);
    if (u.origin === self.location.origin && /\.(js|css|png|ico|webmanifest)$/.test(u.pathname)) {
      files.add(u.href);
    }
  }
  await Promise.all([...files].map((f) => cache.add(f).catch(() => {})));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: always try the network first so a new deploy shows up, fall back to the last copy.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (fresh.ok) {
            const cache = await caches.open(CACHE);
            cache.put(new URL('./', self.registration.scope).href, fresh.clone());
          }
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(new URL('./', self.registration.scope).href)) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  // Files (scripts, fonts, images): the build gives them new names when they change, so a
  // saved copy is always right. Fetch what is missing and keep it.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })()
  );
});
