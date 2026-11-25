const CACHE_NAME = "coacero-ventas-shell-v0.11h";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./role-policy.mjs",
  "./graph-client.mjs",
  "./app.js",
  "./assets/logo-coacero.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./vendor/msal-browser.min.js",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Nunca cachear tokens, OAuth ni llamadas a Microsoft Graph / SharePoint.
  if (
    url.origin !== self.location.origin ||
    url.hostname.includes("microsoftonline.com") ||
    url.hostname.includes("graph.microsoft.com")
  ) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
  );
});
