const CACHE_NAME = "timbrature-baubau-v2";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)).then(async () => {
      // Migrazione iniziale dalla vecchia versione v1: quella pagina non aveva ancora
      // il dialogo di aggiornamento. Attiviamo una sola volta il codice che lo introduce.
      // Le versioni successive (v2 -> v3 e oltre) resteranno in attesa del backup.
      const keys = await caches.keys();
      if (keys.includes("timbrature-baubau-v1")) await self.skipWaiting();
    })
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("timbrature-baubau-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Per la pagina principale prova prima la rete, così online si vede il contenuto più recente;
  // se manca la connessione usa la copia in cache.
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
      }
      return response;
    }).catch(() => caches.match("./index.html").then(cached => cached || caches.match("./"))));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => {
    if (cached) return cached;
    return fetch(event.request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    });
  }));
});
