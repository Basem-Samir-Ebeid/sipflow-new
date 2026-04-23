'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { OrderWithDetails } from '@/lib/types'
import useSWR from 'swr'
import {
  LogOut, Clock, CheckCircle, Loader2, RefreshCw,
  ClipboardList, MessageSquare, BarChart3, FileText, TrendingUp, ArrowRight, Coffee, Flame, ClipboardCheck, X, ChevronRight, Zap, Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast, Toaster } from 'sonner'
import Image from 'next/image'
import { printHTML } from '@/lib/print'
import { DevBar } from '@/components/dev-bar'
import { useSystemLogo } from '@/hooks/use-system-logo'

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
  customerPhone?: string
  employee?: {
    id: string
    name: string
    email: string
    avatar_url: string | null
    department: string | null
    title: string | null
  } | null
  orders: OrderWithDetails[]
  totalPrice: number
  earliestTime: string
}

interface DrinkReportItem {
  drinkName: string
  count: number
  totalRevenue: number
}

type StaffTab = 'pending' | 'done' | 'count' | 'report'

export default function BarPage() {
  const systemLogoUrl = useSystemLogo()
  const [mounted, setMounted] = useState(false)
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [completingUserId, setCompletingUserId] = useState<string | null>(null)
  const [staffTab, setStaffTab] = useState<StaffTab>('pending')
  const previousOrderCount = useRef<number>(-1)
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

  useEffect(() => {
    const savedStaff = localStorage.getItem('bar_user')
    if (savedStaff) {
      try { setStaffUser(JSON.parse(savedStaff)) } catch { localStorage.removeItem('bar_user') }
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (staffUser) {
      triggerAlarm()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffUser?.id])

  const { data: allOrders = [], mutate: mutateOrders, isLoading } = useSWR<OrderWithDetails[]>(
    staffUser ? `bar-all-orders-${staffUser.place_id || 'global'}` : null,
    async () => {
      const placeParam = staffUser?.place_id ? `&place_id=${staffUser.place_id}` : ''
      const sessionRes = await fetch(`/api/sessions?readonly=true${placeParam}`)
      const session = await sessionRes.json()
      if (!session?.id) return []
      const res = await fetch(`/api/orders?session_id=${session.id}`)
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    { refreshInterval: 2000 }
  )

  const pendingOrders = allOrders.filter(o => o.status === 'pending' || o.status === 'preparing' || !o.status)
  const completedOrders = allOrders.filter(o => o.status === 'ready' || o.status === 'completed')

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
            customerPhone: order.customer_phone || undefined,
            employee: order.employee || null,
            orders: [],
            totalPrice: 0,
            earliestTime: order.created_at,
          }
        }
        if (order.employee && !acc[groupKey].employee) {
          acc[groupKey].employee = order.employee
        }
        if (order.customer_phone && !acc[groupKey].customerPhone) {
          acc[groupKey].customerPhone = order.customer_phone
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
    if (previousOrderCount.current === -1) {
      previousOrderCount.current = pendingOrders.length
      return
    }
    if (pendingOrders.length > previousOrderCount.current) {
      triggerAlarm()
      toast.success('طلب جديد وصل!')
    }
    previousOrderCount.current = pendingOrders.length
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      localStorage.setItem('bar_user', JSON.stringify(data))
      toast.success(`أهلاً ${data.name}!`)
      triggerAlarm()
    } catch { toast.error('حدث خطأ، حاول مرة أخرى') }
    finally { setIsLoggingIn(false) }
  }

  const handleLogout = () => {
    setStaffUser(null)
    localStorage.removeItem('bar_user')
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
            body: JSON.stringify({ status: 'ready' })
          })
        )
      )
      toast.success(`تم تجهيز طلب ${group.userName}! — في انتظار الويتر 🛎️`)
      mutateOrders()
    } catch { toast.error('حدث خطأ، حاول مرة أخرى') }
    finally { setCompletingUserId(null) }
  }

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })

  const handlePrintReport = () => {
    const lines = [
      `تقرير البار - يوم ${todayDate}`,
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
    printHTML(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير البار</title></head><body><pre dir="rtl" style="font-family:monospace;font-size:14px;padding:20px">${lines}</pre></body></html>`)
  }

  if (!mounted) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: '#080808' }}>
        <Toaster position="top-center" richColors />
        <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!staffUser) {
    return (
      <div className="min-h-[100dvh] flex flex-col" dir="rtl" style={{ background: '#080808' }}>
        <Toaster position="top-center" richColors />
        <DevBar />
        <div className="px-4 pt-4">
          <button onClick={() => { window.location.href = '/' }}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            <ArrowRight className="h-3.5 w-3.5" />
            الرئيسية
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-[320px]">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="relative mx-auto mb-5 w-fit">
                <div className="h-[72px] w-[72px] rounded-2xl overflow-hidden shadow-2xl" style={{ boxShadow: '0 0 0 1px rgba(56,189,248,0.2), 0 0 30px rgba(56,189,248,0.1)' }}>
                  <Image src={systemLogoUrl} alt="SîpFlõw" width={72} height={72} className="object-cover w-full h-full" unoptimized />
                </div>
                <div className="absolute -bottom-2 -left-2 h-6 w-6 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #38bdf8, #0284c7)', boxShadow: '0 0 12px rgba(56,189,248,0.6)' }}>
                  <Coffee className="h-3 w-3 text-white" />
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-3 text-[11px] font-semibold"
                style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#7dd3fc' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                بوابة البار
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">SîpFlõw</h1>
              <p className="text-xs text-zinc-500 mt-1">نظام إدارة البار</p>
            </div>

            {/* Form */}
            <div className="rounded-3xl p-5 space-y-4" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">اسم المستخدم</label>
                <Input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم" dir="rtl"
                  className="h-11 rounded-xl text-sm"
                  style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">كلمة المرور</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" dir="ltr"
                  className="h-11 rounded-xl text-sm"
                  style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
              </div>
              <button onClick={handleLogin} disabled={isLoggingIn}
                className="w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
                style={{ background: 'linear-gradient(135deg, #38bdf8, #0284c7)', color: '#fff', boxShadow: '0 4px 20px rgba(56,189,248,0.35)' }}>
                {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {isLoggingIn ? 'جاري الدخول...' : 'دخول البار'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const OrderCard = ({ group, showComplete }: { group: UserOrderGroup; showComplete: boolean }) => {
    const isVip = group.orders.some(o => o.notes?.includes('مطور'))
    const totalItems = group.orders.reduce((s, o) => s + (o.quantity || 1), 0)
    return (
      <div className={`relative rounded-2xl overflow-hidden transition-all${isVip ? ' ring-2 ring-amber-500/60' : ''}`}
        style={{
          background: group.employee
            ? 'linear-gradient(160deg, #0f1729 0%, #0b1220 55%, #0a0f1c 100%)'
            : 'linear-gradient(160deg, #161616 0%, #111111 100%)',
          border: isVip
            ? '1px solid rgba(245,158,11,0.4)'
            : group.employee
              ? '1px solid rgba(59,130,246,0.22)'
              : '1px solid rgba(255,255,255,0.06)',
          boxShadow: isVip
            ? '0 0 28px rgba(245,158,11,0.18)'
            : group.employee
              ? '0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.05) inset'
              : '0 4px 18px rgba(0,0,0,0.4)'
        }}>

        {/* Accent strip */}
        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: isVip
              ? 'linear-gradient(90deg, transparent, #f59e0b, transparent)'
              : group.employee
                ? 'linear-gradient(90deg, transparent, #3b82f6, #60a5fa, #3b82f6, transparent)'
                : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)'
          }} />

        {isVip && (
          <div className="flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold"
            style={{ background: 'linear-gradient(90deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1), rgba(245,158,11,0.2))' }}>
            <span>👑</span>
            <span className="text-amber-400 tracking-wide">VIP مطور</span>
          </div>
        )}

        {/* Card Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
              style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)' }}>
              <Clock className="h-3 w-3 text-sky-400" />
              <span className="text-[11px] font-bold text-sky-300 tabular-nums tracking-tight">{formatTime(group.earliestTime)}</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg px-2 py-1.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Package className="h-3 w-3 text-zinc-400" />
              <span className="text-[11px] text-zinc-300 font-bold tabular-nums">{totalItems}</span>
            </div>
          </div>
          <div className="text-right flex items-center gap-3 min-w-0 flex-1 justify-end">
            {group.employee ? (
              <>
                <div className="text-right min-w-0">
                  <p className="font-bold text-[15px] truncate tracking-tight" style={{ color: '#e0eaff' }}>{group.employee.name}</p>
                  {(group.employee.title || group.employee.department) && (
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(147,197,253,0.75)', letterSpacing: '0.01em' }}>
                      {[group.employee.title, group.employee.department].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>
                <div className="relative shrink-0">
                  <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-base"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(96,165,250,0.15))',
                      boxShadow: '0 0 0 2px #0a0f1c, 0 0 0 3.5px rgba(59,130,246,0.55), 0 4px 14px rgba(59,130,246,0.25)'
                    }}>
                    {group.employee.avatar_url
                      ? <img src={group.employee.avatar_url} alt={group.employee.name} className="h-full w-full object-cover" />
                      : <span>👤</span>}
                  </div>
                  <div className="absolute -bottom-0.5 -left-0.5 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                    style={{ background: '#0a0f1c', border: '1.5px solid #3b82f6' }}>
                    <span className="text-[8px]">🏢</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="font-bold text-sm truncate" style={{ color: isVip ? '#fbbf24' : '#f4f4f5' }}>
                {group.orders[0]?.customer_name && group.tableNumber
                  ? `${group.orders[0].customer_name} - طاولة ${group.tableNumber}`
                  : group.orders[0]?.customer_name
                    ? group.orders[0].customer_name
                    : group.tableNumber
                      ? `طاولة ${group.tableNumber}`
                      : group.userName}
              </p>
            )}
          </div>
        </div>

        {/* Employee details ribbon for company orders */}
        {group.employee && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-lg flex items-center justify-between gap-2"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: '#93c5fd' }}>
              <span className="text-[11px]">🏢</span> موظف شركة
            </span>
            <span className="text-[11px] truncate font-medium" style={{ color: 'rgba(224,234,255,0.7)' }}>{group.employee.email}</span>
          </div>
        )}

        {/* Divider */}
        <div className="mx-4 h-px" style={{ background: group.employee ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.06)' }} />

        {/* Order Items */}
        <div className="px-4 py-3.5 space-y-2">
          {group.orders.map((order, idx) => (
            <div key={order.id} className="flex items-start gap-3 rounded-lg px-2.5 py-2 transition-colors"
              style={{ background: 'rgba(255,255,255,0.025)' }}>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  {order.quantity > 1 && (
                    <span className="rounded-md px-2 py-0.5 text-[11px] font-black tabular-nums"
                      style={{ background: 'rgba(56,189,248,0.15)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.3)' }}>
                      × {order.quantity}
                    </span>
                  )}
                  <span className="font-semibold text-sm text-white">{order.drink?.name}</span>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black tabular-nums"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#d4d4d8', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {idx + 1}
                  </span>
                </div>
                {order.notes && (
                  <div className="mt-1.5 flex items-center justify-end gap-1.5">
                    <span className="text-xs italic" style={{ color: 'rgba(161,161,170,0.85)' }}>{order.notes}</span>
                    <MessageSquare className="h-3 w-3 shrink-0 text-zinc-600" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action */}
        <div className="px-4 pb-4">
          {showComplete ? (
            <button
              onClick={() => markUserOrdersCompleted(group)}
              disabled={completingUserId === group.userId}
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 relative overflow-hidden group"
              style={{
                background: completingUserId === group.userId
                  ? 'rgba(56,189,248,0.3)'
                  : group.employee
                    ? 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)'
                    : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                color: '#fff',
                boxShadow: group.employee
                  ? '0 4px 20px rgba(59,130,246,0.4), 0 0 0 1px rgba(255,255,255,0.08) inset'
                  : '0 4px 18px rgba(56,189,248,0.32), 0 0 0 1px rgba(255,255,255,0.08) inset'
              }}>
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), transparent)' }} />
              {completingUserId === group.userId
                ? <Loader2 className="h-4 w-4 animate-spin relative" />
                : <CheckCircle className="h-4 w-4 relative" />}
              <span className="relative tracking-wide">تم التجهيز</span>
            </button>
          ) : (
            <div className="w-full h-11 rounded-xl flex items-center justify-center gap-2"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)' }}>
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span className="font-bold text-sm text-emerald-400 tracking-wide">تم التجهيز</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh]" dir="rtl" style={{ background: '#080808' }}>
      <Toaster position="top-center" richColors />

      {/* Alarm Banner */}
      {alarmActive && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3"
          style={{ background: 'linear-gradient(90deg, #450a0a, #7f1d1d, #450a0a)', borderBottom: '2px solid #ef4444', boxShadow: '0 4px 24px rgba(239,68,68,0.4)' }}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full flex items-center justify-center animate-bounce" style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}>
              <span className="text-base">🔔</span>
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
      <header className={`sticky z-50 ${alarmActive ? 'top-[52px]' : 'top-0'}`} style={{ background: '#0e0e0e', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <DevBar />

        {/* Top Bar */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => { window.location.href = '/' }}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <ArrowRight className="h-4 w-4 text-zinc-500" />
            </button>
            <button onClick={handleLogout}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all hover:bg-red-500/10"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <LogOut className="h-4 w-4 text-zinc-500 hover:text-red-400" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-bold text-sm text-white">{staffUser.name}</p>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] text-emerald-500 font-medium">نشط · البار</span>
              </div>
            </div>
            <div className="h-9 w-9 rounded-xl overflow-hidden shrink-0" style={{ border: '1px solid rgba(56,189,248,0.25)', boxShadow: '0 0 12px rgba(56,189,248,0.15)' }}>
              <Image src={systemLogoUrl} alt="logo" width={36} height={36} className="object-cover w-full h-full" unoptimized />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-2 pb-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {([
            { key: 'pending', label: 'الطلبات', icon: ClipboardList, badge: pendingOrders.length, color: 'sky' },
            { key: 'done', label: 'تم التجهيز', icon: CheckCircle, badge: completedOrders.length, color: 'emerald' },
            { key: 'count', label: 'حصر', icon: ClipboardCheck, badge: 0, color: 'amber' },
            { key: 'report', label: 'تقرير', icon: BarChart3, badge: 0, color: 'violet' },
          ] as const).map(tab => {
            const active = staffTab === tab.key
            const colors: Record<string, { active: string; badge: string; border: string }> = {
              sky:     { active: '#38bdf8', badge: '#0284c7', border: 'rgba(56,189,248,0.5)' },
              emerald: { active: '#34d399', badge: '#059669', border: 'rgba(52,211,153,0.5)' },
              amber:   { active: '#fbbf24', badge: '#d97706', border: 'rgba(251,191,36,0.5)' },
              violet:  { active: '#a78bfa', badge: '#7c3aed', border: 'rgba(167,139,250,0.5)' },
            }
            const c = colors[tab.color]
            return (
              <button key={tab.key} onClick={() => setStaffTab(tab.key as StaffTab)}
                className="flex-1 flex flex-col items-center gap-1 pt-2.5 pb-2 transition-all relative"
                style={{ borderBottom: active ? `2px solid ${c.border}` : '2px solid transparent' }}>
                <div className="flex items-center gap-1">
                  <tab.icon className="h-3.5 w-3.5" style={{ color: active ? c.active : '#52525b' }} />
                  {tab.badge > 0 && (
                    <span className="text-[10px] font-black text-white rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center"
                      style={{ background: c.badge }}>
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold" style={{ color: active ? c.active : '#52525b' }}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </header>

      {/* Content */}
      <div className="p-4 pb-8 space-y-4">

        {/* ── Pending Tab ── */}
        {staffTab === 'pending' && (
          <>
            {/* Date + Refresh Row */}
            <div className="flex items-center justify-between">
              <button onClick={() => mutateOrders()}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#a1a1aa' }}>
                <RefreshCw className="h-3.5 w-3.5" />
                تحديث
              </button>
              <p className="text-xs text-zinc-600 font-medium">{todayDate}</p>
            </div>

            {/* Hot Drinks */}
            {pendingOrders.length > 0 && (() => {
              const drinkCounts: Record<string, { name: string; count: number }> = {}
              pendingOrders.forEach(o => {
                const name = o.drink?.name || 'غير معروف'
                if (!drinkCounts[name]) drinkCounts[name] = { name, count: 0 }
                drinkCounts[name].count += o.quantity || 1
              })
              const topDrinks = Object.values(drinkCounts).sort((a, b) => b.count - a.count).slice(0, 4)
              return (
                <div className="rounded-2xl p-3" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-amber-400 tracking-wide uppercase">الأكثر طلبًا الآن</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topDrinks.map((drink, idx) => (
                      <div key={drink.name} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5"
                        style={{
                          background: idx === 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                          border: idx === 0 ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.06)'
                        }}>
                        <span className="text-xs font-black" style={{ color: idx === 0 ? '#fbbf24' : '#52525b' }}>x{drink.count}</span>
                        <span className="text-xs font-semibold" style={{ color: idx === 0 ? '#fde68a' : '#d4d4d8' }}>{drink.name}</span>
                        {idx === 0 && <span className="text-xs">🔥</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Orders */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-7 w-7 text-sky-500 animate-spin" />
                <p className="text-sm text-zinc-600">جاري تحميل الطلبات...</p>
              </div>
            ) : pendingGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)' }}>
                  <CheckCircle className="h-8 w-8 text-sky-500/60" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-base mb-1">لا توجد طلبات معلقة</p>
                  <p className="text-xs text-zinc-600">جميع الطلبات تم تجهيزها ✓</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingGroups.map(group => <OrderCard key={group.userId} group={group} showComplete={true} />)}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <span className="text-xs font-semibold rounded-full px-3 py-1.5" style={{ background: 'rgba(56,189,248,0.08)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.15)' }}>
                    {pendingGroups.length} {pendingGroups.length === 1 ? 'طاولة' : 'طاولات'} في الانتظار
                  </span>
                  <span className="text-xs font-semibold rounded-full px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.04)', color: '#71717a', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {pendingOrders.length} صنف
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Done Tab ── */}
        {staffTab === 'done' && (
          <>
            <div className="flex items-center justify-between">
              <button onClick={() => mutateOrders()}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#a1a1aa' }}>
                <RefreshCw className="h-3.5 w-3.5" />
                تحديث
              </button>
              <p className="text-xs text-zinc-600 font-medium">المجهّزة اليوم</p>
            </div>

            {completedGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <ClipboardList className="h-8 w-8 text-zinc-700" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-base mb-1">لا توجد طلبات مجهّزة بعد</p>
                  <p className="text-xs text-zinc-600">الطلبات المجهّزة هتظهر هنا</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {completedGroups.map(group => <OrderCard key={group.userId} group={group} showComplete={false} />)}
                <div className="flex items-center justify-center pt-1">
                  <span className="text-xs font-semibold rounded-full px-3 py-1.5" style={{ background: 'rgba(34,197,94,0.08)', color: '#34d399', border: '1px solid rgba(34,197,94,0.15)' }}>
                    {completedOrders.length} طلب تم تجهيزه
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Count Tab ── */}
        {staffTab === 'count' && (() => {
          const deliveredDrinks: Record<string, { drinkName: string; count: number }> = {}
          completedOrders.forEach(order => {
            const name = order.drink?.name || 'غير معروف'
            if (!deliveredDrinks[name]) deliveredDrinks[name] = { drinkName: name, count: 0 }
            deliveredDrinks[name].count += order.quantity || 1
          })
          const deliveredList = Object.values(deliveredDrinks).sort((a, b) => b.count - a.count)
          const totalDelivered = deliveredList.reduce((sum, d) => sum + d.count, 0)

          const handlePrintCount = () => {
            const lines = [
              `حصر الأصناف المسلّمة - ${todayDate}`,
              '─'.repeat(40),
              '',
              'الصنف                  | الكمية المسلّمة',
              '─'.repeat(40),
              ...deliveredList.map(d => `${d.drinkName.padEnd(22)} | ${String(d.count).padStart(4)}`),
              '',
              '─'.repeat(40),
              `إجمالي الأصناف المسلّمة: ${totalDelivered}`,
            ].join('\n')
            printHTML(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>حصر البار</title></head><body><pre dir="rtl" style="font-family:monospace;font-size:14px;padding:20px">${lines}</pre></body></html>`)
          }

          return (
            <>
              <div className="flex items-center justify-between">
                <button onClick={handlePrintCount}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all active:scale-95"
                  style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
                  <FileText className="h-3.5 w-3.5" />
                  طباعة الحصر
                </button>
                <p className="text-xs text-zinc-600 font-medium">{todayDate}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-4 text-center" style={{ background: '#111', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <p className="text-3xl font-black text-amber-400">{totalDelivered}</p>
                  <p className="text-[11px] text-zinc-600 mt-1 font-medium">إجمالي الأصناف</p>
                </div>
                <div className="rounded-2xl p-4 text-center" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-3xl font-black text-sky-400">{deliveredList.length}</p>
                  <p className="text-[11px] text-zinc-600 mt-1 font-medium">أنواع مختلفة</p>
                </div>
              </div>

              {deliveredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <ClipboardCheck className="h-8 w-8 text-zinc-700" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-white text-base mb-1">لا توجد أصناف مسلّمة بعد</p>
                    <p className="text-xs text-zinc-600">الحصر هيظهر هنا بعد تسليم أول طلب</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider text-right mb-3">حصر الأصناف المسلّمة</p>
                  {deliveredList.map((item, idx) => {
                    const maxCount = deliveredList[0].count
                    const pct = Math.round((item.count / maxCount) * 100)
                    return (
                      <div key={item.drinkName} className="rounded-2xl p-3.5" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-black rounded-full px-2.5 py-1"
                            style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                            × {item.count}
                          </span>
                          <div className="flex items-center gap-2 text-right">
                            <span className="font-semibold text-sm text-white">{item.drinkName}</span>
                            <span className="h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold"
                              style={{ background: 'rgba(255,255,255,0.06)', color: '#71717a' }}>
                              {idx + 1}
                            </span>
                          </div>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )
        })()}

        {/* ── Report Tab ── */}
        {staffTab === 'report' && (
          <>
            <div className="flex items-center justify-between">
              <button onClick={handlePrintReport}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all active:scale-95"
                style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8' }}>
                <FileText className="h-3.5 w-3.5" />
                طباعة التقرير
              </button>
              <p className="text-xs text-zinc-600 font-medium">{todayDate}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4 text-center" style={{ background: '#111', border: '1px solid rgba(56,189,248,0.2)' }}>
                <p className="text-3xl font-black text-sky-400">{allOrders.length}</p>
                <p className="text-[11px] text-zinc-600 mt-1 font-medium">إجمالي الطلبات</p>
              </div>
              <div className="rounded-2xl p-4 text-center" style={{ background: '#111', border: '1px solid rgba(34,197,94,0.2)' }}>
                <p className="text-3xl font-black text-emerald-400">{completedOrders.length}</p>
                <p className="text-[11px] text-zinc-600 mt-1 font-medium">تم تجهيزه</p>
              </div>
            </div>

            {drinkReport.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <TrendingUp className="h-8 w-8 text-zinc-700" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-base mb-1">لا توجد طلبات اليوم</p>
                  <p className="text-xs text-zinc-600">التقرير هيظهر هنا بعد أول طلب</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider text-right mb-3">تفاصيل المشروبات</p>
                {drinkReport.map((item, idx) => {
                  const maxCount = drinkReport[0].count
                  const pct = Math.round((item.count / maxCount) * 100)
                  return (
                    <div key={item.drinkName} className="rounded-2xl p-3.5" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-black rounded-full px-2.5 py-1"
                          style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}>
                          × {item.count}
                        </span>
                        <div className="flex items-center gap-2 text-right">
                          <span className="font-semibold text-sm text-white">{item.drinkName}</span>
                          <span className="h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold"
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#71717a' }}>
                            {idx + 1}
                          </span>
                        </div>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
