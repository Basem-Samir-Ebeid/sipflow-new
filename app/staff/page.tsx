'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { OrderWithDetails } from '@/lib/types'
import useSWR from 'swr'
import {
  LogOut, Clock, CheckCircle, Loader2, RefreshCw,
  ClipboardList, MessageSquare, BarChart3, FileText, TrendingUp, ArrowRight,
  CalendarDays, CalendarCheck, CalendarX, Users, Phone, Receipt, Star
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast, Toaster } from 'sonner'
import { DevBar } from '@/components/dev-bar'
import { useSystemLogo } from '@/hooks/use-system-logo'
import { ActiveFeaturesBanner } from '@/components/active-features-banner'
import Image from 'next/image'
import { printHTML } from '@/lib/print'

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

const VIOLET = '#a855f7'
const VIOLET_DIM = 'rgba(168,85,247,0.15)'
const VIOLET_BORDER = 'rgba(168,85,247,0.25)'

export default function StaffPage() {
  const systemLogoUrl = useSystemLogo()
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
        const customerName = order.customer_name
        const tableNumber = order.table_number || order.user?.table_number
        const tableStr = tableNumber != null && tableNumber !== '' ? String(tableNumber) : undefined
        const groupKey = customerName
          ? `customer_${customerName}_${tableStr || 'notab'}`
          : (isShared && tableStr ? `table_${tableStr}` : (order.user_id || 'unknown'))
        if (!acc[groupKey]) {
          let displayName = ''
          if (customerName && tableStr) {
            displayName = `${customerName} - طاولة ${tableStr}`
          } else if (customerName) {
            displayName = customerName
          } else if (tableStr) {
            displayName = `طاولة ${tableStr}`
          } else if (isShared) {
            displayName = 'زبون'
          } else {
            displayName = order.user?.name || 'مستخدم'
          }
          acc[groupKey] = {
            userId: order.user_id || 'unknown',
            userName: displayName,
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
    printHTML(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير</title></head><body><pre dir="rtl" style="font-family:monospace;font-size:14px;padding:20px">${lines}</pre></body></html>`)
  }

  if (!mounted) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: VIOLET_DIM, borderTopColor: VIOLET }} />
      </div>
    )
  }

  /* ─── LOGIN ─── */
  if (!staffUser) {
    return (
      <div className="min-h-[100dvh] flex flex-col" dir="rtl" style={{ background: '#080808' }}>
        <Toaster position="top-center" richColors />
        <DevBar />
        <div className="px-4 pt-4">
          <button onClick={() => { window.location.href = '/' }}
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
            <ArrowRight className="h-3.5 w-3.5" />
            الرئيسية
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-5">
          <div className="w-full max-w-xs">
            <div className="text-center mb-8">
              <div className="relative mx-auto mb-5 h-20 w-20">
                <div className="h-20 w-20 rounded-2xl overflow-hidden" style={{ border: `1px solid ${VIOLET_BORDER}`, boxShadow: `0 0 24px rgba(168,85,247,0.2)` }}>
                  <Image src={systemLogoUrl} alt="SîpFlõw" width={80} height={80} className="object-cover w-full h-full" unoptimized />
                </div>
                <div className="absolute -bottom-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full text-sm"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 0 14px rgba(168,85,247,0.6)' }}>
                  <Receipt className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-3 text-xs font-semibold"
                style={{ background: VIOLET_DIM, border: `1px solid ${VIOLET_BORDER}`, color: '#c084fc' }}>
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: VIOLET }} />
                بوابة الكاشير
              </div>
              <h1 className="text-xl font-bold text-white">SîpFlõw</h1>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>إدارة الطلبات والإيرادات</p>
            </div>

            <div className="rounded-2xl p-5 space-y-4" style={{ background: '#131313', border: `1px solid ${VIOLET_BORDER}` }}>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)' }}>اسم المستخدم</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  dir="rtl"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full h-11 rounded-xl px-4 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                  style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)' }}
                  onFocus={e => (e.currentTarget.style.borderColor = VIOLET_BORDER)}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)' }}>كلمة المرور</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full h-11 rounded-xl px-4 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                  style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)' }}
                  onFocus={e => (e.currentTarget.style.borderColor = VIOLET_BORDER)}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                style={{ background: isLoggingIn ? VIOLET_DIM : 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', boxShadow: '0 2px 16px rgba(168,85,247,0.35)' }}>
                {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                {isLoggingIn ? 'جاري الدخول...' : 'دخول الكاشير'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ─── ORDER CARD ─── */
  const OrderCard = ({ group, showComplete }: { group: UserOrderGroup; showComplete: boolean }) => {
    const isVip = group.orders.some(o => o.notes?.includes('مطور'))
    return (
      <div className="relative rounded-2xl overflow-hidden"
        style={isVip ? {
          border: '2px solid #f59e0b',
          background: '#111',
          boxShadow: '0 0 22px rgba(245,158,11,0.3)'
        } : {
          border: '1px solid rgba(255,255,255,0.07)',
          background: '#111'
        }}>
        {isVip && (
          <div className="absolute -top-3 left-4 z-20 flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-bold shadow-xl"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)', color: '#fff' }}>
            👑 VIP مطور
          </div>
        )}

        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: isVip ? 'rgba(245,158,11,0.08)' : 'rgba(168,85,247,0.06)', borderBottom: `1px solid ${isVip ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" style={{ color: VIOLET }} />
            <span className="text-sm font-medium" style={{ color: VIOLET }}>{formatTime(group.earliestTime)}</span>
          </div>
          <div className="text-right">
            <p className="font-bold text-white text-sm">
              {group.orders[0]?.customer_name && group.tableNumber
                ? `${group.orders[0].customer_name} — طاولة ${group.tableNumber}`
                : group.orders[0]?.customer_name
                  ? group.orders[0].customer_name
                  : group.tableNumber
                    ? `طاولة ${group.tableNumber}`
                    : group.userName}
            </p>
          </div>
        </div>

        {/* Items */}
        <div className="px-4 py-3 space-y-2.5">
          {group.orders.map((order, idx) => (
            <div key={order.id} className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: VIOLET_DIM, color: VIOLET }}>{idx + 1}</span>
                  <span className="font-semibold text-white text-sm">{order.drink?.name}</span>
                  {order.quantity > 1 && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: VIOLET_DIM, color: VIOLET }}>× {order.quantity}</span>
                  )}
                </div>
                {order.notes && (
                  <div className="mt-1 flex items-start gap-1.5 pr-7">
                    <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <span className="text-xs italic" style={{ color: 'rgba(255,255,255,0.4)' }}>{order.notes}</span>
                  </div>
                )}
              </div>
              {Number(order.total_price) > 0 && (
                <span className="shrink-0 text-sm font-bold" style={{ color: VIOLET }}>{order.total_price} ج.م</span>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {showComplete ? (
            <button
              onClick={() => markUserOrdersCompleted(group)}
              disabled={completingUserId === group.userId}
              className="flex-1 h-10 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', boxShadow: '0 2px 12px rgba(22,163,74,0.3)' }}>
              {completingUserId === group.userId
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle className="h-4 w-4" />}
              تم التنفيذ
            </button>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-400">منفّذ</span>
              </div>
              {(() => {
                const rating = group.orders.find(o => o.rating)?.rating
                if (!rating) return null
                return (
                  <div className="flex gap-0.5" dir="ltr">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className="h-3 w-3" fill={s <= rating ? '#f59e0b' : 'transparent'} stroke={s <= rating ? '#f59e0b' : '#3f3f46'} />
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
          {group.totalPrice > 0 && (
            <div className="text-right shrink-0">
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>الإجمالي</p>
              <p className="text-lg font-black" style={{ color: VIOLET }}>{group.totalPrice.toFixed(0)} ج.م</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const pendingReservations = reservations.filter(r => r.status === 'pending')
  const confirmedReservations = reservations.filter(r => r.status === 'confirmed')

  /* ─── TABS CONFIG ─── */
  const tabs = [
    { key: 'pending' as StaffTab, label: 'قيد الانتظار', icon: ClipboardList, activeColor: '#f97316', count: pendingOrders.length },
    { key: 'done' as StaffTab, label: 'منفّذة', icon: CheckCircle, activeColor: '#22c55e', count: completedOrders.length },
    { key: 'report' as StaffTab, label: 'التقرير', icon: BarChart3, activeColor: '#38bdf8', count: 0 },
    ...(staffUser.place_id ? [{ key: 'reservations' as StaffTab, label: 'الحجوزات', icon: CalendarDays, activeColor: VIOLET, count: pendingReservations.length }] : []),
  ]

  /* ─── MAIN UI ─── */
  return (
    <div className="min-h-[100dvh]" dir="rtl" style={{ background: '#080808' }}>
      <Toaster position="top-center" richColors />

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <DevBar />

        <div className="flex items-center justify-between px-4 py-3">
          {/* Left actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <LogOut className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => { window.location.href = '/' }}
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <ArrowRight className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Right: name + avatar */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-white leading-tight">{staffUser.name}</p>
              <div className="inline-flex items-center gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: VIOLET }} />
                <span className="text-[10px] font-medium" style={{ color: VIOLET }}>نشط · كاشير</span>
              </div>
            </div>
            <div className="h-9 w-9 rounded-xl overflow-hidden shrink-0" style={{ border: `1px solid ${VIOLET_BORDER}` }}>
              <Image src={systemLogoUrl} alt="logo" width={36} height={36} className="object-cover w-full h-full" unoptimized />
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex border-t" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex-1 flex flex-col items-center py-2.5 gap-0.5" style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-lg font-black" style={{ color: '#f97316' }}>{pendingOrders.length}</span>
            <span className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>معلّق</span>
          </div>
          <div className="flex-1 flex flex-col items-center py-2.5 gap-0.5" style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-lg font-black text-emerald-400">{completedOrders.length}</span>
            <span className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>منفّذ</span>
          </div>
          <div className="flex-1 flex flex-col items-center py-2.5 gap-0.5" style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-lg font-black" style={{ color: VIOLET }}>{todayRevenue.toFixed(0)}</span>
            <span className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>ج.م</span>
          </div>
          <div className="flex-1 flex flex-col items-center py-2.5 gap-0.5">
            <span className="text-lg font-black text-amber-400">{allOrders.length}</span>
            <span className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>طلب</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {tabs.map(tab => {
            const active = staffTab === tab.key
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setStaffTab(tab.key)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors relative"
                style={{ color: active ? tab.activeColor : 'rgba(255,255,255,0.35)' }}>
                {active && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: tab.activeColor }} />
                )}
                <div className="relative">
                  <Icon className="h-4 w-4" />
                  {tab.count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black text-white"
                      style={{ background: tab.activeColor }}>
                      {tab.count > 9 ? '9+' : tab.count}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-semibold">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </header>

      {/* ── CONTENT ── */}
      <div className="p-4 pb-24">
        <ActiveFeaturesBanner tab="staff" title="ميزات الموظفين الذكية النشطة" compact />

        {/* PENDING TAB */}
        {staffTab === 'pending' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => mutateOrders()}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                <RefreshCw className="h-3.5 w-3.5" />
                تحديث
              </button>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{todayDate}</p>
            </div>

            {isLoading ? (
              <div className="text-center py-16">
                <Loader2 className="h-8 w-8 mx-auto animate-spin mb-4" style={{ color: VIOLET }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>جاري تحميل الطلبات...</p>
              </div>
            ) : pendingGroups.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(34,197,94,0.1)' }}>
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="text-base font-bold text-white mb-1">لا توجد طلبات معلقة</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>جميع الطلبات تم تنفيذها ✓</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingGroups.map(group => <OrderCard key={group.userId} group={group} showComplete={true} />)}
                <div className="flex items-center justify-center gap-3 mt-3">
                  <span className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
                    {pendingGroups.length} {pendingGroups.length === 1 ? 'عميل' : 'عملاء'} في الانتظار
                  </span>
                  <span className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
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
              <button
                onClick={() => mutateOrders()}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                <RefreshCw className="h-3.5 w-3.5" />
                تحديث
              </button>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>المنفّذة اليوم</p>
            </div>

            {completedGroups.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <ClipboardList className="h-8 w-8" style={{ color: 'rgba(255,255,255,0.2)' }} />
                </div>
                <p className="text-base font-bold text-white mb-1">لا توجد طلبات منفّذة بعد</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>الطلبات المنفّذة هتظهر هنا</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedGroups.map(group => <OrderCard key={group.userId} group={group} showComplete={false} />)}
                <div className="flex items-center justify-center gap-3 mt-3">
                  <span className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    {completedOrders.length} طلب منفّذ
                  </span>
                  <span className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: VIOLET_DIM, color: VIOLET }}>
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
              <button
                onClick={handlePrintReport}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 2px 12px rgba(37,99,235,0.3)' }}>
                <FileText className="h-3.5 w-3.5" />
                طباعة التقرير
              </button>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{todayDate}</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { value: allOrders.length, label: 'إجمالي الطلبات', color: '#f97316' },
                { value: completedOrders.length, label: 'منفّذ', color: '#22c55e' },
                { value: todayRevenue.toFixed(0), label: 'ج.م إيراد', color: VIOLET },
              ].map(item => (
                <div key={item.label} className="rounded-2xl p-3 text-center" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-2xl font-black" style={{ color: item.color }}>{item.value}</p>
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</p>
                </div>
              ))}
            </div>

            {/* Ratings */}
            {(() => {
              const ratedOrders = allOrders.filter(o => o.rating)
              if (ratedOrders.length === 0) return null
              const avg = ratedOrders.reduce((s, o) => s + (o.rating || 0), 0) / ratedOrders.length
              const dist = [5,4,3,2,1].map(s => ({ star: s, count: ratedOrders.filter(o => o.rating === s).length }))
              return (
                <div className="rounded-2xl p-4 mb-4" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <h3 className="font-bold text-white text-right mb-3 flex items-center justify-end gap-2 text-sm">
                    <Star className="h-4 w-4 text-amber-400" fill="#f59e0b" />
                    تقييمات اليوم
                  </h3>
                  <div className="flex items-center gap-4 mb-2">
                    <div className="text-center">
                      <p className="text-3xl font-black text-amber-400">{avg.toFixed(1)}</p>
                      <div className="flex gap-0.5 justify-center mt-1" dir="ltr">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className="h-3 w-3" fill={s <= Math.round(avg) ? '#f59e0b' : 'transparent'} stroke={s <= Math.round(avg) ? '#f59e0b' : '#3f3f46'} />
                        ))}
                      </div>
                      <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{ratedOrders.length} تقييم</p>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {dist.map(({ star, count }) => (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-xs text-amber-400 w-3">{star}</span>
                          <Star className="h-3 w-3 text-amber-400 shrink-0" fill="#f59e0b" />
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: ratedOrders.length ? `${(count / ratedOrders.length) * 100}%` : '0%' }} />
                          </div>
                          <span className="text-xs w-4 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Drink breakdown */}
            {drinkReport.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <TrendingUp className="h-8 w-8" style={{ color: 'rgba(255,255,255,0.2)' }} />
                </div>
                <p className="text-base font-bold text-white mb-1">لا توجد طلبات اليوم</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>التقرير هيظهر هنا بعد أول طلب</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="font-bold text-white text-right mb-3 flex items-center justify-end gap-2 text-sm">
                  <BarChart3 className="h-4 w-4" style={{ color: '#38bdf8' }} />
                  تفاصيل المشروبات
                </h3>
                {drinkReport.map((item, idx) => {
                  const maxCount = drinkReport[0].count
                  const pct = Math.round((item.count / maxCount) * 100)
                  const rankColors = ['#f59e0b', '#94a3b8', '#cd7c2f']
                  return (
                    <div key={item.drinkName} className="rounded-xl p-3" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {item.totalRevenue > 0 && (
                            <span className="text-sm font-bold" style={{ color: VIOLET }}>{item.totalRevenue.toFixed(0)} ج.م</span>
                          )}
                          <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: VIOLET_DIM, color: VIOLET }}>× {item.count}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{item.drinkName}</span>
                          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
                            style={{ background: idx < 3 ? `${rankColors[idx]}20` : 'rgba(255,255,255,0.07)', color: idx < 3 ? rankColors[idx] : 'rgba(255,255,255,0.4)' }}>
                            {idx + 1}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: idx === 0 ? 'linear-gradient(90deg, #a855f7, #38bdf8)' : VIOLET }} />
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
              <button
                onClick={() => fetchReservations()}
                disabled={isFetchingReservations}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                <RefreshCw className={`h-3.5 w-3.5 ${isFetchingReservations ? 'animate-spin' : ''}`} />
                تحديث
              </button>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarDays className="h-4 w-4" style={{ color: VIOLET }} />
                الحجوزات
              </h2>
            </div>

            {isFetchingReservations ? (
              <div className="text-center py-16">
                <Loader2 className="h-8 w-8 mx-auto animate-spin mb-4" style={{ color: VIOLET }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>جاري تحميل الحجوزات...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pending reservations */}
                {pendingReservations.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: '#f59e0b' }}>
                      <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-amber-400" />
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
                          <div key={r.id} className="rounded-2xl p-4 space-y-3" style={{ background: '#111', border: '1px solid rgba(245,158,11,0.25)' }}>
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                                معلّق
                              </span>
                              <div className="text-right">
                                <p className="font-bold text-white text-sm">{r.customer_name}</p>
                                {r.customer_phone && (
                                  <a href={`tel:${r.customer_phone}`} className="text-xs flex items-center gap-1 justify-end mt-0.5" style={{ color: '#f59e0b' }}>
                                    <Phone className="h-3 w-3" /> {r.customer_phone}
                                  </a>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { icon: Users, label: `${r.party_size} أشخاص` },
                                { icon: CalendarDays, label: dateStr },
                                { icon: Clock, label: timeStr },
                                ...(r.notes ? [{ icon: MessageSquare, label: r.notes }] : []),
                              ].map((item, i) => (
                                <div key={i} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                  <item.icon className="h-3 w-3 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.label}</span>
                                </div>
                              ))}
                            </div>

                            {showTableInput ? (
                              <div className="space-y-2">
                                <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>رقم الطاولة</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="مثال: 5"
                                    value={tableNumbers[r.id] || ''}
                                    onChange={e => setTableNumbers(prev => ({ ...prev, [r.id]: e.target.value }))}
                                    dir="ltr"
                                    autoFocus
                                    className="flex-1 h-9 rounded-xl px-3 text-center font-bold text-white outline-none text-sm"
                                    style={{ background: '#0d0d0d', border: `1px solid ${VIOLET_BORDER}` }}
                                  />
                                  <button
                                    onClick={() => handleConfirmReservation(r)}
                                    disabled={isConfirming}
                                    className="px-4 rounded-xl font-bold text-sm flex items-center gap-1 text-white disabled:opacity-60 transition-all active:scale-95"
                                    style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                                    {isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
                                    تأكيد
                                  </button>
                                  <button
                                    onClick={() => { setTableInputId(null); setTableNumbers(prev => { const n = { ...prev }; delete n[r.id]; return n }) }}
                                    className="px-3 rounded-xl text-sm transition-colors"
                                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                                    ×
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => setTableInputId(r.id)}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white transition-all active:scale-95"
                                  style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 2px 10px rgba(22,163,74,0.3)' }}>
                                  <CalendarCheck className="h-4 w-4" /> تأكيد + تحديد طاولة
                                </button>
                                <button
                                  onClick={() => handleCancelReservation(r)}
                                  className="flex items-center justify-center gap-1 rounded-xl px-4 py-2 text-xs font-semibold transition-all active:scale-95"
                                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
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
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-emerald-400">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      مؤكدة ({confirmedReservations.length})
                    </h3>
                    <div className="space-y-2">
                      {confirmedReservations.map(r => {
                        const dt = new Date(r.reserved_at)
                        const dateStr = dt.toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })
                        const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                        return (
                          <div key={r.id} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                            <div className="flex items-center gap-2 flex-wrap">
                              {r.table_number && (
                                <span className="font-bold text-xs rounded-full px-2 py-0.5 text-emerald-400" style={{ background: 'rgba(34,197,94,0.12)' }}>
                                  🪑 طاولة {r.table_number}
                                </span>
                              )}
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{r.party_size} أشخاص</span>
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{dateStr} · {timeStr}</span>
                            </div>
                            <p className="font-semibold text-white text-sm">{r.customer_name}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {reservations.length === 0 && !isFetchingReservations && (
                  <div className="text-center py-16">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <CalendarDays className="h-8 w-8" style={{ color: 'rgba(255,255,255,0.2)' }} />
                    </div>
                    <p className="text-base font-bold text-white mb-1">لا توجد حجوزات</p>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>الحجوزات هتظهر هنا بعد ما العملاء يحجزوا</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── FLOATING RESERVATIONS BUTTON ── */}
      {staffUser.place_id && (
        <button
          onClick={() => { setShowReservationsModal(true); fetchReservations() }}
          className="fixed bottom-6 left-4 z-40 flex items-center gap-2 rounded-2xl px-4 py-3 font-bold text-sm text-white shadow-2xl transition-all active:scale-95"
          style={{
            background: pendingReservations.length > 0
              ? 'linear-gradient(135deg, #a855f7, #7c3aed)'
              : 'rgba(255,255,255,0.07)',
            border: pendingReservations.length > 0 ? 'none' : '1px solid rgba(255,255,255,0.1)',
            boxShadow: pendingReservations.length > 0 ? '0 4px 24px rgba(168,85,247,0.45)' : '0 4px 16px rgba(0,0,0,0.4)'
          }}>
          <CalendarDays className="h-5 w-5" />
          الحجوزات
          {pendingReservations.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black" style={{ color: VIOLET }}>
              {pendingReservations.length}
            </span>
          )}
        </button>
      )}

      {/* ── RESERVATIONS MODAL ── */}
      {showReservationsModal && (
        <div className="fixed inset-0 z-50 flex flex-col" dir="rtl">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowReservationsModal(false)} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col max-h-[88vh]"
            style={{ background: '#0f0f0f', border: `1px solid ${VIOLET_BORDER}`, borderBottom: 'none' }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
            </div>

            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={() => { setShowReservationsModal(false); fetchReservations() }}
                className="p-1.5 rounded-full transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <RefreshCw className={`h-4 w-4 ${isFetchingReservations ? 'animate-spin' : ''}`} />
              </button>
              <h2 className="font-bold text-white flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4" style={{ color: VIOLET }} />
                الحجوزات
                {pendingReservations.length > 0 && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-black text-white" style={{ background: VIOLET }}>
                    {pendingReservations.length} جديد
                  </span>
                )}
              </h2>
              <button onClick={() => setShowReservationsModal(false)}
                className="text-2xl leading-none px-1 transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}>×</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {isFetchingReservations ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin mb-3" style={{ color: VIOLET }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>جاري التحميل...</p>
                </div>
              ) : reservations.length === 0 ? (
                <div className="text-center py-16">
                  <CalendarDays className="h-12 w-12 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <p className="font-bold text-white mb-1">لا توجد حجوزات</p>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>الحجوزات هتظهر هنا</p>
                </div>
              ) : (
                <>
                  {pendingReservations.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
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
                            <div key={r.id} className="rounded-2xl p-4 space-y-3" style={{ background: '#181818', border: '1px solid rgba(245,158,11,0.2)' }}>
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>معلّق</span>
                                <div className="text-right">
                                  <p className="font-bold text-white text-sm">{r.customer_name}</p>
                                  {r.customer_phone && (
                                    <a href={`tel:${r.customer_phone}`} className="text-xs flex items-center gap-1 justify-end mt-0.5" style={{ color: '#f59e0b' }}>
                                      <Phone className="h-3 w-3" /> {r.customer_phone}
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { icon: Users, label: `${r.party_size} أشخاص` },
                                  { icon: CalendarDays, label: dateStr },
                                  { icon: Clock, label: timeStr },
                                  ...(r.notes ? [{ icon: MessageSquare, label: r.notes }] : []),
                                ].map((item, i) => (
                                  <div key={i} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                    <item.icon className="h-3 w-3 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.label}</span>
                                  </div>
                                ))}
                              </div>
                              {showTableInput ? (
                                <div className="space-y-2">
                                  <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>رقم الطاولة</label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      placeholder="مثال: 5"
                                      value={tableNumbers[r.id] || ''}
                                      onChange={e => setTableNumbers(prev => ({ ...prev, [r.id]: e.target.value }))}
                                      dir="ltr"
                                      autoFocus
                                      className="flex-1 h-9 rounded-xl px-3 text-center font-bold text-white outline-none text-sm"
                                      style={{ background: '#0d0d0d', border: `1px solid ${VIOLET_BORDER}` }}
                                    />
                                    <button
                                      onClick={() => handleConfirmReservation(r)}
                                      disabled={isConfirming}
                                      className="px-4 rounded-xl font-bold text-sm flex items-center gap-1 text-white disabled:opacity-60 transition-all active:scale-95"
                                      style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                                      {isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
                                      تأكيد
                                    </button>
                                    <button
                                      onClick={() => { setTableInputId(null); setTableNumbers(prev => { const n = { ...prev }; delete n[r.id]; return n }) }}
                                      className="px-3 rounded-xl text-sm"
                                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setTableInputId(r.id)}
                                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white transition-all active:scale-95"
                                    style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 2px 10px rgba(22,163,74,0.3)' }}>
                                    <CalendarCheck className="h-4 w-4" /> تأكيد + تحديد طاولة
                                  </button>
                                  <button
                                    onClick={() => handleCancelReservation(r)}
                                    className="flex items-center justify-center gap-1 rounded-xl px-4 py-2 text-xs font-semibold transition-all active:scale-95"
                                    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
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

                  {confirmedReservations.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-emerald-400">
                        <CalendarCheck className="h-3.5 w-3.5" />
                        مؤكدة ({confirmedReservations.length})
                      </h3>
                      <div className="space-y-2">
                        {confirmedReservations.map(r => {
                          const dt = new Date(r.reserved_at)
                          const dateStr = dt.toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })
                          const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                          return (
                            <div key={r.id} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                              <div className="flex items-center gap-2 flex-wrap">
                                {r.table_number && (
                                  <span className="font-bold text-xs rounded-full px-2 py-0.5 text-emerald-400" style={{ background: 'rgba(34,197,94,0.12)' }}>
                                    🪑 طاولة {r.table_number}
                                  </span>
                                )}
                                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{r.party_size} أشخاص</span>
                                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{dateStr} · {timeStr}</span>
                              </div>
                              <p className="font-semibold text-white text-sm">{r.customer_name}</p>
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
