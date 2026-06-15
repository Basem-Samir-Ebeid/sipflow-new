'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface LoyaltyProps { placeId: string }

const TIER_CONFIG = {
  bronze: { label: 'Bronze', color: '#cd7f32', bg: 'rgba(205,127,50,0.12)', icon: '🥉' },
  silver: { label: 'Silver', color: '#aaa9ad', bg: 'rgba(170,169,173,0.12)', icon: '🥈' },
  gold:   { label: 'Gold',   color: '#ffd700', bg: 'rgba(255,215,0,0.12)',   icon: '🥇' },
}

export function LoyaltySystem({ placeId }: LoyaltyProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cfg, setCfg] = useState({ pointsPerEgp: '1', redeemRate: '10', silverThreshold: '500', goldThreshold: '2000', enabled: false })
  const [bonusUser, setBonusUser] = useState('')
  const [bonusPoints, setBonusPoints] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/loyalty?place_id=${placeId}`)
      const d = await r.json()
      setData(d)
      setCfg({
        pointsPerEgp: String(d.pointsPerEgp ?? 1),
        redeemRate: String(d.redeemRate ?? 10),
        silverThreshold: String(d.silverThreshold ?? 500),
        goldThreshold: String(d.goldThreshold ?? 2000),
        enabled: d.enabled ?? false,
      })
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [placeId])

  const saveSettings = async () => {
    setSaving(true)
    try {
      await Promise.all([
        fetch('/api/loyalty', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'loyalty_points_per_egp', value: cfg.pointsPerEgp }) }),
        fetch('/api/loyalty', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'loyalty_redeem_rate', value: cfg.redeemRate }) }),
        fetch('/api/loyalty', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'loyalty_silver_threshold', value: cfg.silverThreshold }) }),
        fetch('/api/loyalty', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'loyalty_gold_threshold', value: cfg.goldThreshold }) }),
        fetch('/api/loyalty', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'loyalty_enabled', value: String(cfg.enabled) }) }),
      ])
      toast.success('تم حفظ إعدادات الولاء')
      load()
    } finally { setSaving(false) }
  }

  const addBonus = async () => {
    if (!bonusUser || !bonusPoints) return toast.error('أدخل الاسم والنقاط')
    const user = data?.leaderboard?.find((u: any) => u.name.includes(bonusUser))
    if (!user) return toast.error('المستخدم غير موجود في القائمة')
    const r = await fetch('/api/loyalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.userId, place_id: placeId, type: 'bonus', amount: Number(bonusPoints), note: 'مكافأة يدوية' }),
    })
    const d = await r.json()
    if (d.success) { toast.success(`تمت إضافة ${bonusPoints} نقطة`); setBonusUser(''); setBonusPoints(''); load() }
    else toast.error(d.error)
  }

  if (loading) return <div className="text-center py-12 text-amber-400/60">جار التحميل...</div>

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-amber-400">🏆 نظام الولاء</h2>
          <p className="text-xs text-white/40 mt-0.5">كافئ زبائنك المميزين بنقاط وامتيازات</p>
        </div>
        <button onClick={load} className="text-xs text-amber-400/60 hover:text-amber-400 border border-amber-400/20 rounded-lg px-3 py-1.5">↻ تحديث</button>
      </div>

      {/* تفعيل / إيقاف */}
      <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: cfg.enabled ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', borderColor: cfg.enabled ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)' }}>
        <div>
          <div className="font-semibold text-white">{cfg.enabled ? '✅ نظام الولاء مفعّل' : '⏸️ نظام الولاء موقف'}</div>
          <div className="text-xs text-white/50 mt-0.5">الزبائن يكسبون نقاط مع كل طلب</div>
        </div>
        <button onClick={() => { setCfg(p => ({ ...p, enabled: !p.enabled })) }} className="relative w-12 h-6 rounded-full transition-colors" style={{ background: cfg.enabled ? '#10b981' : 'rgba(255,255,255,0.15)' }}>
          <span className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all" style={{ left: cfg.enabled ? '26px' : '4px' }} />
        </button>
      </div>

      {/* الإعدادات */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'نقطة لكل جنيه', key: 'pointsPerEgp', hint: 'عدد النقاط لكل £1' },
          { label: 'معدل الاستبدال', key: 'redeemRate', hint: 'نقاط للحصول على £1' },
          { label: 'حد Silver (نقطة)', key: 'silverThreshold', hint: 'نقاط للوصول Silver' },
          { label: 'حد Gold (نقطة)', key: 'goldThreshold', hint: 'نقاط للوصول Gold' },
        ].map(f => (
          <div key={f.key} className="p-3 rounded-xl border border-white/10 bg-white/4">
            <label className="text-xs text-white/50">{f.label}</label>
            <input type="number" value={(cfg as any)[f.key]} onChange={e => setCfg(p => ({ ...p, [f.key]: e.target.value }))}
              className="w-full bg-transparent text-white font-bold text-lg outline-none mt-1" />
            <div className="text-xs text-white/30">{f.hint}</div>
          </div>
        ))}
      </div>

      <button onClick={saveSettings} disabled={saving} className="w-full py-2.5 rounded-xl font-bold text-sm transition-all" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#1a1a1a' }}>
        {saving ? 'جار الحفظ...' : '💾 حفظ الإعدادات'}
      </button>

      {/* مكافأة يدوية */}
      <div className="p-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
        <div className="text-sm font-semibold text-amber-400 mb-3">🎁 إضافة نقاط يدوية</div>
        <div className="flex gap-2">
          <input value={bonusUser} onChange={e => setBonusUser(e.target.value)} placeholder="اسم الزبون" className="flex-1 bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
          <input type="number" value={bonusPoints} onChange={e => setBonusPoints(e.target.value)} placeholder="النقاط" className="w-24 bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
          <button onClick={addBonus} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: '#f59e0b', color: '#1a1a1a' }}>إضافة</button>
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <div className="text-sm font-semibold text-white/70 mb-3">🏅 قائمة المميزين</div>
        {!data?.leaderboard?.length ? (
          <div className="text-center py-8 text-white/30 text-sm">لا يوجد بيانات ولاء بعد</div>
        ) : (
          <div className="space-y-2">
            {data.leaderboard.map((u: any, i: number) => {
              const tier = TIER_CONFIG[u.tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.bronze
              return (
                <div key={u.userId} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: tier.bg, borderColor: `${tier.color}30` }}>
                  <div className="text-2xl font-black w-8 text-center" style={{ color: tier.color }}>{i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-white text-sm">{u.name}</div>
                    <div className="text-xs" style={{ color: tier.color }}>{tier.icon} {tier.label} · إجمالي مكتسب: {u.totalEarned.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-lg" style={{ color: tier.color }}>{u.points.toLocaleString()}</div>
                    <div className="text-xs text-white/40">نقطة</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
