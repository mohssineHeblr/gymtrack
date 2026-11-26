/* GYMTRACK service worker — offline app shell + runtime caching */
const VERSION = "gymtrack-v1.0.0";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const ROUTES = [
  "/",
  "/workout",
  "/programs",
  "/programs/edit",
  "/exercises",
  "/progress",
  "/body",
  "/history",
  "/history/view",
  "/nutrition",
  "/profile",
  "/login",
];
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(STATIC_ASSETS).catch(() => {});
      // Cache each page and every Next.js chunk it references so the whole app works offline.
      const assetUrls = new Set();
      await Promise.all(
        ROUTES.map(async (route) => {
          try {
            const res = await fetch(route, { credentials: "same-origin" });
            if (!res.ok) return;
            await cache.put(route, res.clone());
            const html = await res.text();
            for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assetUrls.add(m[0]);
          } catch {
            /* ignore — will be cached at runtime */
          }
        }),
      );
      const runtime = await caches.open(RUNTIME_CACHE);
      await Promise.all(
        [...assetUrls].map((u) =>
          fetch(u)
            .then((r) => (r.ok ? runtime.put(u, r) : undefined))
            .catch(() => {}),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase / external requests

  // Immutable build assets: cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Page navigations: network-first (with timeout), fall back to cached page shell
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await Promise.race([fetch(req), timeout(4000)]);
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        } catch {
          const cached =
            (await caches.match(url.pathname, { ignoreSearch: true })) ||
            (await caches.match(req, { ignoreSearch: true })) ||
            (await caches.match("/"));
          return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      })(),
    );
    return;
  }

  // Other same-origin GETs (RSC payloads, manifest, images): stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || new Response("", { status: 504 }));
      return cached || network;
    })(),
  );
});
