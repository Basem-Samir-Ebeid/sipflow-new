'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { ArrowRight, Phone, Star, Calendar, Send, Search, Users, MessageCircle, Filter } from 'lucide-react'
import Link from 'next/link'

type Customer = {
  phone: string
  name: string
  visits: number
  orders: number
  total_spent: number
  last_visit: string
  favorite: string | null
  days_since_last: number
}

type Place = { id: string; name: string }

const TEMPLATES = [
  { label: 'ترحيب بالزبون الجديد', text: 'أهلاً {name}! يسعدنا انضمامك لعائلة {place}. عرض ترحيبي خاص بيك: خصم 15% على طلبك القادم. ✨' },
  { label: 'استرداد زبون غايب',     text: 'يا {name}، وحشتنا في {place}! 😊 رجعلنا واطلب أي حاجة وخد عليها مشروب مجاناً.' },
  { label: 'عرض الـVIP',            text: 'لأنك من عملاءنا المميزين يا {name}، حضّرنا لك عرض حصري: خصم 20% على طلبك القادم في {place}. صالح حتى نهاية الأسبوع.' },
  { label: 'منتج المفضل بسعر أقل',  text: 'مفاجأة يا {name}! "{favorite}" المفضل عندك متاح اليوم بخصم 25% فقط في {place}. عرض محدود.' },
  { label: 'دعوة فعالية',           text: 'يا {name}، عاملين أمسية موسيقية يوم الخميس من 7 إلى 11 في {place}. مكانك محجوز لو حبيت تحضر! 🎵' },
]

const fillTemplate = (t: string, c: Customer, placeName: string) =>
  t.replace(/\{name\}/g, c.name)
   .replace(/\{place\}/g, placeName)
   .replace(/\{favorite\}/g, c.favorite || 'مشروبك المفضل')

