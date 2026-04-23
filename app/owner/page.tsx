'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Store, DollarSign, ShoppingCart, Activity, Wifi, WifiOff, MessageCircle } from 'lucide-react'
import Link from 'next/link'

type PlaceStat = {
  id: string
  name: string
  code: string
  logo_url: string | null
  has_session: boolean
  today: { orders: number; revenue: number; pending: number; ready: number; paid: number; last_order_at: string | null }
  baseline: { avg_orders: number; avg_revenue: number; sample: number }
  trend_pct: number | null
  alerts: { stuck_orders: number }
}

type Dashboard = {
  places: PlaceStat[]
  totals: { revenue: number; orders: number; places_active: number; places_total: number }
  generated_at: string
}

export default function OwnerPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(true)
  const [installable, setInstallable] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/dashboard', { cache: 'no-store' })
      const json = await res.json()
      setData(json)
    } catch {
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30 * 1000)

    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setOnline(navigator.onLine)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onBeforeInstall = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setInstallable(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    return () => {
      clearInterval(t)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [load])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setInstallable(false)
  }

  const totalAlerts = data?.places.reduce((s, p) => s + p.alerts.stuck_orders, 0) ?? 0

  return (
    <div dir="rtl" className="min-h-screen text-white" style={{ background: 'linear-gradient(180deg, #0a0617, #0f0a20 40%, #0a0617)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-30 px-4 py-4 backdrop-blur-xl"
        style={{ background: 'rgba(10,6,23,0.85)', borderBottom: '1px solid rgba(139,92,246,0.2)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="h-10 w-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', boxShadow: '0 8px 24px rgba(139,92,246,0.5)' }}
            >
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black">لوحة المالك</h1>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {online ? <span className="inline-flex items-center gap-1"><Wifi className="h-3 w-3 text-emerald-400" /> متصل — تحديث تلقائي كل 30 ث</span>
                       : <span className="inline-flex items-center gap-1"><WifiOff className="h-3 w-3 text-red-400" /> غير متصل</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/owner/marketing"
              aria-label="تسويق واتساب"
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)' }}
            >
              <MessageCircle className="h-4 w-4" style={{ color: '#86efac' }} />
            </Link>
            <button
              onClick={load}
              disabled={loading}
              aria-label="تحديث"
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} style={{ color: '#a78bfa' }} />
            </button>
          </div>
        </div>

        {/* Totals strip */}
        <div className="grid grid-cols-3 gap-2">
          <StatChip icon={<DollarSign className="h-3.5 w-3.5" />} label="إيراد اليوم" value={data ? `${data.totals.revenue.toLocaleString('en-US')} ج` : '—'} color="#34d399" />
          <StatChip icon={<ShoppingCart className="h-3.5 w-3.5" />} label="طلبات اليوم" value={data ? String(data.totals.orders) : '—'} color="#60a5fa" />
          <StatChip icon={<Store className="h-3.5 w-3.5" />} label="فروع نشطة" value={data ? `${data.totals.places_active}/${data.totals.places_total}` : '—'} color="#a78bfa" />
        </div>

        {totalAlerts > 0 && (
          <div
            className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
          >
            <AlertTriangle className="h-4 w-4" />
            في {totalAlerts} طلب متأخر يحتاج تدخل فوري
          </div>
        )}

        {installable && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full rounded-xl px-3 py-2.5 text-[12px] font-black transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', color: '#fff', boxShadow: '0 8px 24px rgba(139,92,246,0.4)' }}
          >
            ↓ ثبّت التطبيق على شاشتك الرئيسية
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {loading && !data && (
          <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Activity className="h-10 w-10 mx-auto animate-pulse mb-2" />
            <p className="text-sm">بيتم تجميع بيانات الفروع...</p>
          </div>
        )}

        {data && data.places.length === 0 && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Store className="h-10 w-10 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>لا توجد فروع نشطة</p>
          </div>
        )}

        {data?.places.map(place => <PlaceCard key={place.id} place={place} />)}
      </div>

      <div className="px-4 py-6 text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
        SîpFlõw — لوحة المالك · {data?.generated_at ? new Date(data.generated_at).toLocaleTimeString('ar-EG') : '—'}
      </div>
    </div>
  )
}

function StatChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl px-2.5 py-2"
      style={{ background: `${color}10`, border: `1px solid ${color}30` }}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
        {icon}
        <span className="text-[10px] font-semibold whitespace-nowrap">{label}</span>
      </div>
      <p className="text-base font-black tabular-nums" style={{ color: '#fff' }}>{value}</p>
    </div>
  )
}

function PlaceCard({ place }: { place: PlaceStat }) {
  const trend = place.trend_pct
  const trendColor = trend === null ? '#9ca3af' : trend > 0 ? '#34d399' : trend < 0 ? '#f87171' : '#9ca3af'
  const trendIcon = trend === null ? null : trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
  const lastOrderAgo = place.today.last_order_at
    ? Math.floor((Date.now() - new Date(place.today.last_order_at).getTime()) / 60000)
    : null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(6,182,212,0.04))',
        border: '1px solid rgba(139,92,246,0.2)',
      }}
    >
      <div className="flex items-center justify-between p-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          {place.logo_url
            ? <img src={place.logo_url} alt={place.name} className="h-9 w-9 rounded-xl object-cover flex-shrink-0" />
            : <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,92,246,0.2)' }}><Store className="h-4 w-4" style={{ color: '#a78bfa' }} /></div>
          }
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white truncate">{place.name}</h3>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>كود: {place.code}</p>
          </div>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex items-center gap-1"
          style={{
            background: place.has_session ? 'rgba(52,211,153,0.15)' : 'rgba(156,163,175,0.15)',
            color: place.has_session ? '#34d399' : '#9ca3af',
            border: `1px solid ${place.has_session ? 'rgba(52,211,153,0.4)' : 'rgba(156,163,175,0.3)'}`,
          }}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${place.has_session ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
          {place.has_session ? 'مفتوح' : 'مقفول'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-px" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <Cell label="الطلبات" value={String(place.today.orders)} sub={place.baseline.avg_orders > 0 ? `متوسط: ${place.baseline.avg_orders}` : '—'} />
        <Cell label="الإيراد" value={`${place.today.revenue.toLocaleString('en-US')} ج`} sub={place.baseline.avg_revenue > 0 ? `~${place.baseline.avg_revenue}` : '—'} />
        <Cell
          label="الاتجاه"
          value={trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend}%`}
          sub={trend === null ? 'لا توجد بيانات' : trend > 0 ? 'فوق المعتاد' : trend < 0 ? 'تحت المعتاد' : 'مطابق'}
          color={trendColor}
          icon={trendIcon}
        />
      </div>

      <div className="px-3.5 py-2.5 flex items-center justify-between text-[11px]" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-3">
          <span style={{ color: '#fbbf24' }}>قيد الإعداد: <strong className="text-white tabular-nums">{place.today.pending}</strong></span>
          <span style={{ color: '#34d399' }}>جاهز: <strong className="text-white tabular-nums">{place.today.ready}</strong></span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>
          {lastOrderAgo === null ? 'لا طلبات بعد' : lastOrderAgo === 0 ? 'الآن' : `آخر طلب من ${lastOrderAgo} د`}
        </span>
      </div>

      {place.alerts.stuck_orders > 0 && (
        <div className="px-3.5 py-2 text-[11px] font-bold flex items-center gap-1.5" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle className="h-3.5 w-3.5" />
          {place.alerts.stuck_orders} طلب متأخر &gt; 30 دقيقة
        </div>
      )}
    </div>
  )
}

function Cell({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="px-2 py-2.5 text-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <p className="text-[10px] mb-1 flex items-center justify-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {icon}{label}
      </p>
      <p className="text-sm font-black tabular-nums" style={{ color: color || '#fff' }}>{value}</p>
      <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{sub}</p>
    </div>
  )
}
