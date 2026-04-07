'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { OrderWithDetails } from '@/lib/types'
import useSWR from 'swr'
import {
  LogOut, Clock, CheckCircle, Loader2, RefreshCw,
  ClipboardList, MessageSquare, BarChart3, FileText, TrendingUp, ArrowRight,
  CalendarDays, CalendarCheck, CalendarX, Users, Phone
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast, Toaster } from 'sonner'
import Image from 'next/image'

interface StaffUser {
  id: string
  username: string
  name: string
  is_active: boolean
  place_id: string | null
}

interface UserOrderGroup {
  userId: string
  userName: string
  tableNumber?: string
  orders: OrderWithDetails[]
  totalPrice: number
  earliestTime: string
}

interface DrinkReportItem {
  drinkName: string
  count: number
  totalRevenue: number
}

interface Reservation {
  id: string
  place_id: string
  customer_name: string
  customer_phone: string | null
  party_size: number
  reserved_at: string
  status: 'pending' | 'confirmed' | 'cancelled'
  notes: string | null
  table_number: string | null
  created_at: string
}

type StaffTab = 'pending' | 'done' | 'report' | 'reservations'

const DevBar = () => (
  <div className="relative overflow-hidden py-[5px]" style={{ background: 'linear-gradient(90deg, #1a0a00, #3d1f00, #6b3a00, #D4A017, #6b3a00, #3d1f00, #1a0a00)' }}>
    <div className="flex items-center justify-center gap-2">
      <span className="text-[10px] tracking-widest uppercase text-amber-200/60 font-medium">✦</span>
      <span className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: '#ffe8a0', textShadow: '0 0 12px rgba(212,160,23,0.8), 0 0 24px rgba(212,160,23,0.4)' }}>
        Developed by Basem Samir Ebeid
      </span>
      <span className="text-[10px] tracking-widest uppercase text-amber-200/60 font-medium">✦</span>
    </div>
  </div>
)

