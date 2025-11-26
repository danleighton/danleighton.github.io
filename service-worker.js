const BUILD_VERSION = 'v26.11.25.1202';
const CACHE_NAME = `ceilidh-dances-v8-${BUILD_VERSION}`;
const ASSETS = [
  '/',
  '/index.html',
  `/styles.css?v=${BUILD_VERSION}`,
  `/app.js?v=${BUILD_VERSION}`,
  `/dances.json?v=${BUILD_VERSION}`,
  `/formations.json?v=${BUILD_VERSION}`,
  `/roles.json?v=${BUILD_VERSION}`,
  `/setlists.json?v=${BUILD_VERSION}`,
  `/manifest.json?v=${BUILD_VERSION}`
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request);
    })
  );
});