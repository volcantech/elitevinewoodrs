// Service Worker - Ultra-safe network-first strategy
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Network-first: Just pass through to network, no caching
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // On network error, return offline response
        return new Response(
          JSON.stringify({ error: 'Offline' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
  );
});