export default function MarketingPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [placeId, setPlaceId] = useState<string>('')
  const [placeName, setPlaceName] = useState<string>('مكاننا')
  const [days, setDays] = useState(90)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'vip' | 'inactive' | 'frequent'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState(TEMPLATES[1].text)

  // Load places
  useEffect(() => {
    fetch('/api/places').then(r => r.json()).then(data => {
      const ps = (Array.isArray(data) ? data : []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
      setPlaces(ps)
    }).catch(() => {})
  }, [])

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const url = placeId
        ? `/api/customers/marketing?place_id=${encodeURIComponent(placeId)}&days=${days}`
        : `/api/customers/marketing?days=${days}`
      const res = await fetch(url, { cache: 'no-store' })
      const json = await res.json()
      setCustomers(Array.isArray(json.customers) ? json.customers : [])
      setSelected(new Set())
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [placeId, days])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  useEffect(() => {
    const p = places.find(x => x.id === placeId)
    if (p) setPlaceName(p.name)
  }, [placeId, places])

  const filtered = useMemo(() => {
    return customers.filter(c => {
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return false
      }
      if (filter === 'vip') return c.total_spent >= 500
      if (filter === 'inactive') return c.days_since_last >= 21
      if (filter === 'frequent') return c.visits >= 5
      return true
    })
  }, [customers, search, filter])

  const toggle = (phone: string) => {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(phone)) n.delete(phone)
      else n.add(phone)
      return n
    })
  }
  const selectAll = () => setSelected(new Set(filtered.map(c => c.phone)))
  const clearSel = () => setSelected(new Set())

  const sendOne = (c: Customer) => {
    const text = fillTemplate(message, c, placeName)
    const phone = c.phone.startsWith('00') ? c.phone.slice(2) : c.phone
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const broadcastSelected = () => {
    if (selected.size === 0) return
    if (selected.size > 5) {
      const ok = confirm(`هتفتح ${selected.size} نافذة واتساب واحدة بعد التانية. متأكد؟`)
      if (!ok) return
    }
    const list = customers.filter(c => selected.has(c.phone))
    list.forEach((c, idx) => {
      setTimeout(() => sendOne(c), idx * 800)
    })
  }

  return (
    <div dir="rtl" className="min-h-screen text-white" style={{ background: 'linear-gradient(180deg, #0a0617, #0f0a20)' }}>
      <div
        className="sticky top-0 z-30 px-4 py-3 backdrop-blur-xl flex items-center gap-3"
        style={{ background: 'rgba(10,6,23,0.85)', borderBottom: '1px solid rgba(34,197,94,0.25)' }}
      >
        <Link
          href="/owner"
          aria-label="رجوع"
          className="h-9 w-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5 flex-1">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)', boxShadow: '0 8px 24px rgba(37,211,102,0.4)' }}
          >
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black">تسويق واتساب</h1>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {customers.length} زبون من بياناتك — يفتح واتساب الخاص بك مباشرة
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Filters */}
        <div className="rounded-2xl p-3 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm font-bold"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
            >
              <option value="">كل الفروع</option>
              {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
              className="rounded-xl px-3 py-2 text-sm font-bold"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
            >
              <option value={30}>آخر 30 يوم</option>
              <option value={90}>آخر 90 يوم</option>
              <option value={180}>آخر 6 شهور</option>
              <option value={365}>آخر سنة</option>
            </select>
          </div>

          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 right-3 h-4 w-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الرقم..."
              className="w-full rounded-xl pr-10 pl-3 py-2 text-sm"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto">
            {([
              { id: 'all',       label: 'الكل',           color: '#a78bfa' },
              { id: 'vip',       label: 'VIP (500ج+)',    color: '#fbbf24' },
              { id: 'frequent',  label: 'متكرر (5+ زيارة)', color: '#34d399' },
              { id: 'inactive',  label: 'غايب (21 يوم+)',  color: '#f87171' },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black transition-all active:scale-95 flex items-center gap-1.5"
                style={{
                  background: filter === f.id ? `${f.color}25` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${filter === f.id ? `${f.color}60` : 'rgba(255,255,255,0.1)'}`,
                  color: filter === f.id ? f.color : 'rgba(255,255,255,0.6)',
                }}
              >
                <Filter className="h-3 w-3" />{f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates */}
        <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold" style={{ color: '#86efac' }}>قوالب سريعة:</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{'{name} · {place} · {favorite}'}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => setMessage(t.text)}
                className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac' }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full rounded-xl p-3 text-[13px] leading-relaxed resize-none"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(34,197,94,0.25)', color: '#fff' }}
            placeholder="اكتب رسالتك هنا..."
          />
        </div>

        {/* Selection bar */}
        {selected.size > 0 && (
          <div
            className="sticky top-[68px] z-20 rounded-2xl p-3 flex items-center justify-between gap-3"
            style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)', boxShadow: '0 12px 32px rgba(37,211,102,0.45)' }}
          >
            <div className="flex items-center gap-2 text-white">
              <Users className="h-4 w-4" />
              <span className="font-black text-sm">{selected.size} مختار</span>
              <button onClick={clearSel} className="text-[11px] underline opacity-80">إلغاء</button>
            </div>
            <button
              onClick={broadcastSelected}
              className="rounded-full px-4 py-2 text-[13px] font-black flex items-center gap-1.5 transition-all active:scale-95"
              style={{ background: '#fff', color: '#128c7e' }}
            >
              <Send className="h-3.5 w-3.5" /> ابعت لكلهم
            </button>
          </div>
        )}

        {/* Customer list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {filtered.length} زبون مطابق
            </p>
            {filtered.length > 0 && (
              <button
                onClick={selectAll}
                className="text-[11px] font-bold underline"
                style={{ color: '#a78bfa' }}
              >
                اختار الكل
              </button>
            )}
          </div>

          {loading && (
            <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.4)' }}>بيتم جمع زبائنك...</div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Users className="h-8 w-8 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                مفيش زبائن بأرقام موبايل في الفترة دي. اطلب من الكاشير يسجل رقم الموبايل عند كل طلب.
              </p>
            </div>
          )}

          {filtered.map(c => {
            const isSelected = selected.has(c.phone)
            const isVip = c.total_spent >= 500
            const isInactive = c.days_since_last >= 21
            return (
              <div
                key={c.phone}
                className="rounded-2xl p-3 flex items-center gap-3 transition-all"
                style={{
                  background: isSelected ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isSelected ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <button
                  onClick={() => toggle(c.phone)}
                  aria-label="اختيار"
                  className="h-6 w-6 rounded-md flex-shrink-0 flex items-center justify-center transition-all"
                  style={{
                    background: isSelected ? '#25d366' : 'rgba(255,255,255,0.06)',
                    border: `1.5px solid ${isSelected ? '#25d366' : 'rgba(255,255,255,0.2)'}`,
                  }}
                >
                  {isSelected && <span className="text-white text-xs font-black">✓</span>}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-sm font-black text-white truncate">{c.name}</h4>
                    {isVip && <Star className="h-3 w-3 flex-shrink-0" style={{ color: '#fbbf24' }} />}
                    {isInactive && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>غايب</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{c.phone}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{c.days_since_last === 0 ? 'اليوم' : `من ${c.days_since_last} يوم`}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10.5px] mt-1 flex-wrap">
                    <span style={{ color: '#34d399' }}>{c.total_spent.toLocaleString('en-US')} ج</span>
                    <span style={{ color: '#60a5fa' }}>{c.visits} زيارة</span>
                    {c.favorite && <span className="truncate" style={{ color: '#a78bfa' }}>♥ {c.favorite}</span>}
                  </div>
                </div>

                <button
                  onClick={() => sendOne(c)}
                  aria-label="ابعت لـ"
                  className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                  style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)', boxShadow: '0 4px 12px rgba(37,211,102,0.35)' }}
                >
                  <Send className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            )
          })}
        </div>

        <p className="text-center text-[10px] py-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
          الرسائل بتتبعت من واتساب جوالك مباشرة — مفيش رسوم ولا API خارجي
        </p>
      </div>
    </div>
  )
}
