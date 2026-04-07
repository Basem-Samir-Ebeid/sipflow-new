'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { LogOut, RefreshCw, Loader2, ArrowRight, Coffee, CheckCircle2, Clock, AlertCircle, CalendarCheck, Users, Phone, X } from 'lucide-react'
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
  if (s === 'ready' || s === 'completed') return { text: 'جاهز', color: 'bg-green-500/15 text-green-400 border-green-500/30' }
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
  const previousGroupCount = useRef(0)
  const [reservationNotifs, setReservationNotifs] = useState<ReservationNotif[]>([])
  const [dismissedReservIds, setDismissedReservIds] = useState<Set<string>>(new Set())
  const seenReservationIds = useRef<Set<string>>(new Set())

  const playSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const t = ctx.currentTime
      const playBeep = (time: number, freq: number, dur: number) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.frequency.value = freq; osc.type = 'sine'
        g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(0.6, time + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, time + dur)
        osc.start(time); osc.stop(time + dur)
      }
      playBeep(t, 880, 0.18); playBeep(t + 0.22, 1100, 0.18); playBeep(t + 0.44, 1320, 0.25)
    } catch {}
  }

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
          allReady:     g.items.every(i => i.status === 'ready'),
          anyPreparing: g.items.some(i => i.status === 'preparing'),
        }))
        .sort((a, b) => {
          if (a.allReady !== b.allReady) return a.allReady ? 1 : -1
          return new Date(a.earliestTime).getTime() - new Date(b.earliestTime).getTime()
        })

      const pendingNew = result.filter(g => !g.allReady && !deliveredIds.has(g.userId))
      if (pendingNew.length > previousGroupCount.current && previousGroupCount.current > 0) {
        playSound()
        toast.success('طلب جديد وصل!')
      }
      previousGroupCount.current = pendingNew.length

      setTableGroups(result)
      setLastRefresh(new Date())
    } catch { toast.error('خطأ في تحديث الطلبات') }
    finally { setIsLoading(false) }
  }, [staffUser, deliveredIds])

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
          playSound()
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
    if (!staffUser) return
    fetchOrders()
    fetchReservationNotifs()
    const id = setInterval(fetchOrders, 4000)
    const rid = setInterval(fetchReservationNotifs, 15000)
    return () => { clearInterval(id); clearInterval(rid) }
  }, [staffUser, fetchOrders, fetchReservationNotifs])

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
    } catch { toast.error('حدث خطأ، حاول تاني') }
    finally { setIsLoggingIn(false) }
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
                <Image src="/images/qa3da-logo.jpg" alt="SîpFlõw" width={80} height={80} className="object-cover w-full h-full" />
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
      <DevBar />

      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <div>
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4 text-amber-500" />
              <span className="font-bold text-foreground text-sm">بوابة الويتر</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{staffUser.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-[10px] text-zinc-600">
                آخر تحديث {formatTime(lastRefresh.toISOString())}
              </span>
            )}
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
              <TableCard key={group.userId} group={group} onDeliver={() => handleMarkDelivered(group)} formatTime={formatTime} highlight="green" />
            ))}
          </div>
        )}

        {/* Pending tables */}
        {pendingGroups.length > 0 && (
          <div className="space-y-2">
            {readyGroups.length > 0 && <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">قيد التحضير</p>}
            {pendingGroups.map(group => (
              <TableCard key={group.userId} group={group} onDeliver={() => handleMarkDelivered(group)} formatTime={formatTime} highlight={group.anyPreparing ? 'amber' : 'none'} />
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

function TableCard({ group, onDeliver, formatTime, highlight }: {
  group: TableGroup
  onDeliver: () => void
  formatTime: (d: string) => string
  highlight: 'green' | 'amber' | 'none'
}) {
  const [isDelivering, setIsDelivering] = useState(false)

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
          {group.allReady ? 'تم التسليم ✓' : 'سلّم الطلب'}
        </Button>
      )}
      {group.items.every(i => i.status === 'completed') && (
        <p className="text-center text-xs text-green-600 font-medium py-1">✓ تم تسليم هذا الطلب</p>
      )}
    </div>
  )
}
