// SîpFlõw Service Worker — v8 (offline-first)
const VERSION = 'sipflow-v8'
const SHELL_CACHE = `${VERSION}-shell`
const API_CACHE = `${VERSION}-api`
const ASSETS_CACHE = `${VERSION}-assets`

const PRECACHE_URLS = [
  '/',
  '/owner',
  '/owner/marketing',
  '/bar',
  '/waiter',
  '/staff',
  '/reserve',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) =>
      Promise.allSettled(PRECACHE_URLS.map((u) => c.add(u).catch(() => null)))
    )
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // API GET → stale-while-revalidate
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(req, API_CACHE))
    return
  }

  // Static assets → cache-first
  if (
    url.pathname.startsWith('/_next/') ||
    /\.(png|jpg|jpeg|svg|webp|woff2?|ico|css|js|gif|mp3|wav|ogg)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, ASSETS_CACHE))
    return
  }

  // HTML pages → network-first, fall back to cache
  event.respondWith(networkFirst(req, SHELL_CACHE))
})

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {})
      return res
    })
    .catch(() =>
      cached ||
      new Response(JSON.stringify({ offline: true, message: 'لا توجد بيانات محفوظة' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503,
      })
    )
  return cached || network
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)
  if (cached) return cached
  try {
    const res = await fetch(req)
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {})
    return res
  } catch {
    return cached || new Response('', { status: 504 })
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(req)
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {})
    return res
  } catch {
    const cached = await cache.match(req)
    if (cached) return cached
    const fallback = await cache.match('/')
    return fallback || new Response('Offline', { status: 503 })
  }
}
