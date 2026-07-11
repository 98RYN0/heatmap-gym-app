// Minimal service worker — exists purely to make the app installable as a
// PWA (an installed/homescreen app is treated as persistent storage by
// mobile browsers, especially iOS Safari, unlike a plain bookmarked tab —
// see docs/decisions.md). Deliberately does NOT cache anything: a real
// offline-asset caching strategy needs cache versioning/invalidation on
// every deploy, which is a separate feature this isn't trying to be yet.
// Every request just passes straight through to the network.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
