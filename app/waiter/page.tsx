'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { LogOut, RefreshCw, Loader2, ArrowRight, Coffee, CheckCircle2, Clock, CalendarCheck, Users, Phone, X, TrendingUp, Award, Zap, BarChart3, History, Bell, Navigation } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import Image from 'next/image'

interface ReservationNotif {
  id: string
  customer_name: string
  customer_phone: string | null
  party_size: number
  reserved_at: string
  table_number: string | null
  notes: string | null
  status: 'pending' | 'confirmed' | 'cancelled'
}

interface StaffUser {
  id: string
  username: string
  name: string
  is_active: boolean
  place_id: string | null
}

interface OrderItem {
  id: string
  drinkName: string
  quantity: number
  notes?: string | null
  status: string
  totalPrice: number
  createdAt: string
}

interface TableGroup {
  tableNumber: string
  userName: string
  userId: string
  items: OrderItem[]
  earliestTime: string
  allReady: boolean
  anyPreparing: boolean
}

const statusLabel = (s: string) => {
  if (s === 'completed')  return { text: 'تم التسليم',  color: 'rgba(34,197,94,0.15)',  textColor: '#4ade80',  border: 'rgba(34,197,94,0.3)'  }
  if (s === 'on_the_way') return { text: 'في الطريق',   color: 'rgba(59,130,246,0.15)',  textColor: '#60a5fa',  border: 'rgba(59,130,246,0.3)'  }
  if (s === 'ready')      return { text: 'تم التحضير',  color: 'rgba(52,211,153,0.15)',  textColor: '#34d399',  border: 'rgba(52,211,153,0.3)'  }
  if (s === 'preparing')  return { text: 'يتحضر',        color: 'rgba(251,191,36,0.12)',  textColor: '#fbbf24',  border: 'rgba(251,191,36,0.3)'  }
  return                          { text: 'انتظار',       color: 'rgba(255,255,255,0.04)', textColor: '#71717a',  border: 'rgba(255,255,255,0.08)' }
}

const StageBar = ({ status }: { status: string }) => {
  const isReady     = status === 'ready' || status === 'completed'
  const isPreparing = status === 'preparing'
  return (
    <div className="flex items-center gap-1 w-full mt-1.5">
      <div className={`h-0.5 flex-1 rounded-full transition-all duration-700 ${isPreparing || isReady ? 'bg-amber-500' : 'bg-white/8'}`} />
      <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-700 ${isPreparing || isReady ? 'bg-amber-400' : 'bg-white/10'}`} />
      <div className={`h-0.5 flex-1 rounded-full transition-all duration-700 ${isReady ? 'bg-emerald-500' : isPreparing ? 'bg-amber-400/40 animate-pulse' : 'bg-white/8'}`} />
      <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-700 ${isReady ? 'bg-emerald-400' : 'bg-white/10'}`} />
      <div className={`h-0.5 flex-1 rounded-full transition-all duration-700 ${isReady ? 'bg-emerald-500' : 'bg-white/8'}`} />
    </div>
  )
}

const DevBar = () => (
  <div className="relative overflow-hidden py-[5px]" style={{ background: 'linear-gradient(90deg, #0d0d0d, #1a0a00, #3d1f00, #D4A017, #3d1f00, #1a0a00, #0d0d0d)' }}>
    <div className="flex items-center justify-center gap-2">
      <span className="text-[10px] tracking-widest uppercase text-amber-200/50">✦</span>
      <span className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: '#ffe8a0', textShadow: '0 0 12px rgba(212,160,23,0.8)' }}>
        Developed by Basem Samir Ebeid
      </span>
      <span className="text-[10px] tracking-widest uppercase text-amber-200/50">✦</span>
    </div>
  </div>
)

