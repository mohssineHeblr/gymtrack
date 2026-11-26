/* GYMTRACK service worker — offline app shell + runtime caching */
const VERSION = "gymtrack-v2.0.0";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const ROUTES = [
  "/",
  "/workout",
  "/smart",
  "/recovery",
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

// ---------------------------------------------------------------------------
// Rest-timer notifications
// ---------------------------------------------------------------------------

// Web Push fallback (sent by the rest-timer-push Edge Function while the app is suspended).
// The push has no payload; iOS/Android play the standard notification sound.
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = wins.some((c) => c.visibilityState === "visible");
      await self.registration.showNotification("GYMTRACK · Rest finished", {
        body: "Time for your next set 💪",
        tag: "rest-timer",
        renotify: true,
        silent: visible, // the open app already played its own alarm
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        vibrate: [250, 120, 250],
        data: { url: "/workout" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/workout";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of wins) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c && !c.url.endsWith(url)) c.navigate(url).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
