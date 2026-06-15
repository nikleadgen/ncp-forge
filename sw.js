// sw.js — offline-first service worker. Precache the app shell; serve cache-first.
// Bump CACHE on any shell change to force an update.
const CACHE = 'forge-v3';
const SHELL = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.webmanifest',
  './js/store.js',
  './js/exercises.js',
  './js/program.js',
  './js/engine.js',
  './js/charts.js',
  './js/ui.js',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Navigations → app shell (SPA) with offline fallback.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
