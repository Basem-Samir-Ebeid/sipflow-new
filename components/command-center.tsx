'use client'

import { useState, useEffect } from 'react'
import { Activity, TrendingUp, DollarSign, Users, Coffee, Clock, AlertTriangle, CheckCircle2, Loader2, RefreshCw, MapPin, Zap } from 'lucide-react'

interface PlaceStats {
  totalOrders: number
  pendingCount: number
  preparingCount: number
  readyCount: number
  completedCount: number
  revenue: number
  activeTables: number
  recentWaiterCalls: number
}

interface RecentOrder {
  id: string
  drink_name: string
  quantity: number
  status: string
  table_number: string | null
  customer_name: string | null
  created_at: string
  place_name?: string
}

interface PlaceData {
  id: string
  name: string
  code: string
  logo_url: string | null
  isClosed: boolean
  health: 'green' | 'yellow' | 'red'
  stats: PlaceStats
  recentOrders: RecentOrder[]
}

interface GlobalStats {
  totalPlaces: number
  activePlaces: number
  totalOrders: number
  totalRevenue: number
  totalPending: number
  totalActiveTables: number
  healthySummary: { green: number; yellow: number; red: number }
}

interface CommandCenterData {
  globalStats: GlobalStats
  places: PlaceData[]
  recentActivity: RecentOrder[]
  timestamp: string
}

