'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface Props { placeId: string }

const SEG_CONFIG = {
  vip:     { label: 'VIP 👑',       color: '#ffd700', bg: 'rgba(255,215,0,0.10)',   desc: 'إنفاق عالي وطلبات متكررة' },
  regular: { label: 'منتظم ✅',    color: '#10b981', bg: 'rgba(16,185,129,0.10)', desc: 'زبائن نشطون' },
  at_risk: { label: 'في خطر ⚠️',  color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', desc: 'لم يطلبوا منذ 14+ يوم' },
  lost:    { label: 'مفقود 😴',    color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  desc: 'لم يطلبوا منذ 30+ يوم' },
  new:     { label: 'جديد 🌟',     color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', desc: 'انضم خلال آخر 7 أيام' },
}

export function CustomerSegments({ placeId }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeSegment, setActiveSegment] = useState<string>('all')
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/customers/segment?place_id=${placeId}`)
      const d = await r.json()
      setData(d)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [placeId])

  const sendMessage = async () => {
    if (!msgText.trim()) return toast.error('اكتب الرسالة أولاً')
    const targets = filtered.filter((c: any) => activeSegment === 'all' || c.segment === activeSegment)
    if (!targets.length) return toast.error('لا يوجد زبائن في هذا التصنيف')
    setSending(true)
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `رسالة لـ ${activeSegment === 'all' ? 'الجميع' : SEG_CONFIG[activeSegment as keyof typeof SEG_CONFIG]?.label}`, message: msgText, place_id: placeId, is_broadcast: true }),
      })
      toast.success(`تم إرسال الرسالة`)
      setMsgText('')
    } finally { setSending(false) }
  }

  const allCustomers: any[] = data?.customers ?? []
  const filtered = allCustomers.filter(c =>
    (activeSegment === 'all' || c.segment === activeSegment) &&
    (!search || c.name.includes(search))
  )

  if (loading) return <div className="text-center py-12 text-emerald-400/60">جار التحميل...</div>

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-emerald-400">👥 تصنيف الزبائن</h2>
          <p className="text-xs text-white/40 mt-0.5">اعرف زبائنك وتواصل معهم بشكل موجّه</p>
        </div>
        <button onClick={load} className="text-xs text-emerald-400/60 hover:text-emerald-400 border border-emerald-400/20 rounded-lg px-3 py-1.5">↻ تحديث</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(SEG_CONFIG).map(([key, cfg]) => {
          const count = data?.summary?.[key] ?? 0
          return (
            <button key={key} onClick={() => setActiveSegment(activeSegment === key ? 'all' : key)}
              className="p-3 rounded-xl border text-center transition-all"
              style={{ background: activeSegment === key ? cfg.bg : 'rgba(255,255,255,0.04)', borderColor: activeSegment === key ? `${cfg.color}50` : 'rgba(255,255,255,0.08)' }}>
              <div className="text-2xl font-black" style={{ color: cfg.color }}>{count}</div>
              <div className="text-xs mt-1" style={{ color: cfg.color }}>{cfg.label}</div>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ابحث بالاسم..." className="w-full bg-white/6 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none" />

      {/* Message Broadcast */}
      <div className="p-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5">
        <div className="text-sm font-semibold text-emerald-400 mb-2">
          📢 إرسال رسالة لـ {activeSegment === 'all' ? 'الكل' : SEG_CONFIG[activeSegment as keyof typeof SEG_CONFIG]?.label} ({filtered.length} زبون)
        </div>
        <div className="flex gap-2">
          <input value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="اكتب رسالتك هنا..." className="flex-1 bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
          <button onClick={sendMessage} disabled={sending} className="px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap" style={{ background: '#10b981', color: '#fff' }}>
            {sending ? '...' : 'إرسال'}
          </button>
        </div>
      </div>

      {/* Customer List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">لا يوجد زبائن في هذا التصنيف</div>
        ) : filtered.map((c: any) => {
          const seg = SEG_CONFIG[c.segment as keyof typeof SEG_CONFIG] ?? SEG_CONFIG.regular
          return (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/4 hover:bg-white/6 transition-colors">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: seg.bg, color: seg.color }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-sm truncate">{c.name}</div>
                <div className="text-xs text-white/40">
                  {c.totalOrders} طلب · {Number(c.totalSpent).toFixed(0)} ج.م
                  {c.daysSinceLast !== null && ` · آخر طلب منذ ${c.daysSinceLast} يوم`}
                  {c.avgRating && ` · ⭐ ${Number(c.avgRating).toFixed(1)}`}
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap" style={{ background: seg.bg, color: seg.color }}>
                {seg.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