export default function StaffPage() {
  const [mounted, setMounted] = useState(false)
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [completingUserId, setCompletingUserId] = useState<string | null>(null)
  const [staffTab, setStaffTab] = useState<StaffTab>('pending')
  const previousOrderCount = useRef<number>(0)

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isFetchingReservations, setIsFetchingReservations] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [tableInputId, setTableInputId] = useState<string | null>(null)
  const [tableNumbers, setTableNumbers] = useState<Record<string, string>>({})
  const [showReservationsModal, setShowReservationsModal] = useState(false)

  const playOrderSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const playBeep = (startTime: number, freq: number, duration: number, gain: number) => {
        const osc = ctx.createOscillator()
        const gainNode = ctx.createGain()
        osc.connect(gainNode)
        gainNode.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, startTime)
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
        osc.start(startTime)
        osc.stop(startTime + duration)
      }
      const t = ctx.currentTime
      playBeep(t,        880, 0.18, 1.0)
      playBeep(t + 0.2,  1100, 0.18, 1.0)
      playBeep(t + 0.4,  1320, 0.25, 1.0)
      playBeep(t + 0.7,  880, 0.18, 1.0)
      playBeep(t + 0.9,  1100, 0.18, 1.0)
      playBeep(t + 1.1,  1320, 0.25, 1.0)
    } catch {
      const audio = new Audio('/sounds/order.wav')
      audio.volume = 1.0
      audio.play().catch(() => {})
    }
  }

  useEffect(() => {
    const savedStaff = localStorage.getItem('staff_user')
    if (savedStaff) {
      try { setStaffUser(JSON.parse(savedStaff)) } catch { localStorage.removeItem('staff_user') }
    }
    setMounted(true)
  }, [])

  const { data: allOrders = [], mutate: mutateOrders, isLoading } = useSWR<OrderWithDetails[]>(
    staffUser ? `staff-all-orders-${staffUser.place_id || 'global'}` : null,
    async () => {
      const placeParam = staffUser?.place_id ? `&place_id=${staffUser.place_id}` : ''
      const sessionRes = await fetch(`/api/sessions?readonly=true${placeParam}`)
      const session = await sessionRes.json()
      if (!session?.id) return []
      const res = await fetch(`/api/orders?session_id=${session.id}`)
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    { refreshInterval: 3000 }
  )

  const previousPendingReservCount = useRef<number>(-1)

  const fetchReservations = useCallback(async (silent = false) => {
    if (!staffUser?.place_id) return
    if (!silent) setIsFetchingReservations(true)
    try {
      const res = await fetch(`/api/reservations?place_id=${staffUser.place_id}`)
      const data = await res.json()
      if (!Array.isArray(data)) return
      setReservations(data)
      const pending = data.filter((r: Reservation) => r.status === 'pending')
      if (previousPendingReservCount.current >= 0 && pending.length > previousPendingReservCount.current) {
        playOrderSound()
        toast('🔔 حجز جديد وصل! تحقق من تاب الحجوزات', { duration: 8000 })
      }
      previousPendingReservCount.current = pending.length
    } catch { /* silent */ }
    finally { if (!silent) setIsFetchingReservations(false) }
  }, [staffUser])

  useEffect(() => {
    if (!staffUser?.place_id) return
    fetchReservations()
    const interval = setInterval(() => fetchReservations(true), 15000)
    return () => clearInterval(interval)
  }, [staffUser, fetchReservations])

  useEffect(() => {
    if (staffUser && staffTab === 'reservations') {
      fetchReservations()
    }
  }, [staffTab, fetchReservations])

  const handleConfirmReservation = async (r: Reservation) => {
    const tableNum = tableNumbers[r.id] || ''
    setConfirmingId(r.id)
    try {
      const res = await fetch(`/api/reservations/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed', table_number: tableNum || null })
      })
      if (res.ok) {
        toast.success(`✅ تم تأكيد حجز ${r.customer_name}${tableNum ? ` — طاولة ${tableNum}` : ''}`)
        setTableInputId(null)
        setTableNumbers(prev => { const n = { ...prev }; delete n[r.id]; return n })
        fetchReservations()
      } else {
        toast.error('حدث خطأ أثناء التأكيد')
      }
    } catch { toast.error('حدث خطأ في الاتصال') }
    finally { setConfirmingId(null) }
  }

  const handleCancelReservation = async (r: Reservation) => {
    try {
      await fetch(`/api/reservations/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      })
      toast.success(`تم إلغاء حجز ${r.customer_name}`)
      fetchReservations()
    } catch { toast.error('حدث خطأ') }
  }

  const pendingOrders = allOrders.filter(o => o.status === 'pending' || !o.status)
  const completedOrders = allOrders.filter(o => o.status === 'completed')

  const groupOrders = (orders: OrderWithDetails[]): UserOrderGroup[] =>
    Object.values(
      orders.reduce((acc: Record<string, UserOrderGroup>, order) => {
        const isShared = order.user?.name?.startsWith('__زبون__') || order.user?.name?.startsWith('Guest-')
        const rawTable = order.user?.table_number
        const tableStr = rawTable != null && rawTable !== '' ? String(rawTable) : undefined
        const groupKey = isShared && tableStr ? `table_${tableStr}` : (order.user_id || 'unknown')
        if (!acc[groupKey]) {
          acc[groupKey] = {
            userId: order.user_id || 'unknown',
            userName: tableStr
              ? `طاولة ${tableStr}`
              : (isShared ? 'زبون' : (order.user?.name || 'مستخدم')),
            tableNumber: tableStr,
            orders: [],
            totalPrice: 0,
            earliestTime: order.created_at,
          }
        }
        acc[groupKey].orders.push(order)
        acc[groupKey].totalPrice += Number(order.total_price || 0)
        if (new Date(order.created_at) < new Date(acc[groupKey].earliestTime)) {
          acc[groupKey].earliestTime = order.created_at
        }
        return acc
      }, {})
    ).sort((a, b) => new Date(a.earliestTime).getTime() - new Date(b.earliestTime).getTime())

  const pendingGroups = groupOrders(pendingOrders)
  const completedGroups = groupOrders(completedOrders)

  const drinkReport: DrinkReportItem[] = Object.values(
    allOrders.reduce((acc: Record<string, DrinkReportItem>, order) => {
      const name = order.drink?.name || 'غير معروف'
      if (!acc[name]) acc[name] = { drinkName: name, count: 0, totalRevenue: 0 }
      acc[name].count += order.quantity || 1
      acc[name].totalRevenue += Number(order.total_price || 0)
      return acc
    }, {})
  ).sort((a, b) => b.count - a.count)

  const todayRevenue = allOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0)
  const todayDate = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  useEffect(() => {
    if (pendingOrders.length > previousOrderCount.current && previousOrderCount.current > 0) {
      playOrderSound()
      toast.success('طلب جديد وصل!')
    }
    previousOrderCount.current = pendingOrders.length
  }, [pendingOrders.length])

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) { toast.error('من فضلك أدخل اسم المستخدم وكلمة المرور'); return }
    setIsLoggingIn(true)
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      })
      const data = await res.json()
      if (!res.ok || !data) { toast.error('اسم المستخدم أو كلمة المرور غير صحيحة'); return }
      setStaffUser(data)
      localStorage.setItem('staff_user', JSON.stringify(data))
      toast.success(`أهلاً ${data.name}!`)
    } catch { toast.error('حدث خطأ، حاول مرة أخرى') }
    finally { setIsLoggingIn(false) }
  }

  const handleLogout = () => {
    setStaffUser(null)
    localStorage.removeItem('staff_user')
    setUsername('')
    setPassword('')
  }

  const markUserOrdersCompleted = async (group: UserOrderGroup) => {
    setCompletingUserId(group.userId)
    try {
      await Promise.all(
        group.orders.map(order =>
          fetch(`/api/orders/${order.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
          })
        )
      )
      toast.success(`تم تنفيذ طلب ${group.userName}!`)
      mutateOrders()
    } catch { toast.error('حدث خطأ، حاول مرة أخرى') }
    finally { setCompletingUserId(null) }
  }

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })

  const handlePrintReport = () => {
    const lines = [
      `تقرير يوم ${todayDate}`,
      '─'.repeat(40),
      '',
      'المشروب              | الكمية | الإيراد',
      '─'.repeat(40),
      ...drinkReport.map(d => `${d.drinkName.padEnd(20)} | ${String(d.count).padStart(4)}   | ${d.totalRevenue.toFixed(0)} ج.م`),
      '',
      '─'.repeat(40),
      `إجمالي الطلبات: ${allOrders.length}`,
      `إجمالي الإيراد: ${todayRevenue.toFixed(0)} ج.م`,
    ].join('\n')
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`<pre dir="rtl" style="font-family:monospace;font-size:14px;padding:20px">${lines}</pre>`)
      win.document.close()
      win.print()
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!staffUser) {
    return (
      <div className="min-h-screen flex flex-col" dir="rtl" style={{ background: '#0a0a0a' }}>
        <DevBar />
        <div className="px-4 pt-4">
          <button onClick={() => { window.location.href = '/' }}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            <ArrowRight className="h-3.5 w-3.5" />
            الرئيسية
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-5">
          <div className="w-full max-w-xs">
            <div className="text-center mb-7">
              <div className="relative mx-auto mb-5 h-20 w-20">
                <div className="h-20 w-20 rounded-2xl overflow-hidden border border-violet-500/30 shadow-lg shadow-violet-500/15">
                  <Image src="/images/qa3da-logo.jpg" alt="SîpFlõw" width={80} height={80} className="object-cover w-full h-full" />
                </div>
                <div className="absolute -bottom-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full text-sm"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 0 10px rgba(168,85,247,0.5)' }}>
                  <ClipboardList className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2 text-xs font-semibold"
                style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                بوابة الكاشير
              </div>
              <h1 className="text-xl font-bold text-white">SîpFlõw · كاشير</h1>
              <p className="text-xs text-zinc-500 mt-1">إدارة الطلبات والإيرادات</p>
            </div>
            <div className="rounded-2xl p-5 space-y-4" style={{ background: '#141414', border: '1px solid rgba(168,85,247,0.2)' }}>
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 block">اسم المستخدم</label>
                <Input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="username" dir="ltr"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40 focus-visible:border-violet-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 block">كلمة المرور</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" dir="ltr"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/40 focus-visible:border-violet-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
              </div>
              <button onClick={handleLogin} disabled={isLoggingIn}
                className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                style={{ background: isLoggingIn ? 'rgba(168,85,247,0.3)' : 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', boxShadow: '0 2px 14px rgba(168,85,247,0.3)' }}>
                {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                {isLoggingIn ? 'جاري الدخول...' : 'دخول كاشير'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const OrderCard = ({ group, showComplete }: { group: UserOrderGroup; showComplete: boolean }) => {
    const isVip = group.orders.some(o => o.notes?.includes('مطور'))
    return (
    <div className={`relative rounded-2xl shadow-sm${isVip ? ' mt-3' : ''}`}
      style={isVip ? {
        border: '2px solid #f59e0b',
        background: 'var(--card)',
        boxShadow: '0 0 22px rgba(245,158,11,0.35), inset 0 0 15px rgba(245,158,11,0.04)'
      } : {
        border: '1px solid var(--border)',
        background: 'var(--card)'
      }}>
      {isVip && (
        <div className="absolute -top-3.5 left-4 z-20 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold shadow-xl"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)', color: '#fff', letterSpacing: '0.05em' }}>
          👑 VIP مطور
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3 border-b rounded-t-2xl"
        style={{ 
          background: isVip ? 'rgba(245,158,11,0.1)' : 'hsl(var(--muted)/0.4)',
          borderColor: isVip ? 'rgba(245,158,11,0.35)' : 'var(--border)'
        }}>
        <div className="flex items-center gap-2 text-amber-500">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">{formatTime(group.earliestTime)}</span>
        </div>
        <div className="text-right">
          <p className="font-bold" style={{ color: isVip ? '#f59e0b' : 'var(--foreground)' }}>{group.userName}</p>
          {group.tableNumber && <p className="text-xs text-muted-foreground">طربيزة {group.tableNumber}</p>}
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        {group.orders.map((order, idx) => (
          <div key={order.id} className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{idx + 1}</span>
                <span className="font-semibold text-foreground">{order.drink?.name}</span>
                {order.quantity > 1 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">× {order.quantity}</span>
                )}
              </div>
              {order.notes && (
                <div className="mt-1 flex items-start gap-1.5 pr-8">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                  <span className="text-xs text-muted-foreground italic">{order.notes}</span>
                </div>
              )}
            </div>
            {Number(order.total_price) > 0 && (
              <span className="shrink-0 text-sm font-medium text-primary">{order.total_price} ج.م</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3"
        style={{ borderColor: isVip ? 'rgba(245,158,11,0.3)' : 'var(--border)' }}>
        {showComplete ? (
          <Button onClick={() => markUserOrdersCompleted(group)} disabled={completingUserId === group.userId}
            className="flex-1 bg-green-600 hover:bg-green-700" size="lg">
            {completingUserId === group.userId
              ? <Loader2 className="h-5 w-5 animate-spin ml-2" />
              : <CheckCircle className="h-5 w-5 ml-2" />}
            تم التنفيذ
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold">منفّذ</span>
          </div>
        )}
        {group.totalPrice > 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">الإجمالي</p>
            <p className="text-lg font-bold text-primary">{group.totalPrice.toFixed(0)} ج.م</p>
          </div>
        )}
      </div>
    </div>
    )
  }

  const pendingReservations = reservations.filter(r => r.status === 'pending')
  const confirmedReservations = reservations.filter(r => r.status === 'confirmed')

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <DevBar />
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { window.location.href = '/' }} className="text-muted-foreground hover:text-amber-500">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div>
              <h1 className="font-bold text-foreground">{staffUser.name}</h1>
              <p className="text-xs text-muted-foreground">Staff</p>
            </div>
            <div className="h-9 w-9 rounded-full overflow-hidden border border-amber-500/30 shrink-0">
              <Image src="/images/qa3da-logo.jpg" alt="logo" width={36} height={36} className="object-cover w-full h-full" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-border overflow-x-auto">
          <button
            onClick={() => setStaffTab('pending')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 whitespace-nowrap px-2 ${
              staffTab === 'pending' ? 'border-orange-500 text-orange-500 bg-orange-500/5' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Pending
            {pendingOrders.length > 0 && (
              <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {pendingOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setStaffTab('done')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 whitespace-nowrap px-2 ${
              staffTab === 'done' ? 'border-green-500 text-green-500 bg-green-500/5' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            Done
            {completedOrders.length > 0 && (
              <span className="bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {completedOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setStaffTab('report')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 whitespace-nowrap px-2 ${
              staffTab === 'report' ? 'border-blue-500 text-blue-500 bg-blue-500/5' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Report
          </button>
          {staffUser.place_id && (
            <button
              onClick={() => setStaffTab('reservations')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 whitespace-nowrap px-2 ${
                staffTab === 'reservations' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              الحجوزات
              {pendingReservations.length > 0 && (
                <span className="bg-amber-500 text-black text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-bold">
                  {pendingReservations.length}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      <div className="p-4" dir="rtl">

        {/* PENDING TAB */}
        {staffTab === 'pending' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="sm" onClick={() => mutateOrders()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                تحديث
              </Button>
              <p className="text-sm text-muted-foreground">{todayDate}</p>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">جاري تحميل الطلبات...</p>
              </div>
            ) : pendingGroups.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle className="h-14 w-14 mx-auto text-green-500 mb-4" />
                <p className="text-lg font-bold text-foreground mb-1">لا توجد طلبات معلقة</p>
                <p className="text-muted-foreground text-sm">جميع الطلبات تم تنفيذها ✓</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingGroups.map(group => <OrderCard key={group.userId} group={group} showComplete={true} />)}
                <div className="flex items-center justify-center gap-3 mt-2">
                  <span className="bg-orange-500/10 text-orange-600 px-4 py-2 rounded-full text-sm font-medium">
                    {pendingGroups.length} {pendingGroups.length === 1 ? 'عميل' : 'عملاء'} في الانتظار
                  </span>
                  <span className="bg-muted text-muted-foreground px-4 py-2 rounded-full text-sm font-medium">
                    {pendingOrders.length} صنف
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* DONE TAB */}
        {staffTab === 'done' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="sm" onClick={() => mutateOrders()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                تحديث
              </Button>
              <p className="text-sm text-muted-foreground">المنفّذة اليوم</p>
            </div>

            {completedGroups.length === 0 ? (
              <div className="text-center py-16">
                <ClipboardList className="h-14 w-14 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-lg font-bold text-foreground mb-1">لا توجد طلبات منفّذة بعد</p>
                <p className="text-muted-foreground text-sm">الطلبات المنفّذة هتظهر هنا</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedGroups.map(group => <OrderCard key={group.userId} group={group} showComplete={false} />)}
                <div className="flex items-center justify-center gap-3 mt-2">
                  <span className="bg-green-500/10 text-green-600 px-4 py-2 rounded-full text-sm font-medium">
                    {completedOrders.length} طلب منفّذ
                  </span>
                  <span className="bg-muted text-muted-foreground px-4 py-2 rounded-full text-sm font-medium">
                    {completedGroups.reduce((s, g) => s + g.totalPrice, 0).toFixed(0)} ج.م
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* REPORT TAB */}
        {staffTab === 'report' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button onClick={handlePrintReport} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" size="sm">
                <FileText className="h-4 w-4" />
                طباعة التقرير
              </Button>
              <p className="text-sm text-muted-foreground font-medium">{todayDate}</p>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-primary">{allOrders.length}</p>
                <p className="text-xs text-muted-foreground mt-1">إجمالي الطلبات</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-green-600">{completedOrders.length}</p>
                <p className="text-xs text-muted-foreground mt-1">منفّذ</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-amber-500">{todayRevenue.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground mt-1">ج.م إيراد</p>
              </div>
            </div>

            {drinkReport.length === 0 ? (
              <div className="text-center py-16">
                <TrendingUp className="h-14 w-14 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-lg font-bold text-foreground mb-1">لا توجد طلبات اليوم</p>
                <p className="text-muted-foreground text-sm">التقرير هيظهر هنا بعد أول طلب</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="font-bold text-foreground text-right mb-3 flex items-center justify-end gap-2">
                  <BarChart3 className="h-4 w-4" />
                  تفاصيل المشروبات
                </h3>
                {drinkReport.map((item, idx) => {
                  const maxCount = drinkReport[0].count
                  const pct = Math.round((item.count / maxCount) * 100)
                  return (
                    <div key={item.drinkName} className="bg-card border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-left">
                          {item.totalRevenue > 0 && (
                            <span className="text-sm font-bold text-primary">{item.totalRevenue.toFixed(0)} ج.م</span>
                          )}
                          <span className="bg-primary/10 text-primary text-xs font-bold rounded-full px-2 py-0.5">× {item.count}</span>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <span className="font-semibold text-foreground">{item.drinkName}</span>
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                            {idx + 1}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* RESERVATIONS TAB */}
        {staffTab === 'reservations' && staffUser.place_id && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="sm" onClick={fetchReservations} className="gap-2" disabled={isFetchingReservations}>
                <RefreshCw className={`h-4 w-4 ${isFetchingReservations ? 'animate-spin' : ''}`} />
                تحديث
              </Button>
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-500" />
                الحجوزات
              </h2>
            </div>

            {isFetchingReservations ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 mx-auto text-amber-500 animate-spin mb-4" />
                <p className="text-muted-foreground">جاري تحميل الحجوزات...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pending reservations */}
                {pendingReservations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-amber-500 mb-2 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      تنتظر التأكيد ({pendingReservations.length})
                    </h3>
                    <div className="space-y-3">
                      {pendingReservations.map(r => {
                        const dt = new Date(r.reserved_at)
                        const dateStr = dt.toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })
                        const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                        const isConfirming = confirmingId === r.id
                        const showTableInput = tableInputId === r.id
                        return (
                          <div key={r.id} className="rounded-2xl border border-amber-500/30 bg-card p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                معلّق
                              </span>
                              <div className="text-right">
                                <p className="font-bold text-foreground">{r.customer_name}</p>
                                {r.customer_phone && (
                                  <a href={`tel:${r.customer_phone}`} className="text-xs text-amber-400 flex items-center gap-1 justify-end mt-0.5">
                                    <Phone className="h-3 w-3" /> {r.customer_phone}
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.party_size} أشخاص</span>
                              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {dateStr}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {timeStr}</span>
                            </div>
                            {r.notes && (
                              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-2 py-1.5">📝 {r.notes}</p>
                            )}
                            {/* Table number input */}
                            {showTableInput ? (
                              <div className="space-y-2">
                                <label className="text-xs text-muted-foreground">رقم الطاولة</label>
                                <div className="flex gap-2">
                                  <Input
                                    type="text"
                                    placeholder="مثال: 5"
                                    value={tableNumbers[r.id] || ''}
                                    onChange={e => setTableNumbers(prev => ({ ...prev, [r.id]: e.target.value }))}
                                    className="text-center font-bold"
                                    dir="ltr"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleConfirmReservation(r)}
                                    disabled={isConfirming}
                                    className="px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm flex items-center gap-1 disabled:opacity-60 transition-colors"
                                  >
                                    {isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
                                    تأكيد
                                  </button>
                                  <button
                                    onClick={() => { setTableInputId(null); setTableNumbers(prev => { const n = { ...prev }; delete n[r.id]; return n }) }}
                                    className="px-3 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm transition-colors"
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => setTableInputId(r.id)}
                                  className="flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-sm font-bold text-white transition-colors"
                                  style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                                >
                                  <CalendarCheck className="h-4 w-4" /> تأكيد + تحديد طاولة
                                </button>
                                <button
                                  onClick={() => handleCancelReservation(r)}
                                  className="flex items-center justify-center gap-1 rounded-xl px-4 py-2 text-xs bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                                >
                                  <CalendarX className="h-3.5 w-3.5" /> إلغاء
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Confirmed reservations */}
                {confirmedReservations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-green-500 mb-2 flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      مؤكدة ({confirmedReservations.length})
                    </h3>
                    <div className="space-y-2">
                      {confirmedReservations.map(r => {
                        const dt = new Date(r.reserved_at)
                        const dateStr = dt.toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })
                        const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                        return (
                          <div key={r.id} className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {r.table_number && (
                                  <span className="font-bold text-green-400 bg-green-500/15 px-2 py-0.5 rounded-full">
                                    🪑 طاولة {r.table_number}
                                  </span>
                                )}
                                <span>{r.party_size} أشخاص</span>
                                <span>{dateStr} · {timeStr}</span>
                              </div>
                              <p className="font-semibold text-foreground text-sm">{r.customer_name}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {reservations.length === 0 && !isFetchingReservations && (
                  <div className="text-center py-16">
                    <CalendarDays className="h-14 w-14 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-lg font-bold text-foreground mb-1">لا توجد حجوزات</p>
                    <p className="text-muted-foreground text-sm">الحجوزات هتظهر هنا بعد ما العملاء يحجزوا</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating reservations button */}
      {staffUser.place_id && (
        <button
          onClick={() => { setShowReservationsModal(true); fetchReservations() }}
          className="fixed bottom-6 left-4 z-40 flex items-center gap-2 rounded-2xl px-4 py-3 font-bold text-sm shadow-2xl transition-all active:scale-95"
          style={{
            background: pendingReservations.length > 0
              ? 'linear-gradient(135deg, #d97706, #b45309)'
              : 'linear-gradient(135deg, #374151, #1f2937)',
            color: '#fff',
            boxShadow: pendingReservations.length > 0
              ? '0 4px 24px rgba(217,119,6,0.5)'
              : '0 4px 16px rgba(0,0,0,0.4)'
          }}
        >
          <CalendarDays className="h-5 w-5" />
          الحجوزات
          {pendingReservations.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-amber-700 text-xs font-black">
              {pendingReservations.length}
            </span>
          )}
        </button>
      )}

      {/* Reservations Modal */}
      {showReservationsModal && (
        <div className="fixed inset-0 z-50 flex flex-col" dir="rtl">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowReservationsModal(false)} />

          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-[#111] border-t border-amber-500/20 flex flex-col max-h-[85vh]">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <button
                onClick={() => { setShowReservationsModal(false); fetchReservations() }}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 text-muted-foreground ${isFetchingReservations ? 'animate-spin' : ''}`} />
              </button>
              <h2 className="font-bold text-white flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-500" />
                الحجوزات
                {pendingReservations.length > 0 && (
                  <span className="bg-amber-500 text-black text-xs rounded-full px-2 py-0.5 font-black">
                    {pendingReservations.length} جديد
                  </span>
                )}
              </h2>
              <button onClick={() => setShowReservationsModal(false)} className="text-muted-foreground text-2xl leading-none px-1">×</button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {isFetchingReservations ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 mx-auto text-amber-500 animate-spin mb-3" />
                  <p className="text-muted-foreground text-sm">جاري التحميل...</p>
                </div>
              ) : reservations.length === 0 ? (
                <div className="text-center py-16">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-foreground font-bold mb-1">لا توجد حجوزات</p>
                  <p className="text-muted-foreground text-sm">الحجوزات هتظهر هنا</p>
                </div>
              ) : (
                <>
                  {/* Pending */}
                  {pendingReservations.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                        تنتظر التأكيد ({pendingReservations.length})
                      </h3>
                      <div className="space-y-3">
                        {pendingReservations.map(r => {
                          const dt = new Date(r.reserved_at)
                          const dateStr = dt.toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })
                          const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                          const isConfirming = confirmingId === r.id
                          const showTableInput = tableInputId === r.id
                          return (
                            <div key={r.id} className="rounded-2xl border border-amber-500/30 bg-white/5 p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">معلّق</span>
                                <div className="text-right">
                                  <p className="font-bold text-white">{r.customer_name}</p>
                                  {r.customer_phone && (
                                    <a href={`tel:${r.customer_phone}`} className="text-xs text-amber-400 flex items-center gap-1 justify-end mt-0.5">
                                      <Phone className="h-3 w-3" /> {r.customer_phone}
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.party_size} أشخاص</span>
                                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {dateStr}</span>
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {timeStr}</span>
                              </div>
                              {r.notes && (
                                <p className="text-xs text-muted-foreground bg-white/5 rounded-lg px-2 py-1.5">📝 {r.notes}</p>
                              )}
                              {showTableInput ? (
                                <div className="space-y-2">
                                  <label className="text-xs text-muted-foreground">رقم الطاولة</label>
                                  <div className="flex gap-2">
                                    <Input
                                      type="text"
                                      placeholder="مثال: 5"
                                      value={tableNumbers[r.id] || ''}
                                      onChange={e => setTableNumbers(prev => ({ ...prev, [r.id]: e.target.value }))}
                                      className="text-center font-bold bg-white/10 border-white/20 text-white"
                                      dir="ltr"
                                      autoFocus
                                    />
                                    <button
                                      onClick={async () => { await handleConfirmReservation(r); setShowReservationsModal(false) }}
                                      disabled={isConfirming}
                                      className="px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm flex items-center gap-1 disabled:opacity-60 transition-colors"
                                    >
                                      {isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
                                      تأكيد
                                    </button>
                                    <button
                                      onClick={() => { setTableInputId(null); setTableNumbers(prev => { const n = { ...prev }; delete n[r.id]; return n }) }}
                                      className="px-3 rounded-xl border border-white/20 text-muted-foreground text-sm"
                                    >إلغاء</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2 pt-1">
                                  <button
                                    onClick={() => setTableInputId(r.id)}
                                    className="flex-1 flex items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-bold text-white transition-colors"
                                    style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                                  >
                                    <CalendarCheck className="h-4 w-4" /> تأكيد + تحديد طاولة
                                  </button>
                                  <button
                                    onClick={() => handleCancelReservation(r)}
                                    className="flex items-center justify-center gap-1 rounded-xl px-4 py-2 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                  >
                                    <CalendarX className="h-3.5 w-3.5" /> إلغاء
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Confirmed */}
                  {confirmedReservations.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-1.5">
                        <CalendarCheck className="h-3.5 w-3.5" />
                        مؤكدة ({confirmedReservations.length})
                      </h3>
                      <div className="space-y-2">
                        {confirmedReservations.map(r => {
                          const dt = new Date(r.reserved_at)
                          const dateStr = dt.toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })
                          const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                          return (
                            <div key={r.id} className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {r.table_number && (
                                    <span className="font-bold text-green-400 bg-green-500/15 px-2 py-0.5 rounded-full">
                                      🪑 طاولة {r.table_number}
                                    </span>
                                  )}
                                  <span>{r.party_size} أشخاص</span>
                                  <span>{dateStr} · {timeStr}</span>
                                </div>
                                <p className="font-semibold text-white text-sm">{r.customer_name}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
