const CACHE = "eburum-react-__CACHE_ID__";
const ASSETS = __PRECACHE_ASSETS__;
const paths = new Set(
  ASSETS.map((p) => new URL(p, self.location.href).pathname),
);
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))),
);
self.addEventListener("message", (event) => {
  if (event.data === "ACTIVATE_UPDATE") self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith("eburum-react-") ||
                  key.startsWith("eburum-team-manager-")) &&
                key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !paths.has(url.pathname)
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        const expected = url.pathname.endsWith(".js")
          ? "javascript"
          : url.pathname.endsWith(".css")
            ? "text/css"
            : null;
        if (
          response.ok &&
          (!expected ||
            (response.headers.get("content-type") || "").includes(expected))
        ) {
          const cache = await caches.open(CACHE);
          await cache.put(
            new Request(url.origin + url.pathname),
            response.clone(),
          );
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(url.origin + url.pathname);
        return (
          cached ||
          new Response("Risorsa non disponibile offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }),
  );
});
