// Minimal service worker: makes ENDZ installable (PWA) WITHOUT caching, so it
// can never serve a stale build — important while we iterate pre-launch.
// A registered SW with a fetch listener is what satisfies installability;
// we intentionally don't call respondWith, so every request hits the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // network passthrough (no offline cache by design)
});
