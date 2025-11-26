importScripts('version.js');

if (typeof BUILD_VERSION === 'undefined') {
  throw new Error('version.js must be available to the service worker');
}

const CACHE_NAME = `ceilidh-dances-v8-${BUILD_VERSION}`;
const ASSETS = [
  '/',
  '/index.html',
  '/version.js',
  `/styles.css${VERSION_SUFFIX}`,
  `/app.js${VERSION_SUFFIX}`,
  `/dances.json${VERSION_SUFFIX}`,
  `/formations.json${VERSION_SUFFIX}`,
  `/roles.json${VERSION_SUFFIX}`,
  `/setlists.json${VERSION_SUFFIX}`,
  `/manifest.json${VERSION_SUFFIX}`
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