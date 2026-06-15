'use client'
import { useState, useEffect } from 'react'

interface Props { placeId: string }

const TAG_CONFIG = {
  star:       { label: '⭐ نجم',        color: '#ffd700', bg: 'rgba(255,215,0,0.12)' },
  rising:     { label: '🚀 صاعد',       color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  normal:     { label: '✅ عادي',        color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  hidden_gem: { label: '💎 كنز مخفي',   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  falling:    { label: '📉 في تراجع',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  dead:       { label: '💀 بدون طلبات', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

export function MenuOptimizer({ placeId }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/menu-optimizer?place_id=${placeId}`)
      const d = await r.json()
      setData(d)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [placeId])

  const drinks: any[] = data?.drinks ?? []
  const filtered = filter === 'all' ? drinks : drinks.filter(d => d.tag === filter)

  if (loading) return <div className="text-center py-12 text-purple-400/60">جار التحليل الذكي...</div>

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-purple-400">🤖 محسّن المنيو الذكي</h2>
          <p className="text-xs text-white/40 mt-0.5">توصيات ذكية بناءً على بيانات الطلبات والتقييمات</p>
        </div>
        <button onClick={load} className="text-xs text-purple-400/60 hover:text-purple-400 border border-purple-400/20 rounded-lg px-3 py-1.5">↻ تحديث</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(TAG_CONFIG).map(([key, cfg]) => {
          const count = data?.summary?.[key === 'hidden_gem' ? 'hiddenGems' : key] ?? 0
          return (
            <button key={key} onClick={() => setFilter(filter === key ? 'all' : key)}
              className="p-2 rounded-xl border text-center transition-all"
              style={{ background: filter === key ? cfg.bg : 'rgba(255,255,255,0.04)', borderColor: filter === key ? `${cfg.color}50` : 'rgba(255,255,255,0.08)' }}>
              <div className="text-xl font-black" style={{ color: cfg.color }}>{count}</div>
              <div className="text-xs mt-0.5 leading-tight" style={{ color: cfg.color }}>{cfg.label.split(' ')[0]}</div>
            </button>
          )
        })}
      </div>

      {/* AI Recommendations */}
      {data?.recommendations?.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-purple-400">🧠 توصيات الذكاء الاصطناعي</div>
          {data.recommendations.map((r: string, i: number) => (
            <div key={i} className="flex gap-3 p-3 rounded-xl border border-purple-400/20 bg-purple-400/5">
              <div className="text-purple-400 shrink-0">→</div>
              <div className="text-sm text-white/80">{r}</div>
            </div>
          ))}
        </div>
      )}

      {/* Combo Suggestions */}
      {data?.combos?.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
          <div className="text-sm font-semibold text-amber-400 mb-3">🔗 اقتراحات الكومبو</div>
          <div className="space-y-2">
            {data.combos.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-white/80">{c.item1}</span>
                <span className="text-amber-400">+</span>
                <span className="text-white/80">{c.item2}</span>
                <span className="text-white/40 mr-auto text-xs">طُلبوا معاً {c.count} مرة</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drinks List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">لا يوجد منتجات في هذا التصنيف</div>
        ) : filtered.map((d: any) => {
          const tag = TAG_CONFIG[d.tag as keyof typeof TAG_CONFIG] ?? TAG_CONFIG.normal
          const trend = d.trend
          return (
            <div key={d.id} className="p-3 rounded-xl border border-white/8 bg-white/4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-white text-sm">{d.name}</span>
                  <span className="text-xs text-white/40 mr-2">{d.category} · {Number(d.price).toFixed(0)} ج.م</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap" style={{ background: tag.bg, color: tag.color }}>{tag.label}</span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <div className="text-white/40">30 يوم</div>
                  <div className="font-bold text-white">{d.orders30} طلب</div>
                </div>
                <div>
                  <div className="text-white/40">الإيراد</div>
                  <div className="font-bold text-emerald-400">{Number(d.revenue30).toFixed(0)} ج.م</div>
                </div>
                <div>
                  <div className="text-white/40">الاتجاه</div>
                  <div className="font-bold" style={{ color: trend > 10 ? '#10b981' : trend < -10 ? '#ef4444' : '#6b7280' }}>
                    {trend > 0 ? `↑${trend}%` : trend < 0 ? `↓${Math.abs(trend)}%` : '→ ثابت'}
                  </div>
                </div>
                <div>
                  <div className="text-white/40">التقييم</div>
                  <div className="font-bold text-yellow-400">{d.avgRating ? `⭐ ${Number(d.avgRating).toFixed(1)}` : 'لا يوجد'}</div>
                </div>
              </div>

              {d.priceAdvice && (
                <div className="text-xs text-amber-300 bg-amber-400/8 rounded-lg p-2 border border-amber-400/20">
                  💡 {d.priceAdvice}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
