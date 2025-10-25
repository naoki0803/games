// Service Worker for side-scroller PWA
const CACHE_NAME = 'side-scroller-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

self.addEventListener('activate', (event) => {
  const whitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.map((n) => {
      if (!whitelist.includes(n)) return caches.delete(n);
    })))
  );
});
