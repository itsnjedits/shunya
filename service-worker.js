/* ═══════════════════════════════════════════════════════════
   ShunyaSpace — service-worker.js
   Cache-first for app shell, network-first for JSON data.
   A silence you can enter — even offline.
═══════════════════════════════════════════════════════════ */

const CACHE_NAME    = 'shunyaspace-v4';
const DATA_CACHE    = 'shunyaspace-data-v4';
const FONT_CACHE    = 'shunyaspace-fonts-v4';

/* App shell — always cached */
const SHELL_ASSETS = [
  './',
  './index.html',
  './script.js',
  './styles.css',
  './favicon.svg',
  './manifest.json',
];

/* JSON data files — network-first with cache fallback */
const DATA_PATTERNS = [
  /\/data\/.*\.json$/,
];

/* Font CDN — cache on first use */
const FONT_PATTERNS = [
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js/,
];

/* ─── INSTALL ─────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install failed:', err))
  );
});

/* ─── ACTIVATE ─────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== DATA_CACHE && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ─── FETCH ─────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET and chrome-extension requests */
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  /* JSON data: network-first, cache fallback */
  if (DATA_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  /* Fonts & CDN: cache-first */
  if (FONT_PATTERNS.some(p => p.test(url.href))) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  /* App shell & static assets: cache-first */
  if (url.origin === location.origin) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  /* Everything else: network only (audio/video/images) */
  event.respondWith(fetch(request).catch(() => new Response('', { status: 408 })));
});

/* ─── STRATEGIES ─────────────────────────────────────────── */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    /* Return offline fallback for HTML */
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('./index.html');
    }
    return new Response('', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('[]', {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
