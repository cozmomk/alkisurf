const STATIC_CACHE = 'alkisurf-static-v2';
const API_CACHE = 'alkisurf-api-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname === '/api/conditions') {
    // Network-first: serve fresh data, fall back to cache when offline
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(API_CACHE).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    // Other API routes: network only
    return;
  }

  // Fingerprinted assets (/assets/*.js, /assets/*.css): cache-first, safe forever
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // HTML and everything else: network-first so deploys are always reflected
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
