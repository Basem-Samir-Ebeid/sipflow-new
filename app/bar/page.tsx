'use client'

import { useState, useEffect, useRef } from 'react'
import { OrderWithDetails } from '@/lib/types'
import useSWR from 'swr'
import {
  LogOut, Clock, CheckCircle, Loader2, RefreshCw,
  ClipboardList, MessageSquare, BarChart3, FileText, TrendingUp, ArrowRight, Coffee, Flame, Timer, ClipboardCheck, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
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
  customerPhone?: string
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

export default function BarPage() {
  const [mounted, setMounted] = useState(false)
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [completingUserId, setCompletingUserId] = useState<string | null>(null)
  const [staffTab, setStaffTab] = useState<StaffTab>('pending')
  const previousOrderCount = useRef<number>(0)
  const [alarmActive, setAlarmActive] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const triggerAlarm = () => {
    if (alarmActive) return
    setAlarmActive(true)
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/order.wav')
        audioRef.current.loop = true
      }
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    } catch {}
  }

  const stopAlarm = () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    } catch {}
    setAlarmActive(false)
  }

  useEffect(() => {
    const savedStaff = localStorage.getItem('bar_user')
    if (savedStaff) {
      try { setStaffUser(JSON.parse(savedStaff)) } catch { localStorage.removeItem('bar_user') }
    }
    setMounted(true)
  }, [])

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
    { refreshInterval: 3000 }
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
        
        // Use customer_name if available, otherwise fall back to table number or user name
        const groupKey = customerName 
          ? `customer_${customerName}_${tableStr || 'notab'}`
          : (isShared && tableStr ? `table_${tableStr}` : (order.user_id || 'unknown'))
        
        if (!acc[groupKey]) {
          // Build the display name - prioritize customer_name + table_number from order input
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
            orders: [],
            totalPrice: 0,
            earliestTime: order.created_at,
          }
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
    if (pendingOrders.length > previousOrderCount.current && previousOrderCount.current > 0) {
      triggerAlarm()
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
      localStorage.setItem('bar_user', JSON.stringify(data))
      toast.success(`أهلاً ${data.name}!`)
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
        <div className="w-8 h-8 border-2 border-sky-500/40 border-t-sky-500 rounded-full animate-spin" />
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
                <div className="h-20 w-20 rounded-2xl overflow-hidden border border-sky-500/30 shadow-lg shadow-sky-500/15">
                  <Image src="/images/sipflow-logo.jpg" alt="SîpFlõw" width={80} height={80} className="object-cover w-full h-full" />
                </div>
                <div className="absolute -bottom-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full text-sm"
                  style={{ background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', boxShadow: '0 0 10px rgba(56,189,248,0.5)' }}>
                  <Coffee className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2 text-xs font-semibold"
                style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', color: '#7dd3fc' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                بوابة البار
              </div>
              <h1 className="text-xl font-bold text-white">SîpFlõw · بار</h1>
              <p className="text-xs text-zinc-500 mt-1">إدارة الطلبات والمشروبات</p>
            </div>
            <div className="rounded-2xl p-5 space-y-4" style={{ background: '#141414', border: '1px solid rgba(56,189,248,0.2)' }}>
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 block">اسم المستخدم</label>
                <Input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="username" dir="ltr"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-sky-500/40 focus-visible:border-sky-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 block">كلمة المرور</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" dir="ltr"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-sky-500/40 focus-visible:border-sky-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
              </div>
              <button onClick={handleLogin} disabled={isLoggingIn}
                className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                style={{ background: isLoggingIn ? 'rgba(56,189,248,0.3)' : 'linear-gradient(135deg, #38bdf8, #0ea5e9)', color: '#fff', boxShadow: '0 2px 14px rgba(56,189,248,0.3)' }}>
                {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coffee className="h-4 w-4" />}
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
        <div className="flex items-center gap-2 text-sky-400">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">{formatTime(group.earliestTime)}</span>
        </div>
        <div className="text-right">
          <p className="font-bold" style={{ color: isVip ? '#f59e0b' : 'var(--foreground)' }}>
            {group.orders[0]?.customer_name && group.tableNumber
              ? `${group.orders[0].customer_name} - طاولة ${group.tableNumber}`
              : group.orders[0]?.customer_name
                ? group.orders[0].customer_name
                : group.tableNumber
                  ? `طاولة ${group.tableNumber}`
                  : group.userName}
          </p>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        {group.orders.map((order, idx) => (
          <div key={order.id} className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-bold text-sky-400">{idx + 1}</span>
                <span className="font-semibold text-foreground">{order.drink?.name}</span>
                {order.quantity > 1 && (
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-400">× {order.quantity}</span>
                )}
              </div>
              {order.notes && (
                <div className="mt-1 flex items-start gap-1.5 pr-8">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                  <span className="text-xs text-muted-foreground italic">{order.notes}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3"
        style={{ borderColor: isVip ? 'rgba(245,158,11,0.3)' : 'var(--border)' }}>
        {showComplete ? (
          <Button onClick={() => markUserOrdersCompleted(group)} disabled={completingUserId === group.userId}
            className="flex-1 h-10 font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', color: '#fff' }}
            size="lg">
            {completingUserId === group.userId
              ? <Loader2 className="h-5 w-5 animate-spin ml-2" />
              : <CheckCircle className="h-5 w-5 ml-2" />}
            تم التجهيز
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-sky-500">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold">تم</span>
          </div>
        )}
      </div>
    </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">

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

      <header className={`sticky z-50 bg-card border-b border-border ${alarmActive ? 'top-14' : 'top-0'}`}>
        <DevBar />
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { window.location.href = '/' }} className="text-muted-foreground hover:text-sky-400">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div>
              <h1 className="font-bold text-foreground">{staffUser.name}</h1>
              <p className="text-xs text-sky-400/70">البار</p>
            </div>
            <div className="h-9 w-9 rounded-full overflow-hidden border border-sky-500/30 shrink-0">
              <Image src="/images/sipflow-logo.jpg" alt="logo" width={36} height={36} className="object-cover w-full h-full" />
            </div>
          </div>
        </div>

        <div className="flex border-t border-border">
          <button
            onClick={() => setStaffTab('pending')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors border-b-2 ${
              staffTab === 'pending' ? 'border-sky-500 text-sky-500 bg-sky-500/5' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            الطلبات
            {pendingOrders.length > 0 && (
              <span className="bg-sky-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {pendingOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setStaffTab('done')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors border-b-2 ${
              staffTab === 'done' ? 'border-green-500 text-green-500 bg-green-500/5' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            تم التجهيز
            {completedOrders.length > 0 && (
              <span className="bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {completedOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setStaffTab('count')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors border-b-2 ${
              staffTab === 'count' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            حصر
          </button>
          <button
            onClick={() => setStaffTab('report')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors border-b-2 ${
              staffTab === 'report' ? 'border-sky-500 text-sky-500 bg-sky-500/5' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            تقرير
          </button>
        </div>
      </header>

      <div className="p-4">

        {staffTab === 'pending' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="sm" onClick={() => mutateOrders()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                تحديث
              </Button>
              <p className="text-sm text-muted-foreground">{todayDate}</p>
            </div>

            {/* Hot Items - Most requested drinks right now */}
            {pendingOrders.length > 0 && (() => {
              const drinkCounts: Record<string, { name: string; count: number }> = {}
              pendingOrders.forEach(o => {
                const name = o.drink?.name || 'غير معروف'
                if (!drinkCounts[name]) drinkCounts[name] = { name, count: 0 }
                drinkCounts[name].count += o.quantity || 1
              })
              const topDrinks = Object.values(drinkCounts).sort((a, b) => b.count - a.count).slice(0, 3)
              
              return (
                <div className="mb-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-bold text-amber-400">الأكثر طلبًا الآن</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topDrinks.map((drink, idx) => (
                      <div 
                        key={drink.name}
                        className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                        style={{ 
                          background: idx === 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                          border: idx === 0 ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.1)'
                        }}
                      >
                        <span className={`text-xs font-bold ${idx === 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                          {idx === 0 ? '1' : idx + 1}
                        </span>
                        <span className={`text-sm font-medium ${idx === 0 ? 'text-amber-300' : 'text-foreground'}`}>
                          {drink.name}
                        </span>
                        <span className="text-xs font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-full">
                          x{drink.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 mx-auto text-sky-500 animate-spin mb-4" />
                <p className="text-muted-foreground">جاري تحميل الطلبات...</p>
              </div>
            ) : pendingGroups.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle className="h-14 w-14 mx-auto text-sky-500 mb-4" />
                <p className="text-lg font-bold text-foreground mb-1">لا توجد طلبات معلقة</p>
                <p className="text-muted-foreground text-sm">جميع الطلبات تم تجهيزها ✓</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingGroups.map(group => <OrderCard key={group.userId} group={group} showComplete={true} />)}
                <div className="flex items-center justify-center gap-3 mt-2">
                  <span className="bg-sky-500/10 text-sky-500 px-4 py-2 rounded-full text-sm font-medium">
                    {pendingGroups.length} {pendingGroups.length === 1 ? 'طاولة' : 'طاولات'} في الانتظار
                  </span>
                  <span className="bg-muted text-muted-foreground px-4 py-2 rounded-full text-sm font-medium">
                    {pendingOrders.length} صنف
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {staffTab === 'done' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="sm" onClick={() => mutateOrders()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                تحديث
              </Button>
              <p className="text-sm text-muted-foreground">المجهّزة اليوم</p>
            </div>

            {completedGroups.length === 0 ? (
              <div className="text-center py-16">
                <ClipboardList className="h-14 w-14 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-lg font-bold text-foreground mb-1">لا توجد طلبات مجهّزة بعد</p>
                <p className="text-muted-foreground text-sm">الطلبات المجهّزة هتظهر هنا</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedGroups.map(group => <OrderCard key={group.userId} group={group} showComplete={false} />)}
                <div className="flex items-center justify-center gap-3 mt-2">
                  <span className="bg-green-500/10 text-green-600 px-4 py-2 rounded-full text-sm font-medium">
                    {completedOrders.length} طلب تم تجهيزه
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {staffTab === 'count' && (() => {
          // حصر الأصناف المسلّمة (ready أو completed)
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
            const win = window.open('', '_blank')
            if (win) {
              win.document.write(`<pre dir="rtl" style="font-family:monospace;font-size:14px;padding:20px">${lines}</pre>`)
              win.document.close()
              win.print()
            }
          }

          return (
            <>
              <div className="flex items-center justify-between mb-4">
                <Button onClick={handlePrintCount} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white" size="sm">
                  <FileText className="h-4 w-4" />
                  طباعة الحصر
                </Button>
                <p className="text-sm text-muted-foreground font-medium">{todayDate}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-card border border-amber-500/30 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-amber-500">{totalDelivered}</p>
                  <p className="text-xs text-muted-foreground mt-1">إجمالي الأصناف المسلّمة</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-sky-400">{deliveredList.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">أنواع مختلفة</p>
                </div>
              </div>

              {deliveredList.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardCheck className="h-14 w-14 mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-lg font-bold text-foreground mb-1">لا توجد أصناف مسلّمة بعد</p>
                  <p className="text-muted-foreground text-sm">الحصر هيظهر هنا بعد تسليم أول طلب</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="font-bold text-foreground text-right mb-3 flex items-center justify-end gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    حصر الأصناف المسلّمة
                  </h3>
                  {deliveredList.map((item, idx) => {
                    const maxCount = deliveredList[0].count
                    const pct = Math.round((item.count / maxCount) * 100)
                    return (
                      <div key={item.drinkName} className="bg-card border border-border rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-left">
                            <span className="bg-amber-500/10 text-amber-500 text-xs font-bold rounded-full px-2 py-0.5">× {item.count}</span>
                          </div>
                          <div className="flex items-center gap-2 text-right">
                            <span className="font-semibold text-foreground">{item.drinkName}</span>
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                              {idx + 1}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #f59e0b, #d97706)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )
        })()}

        {staffTab === 'report' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button onClick={handlePrintReport} className="gap-2 bg-sky-600 hover:bg-sky-700 text-white" size="sm">
                <FileText className="h-4 w-4" />
                طباعة التقرير
              </Button>
              <p className="text-sm text-muted-foreground font-medium">{todayDate}</p>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-sky-400">{allOrders.length}</p>
                <p className="text-xs text-muted-foreground mt-1">إجمالي الطلبات</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-green-600">{completedOrders.length}</p>
                <p className="text-xs text-muted-foreground mt-1">تم تجهيزه</p>
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
                          <span className="bg-sky-500/10 text-sky-400 text-xs font-bold rounded-full px-2 py-0.5">× {item.count}</span>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <span className="font-semibold text-foreground">{item.drinkName}</span>
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                            {idx + 1}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)' }} />
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
