'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Wifi, WifiOff, TrendingUp, Clock, AlertTriangle } from 'lucide-react'

type PlaceLiveData = {
  id: string
  name: string
  code: string
  logo_url: string | null
  isOpen: boolean
  health: 'green' | 'yellow' | 'red'
  activeTables: number
  pendingOrders: number
  waiterCalls: number
  todayRevenue: number
  totalOrders: number
  readyCount: number
}

type GlobalStats = {
  totalPlaces: number
  activePlaces: number
  totalOrders: number
  totalRevenue: number
  totalPending: number
  totalActiveTables: number
}

const POLL_INTERVAL = 15_000

function formatRevenue(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ج'
}

function HealthDot({ health }: { health: 'green' | 'yellow' | 'red' }) {
  const color = health === 'green' ? '#10b981' : health === 'yellow' ? '#f59e0b' : '#ef4444'
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ backgroundColor: color }} />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-4 space-y-3 animate-pulse" style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="h-4 w-28 rounded-lg bg-white/5" />
        <div className="h-5 w-14 rounded-full bg-white/5" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-12 rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="h-4 w-20 rounded-lg bg-white/5" />
    </div>
  )
}

function PlaceCard({ place }: { place: PlaceLiveData }) {
  const isOpen = place.isOpen
  const alerting = place.waiterCalls > 0 || place.pendingOrders > 4

  return (
    <div
      className="rounded-2xl p-4 space-y-3 transition-all duration-300"
      style={{
        background: alerting
          ? 'linear-gradient(135deg, rgba(245,158,11,0.07), rgba(239,68,68,0.05))'
          : 'rgba(139,92,246,0.04)',
        border: `1px solid ${
          alerting
            ? 'rgba(245,158,11,0.35)'
            : place.health === 'red'
            ? 'rgba(239,68,68,0.25)'
            : 'rgba(139,92,246,0.12)'
        }`,
        boxShadow: alerting ? '0 0 18px rgba(245,158,11,0.08)' : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <HealthDot health={place.health} />
          <span className="text-sm font-bold text-white truncate">{place.name}</span>
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide"
          style={
            isOpen
              ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#6ee7b7' }
              : { background: 'rgba(107,114,128,0.15)', border: '1px solid rgba(107,114,128,0.3)', color: '#9ca3af' }
          }
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: isOpen ? '#10b981' : '#6b7280' }}
          />
          {isOpen ? 'مفتوح' : 'مغلق'}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Active tables */}
        <div
          className="rounded-xl px-3 py-2.5 text-center"
          style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}
        >
          <p className="text-lg font-black tabular-nums text-blue-300">{place.activeTables}</p>
          <p className="text-[10px] font-medium" style={{ color: '#60a5fa' }}>طاولات نشطة</p>
        </div>

        {/* Pending orders */}
        <div
          className="rounded-xl px-3 py-2.5 text-center"
          style={{
            background: place.pendingOrders > 4 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.07)',
            border: `1px solid ${place.pendingOrders > 4 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.2)'}`,
          }}
        >
          <p
            className="text-lg font-black tabular-nums"
            style={{ color: place.pendingOrders > 4 ? '#f87171' : '#fbbf24' }}
          >
            {place.pendingOrders}
          </p>
          <p className="text-[10px] font-medium" style={{ color: place.pendingOrders > 4 ? '#f87171' : '#fbbf24' }}>
            طلبات معلقة
          </p>
        </div>

        {/* Waiter calls */}
        <div
          className="rounded-xl px-3 py-2.5 text-center"
          style={{
            background: place.waiterCalls > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${place.waiterCalls > 0 ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.06)'}`,
          }}
        >
          <p
            className="text-lg font-black tabular-nums"
            style={{ color: place.waiterCalls > 0 ? '#f87171' : '#6b7280' }}
          >
            {place.waiterCalls}
          </p>
          <p className="text-[10px] font-medium" style={{ color: place.waiterCalls > 0 ? '#f87171' : '#6b7280' }}>
            نداء نادل
          </p>
        </div>

        {/* Revenue */}
        <div
          className="rounded-xl px-3 py-2.5 text-center"
          style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}
        >
          <p className="text-base font-black tabular-nums text-emerald-300 leading-tight">
            {formatRevenue(place.todayRevenue)}
          </p>
          <p className="text-[10px] font-medium" style={{ color: '#6ee7b7' }}>إيراد اليوم</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono" style={{ color: '#4c3d72' }}>#{place.code}</span>
        <span className="text-[10px]" style={{ color: '#4c3d72' }}>
          {place.totalOrders} طلب إجمالي · {place.readyCount} جاهز
        </span>
      </div>
    </div>
  )
}

