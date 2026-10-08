// Offline support: serve from cache straight away, refresh the cache in the background.
// Bump VERSION whenever app files change so phones pick up the new build.
const VERSION = 'gym-v17';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './js/app.js',
  './js/logic.js',
  './js/store.js',
  './js/demo.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      const net = fetch(e.request)
        .then((res) => {
          if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
