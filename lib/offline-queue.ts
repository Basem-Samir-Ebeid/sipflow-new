'use client'

const DB_NAME = 'sipflow-offline'
const STORE = 'queue'
const DB_VERSION = 1

// Only queue mutations to these endpoints. Auth/login/payment endpoints are
// intentionally excluded — they should fail explicitly instead of silently queue.
const QUEUE_PATH_PREFIXES = [
  '/api/orders',
  '/api/drinks',
  '/api/inventory',
  '/api/inventory-dashboard',
  '/api/messages',
  '/api/reservations',
  '/api/stock-movements',
  '/api/recipes',
  '/api/ingredients',
  '/api/purchase-orders',
  '/api/suppliers',
  '/api/clients',
  '/api/staff',
  '/api/users',
]

type QueuedRequest = {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
  createdAt: number
}

let installed = false
let originalFetch: typeof fetch | null = null
const listeners = new Set<(count: number) => void>()

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbAdd(item: QueuedRequest): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function dbGetAll(): Promise<QueuedRequest[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as QueuedRequest[]) || [])
    req.onerror = () => reject(req.error)
  })
}

async function dbDelete(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function notify() {
  try {
    const items = await dbGetAll()
    listeners.forEach((cb) => cb(items.length))
  } catch {
    listeners.forEach((cb) => cb(0))
  }
}

export function onQueueChange(cb: (count: number) => void): () => void {
  listeners.add(cb)
  dbGetAll().then((q) => cb(q.length)).catch(() => cb(0))
  return () => { listeners.delete(cb) }
}

export async function getPendingCount(): Promise<number> {
  try {
    const q = await dbGetAll()
    return q.length
  } catch {
    return 0
  }
}

function shouldQueue(url: string, method: string): boolean {
  const m = method.toUpperCase()
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://x')
    return QUEUE_PATH_PREFIXES.some((p) => u.pathname.startsWith(p))
  } catch {
    return false
  }
}

let flushing = false
export async function flushQueue(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    const items = await dbGetAll()
    for (const item of items) {
      try {
        const fn = originalFetch || fetch
        const res = await fn(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        })
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          // success or non-recoverable error → discard from queue
          await dbDelete(item.id).catch(() => {})
        } else {
          break // server error, try later
        }
      } catch {
        break // network down again
      }
    }
  } finally {
    flushing = false
    notify()
  }
}

export function installOfflineQueue() {
  if (installed || typeof window === 'undefined' || !('indexedDB' in window)) return
  installed = true
  originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url
    const method = (init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase()
    const fn = originalFetch as typeof fetch

    if (!shouldQueue(url, method)) return fn(input as RequestInfo, init)

    try {
      return await fn(input as RequestInfo, init)
    } catch {
      // Network failed — queue the request for later sync
      const headers: Record<string, string> = {}
      const initHeaders = init?.headers
      if (initHeaders) {
        if (initHeaders instanceof Headers) initHeaders.forEach((v, k) => { headers[k] = v })
        else if (Array.isArray(initHeaders)) initHeaders.forEach(([k, v]) => { headers[k] = String(v) })
        else Object.entries(initHeaders as Record<string, string>).forEach(([k, v]) => { headers[k] = String(v) })
      }
      let body: string | null = null
      if (init?.body) {
        if (typeof init.body === 'string') body = init.body
        else if (init.body instanceof URLSearchParams) body = init.body.toString()
      }
      const id = `q_${Date.now()}_${Math.random().toString(36).slice(2)}`
      try {
        await dbAdd({ id, url: new URL(url, window.location.origin).toString(), method, headers, body, createdAt: Date.now() })
        notify()
      } catch {}
      return new Response(
        JSON.stringify({
          offline: true,
          queued: true,
          id,
          message: 'تم حفظ العملية محلياً وسيتم تنفيذها لما النت يرجع',
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // Replay queue when connection comes back, and on page load
  window.addEventListener('online', () => { flushQueue() })
  if (navigator.onLine) {
    setTimeout(() => flushQueue(), 1500)
  }
}
