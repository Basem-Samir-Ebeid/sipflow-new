'use client'
import { useState, useEffect } from 'react'

interface Props { placeId: string }

const PERF_CONFIG = {
  star:   { label: '⭐ نجم',     color: '#ffd700', bg: 'rgba(255,215,0,0.12)' },
  normal: { label: '✅ عادي',   color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  slow:   { label: '🐢 بطيء',   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  dead:   { label: '💀 متوقف',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden w-full">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}

export function PnlReport({ placeId }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState(3)
  const [sort, setSort] = useState<'revenue' | 'margin' | 'qty'>('revenue')

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/analytics/pnl?place_id=${placeId}&months=${months}`)
      const d = await r.json()
      setData(d)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [placeId, months])

  if (loading) return <div className="text-center py-12 text-blue-400/60">جار تحليل البيانات...</div>

  const drinks: any[] = data?.drinks ?? []
  const sorted = [...drinks].sort((a, b) => sort === 'revenue' ? b.revenue - a.revenue : sort === 'margin' ? b.margin - a.margin : b.totalQty - a.totalQty)
  const maxRev = Math.max(...drinks.map(d => d.revenue), 1)

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-blue-400">📊 تقرير الأرباح والخسائر</h2>
          <p className="text-xs text-white/40 mt-0.5">تحليل مالي عميق لأداء المنيو</p>
        </div>
        <div className="flex gap-2">
          {[1, 3, 6, 12].map(m => (
            <button key={m} onClick={() => setMonths(m)} className="text-xs px-3 py-1.5 rounded-lg border transition-all"
              style={{ background: months === m ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', borderColor: months === m ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)', color: months === m ? '#60a5fa' : '#fff6' }}>
              {m === 1 ? 'شهر' : m === 12 ? 'سنة' : `${m} شهور`}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الإيراد', value: `${Number(data?.summary?.totalRevenue ?? 0).toFixed(0)} ج.م`, color: '#10b981', icon: '💰' },
          { label: 'إجمالي التكاليف', value: `${Number(data?.summary?.totalCost ?? 0).toFixed(0)} ج.م`, color: '#ef4444', icon: '📦' },
          { label: 'صافي الربح', value: `${Number(data?.summary?.grossProfit ?? 0).toFixed(0)} ج.م`, color: '#ffd700', icon: '📈' },
          { label: 'هامش الربح', value: `${data?.summary?.overallMargin ?? 0}%`, color: '#a78bfa', icon: '🎯' },
        ].map(c => (
          <div key={c.label} className="p-4 rounded-xl border border-white/10 bg-white/4 text-center">
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-xl font-black" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs text-white/50 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Insights */}
      {data?.insights && (
        <div className="grid grid-cols-2 gap-3">
          {data.insights.stars?.length > 0 && (
            <div className="p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
              <div className="text-xs font-bold text-yellow-400 mb-1">⭐ النجوم</div>
              <div className="text-xs text-white/70">{data.insights.stars.join(' · ')}</div>
            </div>
          )}
          {data.insights.deadItems?.length > 0 && (
            <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5">
              <div className="text-xs font-bold text-red-400 mb-1">💀 بدون طلبات</div>
              <div className="text-xs text-white/70">{data.insights.deadItems.join(' · ')}</div>
            </div>
          )}
          {data.insights.highMargin?.length > 0 && (
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-xs font-bold text-emerald-400 mb-1">💎 أعلى هامش ربح</div>
              <div className="text-xs text-white/70">{data.insights.highMargin.join(' · ')}</div>
            </div>
          )}
          {data.insights.lowMargin?.length > 0 && (
            <div className="p-3 rounded-xl border border-orange-500/20 bg-orange-500/5">
              <div className="text-xs font-bold text-orange-400 mb-1">⚠️ أقل هامش ربح</div>
              <div className="text-xs text-white/70">{data.insights.lowMargin.join(' · ')}</div>
            </div>
          )}
        </div>
      )}

      {/* Monthly Revenue Chart */}
      {data?.monthly?.length > 0 && (
        <div className="p-4 rounded-xl border border-white/10 bg-white/4">
          <div className="text-sm font-semibold text-white/70 mb-4">📅 الإيراد الشهري</div>
          <div className="flex items-end gap-3 h-28">
            {data.monthly.map((m: any) => {
              const maxM = Math.max(...data.monthly.map((x: any) => Number(x.revenue)), 1)
              const pct = (Number(m.revenue) / maxM) * 100
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="text-xs text-white/50">{Number(m.revenue).toFixed(0)}</div>
                  <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(4, pct * 0.7)}px`, background: 'linear-gradient(180deg,#60a5fa,#2563eb)' }} />
                  <div className="text-xs text-white/40 truncate w-full text-center">{String(m.month).slice(5)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex gap-2">
        <span className="text-xs text-white/40 self-center">ترتيب حسب:</span>
        {[{ k: 'revenue', l: 'الإيراد' }, { k: 'margin', l: 'الهامش' }, { k: 'qty', l: 'الكمية' }].map(s => (
          <button key={s.k} onClick={() => setSort(s.k as any)} className="text-xs px-3 py-1 rounded-lg border transition-all"
            style={{ background: sort === s.k ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)', borderColor: sort === s.k ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)', color: sort === s.k ? '#60a5fa' : '#fff6' }}>
            {s.l}
          </button>
        ))}
      </div>

      {/* Drinks Table */}
      <div className="space-y-2">
        {sorted.map((d: any) => {
          const perf = PERF_CONFIG[d.performance as keyof typeof PERF_CONFIG] ?? PERF_CONFIG.normal
          return (
            <div key={d.name} className="p-3 rounded-xl border border-white/8 bg-white/4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="font-semibold text-white text-sm">{d.name}</span>
                  <span className="text-xs text-white/40 mr-2">{d.category}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: perf.bg, color: perf.color }}>{perf.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
                <div><div className="text-white/40">السعر</div><div className="font-bold text-white">{Number(d.price).toFixed(0)} ج.م</div></div>
                <div><div className="text-white/40">المبيعات</div><div className="font-bold text-emerald-400">{Number(d.revenue).toFixed(0)} ج.م</div></div>
                <div><div className="text-white/40">الكمية</div><div className="font-bold text-blue-400">{d.totalQty}</div></div>
                <div><div className="text-white/40">الهامش</div><div className="font-bold" style={{ color: d.margin > 50 ? '#10b981' : d.margin > 20 ? '#f59e0b' : '#ef4444' }}>{d.margin}%</div></div>
              </div>
              <Bar pct={(d.revenue / maxRev) * 100} color={perf.color} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