export function LivePlacesHub() {
  const [places, setPlaces] = useState<PlaceLiveData[]>([])
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true)
    try {
      const res = await fetch('/api/command-center', { cache: 'no-store' })
      if (!res.ok) throw new Error('فشل في جلب البيانات')
      const json = await res.json()

      const mapped: PlaceLiveData[] = (json.places ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        logo_url: p.logo_url,
        isOpen: !p.isClosed,
        health: p.health,
        activeTables: p.stats.activeTables,
        pendingOrders: p.stats.pendingCount,
        waiterCalls: p.stats.recentWaiterCalls,
        todayRevenue: p.stats.revenue,
        totalOrders: p.stats.totalOrders,
        readyCount: p.stats.readyCount,
      }))

      setPlaces(mapped)
      setGlobalStats(json.globalStats ?? null)
      setLastUpdated(new Date())
      setError(null)
    } catch (e: any) {
      setError(e.message ?? 'خطأ غير معروف')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()

    intervalRef.current = setInterval(() => fetchData(), POLL_INTERVAL)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [fetchData])

  const timeAgo = lastUpdated
    ? `${Math.floor((Date.now() - lastUpdated.getTime()) / 1000)} ث`
    : null

  return (
    <div className="space-y-4" dir="rtl">
      {/* ── Header ── */}
      <div
        className="relative rounded-2xl overflow-hidden p-4 space-y-3"
        style={{
          background: 'linear-gradient(140deg, #04000d 0%, #0a0020 50%, #0d001f 100%)',
          border: '1px solid rgba(139,92,246,0.25)',
          boxShadow: '0 0 32px rgba(109,40,217,0.1)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)' }}
            >
              <Wifi className="h-5 w-5" style={{ color: '#c4b5fd' }} />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">Live Places Hub</h2>
              <p className="text-[11px] font-mono" style={{ color: '#7c6e9e' }}>
                تحديث كل 15 ثانية{' '}
                {timeAgo && <span style={{ color: '#a78bfa' }}>· آخر تحديث: {timeAgo}</span>}
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>

        {/* Global KPIs */}
        {globalStats && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'الأماكن المفتوحة', value: `${globalStats.activePlaces}/${globalStats.totalPlaces}`, color: '#c4b5fd', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.22)' },
              { label: 'إجمالي الطلبات', value: globalStats.totalOrders, color: '#6ee7b7', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
              { label: 'إجمالي الإيراد', value: formatRevenue(globalStats.totalRevenue), color: '#fcd34d', bg: 'rgba(212,160,23,0.08)', border: 'rgba(212,160,23,0.2)' },
            ].map(s => (
              <div key={s.label} className="rounded-xl px-2 py-2 text-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                <p className="text-sm font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] mt-0.5" style={{ color: s.color, opacity: 0.7 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Status bar */}
        <div
          className="flex items-center justify-between rounded-lg px-3 py-1.5"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div className="flex items-center gap-1.5">
            {error ? (
              <WifiOff className="h-3 w-3 text-red-400" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
            <span className="text-[10px] font-medium" style={{ color: error ? '#f87171' : '#6ee7b7' }}>
              {error ? 'خطأ في الاتصال' : 'متصل — مباشر'}
            </span>
          </div>
          <span className="text-[10px] font-mono" style={{ color: '#3d2d60' }}>
            {places.length} مكان مُراقَب
          </span>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div
          className="rounded-2xl p-6 text-center space-y-3"
          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
          <p className="text-sm font-semibold text-red-400">{error}</p>
          <button
            onClick={() => fetchData(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all active:scale-95"
            style={{ background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.4)' }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </button>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && places.length === 0 && (
        <div
          className="rounded-2xl p-8 text-center space-y-2"
          style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}
        >
          <TrendingUp className="h-10 w-10 mx-auto mb-2" style={{ color: '#5b4a8a' }} />
          <p className="text-sm font-semibold text-white">لا توجد أماكن مفعّلة</p>
          <p className="text-xs" style={{ color: '#5b4a8a' }}>أضف وفعّل مكاناً من تبويب الأماكن لتظهر هنا.</p>
        </div>
      )}

      {/* ── Place Cards Grid ── */}
      {!loading && !error && places.length > 0 && (
        <>
          {/* Alert banner */}
          {places.some(p => p.waiterCalls > 0 || p.pendingOrders > 4) && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs font-semibold text-amber-300">
                يوجد أماكن تحتاج انتباهاً — نداءات نادل أو طلبات معلقة كثيرة
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {places.map(place => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-1.5">
            <Clock className="h-3 w-3" style={{ color: '#3d2d60' }} />
            <span className="text-[10px] font-mono" style={{ color: '#3d2d60' }}>
              يتجدد تلقائياً كل 15 ثانية
            </span>
          </div>
        </>
      )}
    </div>
  )
}
