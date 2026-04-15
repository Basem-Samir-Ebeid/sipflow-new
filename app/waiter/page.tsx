'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { LogOut, RefreshCw, Loader2, ArrowRight, Coffee, CheckCircle2, Clock, AlertCircle, CalendarCheck, Users, Phone, X, TrendingUp, Award, Zap, BarChart3, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  if (s === 'completed') return { text: 'تم التسليم', color: 'bg-green-500/15 text-green-400 border-green-500/30' }
  if (s === 'on_the_way') return { text: 'في الطريق', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' }
  if (s === 'ready') return { text: 'تم التحضير', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' }
  if (s === 'preparing') return { text: 'يتحضر', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
  return { text: 'انتظار', color: 'bg-zinc-800 text-zinc-500 border-zinc-700' }
}

const StageBar = ({ status }: { status: string }) => {
  const isReady     = status === 'ready' || status === 'completed'
  const isPreparing = status === 'preparing'
  return (
    <div className="flex items-center gap-1 w-full mt-1">
      <div className={`h-1 flex-1 rounded-full transition-all duration-700 ${isPreparing || isReady ? 'bg-amber-500' : 'bg-zinc-800'}`} />
      <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-700 ${isPreparing || isReady ? 'bg-amber-400' : 'bg-zinc-700'}`} />
      <div className={`h-1 flex-1 rounded-full transition-all duration-700 ${isReady ? 'bg-green-500' : isPreparing ? 'bg-amber-400/50 animate-pulse' : 'bg-zinc-800'}`} />
      <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-700 ${isReady ? 'bg-green-400' : 'bg-zinc-700'}`} />
      <div className={`h-1 flex-1 rounded-full transition-all duration-700 ${isReady ? 'bg-green-500' : 'bg-zinc-800'}`} />
    </div>
  )
}

const DevBar = () => (
  <div className="relative overflow-hidden py-[5px]" style={{ background: 'linear-gradient(90deg, #1a0a00, #3d1f00, #6b3a00, #D4A017, #6b3a00, #3d1f00, #1a0a00)' }}>
    <div className="flex items-center justify-center gap-2">
      <span className="text-[10px] tracking-widest uppercase text-amber-200/60 font-medium">✦</span>
      <span className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: '#ffe8a0', textShadow: '0 0 12px rgba(212,160,23,0.8)' }}>
        Developed by Basem Samir Ebeid
      </span>
      <span className="text-[10px] tracking-widest uppercase text-amber-200/60 font-medium">✦</span>
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
  const [onWayIds, setOnWayIds] = useState<Set<string>>(new Set())
  const [showReport, setShowReport] = useState(false)
  const [showDeliveryHistory, setShowDeliveryHistory] = useState(false)
  const [deliveryHistory, setDeliveryHistory] = useState<TableGroup[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const [reservationNotifs, setReservationNotifs] = useState<ReservationNotif[]>([])
  const [dismissedReservIds, setDismissedReservIds] = useState<Set<string>>(new Set())
  const seenReservationIds = useRef<Set<string>>(new Set())
  const previousGroupCount = useRef<number>(-1)

  // Waiter call notifications state
  interface WaiterCall { id: string; message: string; created_at: string }
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([])
  const [dismissedCallIds, setDismissedCallIds] = useState<Set<string>>(new Set())
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
      if (audio.paused) {
        audio.currentTime = 0
        audio.play().catch(() => {})
      }
    } catch {}
  }, [getAudio])

  const stopAlarm = useCallback(() => {
    alarmActiveRef.current = false
    setAlarmActive(false)
    try {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
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
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
  }, [])

  const fetchWaiterCalls = useCallback(async () => {
    if (!staffUser?.place_id) return
    try {
      const res = await fetch(`/api/messages?place_id=${staffUser.place_id}&limit=20`)
      if (!res.ok) return
      const msgs = await res.json()
      if (!Array.isArray(msgs)) return
      const calls: WaiterCall[] = msgs
        .filter((m: { title: string; id: string; message: string; created_at: string }) => m.title === '🔔 نداء نادل')
        .map((m: { title: string; id: string; message: string; created_at: string }) => ({ id: m.id, message: m.message, created_at: m.created_at }))
      // detect new calls and play sound (skip sound on first fetch to avoid noise on login)
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
  }, [staffUser])

  const fetchOrders = useCallback(async () => {
    if (!staffUser) return
    setIsLoading(true)
    try {
      const placeParam = staffUser.place_id ? `&place_id=${staffUser.place_id}` : ''
      const sessRes = await fetch(`/api/sessions?readonly=true${placeParam}`)
      const sess = await sessRes.json()
      if (!sess?.id) { setTableGroups([]); return }

      const res = await fetch(`/api/orders?session_id=${sess.id}`)
      const orders = await res.json()
      if (!Array.isArray(orders)) return

      // Only show active orders (not cancelled, not already delivered)
      const active = orders.filter((o: { status: string }) => o.status !== 'cancelled' && o.status !== 'completed')

      // Group by table/user
      const grouped: Record<string, TableGroup> = {}
      for (const o of active) {
        const uid  = o.user_id || 'unknown'
        const rawTableNum = o.user?.table_number
        const tableNum = rawTableNum != null && rawTableNum !== '' ? String(rawTableNum) : null
        if (!tableNum) continue // skip orders with no table

        // Group by table_number (not user_id) so shared-user tables stay separate
        const groupKey = `table_${tableNum}`
        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            tableNumber: tableNum,
            userName: `طاولة ${tableNum}`,
            userId: uid,
            items: [],
            earliestTime: o.created_at,
            allReady: false,
            anyPreparing: false,
          }
        }
        grouped[groupKey].items.push({
          id: o.id,
          drinkName: o.drink?.name || 'مشروب',
          quantity: o.quantity || 1,
          notes: o.notes,
          status: o.status || 'pending',
          totalPrice: Number(o.total_price || 0),
          createdAt: o.created_at,
        })
        if (new Date(o.created_at) < new Date(grouped[groupKey].earliestTime)) {
          grouped[groupKey].earliestTime = o.created_at
        }
      }

      const result: TableGroup[] = Object.values(grouped)
        .map(g => ({
          ...g,
          allReady:     g.items.every(i => i.status === 'ready' || i.status === 'on_the_way'),
          anyPreparing: g.items.some(i => i.status === 'preparing'),
        }))
        .sort((a, b) => {
          if (a.allReady !== b.allReady) return a.allReady ? 1 : -1
          return new Date(a.earliestTime).getTime() - new Date(b.earliestTime).getTime()
        })

      const pendingNew = result.filter(g => !g.allReady && !deliveredIds.has(g.userId))
      if (previousGroupCount.current === -1) {
        previousGroupCount.current = pendingNew.length
      } else if (pendingNew.length > previousGroupCount.current) {
        triggerAlarm()
        toast.success('طلب جديد وصل!')
        previousGroupCount.current = pendingNew.length
      } else {
        previousGroupCount.current = pendingNew.length
      }

      setTableGroups(result)
      setLastRefresh(new Date())
    } catch { toast.error('خطأ في تحديث الطلبات') }
    finally { setIsLoading(false) }
  }, [staffUser, deliveredIds])

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

      // Only show completed/delivered orders
      const completed = orders.filter((o: { status: string }) => o.status === 'completed')

      // Group by table
      const grouped: Record<string, TableGroup> = {}
      for (const o of completed) {
        const uid = o.user_id || 'unknown'
        const rawTableNum = o.user?.table_number
        const tableNum = rawTableNum != null && rawTableNum !== '' ? String(rawTableNum) : null
        if (!tableNum) continue

        const groupKey = `table_${tableNum}`
        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            tableNumber: tableNum,
            userName: `طاولة ${tableNum}`,
            userId: uid,
            items: [],
            earliestTime: o.created_at,
            allReady: true,
            anyPreparing: false,
          }
        }
        grouped[groupKey].items.push({
          id: o.id,
          drinkName: o.drink?.name || 'مشروب',
          quantity: o.quantity || 1,
          notes: o.notes,
          status: o.status || 'completed',
          totalPrice: Number(o.total_price || 0),
          createdAt: o.created_at,
        })
        if (new Date(o.created_at) < new Date(grouped[groupKey].earliestTime)) {
          grouped[groupKey].earliestTime = o.created_at
        }
      }

      const result: TableGroup[] = Object.values(grouped)
        .sort((a, b) => new Date(b.earliestTime).getTime() - new Date(a.earliestTime).getTime())

      setDeliveryHistory(result)
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
      const confirmed = (data as ReservationNotif[]).filter(r =>
        r.status === 'confirmed' && new Date(r.reserved_at).getTime() > cutoff
      )
      setReservationNotifs(confirmed)
      const newOnes = confirmed.filter(r => !seenReservationIds.current.has(r.id))
      if (newOnes.length > 0) {
        const isFirstLoad = seenReservationIds.current.size === 0
        newOnes.forEach(r => seenReservationIds.current.add(r.id))
        if (!isFirstLoad) {
          triggerAlarm()
          newOnes.forEach(r => {
            toast(`✅ حجز مؤكد — ${r.customer_name}${r.table_number ? ` | طاولة ${r.table_number}` : ''}`, { duration: 8000 })
          })
        }
      }
    } catch { }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffUser])

  useEffect(() => {
    const saved = localStorage.getItem('waiter_user')
    if (saved) { try { setStaffUser(JSON.parse(saved)) } catch { localStorage.removeItem('waiter_user') } }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (staffUser) {
      triggerAlarm()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffUser?.id])

  useEffect(() => {
    if (!staffUser) return
    fetchOrders()
    fetchReservationNotifs()
    fetchWaiterCalls()
    const id = setInterval(fetchOrders, 4000)
    const rid = setInterval(fetchReservationNotifs, 15000)
    const cid = setInterval(fetchWaiterCalls, 10000)
    return () => { clearInterval(id); clearInterval(rid); clearInterval(cid) }
  }, [staffUser, fetchOrders, fetchReservationNotifs, fetchWaiterCalls])

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) { toast.error('أدخل اسم المستخدم وكلمة المرور'); return }
    setIsLoggingIn(true)
    try {
      const res  = await fetch('/api/staff/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.trim(), password: password.trim() }) })
      const data = await res.json()
      if (!res.ok || !data.id) { toast.error('اسم المستخدم أو كلمة المرور غلط'); return }
      setStaffUser(data)
      localStorage.setItem('waiter_user', JSON.stringify(data))
      toast.success(`أهلاً ${data.name}!`)
      triggerAlarm()
    } catch { toast.error('حدث خطأ، حاول تاني') }
    finally { setIsLoggingIn(false) }
  }

  const handleMarkOnWay = async (group: TableGroup) => {
    try {
      await Promise.all(
        group.items
          .filter(i => i.status === 'ready')
          .map(i => fetch(`/api/orders/${i.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'on_the_way' }),
          }))
      )
      setOnWayIds(prev => new Set([...prev, group.userId]))
      toast.success(`${group.tableNumber} في الطريق إلى الطاولة 🚶`)
      try {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: group.userId,
            message: `الويتر بياخد الطلبات للطاولة ${group.tableNumber}`,
            type: 'on_way'
          })
        })
      } catch { }
      fetchOrders()
    } catch { toast.error('حصل خطأ، حاول تاني') }
  }

  const handleMarkDelivered = async (group: TableGroup) => {
    try {
      await Promise.all(
        group.items
          .filter(i => i.status !== 'completed')
          .map(i => fetch(`/api/orders/${i.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' }),
          }))
      )
      setDeliveredIds(prev => new Set([...prev, group.userId]))
      toast.success(`تم تسليم طاولة ${group.tableNumber} ✓`)
      
      // Send notifications to cashier and admin
      try {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `تم تسليم طاولة ${group.tableNumber} للكاستمر`,
            type: 'order_delivered'
          })
        })
      } catch { }
      
      fetchOrders()
    } catch { toast.error('حصل خطأ، حاول تاني') }
  }

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })

  if (!mounted) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
    </div>
  )

  /* ─── Login screen ─── */
  if (!staffUser) return (
    <div className="min-h-screen flex flex-col" dir="rtl" style={{ background: '#0a0a0a' }}>
      <DevBar />
      <Toaster position="top-center" richColors />
      <div className="px-4 pt-4">
        <button onClick={() => window.location.href = '/'}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowRight className="h-3.5 w-3.5" />
          الرئيسية
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-5">
        <div className="w-full max-w-xs">
          {/* Header */}
          <div className="text-center mb-7">
            <div className="relative mx-auto mb-5 h-20 w-20">
              <div className="h-20 w-20 rounded-2xl overflow-hidden border shadow-lg"
                style={{ borderColor: 'rgba(212,160,23,0.35)', boxShadow: '0 4px 20px rgba(212,160,23,0.2)' }}>
                <Image src="/images/sipflow-logo.jpg" alt="SîpFlõw" width={80} height={80} className="object-cover w-full h-full" />
              </div>
              <div className="absolute -bottom-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full text-base"
                style={{ background: 'linear-gradient(135deg, #D4A017, #b8860b)', boxShadow: '0 0 12px rgba(212,160,23,0.6)' }}>
                🛎️
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2 text-xs font-semibold"
              style={{ background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.3)', color: '#D4A017' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              بوابة الويتر
            </div>
            <h1 className="text-xl font-bold text-white">SîpFlõw · ويتر</h1>
            <p className="text-xs text-zinc-500 mt-1">تتبع الطلبات وتسليمها للطاولات</p>
          </div>
          {/* Card */}
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: '#141414', border: '1px solid rgba(212,160,23,0.2)' }}>
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">اسم المستخدم</label>
              <Input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="username" dir="ltr"
                className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                style={{ '--ring': 'rgba(212,160,23,0.4)' } as React.CSSProperties}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">كلمة المرور</label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" dir="ltr"
                className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <button onClick={handleLogin} disabled={isLoggingIn}
              className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
              style={{ background: isLoggingIn ? 'rgba(212,160,23,0.3)' : 'linear-gradient(135deg, #D4A017, #b8860b)', color: '#1a0800', boxShadow: '0 2px 16px rgba(212,160,23,0.35)' }}>
              {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-base">🛎️</span>}
              {isLoggingIn ? 'جاري الدخول...' : 'دخول ويتر'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  /* ─── Main waiter view ─── */
  const pendingGroups   = tableGroups.filter(g => !g.allReady && !deliveredIds.has(g.userId))
  const readyGroups     = tableGroups.filter(g => g.allReady  && !deliveredIds.has(g.userId))
  const deliveredGroups = tableGroups.filter(g => deliveredIds.has(g.userId))

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Toaster position="top-center" richColors />

      {/* Persistent Alarm Banner */}
      {alarmActive && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3"
          style={{ background: 'linear-gradient(90deg, #7f1d1d, #b91c1c, #7f1d1d)', borderBottom: '3px solid #ef4444', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-bounce">🔔</span>
            <div>
              <p className="font-black text-white text-sm">طلب جديد وصل!</p>
              <p className="text-red-200 text-xs">اضغط لإيقاف التنبيه</p>
            </div>
          </div>
          <button onClick={stopAlarm}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }}>
            <X className="h-4 w-4" />
            إيقاف التنبيه
          </button>
        </div>
      )}

      <DevBar />

      {/* Header */}
      <div className={`sticky z-30 border-b border-border bg-background/95 backdrop-blur-sm ${alarmActive ? 'top-14' : 'top-0'}`}>
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <div>
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4 text-amber-500" />
              <span className="font-bold text-foreground text-sm">بوابة الويتر</span>
              {waiterCalls.filter(c => !dismissedCallIds.has(c.id)).length > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-indigo-500 text-white text-[10px] font-bold h-4 min-w-4 px-1 animate-bounce">
                  {waiterCalls.filter(c => !dismissedCallIds.has(c.id)).length}🔔
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{staffUser.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-[10px] text-zinc-600">
                آخر تحديث {formatTime(lastRefresh.toISOString())}
              </span>
            )}
<button onClick={() => { setShowDeliveryHistory(true); fetchDeliveryHistory() }} 
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-green-400 hover:border-green-400/40 transition-colors"
                              title="سجل التسليمات">
                              <History className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setShowReport(!showReport)} 
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-blue-400 hover:border-blue-400/40 transition-colors"
                              title="عرض التقرير">
                              <BarChart3 className="h-3.5 w-3.5" />
                            </button>
            <button onClick={fetchOrders} disabled={isLoading}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-amber-500 hover:border-amber-500/40 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => { setStaffUser(null); localStorage.removeItem('waiter_user') }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-20">

        {/* Delivery History Modal */}
        {showDeliveryHistory && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowDeliveryHistory(false)}>
            <div className="w-full max-w-lg bg-background rounded-2xl border border-green-500/30 p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-green-400" />
                  <h2 className="font-bold text-foreground text-lg">سجل التسليمات</h2>
                </div>
                <button onClick={() => setShowDeliveryHistory(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                  <CheckCircle2 className="h-4 w-4 text-green-400 mx-auto mb-1" />
                  <p className="text-2xl font-black text-green-400">{deliveryHistory.length}</p>
                  <p className="text-[10px] text-green-400/70">طاولة تم تسليمها</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <Coffee className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-2xl font-black text-amber-400">
                    {deliveryHistory.reduce((sum, g) => sum + g.items.length, 0)}
                  </p>
                  <p className="text-[10px] text-amber-400/70">إجمالي الطلبات</p>
                </div>
              </div>

              {/* Loading state */}
              {isLoadingHistory && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-green-400" />
                </div>
              )}

              {/* Empty state */}
              {!isLoadingHistory && deliveryHistory.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">لا توجد تسليمات مسجلة اليوم</p>
                </div>
              )}

              {/* Delivery history list */}
              {!isLoadingHistory && deliveryHistory.length > 0 && (
                <div className="space-y-3">
                  {deliveryHistory.map(group => {
                    const totalPrice = group.items.reduce((sum, item) => sum + item.totalPrice, 0)
                    return (
                      <div key={group.tableNumber + group.earliestTime} className="border border-green-500/20 rounded-xl p-4 bg-green-500/5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/20 text-green-400 font-black text-lg">
                              {group.tableNumber}
                            </div>
                            <div>
                              <p className="font-bold text-foreground">طاولة {group.tableNumber}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {group.items.length} {group.items.length === 1 ? 'طلب' : 'طلبات'} · {formatTime(group.earliestTime)}
                              </p>
                            </div>
                          </div>
                          <div className="text-left">
                            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 font-medium">✓ تم التسليم</span>
                          </div>
                        </div>
                        
                        {/* Order items */}
                        <div className="space-y-2 border-t border-border/50 pt-3">
                          {group.items.map(item => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <Coffee className="h-3.5 w-3.5 text-amber-500/60" />
                                <span className="text-foreground">
                                  {item.drinkName}
                                  {item.quantity > 1 && <span className="text-muted-foreground text-xs mr-1">× {item.quantity}</span>}
                                </span>
                              </div>
                              <span className="text-muted-foreground text-xs">{formatTime(item.createdAt)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Total */}
                        {totalPrice > 0 && (
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                            <span className="text-xs text-muted-foreground">الإجمالي</span>
                            <span className="font-bold text-green-400">{totalPrice.toFixed(2)} ج.م</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Refresh button */}
              <button 
                onClick={fetchDeliveryHistory}
                disabled={isLoadingHistory}
                className="w-full py-2.5 rounded-xl border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/10 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                تحديث السجل
              </button>
            </div>
          </div>
        )}

        {/* Report Modal */}
        {showReport && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowReport(false)}>
            <div className="w-full max-w-lg bg-background rounded-2xl border border-border p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-400" />
                  <h2 className="font-bold text-foreground text-lg">تقرير الطلبات</h2>
                </div>
                <button onClick={() => setShowReport(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Report summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                  <CheckCircle2 className="h-4 w-4 text-green-400 mx-auto mb-1" />
                  <p className="text-xl font-black text-green-400">{readyGroups.length}</p>
                  <p className="text-[10px] text-green-400/70">طاولة جاهزة</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <Clock className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-xl font-black text-amber-400">{pendingGroups.length}</p>
                  <p className="text-[10px] text-amber-400/70">طاولة في الانتظار</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                  <Coffee className="h-4 w-4 text-blue-400 mx-auto mb-1" />
                  <p className="text-xl font-black text-blue-400">{deliveredGroups.length}</p>
                  <p className="text-[10px] text-blue-400/70">تم تسليمها</p>
                </div>
              </div>

              {/* Ready orders - الطلبات الواصلة من البار */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <h3 className="font-bold text-green-400 text-sm">الطلبات الواصلة (جاهزة للتسليم)</h3>
                </div>
                {readyGroups.length > 0 ? (
                  <div className="space-y-2">
                    {readyGroups.map(group => (
                      <div key={group.userId} className="border border-green-500/30 rounded-xl p-3 bg-green-500/5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20 text-green-400 font-bold text-sm">
                              {group.tableNumber}
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-sm">طاولة {group.tableNumber}</p>
                              <p className="text-[10px] text-muted-foreground">{group.items.length} طلب · {formatTime(group.earliestTime)}</p>
                            </div>
                          </div>
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                        </div>
                        <div className="space-y-1 pr-2">
                          {group.items.map(item => (
                            <div key={item.id} className="flex items-center justify-between text-xs">
                              <span className="text-foreground">
                                {item.drinkName} {item.quantity > 1 && `× ${item.quantity}`}
                              </span>
                              <span className="text-green-400 font-medium">جاهز</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border border-dashed border-border rounded-xl">
                    <p className="text-xs">لا توجد طلبات جاهزة حالياً</p>
                  </div>
                )}
              </div>

              {/* Pending orders - الطلبات قيد التحضي�� */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <h3 className="font-bold text-amber-400 text-sm">الطلبات قيد التحضير</h3>
                </div>
                {pendingGroups.length > 0 ? (
                  <div className="space-y-2">
                    {pendingGroups.map(group => (
                      <div key={group.userId} className="border border-amber-500/30 rounded-xl p-3 bg-amber-500/5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-bold text-sm">
                              {group.tableNumber}
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-sm">طاولة {group.tableNumber}</p>
                              <p className="text-[10px] text-muted-foreground">{group.items.length} طلب · {formatTime(group.earliestTime)}</p>
                            </div>
                          </div>
                          <Clock className="h-5 w-5 text-amber-400" />
                        </div>
                        <div className="space-y-1 pr-2">
                          {group.items.map(item => {
                            const { text, color } = statusLabel(item.status)
                            return (
                              <div key={item.id} className="flex items-center justify-between text-xs">
                                <span className="text-foreground">
                                  {item.drinkName} {item.quantity > 1 && `× ${item.quantity}`}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>{text}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border border-dashed border-border rounded-xl">
                    <p className="text-xs">لا توجد طلبات قيد التحضير</p>
                  </div>
                )}
              </div>

              {/* Delivered orders - الطلبات المسلمة */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <h3 className="font-bold text-blue-400 text-sm">الطلبات المسلمة</h3>
                </div>
                {deliveredGroups.length > 0 ? (
                  <div className="space-y-2">
                    {deliveredGroups.map(group => (
                      <div key={group.userId} className="border border-border rounded-xl p-3 bg-card/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground font-bold text-sm">
                              {group.tableNumber}
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-sm">طاولة {group.tableNumber}</p>
                              <p className="text-[10px] text-muted-foreground">{group.items.length} طلب</p>
                            </div>
                          </div>
                          <span className="text-xs text-green-500 font-medium">✓ تم التسليم</span>
                        </div>
                        <div className="space-y-1 pr-2">
                          {group.items.map(item => (
                            <div key={item.id} className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{item.drinkName} {item.quantity > 1 && `× ${item.quantity}`}</span>
                              <span>{formatTime(item.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border border-dashed border-border rounded-xl">
                    <p className="text-xs">لم تسلم أي طلبات بعد</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirmed reservation notifications */}
        {reservationNotifs.filter(r => !dismissedReservIds.has(r.id)).map(r => {
          const dt = new Date(r.reserved_at)
          const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
          const dateStr = dt.toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })
          return (
            <div key={r.id} className="rounded-2xl p-4 space-y-2 relative" style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(180,83,9,0.08))',
              border: '1.5px solid rgba(245,158,11,0.4)',
              boxShadow: '0 0 18px rgba(245,158,11,0.12)'
            }}>
              <button onClick={() => setDismissedReservIds(prev => new Set([...prev, r.id]))} className="absolute top-2 left-2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-amber-400 shrink-0" />
                <p className="font-bold text-amber-300 text-sm">حجز مؤكد — تجهيز الطاولة</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-200/80">
                <span className="font-semibold text-amber-200">{r.customer_name}</span>
                {r.table_number
                  ? <span className="font-bold text-amber-300 text-sm">🪑 طاولة {r.table_number}</span>
                  : <span className="text-amber-200/50 italic">بدون رقم طاولة</span>
                }
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.party_size} أشخاص</span>
                <span>{dateStr} · {timeStr}</span>
                {r.customer_phone && (
                  <a href={`tel:${r.customer_phone}`} className="flex items-center gap-1 text-amber-300">
                    <Phone className="h-3 w-3" /> {r.customer_phone}
                  </a>
                )}
              </div>
              {r.notes && <p className="text-xs text-amber-200/60 bg-amber-900/20 rounded-lg px-2 py-1">📝 {r.notes}</p>}
            </div>
          )
        })}

        {/* ── Waiter Call Notifications ── */}
        {waiterCalls.filter(c => !dismissedCallIds.has(c.id)).map(c => (
          <div key={c.id} className="rounded-2xl p-4 space-y-2 relative animate-pulse-once" style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(67,56,202,0.08))',
            border: '1.5px solid rgba(99,102,241,0.5)',
            boxShadow: '0 0 18px rgba(99,102,241,0.15)'
          }}>
            <button
              onClick={() => setDismissedCallIds(prev => new Set([...prev, c.id]))}
              className="absolute top-2 left-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔔</span>
              <p className="font-bold text-indigo-300 text-sm">نداء نادل</p>
            </div>
            <p className="text-xs text-indigo-200/80">{c.message}</p>
            <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        ))}

        {/* Summary badges */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-sm font-bold text-amber-400">{pendingGroups.length}</span>
            <span className="text-xs text-amber-400/70">طاولة في الانتظار</span>
          </div>
          {readyGroups.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-1.5 animate-pulse">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              <span className="text-sm font-bold text-green-400">{readyGroups.length}</span>
              <span className="text-xs text-green-400/70">جاهزة للتسليم</span>
            </div>
          )}
          {deliveredGroups.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-1.5">
              <span className="text-sm font-bold text-muted-foreground">{deliveredGroups.length}</span>
              <span className="text-xs text-muted-foreground">تم تسليمها</span>
            </div>
          )}
        </div>

        {/* Daily Performance Summary */}
        {deliveredGroups.length > 0 && (
          <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-foreground text-sm">ملخص أدائ�� اليوم</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                </div>
                <p className="text-2xl font-black text-green-400">{deliveredGroups.length}</p>
                <p className="text-[10px] text-green-400/70">طاولة تم تسليمها</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Coffee className="h-4 w-4 text-amber-400" />
                </div>
                <p className="text-2xl font-black text-amber-400">
                  {deliveredGroups.reduce((sum, g) => sum + g.items.length, 0)}
                </p>
                <p className="text-[10px] text-amber-400/70">طلب تم تسليمه</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-black text-primary">
                  {pendingGroups.length + readyGroups.length}
                </p>
                <p className="text-[10px] text-primary/70">في الانتظار</p>
              </div>
            </div>
            {deliveredGroups.length >= 5 && (
              <div className="mt-3 flex items-center justify-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <Award className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-400">ممتاز! أداء رائع اليوم</span>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {tableGroups.length === 0 && !isLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <Coffee className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">لا توجد طلبات حالياً</p>
            <p className="text-sm mt-1 opacity-60">الطلبات الجديدة ستظهر هنا تلقائياً</p>
          </div>
        )}

        {/* Ready tables — show first */}
        {readyGroups.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-green-400 uppercase tracking-wider px-1">جاهزة للتسليم</p>
        {readyGroups.map(group => (
          <TableCard key={group.userId} group={group} onDeliver={() => handleMarkDelivered(group)} onWay={() => handleMarkOnWay(group)} formatTime={formatTime} highlight="green" />
        ))}
          </div>
        )}

        {/* Pending tables */}
        {pendingGroups.length > 0 && (
          <div className="space-y-2">
            {readyGroups.length > 0 && <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">قيد التحضير</p>}
        {pendingGroups.map(group => (
          <TableCard key={group.userId} group={group} onDeliver={() => handleMarkDelivered(group)} onWay={() => handleMarkOnWay(group)} formatTime={formatTime} highlight={group.anyPreparing ? 'amber' : 'none'} />
        ))}
          </div>
        )}

        {/* Delivered today */}
        {deliveredGroups.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400 transition-colors px-1 py-2 flex items-center gap-1.5 list-none">
              <CheckCircle2 className="h-3.5 w-3.5" />
              تم تسليمها اليوم ({deliveredGroups.length})
            </summary>
            <div className="space-y-2 mt-2">
              {deliveredGroups.map(group => (
                <div key={group.userId} className="rounded-xl border border-border/40 bg-card/40 p-3 opacity-50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-muted-foreground text-sm">طاولة {group.tableNumber}</span>
                    <span className="text-xs text-green-600 font-medium">✓ تم التسليم</span>
                  </div>
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

  const borderColor = highlight === 'green'
    ? 'rgba(34,197,94,0.5)'
    : highlight === 'amber'
    ? 'rgba(212,160,23,0.35)'
    : 'var(--border)'

  const glowStyle = highlight === 'green'
    ? { boxShadow: '0 0 20px rgba(34,197,94,0.15)' }
    : highlight === 'amber'
    ? { boxShadow: '0 0 16px rgba(212,160,23,0.12)' }
    : {}

  const handleClick = async () => {
    setIsDelivering(true)
    await onDeliver()
    setIsDelivering(false)
  }

  const handleOnWay = async () => {
    setIsOnWay(true)
    await onWay()
    setIsOnWay(false)
  }

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3 transition-all duration-300"
      style={{ borderColor, ...glowStyle }}>

      {/* Table header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black ${highlight === 'green' ? 'bg-green-500/15 text-green-400' : highlight === 'amber' ? 'bg-amber-500/15 text-amber-400' : 'bg-muted text-foreground'}`}>
            {group.tableNumber}
          </div>
          <div>
            <p className="font-bold text-foreground text-sm leading-tight">طاولة {group.tableNumber}</p>
            <p className="text-[11px] text-muted-foreground">{formatTime(group.earliestTime)} · {group.items.length} {group.items.length === 1 ? 'طلب' : 'طلبات'}</p>
          </div>
        </div>
        {highlight === 'green' && (
          <AlertCircle className="h-5 w-5 text-green-400 animate-pulse" />
        )}
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {group.items.map(item => {
          const { text, color } = statusLabel(item.status)
          return (
            <div key={item.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Coffee className="h-3.5 w-3.5 shrink-0 text-amber-500/60" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {item.drinkName}
                    {item.quantity > 1 && <span className="text-muted-foreground text-xs mr-1 font-normal">× {item.quantity}</span>}
                  </span>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>{text}</span>
              </div>
              <StageBar status={item.status} />
              {item.notes && (
                <p className="text-[11px] text-amber-400/70 pr-5">ملاحظة: {item.notes}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Buttons container */}
      <div className="space-y-2">
        {/* On the way button - show when all ready and not yet on way */}
        {group.allReady && !group.items.every(i => i.status === 'completed') && (
          <Button
            onClick={handleOnWay}
            disabled={isOnWay}
            className="w-full font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
            size="sm"
          >
            {isOnWay
              ? <Loader2 className="h-4 w-4 animate-spin ml-2" />
              : <ArrowRight className="h-4 w-4 ml-2" />
            }
            في الطريق للطاولة
          </Button>
        )}
        
        {/* Deliver button — show when all ready OR for waiting orders */}
        {!group.items.every(i => i.status === 'completed') && (
          <Button
            onClick={handleClick}
            disabled={isDelivering}
            className={`w-full font-bold ${group.allReady ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            size="sm"
          >
            {isDelivering
              ? <Loader2 className="h-4 w-4 animate-spin ml-2" />
              : <CheckCircle2 className="h-4 w-4 ml-2" />
            }
            {group.allReady ? 'تم تسليم الأوردر ✓' : 'سلّم الطلب'}
          </Button>
        )}
      </div>
      {group.items.every(i => i.status === 'completed') && (
        <p className="text-center text-xs text-green-600 font-medium py-1">✓ تم تسليم هذا الطلب</p>
      )}
    </div>
  )
}
