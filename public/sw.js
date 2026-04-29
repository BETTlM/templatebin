const VERSION = "meme-vault-v1";
const IMAGE_CACHE = `${VERSION}-images`;
const API_CACHE = `${VERSION}-api`;
const IMAGE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const API_TTL_MS = 1000 * 60 * 2; // 2 minutes

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => ![IMAGE_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function getCache(url) {
  const isTemplateImage =
    url.includes("/storage/v1/object/") ||
    /\.(png|jpg|jpeg|webp|gif|avif)$/i.test(url);
  return isTemplateImage ? IMAGE_CACHE : API_CACHE;
}

function getTtl(url) {
  return getCache(url) === IMAGE_CACHE ? IMAGE_TTL_MS : API_TTL_MS;
}

async function getFreshFromCache(cache, request) {
  const cached = await cache.match(request);
  if (!cached) return null;
  const ts = cached.headers.get("sw-fetched-at");
  if (!ts) return cached;
  const isFresh = Date.now() - Number(ts) < getTtl(request.url);
  return isFresh ? cached : null;
}

async function cacheResponse(cache, request, response) {
  if (!response || response.status !== 200 || response.type === "opaque") return;
  const headers = new Headers(response.headers);
  headers.set("sw-fetched-at", `${Date.now()}`);
  const body = await response.clone().blob();
  const wrapped = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  await cache.put(request, wrapped);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isApi = sameOrigin && url.pathname.startsWith("/api/templates/");
  const isImage =
    url.pathname.includes("/storage/v1/object/") ||
    /\.(png|jpg|jpeg|webp|gif|avif)$/i.test(url.pathname);
  if (!isApi && !isImage) return;

  event.respondWith(
    (async () => {
      const cacheName = getCache(request.url);
      const cache = await caches.open(cacheName);
      const freshCached = await getFreshFromCache(cache, request);
      if (freshCached) return freshCached;

      try {
        const networkResponse = await fetch(request);
        await cacheResponse(cache, request, networkResponse);
        return networkResponse;
      } catch {
        const stale = await cache.match(request);
        if (stale) return stale;
        throw new Error("Network and cache unavailable");
      }
    })(),
  );
});
