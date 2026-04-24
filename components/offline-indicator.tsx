'use client'

import { useEffect, useState } from 'react'
import { installOfflineQueue, onQueueChange, flushQueue, getPendingCount } from '@/lib/offline-queue'
import { Wifi, WifiOff, RefreshCw, Cloud, CheckCircle2 } from 'lucide-react'

export function OfflineIndicator() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [show, setShow] = useState(false)
  const [justSynced, setJustSynced] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Install offline queue + listeners
  useEffect(() => {
    installOfflineQueue()
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
    getPendingCount().then(setPending).catch(() => {})

    const onOn = () => setOnline(true)
    const onOff = () => setOnline(false)
    window.addEventListener('online', onOn)
    window.addEventListener('offline', onOff)
    const unsub = onQueueChange((c) => setPending(c))

    return () => {
      window.removeEventListener('online', onOn)
      window.removeEventListener('offline', onOff)
      unsub()
    }
  }, [])

  // Visibility logic
  useEffect(() => {
    if (!online || pending > 0) {
      setShow(true)
      setJustSynced(false)
    } else if (show) {
      // We were showing, now both online and queue empty → flash success then hide
      setJustSynced(true)
      const t = setTimeout(() => { setShow(false); setJustSynced(false) }, 2500)
      return () => clearTimeout(t)
    }
  }, [online, pending, show])

  // Detect "syncing" — pending > 0 while online
  useEffect(() => {
    setSyncing(online && pending > 0)
  }, [online, pending])

  if (!show) return null

  let bg = 'linear-gradient(90deg, #b91c1c, #ef4444)'
  let label = 'أنت أوفلاين — التطبيق شغال، التغييرات هتتزامن لما النت يرجع'
  let Icon = WifiOff
  if (online && pending > 0) {
    bg = 'linear-gradient(90deg, #b45309, #f59e0b)'
    label = `بيتم مزامنة ${pending} عملية محفوظة محلياً...`
    Icon = Cloud
  } else if (justSynced) {
    bg = 'linear-gradient(90deg, #047857, #10b981)'
    label = 'تم المزامنة — كل البيانات محفوظة'
    Icon = CheckCircle2
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[10000] flex items-center justify-between gap-3 px-4 py-2 text-white text-[12.5px] font-bold"
      style={{
        background: bg,
        boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
      }}
      dir="rtl"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`h-4 w-4 flex-shrink-0 ${syncing ? 'animate-pulse' : ''}`} />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {pending > 0 && (
          <span
            className="text-[10px] font-black tabular-nums px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.22)' }}
          >
            {pending} في الانتظار
          </span>
        )}
        {online && pending > 0 && (
          <button
            onClick={() => flushQueue()}
            className="rounded-full px-2.5 py-0.5 text-[10.5px] font-black flex items-center gap-1 transition-all active:scale-95"
            style={{ background: '#fff', color: '#b45309' }}
            aria-label="إعادة المحاولة"
          >
            <RefreshCw className="h-3 w-3" /> الآن
          </button>
        )}
        {online && pending === 0 && (
          <Wifi className="h-3.5 w-3.5 opacity-70" />
        )}
      </div>
    </div>
  )
}
