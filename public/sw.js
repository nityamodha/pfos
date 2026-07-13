// Minimal service worker: enables installability + a lightweight offline shell.
// v2: only content-hashed /_next/static assets are cache-first. Everything else
// (page navigations AND same-origin RSC/data fetches issued by client-side
// <Link> transitions) is network-first, so soft-navigating between tabs never
// serves stale data — previously those data fetches fell into the cache-first
// branch meant for static assets and could get stuck stale until a hard reload.
const CACHE = "pfos-v2";
const APP_SHELL = ["/", "/accounts", "/transactions", "/add", "/settings", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

function isImmutableStaticAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cache-first only for content-hashed build assets — safe because their URL
  // changes whenever their content does.
  if (isImmutableStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
            return res;
          }),
      ),
    );
    return;
  }

  // Network-first for everything else same-origin: full-page navigations,
  // client-side RSC/data fetches, and unhashed assets. Falls back to cache
  // (offline shell) only when the network is unavailable.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || (request.mode === "navigate" ? caches.match("/") : undefined))),
    );
  }
});