export default function WaiterPage() {
  const [mounted, setMounted] = useState(false)
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [deliveredIds, setDeliveredIds] = useState<Set<string>>(new Set())
  const [showReport, setShowReport] = useState(false)
  const [showDeliveryHistory, setShowDeliveryHistory] = useState(false)
  const [deliveryHistory, setDeliveryHistory] = useState<TableGroup[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [reservationNotifs, setReservationNotifs] = useState<ReservationNotif[]>([])
  const [dismissedReservIds, setDismissedReservIds] = useState<Set<string>>(new Set())
  const seenReservationIds = useRef<Set<string>>(new Set())
  const seenOrderIds = useRef<Set<string>>(new Set())
  const seenReadyOrderIds = useRef<Set<string>>(new Set())
  const isFirstOrdersFetch = useRef(true)
  const cachedSession = useRef<{ id: string; ts: number } | null>(null)

  interface WaiterCall { id: string; message: string; created_at: string }
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([])
  const [dismissedCallIds, setDismissedCallIds] = useState<Set<string>>(new Set())
  const [respondingCallIds, setRespondingCallIds] = useState<Set<string>>(new Set())
  const seenCallIds = useRef<Set<string>>(new Set())
  const isFirstCallsFetch = useRef(true)

  const [alarmActive, setAlarmActive] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const alarmActiveRef = useRef(false)

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/order.wav')
      audioRef.current.loop = true
    }
    return audioRef.current
  }, [])

  const triggerAlarm = useCallback(() => {
    alarmActiveRef.current = true
    setAlarmActive(true)
    try {
      const audio = getAudio()
      if (audio.paused) { audio.currentTime = 0; audio.play().catch(() => {}) }
    } catch {}
  }, [getAudio])

  const stopAlarm = useCallback(() => {
    alarmActiveRef.current = false
    setAlarmActive(false)
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
    } catch {}
  }, [])

  useEffect(() => {
    const unlock = () => {
      if (alarmActiveRef.current && audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(() => {})
      }
    }
    document.addEventListener('click', unlock)
    document.addEventListener('touchstart', unlock)
    return () => { document.removeEventListener('click', unlock); document.removeEventListener('touchstart', unlock) }
  }, [])

  const fetchWaiterCalls = useCallback(async () => {
    if (!staffUser?.place_id) return
    try {
      const res = await fetch(`/api/messages?place_id=${staffUser.place_id}&limit=20`)
      if (!res.ok) return
      const msgs = await res.json()
      if (!Array.isArray(msgs)) return
      const calls: WaiterCall[] = msgs
        .filter((m: { title: string }) => m.title === '🔔 نداء نادل')
        .map((m: { id: string; message: string; created_at: string }) => ({ id: m.id, message: m.message, created_at: m.created_at }))
      let hasNew = false
      for (const c of calls) {
        if (!seenCallIds.current.has(c.id)) {
          seenCallIds.current.add(c.id)
          if (!isFirstCallsFetch.current) hasNew = true
        }
      }
      isFirstCallsFetch.current = false
      if (hasNew) triggerAlarm()
      setWaiterCalls(calls)
    } catch {}
  }, [staffUser, triggerAlarm])

  const respondToCall = useCallback(async (call: WaiterCall) => {
    setRespondingCallIds(prev => new Set([...prev, call.id]))
    try {
      const tableMatch = call.message.match(/طاولة\s*(\S+)/)
      const tableNum = tableMatch ? tableMatch[1] : ''
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '🚶 رد النادل', message: `في الطريق إليك - طاولة ${tableNum}`, place_id: staffUser?.place_id || null })
      })
      setDismissedCallIds(prev => new Set([...prev, call.id]))
      toast.success('تم إرسال الرد للزبون ✓')
    } catch { toast.error('فشل إرسال الرد') }
    finally { setRespondingCallIds(prev => { const n = new Set(prev); n.delete(call.id); return n }) }
  }, [staffUser])

  const fetchOrders = useCallback(async () => {
    if (!staffUser) return
    setIsLoading(true)
    try {
      const placeParam = staffUser.place_id ? `&place_id=${staffUser.place_id}` : ''
      let sessionId: string | null = null
      if (cachedSession.current && Date.now() - cachedSession.current.ts < 30000) {
        sessionId = cachedSession.current.id
      } else {
        const sessRes = await fetch(`/api/sessions?readonly=true${placeParam}`)
        const sess = await sessRes.json()
        if (!sess?.id) { setTableGroups([]); return }
        sessionId = sess.id
        cachedSession.current = { id: sess.id, ts: Date.now() }
      }
      const res = await fetch(`/api/orders?session_id=${sessionId}`)
      const orders = await res.json()
      if (!Array.isArray(orders)) return
      if (!isFirstOrdersFetch.current) {
        const brandNew = orders.filter((o: { id: string; status: string }) => !seenOrderIds.current.has(o.id) && o.status !== 'cancelled')
        const newlyReady = orders.filter((o: { id: string; status: string }) => o.status === 'ready' && !seenReadyOrderIds.current.has(o.id))
        if (brandNew.length > 0) { triggerAlarm(); toast.success('طلب جديد وصل!') }
        else if (newlyReady.length > 0) { triggerAlarm(); toast.success('طلبات جاهزة للتسليم! 🛎️') }
        newlyReady.forEach((o: { id: string }) => seenReadyOrderIds.current.add(o.id))
      }
      orders.forEach((o: { id: string; status: string }) => { if (o.status !== 'cancelled') seenOrderIds.current.add(o.id) })
      isFirstOrdersFetch.current = false
      const active = orders.filter((o: { status: string }) => o.status !== 'cancelled' && o.status !== 'completed')
      const grouped: Record<string, TableGroup> = {}
      for (const o of active) {
        const uid = o.user_id || ''
        const rawTableNum = o.table_number || o.user?.table_number
        const tableNum = rawTableNum != null && rawTableNum !== '' ? String(rawTableNum) : null
        if (!tableNum) continue
        const groupKey = `table_${tableNum}`
        if (!grouped[groupKey]) {
          grouped[groupKey] = { tableNumber: tableNum, userName: `طاولة ${tableNum}`, userId: uid, items: [], earliestTime: o.created_at, allReady: false, anyPreparing: false }
        }
        grouped[groupKey].items.push({ id: o.id, drinkName: o.drink?.name || 'مشروب', quantity: o.quantity || 1, notes: o.notes, status: o.status || 'pending', totalPrice: Number(o.total_price || 0), createdAt: o.created_at })
        if (new Date(o.created_at) < new Date(grouped[groupKey].earliestTime)) grouped[groupKey].earliestTime = o.created_at
      }
      const result: TableGroup[] = Object.values(grouped)
        .map(g => ({ ...g, allReady: g.items.every(i => i.status === 'ready' || i.status === 'on_the_way'), anyPreparing: g.items.some(i => i.status === 'preparing') }))
        .sort((a, b) => { if (a.allReady !== b.allReady) return a.allReady ? -1 : 1; return new Date(a.earliestTime).getTime() - new Date(b.earliestTime).getTime() })
      setTableGroups(result)
      setLastRefresh(new Date())
    } catch { toast.error('خطأ في تحديث الطلبات') }
    finally { setIsLoading(false) }
  }, [staffUser, triggerAlarm])

  const fetchDeliveryHistory = useCallback(async () => {
    if (!staffUser) return
    setIsLoadingHistory(true)
    try {
      const placeParam = staffUser.place_id ? `&place_id=${staffUser.place_id}` : ''
      const sessRes = await fetch(`/api/sessions?readonly=true${placeParam}`)
      const sess = await sessRes.json()
      if (!sess?.id) { setDeliveryHistory([]); setIsLoadingHistory(false); return }
      const res = await fetch(`/api/orders?session_id=${sess.id}`)
      const orders = await res.json()
      if (!Array.isArray(orders)) { setIsLoadingHistory(false); return }
      const completed = orders.filter((o: { status: string }) => o.status === 'completed')
      const grouped: Record<string, TableGroup> = {}
      for (const o of completed) {
        const uid = o.user_id || ''
        const rawTableNum = o.table_number || o.user?.table_number
        const tableNum = rawTableNum != null && rawTableNum !== '' ? String(rawTableNum) : null
        if (!tableNum) continue
        const groupKey = `table_${tableNum}`
        if (!grouped[groupKey]) {
          grouped[groupKey] = { tableNumber: tableNum, userName: `طاولة ${tableNum}`, userId: uid, items: [], earliestTime: o.created_at, allReady: true, anyPreparing: false }
        }
        grouped[groupKey].items.push({ id: o.id, drinkName: o.drink?.name || 'مشروب', quantity: o.quantity || 1, notes: o.notes, status: o.status || 'completed', totalPrice: Number(o.total_price || 0), createdAt: o.created_at })
        if (new Date(o.created_at) < new Date(grouped[groupKey].earliestTime)) grouped[groupKey].earliestTime = o.created_at
      }
      setDeliveryHistory(Object.values(grouped).sort((a, b) => new Date(b.earliestTime).getTime() - new Date(a.earliestTime).getTime()))
    } catch { toast.error('خطأ في جلب سجل التسليمات') }
    finally { setIsLoadingHistory(false) }
  }, [staffUser])

  const fetchReservationNotifs = useCallback(async () => {
    if (!staffUser?.place_id) return
    try {
      const res = await fetch(`/api/reservations?place_id=${staffUser.place_id}`)
      const data = await res.json()
      if (!Array.isArray(data)) return
      const cutoff = Date.now() - 8 * 60 * 60 * 1000
      const confirmed = (data as ReservationNotif[]).filter(r => r.status === 'confirmed' && new Date(r.reserved_at).getTime() > cutoff)
      setReservationNotifs(confirmed)
      const newOnes = confirmed.filter(r => !seenReservationIds.current.has(r.id))
      if (newOnes.length > 0) {
        const isFirstLoad = seenReservationIds.current.size === 0
        newOnes.forEach(r => seenReservationIds.current.add(r.id))
        if (!isFirstLoad) {
          triggerAlarm()
          newOnes.forEach(r => toast(`✅ حجز مؤكد — ${r.customer_name}${r.table_number ? ` | طاولة ${r.table_number}` : ''}`, { duration: 8000 }))
        }
      }
    } catch {}
  }, [staffUser, triggerAlarm])

  useEffect(() => {
    const saved = localStorage.getItem('waiter_user')
    if (saved) { try { setStaffUser(JSON.parse(saved)) } catch { localStorage.removeItem('waiter_user') } }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (staffUser) triggerAlarm()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffUser?.id])

  useEffect(() => {
    if (!staffUser) return
    fetchOrders(); fetchReservationNotifs(); fetchWaiterCalls()
    const id  = setInterval(fetchOrders, 2000)
    const rid = setInterval(fetchReservationNotifs, 15000)
    const cid = setInterval(fetchWaiterCalls, 8000)
    return () => { clearInterval(id); clearInterval(rid); clearInterval(cid) }
  }, [staffUser, fetchOrders, fetchReservationNotifs, fetchWaiterCalls])

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) { toast.error('أدخل اسم المستخدم وكلمة المرور'); return }
    setIsLoggingIn(true)
    try {
      const res  = await fetch('/api/staff/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.trim(), password: password.trim() }) })
      const data = await res.json()
      if (!res.ok || !data.id) { toast.error('اسم المستخدم أو كلمة المرور غلط'); return }
      setStaffUser(data); localStorage.setItem('waiter_user', JSON.stringify(data))
      toast.success(`أهلاً ${data.name}!`); triggerAlarm()
    } catch { toast.error('حدث خطأ، حاول تاني') }
    finally { setIsLoggingIn(false) }
  }

  const handleMarkOnWay = async (group: TableGroup) => {
    try {
      await Promise.all(group.items.filter(i => i.status === 'ready').map(i => fetch(`/api/orders/${i.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'on_the_way' }) })))
      toast.success(`${group.tableNumber} في الطريق إلى الطاولة 🚶`)
      try { await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: group.userId || undefined, message: `الويتر بياخد الطلبات للطاولة ${group.tableNumber}`, type: 'on_way' }) }) } catch {}
      fetchOrders()
    } catch { toast.error('حصل خطأ، حاول تاني') }
  }

  const handleMarkDelivered = async (group: TableGroup) => {
    try {
      await Promise.all(group.items.filter(i => i.status !== 'completed').map(i => fetch(`/api/orders/${i.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) })))
      setDeliveredIds(prev => new Set([...prev, group.userId]))
      toast.success(`تم تسليم طاولة ${group.tableNumber} ✓`)
      try { await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `تم تسليم طاولة ${group.tableNumber} للكاستمر`, type: 'order_delivered' }) }) } catch {}
      fetchOrders()
    } catch { toast.error('حصل خطأ، حاول تاني') }
  }

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })

  if (!mounted) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080808' }}>
      <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
    </div>
  )

  /* ── Login ── */
  if (!staffUser) return (
    <div className="min-h-screen flex flex-col" dir="rtl" style={{ background: '#080808' }}>
      <DevBar />
      <Toaster position="top-center" richColors />
      <div className="px-4 pt-4">
        <button onClick={() => window.location.href = '/'}
          className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          <ArrowRight className="h-3.5 w-3.5" />
          الرئيسية
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[320px]">
          <div className="text-center mb-8">
            <div className="relative mx-auto mb-5 w-fit">
              <div className="h-[72px] w-[72px] rounded-2xl overflow-hidden shadow-2xl" style={{ boxShadow: '0 0 0 1px rgba(212,160,23,0.25), 0 0 30px rgba(212,160,23,0.12)' }}>
                <Image src="/images/sipflow-logo.jpg" alt="SîpFlõw" width={72} height={72} className="object-cover w-full h-full" />
              </div>
              <div className="absolute -bottom-2 -left-2 h-6 w-6 rounded-full flex items-center justify-center text-sm"
                style={{ background: 'linear-gradient(135deg, #D4A017, #92640a)', boxShadow: '0 0 12px rgba(212,160,23,0.6)' }}>
                🛎️
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-3 text-[11px] font-semibold"
              style={{ background: 'rgba(212,160,23,0.08)', border: '1px solid rgba(212,160,23,0.2)', color: '#D4A017' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              بوابة الويتر
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">SîpFlõw</h1>
            <p className="text-xs text-zinc-500 mt-1">تتبع الطلبات وتسليمها للطاولات</p>
          </div>
          <div className="rounded-3xl p-5 space-y-4" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">اسم المستخدم</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم" dir="rtl"
                className="w-full h-11 rounded-xl px-3 text-sm outline-none transition-all"
                style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">كلمة المرور</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" dir="ltr"
                className="w-full h-11 rounded-xl px-3 text-sm outline-none transition-all"
                style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <button onClick={handleLogin} disabled={isLoggingIn}
              className="w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
              style={{ background: 'linear-gradient(135deg, #D4A017, #92640a)', color: '#fff', boxShadow: '0 4px 20px rgba(212,160,23,0.3)' }}>
              {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-base">🛎️</span>}
              {isLoggingIn ? 'جاري الدخول...' : 'دخول الويتر'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  /* ── Main view ── */
  const pendingGroups   = tableGroups.filter(g => !g.allReady && !deliveredIds.has(g.userId))
  const readyGroups     = tableGroups.filter(g => g.allReady  && !deliveredIds.has(g.userId))
  const deliveredGroups = tableGroups.filter(g => deliveredIds.has(g.userId))
  const activeCallCount = waiterCalls.filter(c => !dismissedCallIds.has(c.id)).length

  return (
    <div className="min-h-screen" dir="rtl" style={{ background: '#080808' }}>
      <Toaster position="top-center" richColors />

      {/* Alarm Banner */}
      {alarmActive && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3"
          style={{ background: 'linear-gradient(90deg, #450a0a, #7f1d1d, #450a0a)', borderBottom: '2px solid #ef4444', boxShadow: '0 4px 24px rgba(239,68,68,0.4)' }}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full flex items-center justify-center animate-bounce" style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}>
              <Bell className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="font-black text-white text-sm">طلب جديد وصل!</p>
              <p className="text-red-300/70 text-[11px]">اضغط لإيقاف التنبيه</p>
            </div>
          </div>
          <button onClick={stopAlarm}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <X className="h-3.5 w-3.5" />
            إيقاف
          </button>
        </div>
      )}

      {/* Header */}
      <header className={`sticky z-40 ${alarmActive ? 'top-[52px]' : 'top-0'}`} style={{ background: '#0e0e0e', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <DevBar />
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Left: actions */}
          <div className="flex items-center gap-1.5">
            <button onClick={() => window.location.href = '/'}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <ArrowRight className="h-4 w-4 text-zinc-500" />
            </button>
            <button onClick={() => { setStaffUser(null); localStorage.removeItem('waiter_user') }}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-red-500/10"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <LogOut className="h-4 w-4 text-zinc-500" />
            </button>
            <button onClick={() => { setShowDeliveryHistory(true); fetchDeliveryHistory() }}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-emerald-500/10"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <History className="h-4 w-4 text-zinc-500" />
            </button>
            <button onClick={() => setShowReport(!showReport)}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-sky-500/10"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <BarChart3 className="h-4 w-4 text-zinc-500" />
            </button>
            <button onClick={fetchOrders} disabled={isLoading}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-amber-500/10"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <RefreshCw className={`h-4 w-4 text-zinc-500 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Right: user info */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                <p className="font-bold text-sm text-white">{staffUser.name}</p>
                {activeCallCount > 0 && (
                  <span className="flex items-center justify-center h-5 min-w-5 px-1 rounded-full text-[10px] font-black text-white animate-bounce"
                    style={{ background: '#6366f1' }}>
                    {activeCallCount}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[11px] text-amber-500 font-medium">نشط · ويتر</span>
              </div>
            </div>
            <div className="h-9 w-9 rounded-xl overflow-hidden shrink-0" style={{ border: '1px solid rgba(212,160,23,0.25)', boxShadow: '0 0 12px rgba(212,160,23,0.12)' }}>
              <Image src="/images/sipflow-logo.jpg" alt="logo" width={36} height={36} className="object-cover w-full h-full" />
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-2 px-4 pb-2.5 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 shrink-0"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <Clock className="h-3 w-3 text-amber-400" />
            <span className="text-xs font-bold text-amber-400">{pendingGroups.length}</span>
            <span className="text-[11px] text-amber-400/60">في الانتظار</span>
          </div>
          {readyGroups.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 shrink-0 animate-pulse"
              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">{readyGroups.length}</span>
              <span className="text-[11px] text-emerald-400/70">جاهزة للتسليم</span>
            </div>
          )}
          {deliveredGroups.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-xs font-bold text-zinc-500">{deliveredGroups.length}</span>
              <span className="text-[11px] text-zinc-600">تم التسليم</span>
            </div>
          )}
          {lastRefresh && (
            <span className="text-[10px] text-zinc-700 mr-auto shrink-0">آخر تحديث {formatTime(lastRefresh.toISOString())}</span>
          )}
        </div>
      </header>

      {/* Modals */}
      {showDeliveryHistory && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowDeliveryHistory(false)}>
          <div className="w-full max-w-lg rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            style={{ background: '#111', border: '1px solid rgba(52,211,153,0.2)', boxShadow: '0 0 40px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-emerald-400" />
                <h2 className="font-bold text-white text-base">سجل التسليمات</h2>
              </div>
              <button onClick={() => setShowDeliveryHistory(false)} className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/8" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <X className="h-4 w-4 text-zinc-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                <p className="text-3xl font-black text-emerald-400">{deliveryHistory.length}</p>
                <p className="text-[11px] text-zinc-600 mt-1">طاولة تم تسليمها</p>
              </div>
              <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <p className="text-3xl font-black text-amber-400">{deliveryHistory.reduce((s, g) => s + g.items.length, 0)}</p>
                <p className="text-[11px] text-zinc-600 mt-1">إجمالي الطلبات</p>
              </div>
            </div>
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-400" /></div>
            ) : deliveryHistory.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-zinc-700" />
                <p className="text-sm text-zinc-600">لا توجد تسليمات مسجلة اليوم</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {deliveryHistory.map(group => (
                  <div key={group.tableNumber + group.earliestTime} className="rounded-2xl p-4" style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>✓ تم التسليم</span>
                      <div className="flex items-center gap-2 text-right">
                        <div>
                          <p className="font-bold text-white text-sm">طاولة {group.tableNumber}</p>
                          <p className="text-[11px] text-zinc-600">{group.items.length} طلب · {formatTime(group.earliestTime)}</p>
                        </div>
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-base" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>{group.tableNumber}</div>
                      </div>
                    </div>
                    <div className="space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                      {group.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-zinc-600">{formatTime(item.createdAt)}</span>
                          <span className="text-zinc-300">{item.drinkName}{item.quantity > 1 && <span className="text-zinc-500"> × {item.quantity}</span>}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={fetchDeliveryHistory} disabled={isLoadingHistory}
              className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{ border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', background: 'rgba(52,211,153,0.05)' }}>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              تحديث السجل
            </button>
          </div>
        </div>
      )}

      {showReport && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowReport(false)}>
          <div className="w-full max-w-lg rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            style={{ background: '#111', border: '1px solid rgba(56,189,248,0.2)', boxShadow: '0 0 40px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-sky-400" />
                <h2 className="font-bold text-white text-base">تقرير الطلبات</h2>
              </div>
              <button onClick={() => setShowReport(false)} className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/8" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <X className="h-4 w-4 text-zinc-500" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: readyGroups.length,   label: 'جاهزة',      color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)'  },
                { val: pendingGroups.length, label: 'في الانتظار', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)'  },
                { val: deliveredGroups.length, label: 'تم التسليم', color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
              ].map(({ val, label, color, bg, border }) => (
                <div key={label} className="rounded-2xl p-3 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
                  <p className="text-2xl font-black" style={{ color }}>{val}</p>
                  <p className="text-[10px] mt-1" style={{ color: `${color}90` }}>{label}</p>
                </div>
              ))}
            </div>

            {[
              { groups: readyGroups, color: '#34d399', border: 'rgba(52,211,153,0.2)', bg: 'rgba(52,211,153,0.04)', label: 'جاهزة للتسليم', dot: 'bg-emerald-400 animate-pulse' },
              { groups: pendingGroups, color: '#fbbf24', border: 'rgba(251,191,36,0.2)', bg: 'rgba(251,191,36,0.04)', label: 'قيد التحضير', dot: 'bg-amber-400' },
            ].map(({ groups, color, border, bg, label, dot }) => (
              <div key={label}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  <p className="text-xs font-bold" style={{ color }}>{label}</p>
                </div>
                {groups.length === 0 ? (
                  <div className="rounded-xl py-4 text-center text-xs text-zinc-700" style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>لا توجد طلبات</div>
                ) : (
                  <div className="space-y-2">
                    {groups.map(group => (
                      <div key={group.userId} className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${border}` }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-zinc-600">{formatTime(group.earliestTime)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">طاولة {group.tableNumber}</span>
                            <div className="h-7 w-7 rounded-lg flex items-center justify-center font-black text-xs" style={{ background: `${color}20`, color }}>{group.tableNumber}</div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {group.items.map(item => {
                            const st = statusLabel(item.status)
                            return (
                              <div key={item.id} className="flex items-center justify-between text-xs">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: st.color, color: st.textColor, border: `1px solid ${st.border}` }}>{st.text}</span>
                                <span className="text-zinc-300">{item.drinkName}{item.quantity > 1 && <span className="text-zinc-500"> × {item.quantity}</span>}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-24">

        {/* Waiter Call Notifications */}
        {waiterCalls.filter(c => !dismissedCallIds.has(c.id)).map(c => (
          <div key={c.id} className="rounded-2xl p-4 relative" style={{ background: 'rgba(99,102,241,0.08)', border: '1.5px solid rgba(99,102,241,0.35)', boxShadow: '0 0 20px rgba(99,102,241,0.12)' }}>
            <button onClick={() => setDismissedCallIds(prev => new Set([...prev, c.id]))}
              className="absolute top-3 left-3 h-6 w-6 rounded-lg flex items-center justify-center transition-all"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <X className="h-3.5 w-3.5 text-zinc-500" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.2)' }}>
                <Bell className="h-3.5 w-3.5 text-indigo-400 animate-bounce" />
              </div>
              <div>
                <p className="font-bold text-indigo-300 text-sm">نداء نادل</p>
                <p className="text-[10px] text-zinc-600">{new Date(c.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-indigo-100 mb-3 pr-1">{c.message}</p>
            <button onClick={() => respondToCall(c)} disabled={respondingCallIds.has(c.id)}
              className="w-full h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: respondingCallIds.has(c.id) ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc' }}>
              {respondingCallIds.has(c.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
              {respondingCallIds.has(c.id) ? 'جاري الإرسال...' : 'في الطريق إليك'}
            </button>
          </div>
        ))}

        {/* Reservation Notifications */}
        {reservationNotifs.filter(r => !dismissedReservIds.has(r.id)).map(r => {
          const dt = new Date(r.reserved_at)
          const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
          const dateStr = dt.toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })
          return (
            <div key={r.id} className="rounded-2xl p-4 relative" style={{ background: 'rgba(212,160,23,0.06)', border: '1.5px solid rgba(212,160,23,0.3)', boxShadow: '0 0 18px rgba(212,160,23,0.08)' }}>
              <button onClick={() => setDismissedReservIds(prev => new Set([...prev, r.id]))}
                className="absolute top-3 left-3 h-6 w-6 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <X className="h-3.5 w-3.5 text-zinc-500" />
              </button>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,160,23,0.15)' }}>
                  <CalendarCheck className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <p className="font-bold text-amber-300 text-sm">حجز مؤكد — تجهيز الطاولة</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="rounded-xl p-2.5 text-right" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] text-zinc-600 mb-0.5">الاسم</p>
                  <p className="text-sm font-bold text-amber-200">{r.customer_name}</p>
                </div>
                <div className="rounded-xl p-2.5 text-right" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] text-zinc-600 mb-0.5">الطاولة</p>
                  <p className="text-sm font-bold text-amber-300">{r.table_number ? `🪑 ${r.table_number}` : '—'}</p>
                </div>
                <div className="rounded-xl p-2.5 text-right" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] text-zinc-600 mb-0.5">عدد الأشخاص</p>
                  <div className="flex items-center justify-end gap-1"><Users className="h-3 w-3 text-amber-400" /><p className="text-sm font-bold text-amber-200">{r.party_size}</p></div>
                </div>
                <div className="rounded-xl p-2.5 text-right" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] text-zinc-600 mb-0.5">الموعد</p>
                  <p className="text-xs font-semibold text-amber-200">{dateStr} · {timeStr}</p>
                </div>
              </div>
              {r.customer_phone && (
                <a href={`tel:${r.customer_phone}`} className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.2)', color: '#D4A017' }}>
                  <Phone className="h-3.5 w-3.5" />
                  {r.customer_phone}
                </a>
              )}
              {r.notes && <p className="text-xs text-amber-200/50 mt-2 pr-1">📝 {r.notes}</p>}
            </div>
          )
        })}

        {/* Daily Performance */}
        {deliveredGroups.length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">ملخص أدائك اليوم</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: deliveredGroups.length, label: 'طاولة تم تسليمها', color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.15)' },
                { val: deliveredGroups.reduce((s, g) => s + g.items.length, 0), label: 'طلب تم تسليمه', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.15)' },
                { val: pendingGroups.length + readyGroups.length, label: 'في الانتظار', color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },
              ].map(({ val, label, color, bg, border }) => (
                <div key={label} className="rounded-xl p-3 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
                  <p className="text-2xl font-black" style={{ color }}>{val}</p>
                  <p className="text-[10px] mt-1 text-zinc-600">{label}</p>
                </div>
              ))}
            </div>
            {deliveredGroups.length >= 5 && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl p-2" style={{ background: 'rgba(212,160,23,0.08)', border: '1px solid rgba(212,160,23,0.2)' }}>
                <Award className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-bold text-amber-400">ممتاز! أداء رائع اليوم 🏆</span>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {tableGroups.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(212,160,23,0.06)', border: '1px solid rgba(212,160,23,0.12)' }}>
              <Coffee className="h-8 w-8 text-amber-900" />
            </div>
            <div className="text-center">
              <p className="font-bold text-white text-base mb-1">لا توجد طلبات حالياً</p>
              <p className="text-xs text-zinc-600">الطلبات الجديدة ستظهر هنا تلقائياً</p>
            </div>
          </div>
        )}

        {/* Ready tables */}
        {readyGroups.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">جاهزة للتسليم</p>
            </div>
            {readyGroups.map(group => (
              <TableCard key={group.userId} group={group} onDeliver={() => handleMarkDelivered(group)} onWay={() => handleMarkOnWay(group)} formatTime={formatTime} highlight="green" />
            ))}
          </div>
        )}

        {/* Pending tables */}
        {pendingGroups.length > 0 && (
          <div className="space-y-2.5">
            {readyGroups.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <p className="text-xs font-bold text-amber-500/70 uppercase tracking-wider">قيد التحضير</p>
              </div>
            )}
            {pendingGroups.map(group => (
              <TableCard key={group.userId} group={group} onDeliver={() => handleMarkDelivered(group)} onWay={() => handleMarkOnWay(group)} formatTime={formatTime} highlight={group.anyPreparing ? 'amber' : 'none'} />
            ))}
          </div>
        )}

        {/* Delivered today */}
        {deliveredGroups.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer flex items-center gap-2 px-1 py-2 list-none select-none">
              <CheckCircle2 className="h-3.5 w-3.5 text-zinc-700" />
              <span className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors">تم تسليمها اليوم ({deliveredGroups.length})</span>
            </summary>
            <div className="space-y-2 mt-2">
              {deliveredGroups.map(group => (
                <div key={group.userId} className="rounded-xl p-3 flex items-center justify-between opacity-40"
                  style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-xs text-emerald-600 font-semibold">✓ تم التسليم</span>
                  <span className="text-sm font-bold text-zinc-400">طاولة {group.tableNumber}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

function TableCard({ group, onDeliver, onWay, formatTime, highlight }: {
  group: TableGroup
  onDeliver: () => void
  onWay: () => void
  formatTime: (d: string) => string
  highlight: 'green' | 'amber' | 'none'
}) {
  const [isDelivering, setIsDelivering] = useState(false)
  const [isOnWay, setIsOnWay] = useState(false)

  const colors = {
    green: { border: 'rgba(52,211,153,0.35)', glow: '0 0 24px rgba(52,211,153,0.1)', bg: 'rgba(52,211,153,0.05)', badge: 'rgba(52,211,153,0.15)', badgeText: '#34d399', num: '#34d399' },
    amber: { border: 'rgba(212,160,23,0.3)',   glow: '0 0 20px rgba(212,160,23,0.08)',  bg: 'rgba(212,160,23,0.04)',  badge: 'rgba(212,160,23,0.15)',  badgeText: '#D4A017',  num: '#D4A017' },
    none:  { border: 'rgba(255,255,255,0.07)', glow: '',                                bg: 'transparent',             badge: 'rgba(255,255,255,0.07)', badgeText: '#71717a',  num: '#71717a' },
  }
  const c = colors[highlight]

  const totalItems = group.items.reduce((s, i) => s + i.quantity, 0)

  const handleClick = async () => { setIsDelivering(true); await onDeliver(); setIsDelivering(false) }
  const handleOnWay = async () => { setIsOnWay(true); await onWay(); setIsOnWay(false) }

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ border: `1px solid ${c.border}`, boxShadow: c.glow || '0 2px 12px rgba(0,0,0,0.3)', background: '#131313' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: c.bg, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Clock className="h-3 w-3 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-500">{formatTime(group.earliestTime)}</span>
          </div>
          <div className="flex items-center gap-1 rounded-full px-2 py-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Coffee className="h-3 w-3 text-zinc-600" />
            <span className="text-xs text-zinc-600 font-medium">{totalItems}</span>
          </div>
          {highlight === 'green' && (
            <span className="text-[11px] font-bold rounded-full px-2 py-0.5 animate-pulse"
              style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
              جاهز
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm text-white">طاولة {group.tableNumber}</p>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-base" style={{ background: c.badge, color: c.num }}>
            {group.tableNumber}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-3">
        {group.items.map(item => {
          const st = statusLabel(item.status)
          return (
            <div key={item.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: st.color, color: st.textColor, border: `1px solid ${st.border}` }}>{st.text}</span>
                <div className="flex items-center gap-1.5 text-right">
                  {item.quantity > 1 && (
                    <span className="text-[11px] font-black rounded-full px-2 py-0.5"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
                      × {item.quantity}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-white">{item.drinkName}</span>
                </div>
              </div>
              <StageBar status={item.status} />
              {item.notes && (
                <p className="text-[11px] text-amber-400/60 mt-1 text-right">ملاحظة: {item.notes}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 space-y-2">
        {group.allReady && !group.items.every(i => i.status === 'completed') && (
          <button onClick={handleOnWay} disabled={isOnWay}
            className="w-full h-10 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
            {isOnWay ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            في الطريق للطاولة
          </button>
        )}
        {!group.items.every(i => i.status === 'completed') && (
          <button onClick={handleClick} disabled={isDelivering}
            className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
            style={group.allReady
              ? { background: 'linear-gradient(135deg, #34d399, #059669)', color: '#fff', boxShadow: '0 2px 16px rgba(52,211,153,0.3)' }
              : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#71717a' }}>
            {isDelivering ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {group.allReady ? 'تم تسليم الأوردر ✓' : 'سلّم الطلب'}
          </button>
        )}
        {group.items.every(i => i.status === 'completed') && (
          <div className="w-full h-9 rounded-xl flex items-center justify-center gap-2"
            style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-600">تم تسليم هذا الطلب</span>
          </div>
        )}
      </div>
    </div>
  )
}
