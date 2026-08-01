/* ============================================================
   AniLog Service Worker
   - Caches app shell for offline use
   - Network-first for API calls (Sheets, AniList)
   - Cache-first for static assets
   ============================================================ */

const CACHE_NAME = 'anilog-v1';
const STATIC_ASSETS = [
  '/anime-tracker/',
  '/anime-tracker/index.html',
  '/anime-tracker/manifest.json',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600&display=swap'
];

/* Install — cache app shell */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* Activate — clean old caches */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Fetch strategy */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network-first for: Google Sheets API, AniList GraphQL
  if (
    url.hostname === 'script.google.com' ||
    url.hostname === 'graphql.anilist.co' ||
    url.hostname === 'api.jikan.moe'
  ) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Cache-first for Google Fonts (they rarely change)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // Stale-while-revalidate for app shell (index.html, manifest)
  if (url.hostname === 'skaushik90.github.io') {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(res => {
            cache.put(e.request, res.clone());
            return res;
          });
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Default: network with cache fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
