/* Service worker mínimo: necesario para que la app sea instalable (PWA).
   No cachea nada (pasa todo a red) para evitar contenido desactualizado. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // passthrough a red; el handler debe existir para instalabilidad
});
