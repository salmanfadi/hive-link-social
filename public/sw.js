// Robust service worker — caches the app shell and serves cached responses when offline
const CACHE = "decentra-v2";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => {
      console.log("[SW] Caching shell...");
      return c.addAll(SHELL);
    }).catch((err) => console.error("[SW] Install error:", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  
  const url = new URL(req.url);
  // Skip Supabase, IPFS, and cross-origin API traffic
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Only cache successful responses
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        // Network failed, try cache
        const match = await caches.match(req);
        if (match) return match;
        
        // If it's a navigation request, return the shell
        if (req.mode === "navigate") {
          return caches.match("/") || caches.match("/index.html");
        }
        
        // Return a basic error response instead of undefined to avoid TypeError
        return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
      })
  );
});
