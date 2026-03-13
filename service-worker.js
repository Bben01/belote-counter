/* eslint-disable no-restricted-globals */

const CACHE_NAME = "belote-counter-v2"
const PRECACHE_URLS = ["./", "./index.html", "./app.css", "./app.js", "./logic.js", "./manifest.webmanifest", "./favicon.ico", "./icons/icon-192.png", "./icons/icon-512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(PRECACHE_URLS)
      self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
      self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  event.respondWith(
    (async () => {
      const url = new URL(req.url)
      const isSameOrigin = url.origin === self.location.origin

      // For navigations, prefer cached shell to feel instant/offline-friendly.
      if (req.mode === "navigate") {
        const cached = await caches.match("./index.html")
        if (cached) return cached
      }

      if (isSameOrigin) {
        const cached = await caches.match(req)
        if (cached) return cached
      }

      try {
        const res = await fetch(req)
        if (isSameOrigin && res.ok) {
          const cache = await caches.open(CACHE_NAME)
          cache.put(req, res.clone())
        }
        return res
      } catch (err) {
        // Offline fallback: try cached request, then app shell.
        const cached = await caches.match(req)
        if (cached) return cached
        const shell = await caches.match("./index.html")
        if (shell) return shell
        throw err
      }
    })(),
  )
})

