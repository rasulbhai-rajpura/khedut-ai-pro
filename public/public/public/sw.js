self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // ઑનલાઇન અને ઑફલાઇન કેશિંગ રિક્વેસ્ટ હેન્ડલિંગ
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