export function CommandCenter() {
  const [data, setData] = useState<CommandCenterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchData = async () => {
    try {
      const res = await fetch('/api/command-center', {
        headers: { 'x-admin-secret': 'Basem.s.ebeid#@55!' },
      })
      const json = await res.json()
      if (!json.error) {
        setData(json)
        setLastUpdate(new Date())
      }
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const statusAr: Record<string, string> = {
    pending: 'بانتظار',
    preparing: 'تحضير',
    ready: 'جاهز',
    completed: 'مكتمل',
  }

  const statusColor: Record<string, string> = {
    pending: '#f59e0b',
    preparing: '#3b82f6',
    ready: '#22c55e',
    completed: '#6b7280',
  }

  const healthPulse = (h: string) => {
    if (h === 'green') return '#22c55e'
    if (h === 'yellow') return '#f59e0b'
    return '#ef4444'
  }

  const timeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return `${diff} ث`
    if (diff < 3600) return `${Math.floor(diff / 60)} د`
    return `${Math.floor(diff / 3600)} س`
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
        <p className="text-sm" style={{ color: 'rgba(167,139,250,0.6)' }}>جاري تحميل مركز التحكم...</p>
      </div>
    )
  }

  if (!data) return null

  const { globalStats: g, places, recentActivity } = data

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(147,51,234,0.15)', border: '1px solid rgba(147,51,234,0.3)' }}>
            <Activity className="h-4 w-4" style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>مركز التحكم الحي</h2>
            <p className="text-[10px]" style={{ color: 'rgba(167,139,250,0.4)' }}>LIVE COMMAND CENTER</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {lastUpdate.toLocaleTimeString('ar-EG')}
            </span>
          )}
          <button onClick={fetchData} className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <RefreshCw className="h-3 w-3" style={{ color: 'rgba(167,139,250,0.5)' }} />
          </button>
          <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[9px] font-bold" style={{ color: '#34d399' }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* Global Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: <MapPin className="h-4 w-4" />, label: 'الأماكن النشطة', value: `${g.activePlaces}/${g.totalPlaces}`, color: '#a78bfa', bg: 'rgba(147,51,234,0.08)', border: 'rgba(147,51,234,0.2)' },
          { icon: <Coffee className="h-4 w-4" />, label: 'إجمالي الطلبات', value: g.totalOrders, color: '#60a5fa', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
          { icon: <DollarSign className="h-4 w-4" />, label: 'إجمالي الإيراد', value: `${g.totalRevenue.toFixed(0)} ج.م`, color: '#34d399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
          { icon: <Zap className="h-4 w-4" />, label: 'طلبات معلقة', value: g.totalPending, color: g.totalPending > 5 ? '#f87171' : '#fbbf24', bg: g.totalPending > 5 ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)', border: g.totalPending > 5 ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)' },
        ].map((card, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-xl px-3 py-3" style={{ background: card.bg, border: `1px solid ${card.border}` }}>
            <div className="shrink-0" style={{ color: card.color }}>{card.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>{card.label}</p>
              <p className="text-base font-bold tabular-nums" style={{ color: card.color }}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Health Summary */}
      <div className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>حالة الأماكن:</span>
        <div className="flex items-center gap-4 flex-1">
          {[
            { label: 'سليم', count: g.healthySummary.green, color: '#22c55e' },
            { label: 'تنبيه', count: g.healthySummary.yellow, color: '#f59e0b' },
            { label: 'حرج', count: g.healthySummary.red, color: '#ef4444' },
          ].map((h, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: h.color, boxShadow: h.count > 0 ? `0 0 6px ${h.color}` : 'none' }} />
              <span className="text-[11px] font-bold tabular-nums" style={{ color: h.count > 0 ? h.color : 'rgba(255,255,255,0.2)' }}>{h.count}</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{h.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Place Cards */}
      <div className="space-y-2">
        <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>📍 الأماكن</p>
        {places.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>لا توجد أماكن نشطة</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {places.map(place => (
              <div key={place.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${place.health === 'red' ? 'rgba(239,68,68,0.25)' : place.health === 'yellow' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                {/* Place Header */}
                <div className="flex items-center gap-3 px-3.5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {/* Health Pulse */}
                  <div className="relative shrink-0">
                    <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: healthPulse(place.health) }} />
                    <span className="relative flex h-3 w-3 rounded-full" style={{ background: healthPulse(place.health), boxShadow: `0 0 8px ${healthPulse(place.health)}` }} />
                  </div>
                  {/* Logo */}
                  <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {place.logo_url ? (
                      <img src={place.logo_url} alt={place.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg">🏪</span>
                    )}
                  </div>
                  {/* Name & Status */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{place.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>{place.code}</span>
                      {place.isClosed ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>مغلق</span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#34d399' }}>مفتوح</span>
                      )}
                    </div>
                  </div>
                  {/* Revenue */}
                  <div className="text-left shrink-0">
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>الإيراد</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: '#34d399' }}>{place.stats.revenue.toFixed(0)}</p>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-1 px-3 py-2">
                  {[
                    { label: 'معلق', count: place.stats.pendingCount, color: '#f59e0b', icon: '⏳' },
                    { label: 'تحضير', count: place.stats.preparingCount, color: '#3b82f6', icon: '🔥' },
                    { label: 'جاهز', count: place.stats.readyCount, color: '#22c55e', icon: '✅' },
                    { label: 'مكتمل', count: place.stats.completedCount, color: '#6b7280', icon: '📦' },
                  ].map((s, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center rounded-lg py-1.5" style={{ background: s.count > 0 ? `${s.color}08` : 'transparent' }}>
                      <span className="text-xs">{s.icon}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: s.count > 0 ? s.color : 'rgba(255,255,255,0.15)' }}>{s.count}</span>
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{s.label}</span>
                    </div>
                  ))}
                  <div className="w-px h-8 mx-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <div className="flex flex-col items-center rounded-lg py-1.5 px-2">
                    <span className="text-xs">🪑</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: place.stats.activeTables > 0 ? '#a78bfa' : 'rgba(255,255,255,0.15)' }}>{place.stats.activeTables}</span>
                    <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>طاولات</span>
                  </div>
                  {place.stats.recentWaiterCalls > 0 && (
                    <>
                      <div className="w-px h-8 mx-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                      <div className="flex flex-col items-center rounded-lg py-1.5 px-2" style={{ background: 'rgba(251,191,36,0.08)' }}>
                        <span className="text-xs">🔔</span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: '#fbbf24' }}>{place.stats.recentWaiterCalls}</span>
                        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>نداء</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Feed */}
      <div className="space-y-2">
        <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>⚡ آخر النشاطات</p>
        {recentActivity.length === 0 ? (
          <div className="text-center py-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>لا توجد نشاطات حديثة</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {recentActivity.map((order, i) => (
              <div key={order.id} className="flex items-center gap-3 px-3.5 py-2.5" style={{ borderBottom: i < recentActivity.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: statusColor[order.status] || '#6b7280', boxShadow: `0 0 4px ${statusColor[order.status] || '#6b7280'}` }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>{order.drink_name || '—'}</span>
                    {order.quantity > 1 && <span className="text-[10px] px-1 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>×{order.quantity}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px]" style={{ color: 'rgba(167,139,250,0.5)' }}>{order.place_name}</span>
                    {order.table_number && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>· طاولة {order.table_number}</span>}
                  </div>
                </div>
                <div className="text-left shrink-0 flex flex-col items-end gap-0.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${statusColor[order.status]}15`, color: statusColor[order.status] }}>{statusAr[order.status] || order.status}</span>
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{timeAgo(order.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
