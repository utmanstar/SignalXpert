// service-worker.js for SignalXpert
const CACHE_NAME = "signalxpert-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/script.js",
  "/signals.json",
  "/styles.css",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

// Install event - cache everything
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - try cache first, then network
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
