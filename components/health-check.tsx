'use client'

import { useState, useEffect } from 'react'
import { Activity, Database, Server, Wifi, Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Loader2, Zap, HardDrive, Users, Coffee, ShoppingCart } from 'lucide-react'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down'
  latency: number
  message: string
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down'
  timestamp: string
  checks: {
    database: HealthStatus
    api: HealthStatus
    storage: HealthStatus
  }
  stats: {
    totalPlaces: number
    totalUsers: number
    totalDrinks: number
    totalOrders: number
    activeSessionsCount: number
    dbSize: string
  }
  recentErrors: {
    id: string
    message: string
    timestamp: string
    type: string
  }[]
}

export function HealthCheck() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health-check', {
        headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || '' },
      })
      const data = await res.json()
      if (!data.error) {
        setHealth(data)
        setLastChecked(new Date())
      }
    } catch (err) {
      console.error('Health check failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    let interval: NodeJS.Timeout | null = null
    if (isAutoRefresh) {
      interval = setInterval(fetchHealth, 30000) // كل 30 ثانية
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isAutoRefresh])

  const statusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4" style={{ color: '#34d399' }} />
      case 'degraded': return <AlertTriangle className="h-4 w-4" style={{ color: '#fbbf24' }} />
      case 'down': return <XCircle className="h-4 w-4" style={{ color: '#f87171' }} />
      default: return <Activity className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'healthy': return { bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)', text: '#34d399' }
      case 'degraded': return { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', text: '#fbbf24' }
      case 'down': return { bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', text: '#f87171' }
      default: return { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.5)' }
    }
  }

  const statusAr = (status: string) => {
    switch (status) {
      case 'healthy': return 'سليم'
      case 'degraded': return 'بطيء'
      case 'down': return 'متوقف'
      default: return 'غير معروف'
    }
  }

  const latencyColor = (ms: number) => {
    if (ms < 100) return '#34d399'
    if (ms < 300) return '#fbbf24'
    return '#f87171'
  }

  if (loading && !health) {
    return (
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'rgba(167,139,250,0.5)' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>جاري فحص صحة النظام...</p>
        </div>
      </div>
    )
  }

  if (!health) {
    return (
      <div className="rounded-2xl p-6" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)' }}>
        <div className="flex items-center gap-3">
          <XCircle className="h-6 w-6" style={{ color: '#f87171' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#f87171' }}>فشل فحص النظام</p>
            <p className="text-xs" style={{ color: 'rgba(248,113,113,0.7)' }}>تعذر الاتصال بخدمة الفحص</p>
          </div>
          <button
            onClick={fetchHealth}
            className="mr-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  const overall = statusColor(health.overall)

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: overall.bg, border: `1px solid ${overall.border}` }}
          >
            <Activity className="h-5 w-5" style={{ color: overall.text }} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>فحص صحة النظام</h2>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>SYSTEM HEALTH CHECK</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastChecked && (
            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {lastChecked.toLocaleTimeString('ar-EG')}
            </span>
          )}
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${isAutoRefresh ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/40'}`}
            style={{ border: `1px solid ${isAutoRefresh ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}` }}
          >
            {isAutoRefresh ? 'تلقائي' : 'يدوي'}
          </button>
          <button
            onClick={fetchHealth}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <RefreshCw className="h-3.5 w-3.5" style={{ color: 'rgba(167,139,250,0.5)' }} />
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between"
        style={{ background: overall.bg, border: `1px solid ${overall.border}` }}
      >
        <div className="flex items-center gap-3">
          {statusIcon(health.overall)}
          <div>
            <p className="text-sm font-bold" style={{ color: overall.text }}>
              حالة النظام: {statusAr(health.overall)}
            </p>
            <p className="text-[10px]" style={{ color: `${overall.text}99` }}>
              آخر تحديث: {new Date(health.timestamp).toLocaleString('ar-EG')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="relative flex h-2.5 w-2.5">
            {health.overall === 'healthy' && (
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: overall.text }} />
            )}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: overall.text }} />
          </span>
        </div>
      </div>

      {/* Service Checks */}
      <div className="grid grid-cols-3 gap-3">
        {/* Database */}
        <div
          className="rounded-xl p-3"
          style={{
            background: statusColor(health.checks.database.status).bg,
            border: `1px solid ${statusColor(health.checks.database.status).border}`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4" style={{ color: statusColor(health.checks.database.status).text }} />
            <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>قاعدة البيانات</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: statusColor(health.checks.database.status).text }}>
              {statusAr(health.checks.database.status)}
            </span>
            <span className="text-[10px] font-mono" style={{ color: latencyColor(health.checks.database.latency) }}>
              {health.checks.database.latency}ms
            </span>
          </div>
        </div>

        {/* API */}
        <div
          className="rounded-xl p-3"
          style={{
            background: statusColor(health.checks.api.status).bg,
            border: `1px solid ${statusColor(health.checks.api.status).border}`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Server className="h-4 w-4" style={{ color: statusColor(health.checks.api.status).text }} />
            <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>API</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: statusColor(health.checks.api.status).text }}>
              {statusAr(health.checks.api.status)}
            </span>
            <span className="text-[10px] font-mono" style={{ color: latencyColor(health.checks.api.latency) }}>
              {health.checks.api.latency}ms
            </span>
          </div>
        </div>

        {/* Storage */}
        <div
          className="rounded-xl p-3"
          style={{
            background: statusColor(health.checks.storage.status).bg,
            border: `1px solid ${statusColor(health.checks.storage.status).border}`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="h-4 w-4" style={{ color: statusColor(health.checks.storage.status).text }} />
            <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>التخزين</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: statusColor(health.checks.storage.status).text }}>
              {statusAr(health.checks.storage.status)}
            </span>
            <span className="text-[10px] font-mono" style={{ color: latencyColor(health.checks.storage.latency) }}>
              {health.checks.storage.latency}ms
            </span>
          </div>
        </div>
      </div>

      {/* System Stats */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs font-bold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>إحصائيات النظام</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Users className="h-4 w-4" />, label: 'المستخدمين', value: health.stats.totalUsers, color: '#a78bfa' },
            { icon: <Coffee className="h-4 w-4" />, label: 'المشروبات', value: health.stats.totalDrinks, color: '#60a5fa' },
            { icon: <ShoppingCart className="h-4 w-4" />, label: 'الطلبات', value: health.stats.totalOrders, color: '#34d399' },
            { icon: <Zap className="h-4 w-4" />, label: 'جلسات نشطة', value: health.stats.activeSessionsCount, color: '#fbbf24' },
            { icon: <Server className="h-4 w-4" />, label: 'الأماكن', value: health.stats.totalPlaces, color: '#f472b6' },
            { icon: <HardDrive className="h-4 w-4" />, label: 'حجم DB', value: health.stats.dbSize, color: '#fb923c' },
          ].map((stat, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ color: stat.color }}>{stat.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Errors */}
      {health.recentErrors.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4" style={{ color: '#f87171' }} />
            <p className="text-xs font-bold" style={{ color: '#f87171' }}>أخطاء حديثة</p>
          </div>
          <div className="space-y-2">
            {health.recentErrors.slice(0, 5).map((err, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: '#f87171' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{err.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>{err.type}</span>
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {new Date(err.timestamp).toLocaleTimeString('ar-EG')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Systems Operational */}
      {health.overall === 'healthy' && health.recentErrors.length === 0 && (
        <div className="flex items-center justify-center gap-2 rounded-xl py-3" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)' }}>
          <CheckCircle2 className="h-4 w-4" style={{ color: '#34d399' }} />
          <span className="text-xs font-medium" style={{ color: '#34d399' }}>جميع الأنظمة تعمل بشكل طبيعي</span>
        </div>
      )}
    </div>
  )
}
