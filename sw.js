// Minimal service worker: cache-first for shell assets, network-only for /api calls.
// Bumping VERSION busts the old cache.

const VERSION = 'sg-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './src/data.jsx',
  './src/sync.jsx',
  './src/flowers.jsx',
  './src/screens.jsx',
  './src/app.jsx',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Never cache API calls or cross-origin scripts (React/Babel/fonts)
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(resp => {
      if (resp.ok) {
        const copy = resp.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return resp;
    }).catch(() => caches.match('./index.html')))
  );
});
