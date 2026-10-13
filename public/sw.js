// Pakti service worker: installability only.
// It deliberately caches nothing and does not intercept requests, because
// Pakti holds private goals, finances and evidence that must never be served
// stale or stored offline on a shared phone.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
