// Basic app-shell service worker for BILL APP.
// Caches the static shell so the app can still load while offline;
// live data (billing, stock, etc.) still goes through the network
// to the configured Google Sheet backend.

const CACHE_NAME = 'bill-app-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './favicon-16.png',
  './favicon-32.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Network-first for navigation/API calls, cache-first for the app shell.
self.addEventListener('fetch', function (event) {
  const req = event.request;

  // Never intercept calls to the Google Sheet backend or other
  // cross-origin API requests — always go to the network for those.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      const fetchPromise = fetch(req)
        .then(function (networkRes) {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(req, clone);
            });
          }
          return networkRes;
        })
        .catch(function () {
          return cached;
        });
      return cached || fetchPromise;
    })
  );
});
