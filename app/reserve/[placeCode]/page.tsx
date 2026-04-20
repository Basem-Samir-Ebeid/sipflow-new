'use client'

import { useState, useEffect, use } from 'react'

interface Place {
  id: string
  name: string
  code: string
  reservations_enabled: boolean | null
  logo_url: string | null
}

export default function ReservePage({ params }: { params: Promise<{ placeCode: string }> }) {
  const { placeCode } = use(params)
  const [place, setPlace] = useState<Place | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [disabled, setDisabled] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!placeCode) { setNotFound(true); setLoading(false); return }
    // Normalize: decode first (in case params arrive URL-encoded), then re-encode for the query string
    const normalizedCode = (() => { try { return decodeURIComponent(placeCode) } catch { return placeCode } })()
    fetch(`/api/places/lookup?code=${encodeURIComponent(normalizedCode)}`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok || data.error) {
          setNotFound(true)
        } else {
          if (data.reservations_enabled === false) { setDisabled(true) }
          setPlace(data)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [placeCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('الاسم مطلوب'); return }
    if (!date || !time) { setError('التاريخ والوقت مطلوبان'); return }
    setSubmitting(true)
    setError('')
    try {
      const reserved_at = new Date(`${date}T${time}:00`).toISOString()
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: place!.id,
          customer_name: name.trim(),
          customer_phone: phone.trim() || undefined,
          party_size: partySize,
          reserved_at,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setSuccess(true)
    } catch {
      setError('حدث خطأ. حاول مرة أخرى')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0a0a]">
        <p className="text-amber-400 text-lg animate-pulse">جاري التحميل...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#0a0a0a] gap-4 p-6">
        <p className="text-4xl">😕</p>
        <h1 className="text-xl font-bold text-white">المكان غير موجود</h1>
        <p className="text-gray-400 text-sm text-center">تأكد من الرابط وحاول مرة أخرى</p>
      </div>
    )
  }

  if (disabled) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#0a0a0a] gap-4 p-6">
        <p className="text-4xl">🔒</p>
        <h1 className="text-xl font-bold text-white">الحجز غير متاح</h1>
        <p className="text-gray-400 text-sm text-center">{place?.name} — الحجز المسبق غير مفعّل حالياً</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#0a0a0a] gap-6 p-6" dir="rtl">
        <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center">
          <span className="text-4xl">✅</span>
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">تم الحجز بنجاح!</h1>
          <p className="text-gray-400">سنتواصل معك للتأكيد قريباً</p>
          <p className="text-amber-400 font-semibold mt-4">{place?.name}</p>
        </div>
        <button
          onClick={() => { setSuccess(false); setName(''); setPhone(''); setDate(''); setTime(''); setNotes(''); setPartySize(2) }}
          className="mt-4 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold transition-colors text-sm"
        >
          حجز جديد
        </button>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white" dir="rtl">
      <div className="max-w-md mx-auto px-4 py-10 space-y-8">
        {/* Back button */}
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : (window.location.href = '/')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-amber-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          خروج
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          {place?.logo_url && (
            <img src={place.logo_url} alt={place.name} className="w-16 h-16 rounded-2xl mx-auto object-cover mb-3" />
          )}
          <h1 className="text-2xl font-bold text-amber-400">{place?.name}</h1>
          <p className="text-gray-400 text-sm">احجز طاولتك مسبقاً</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">الاسم *</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="اسمك الكامل"
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">رقم الهاتف</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
            />
          </div>

          {/* Party Size */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">عدد الأشخاص</label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setPartySize(s => Math.max(1, s - 1))}
                className="w-10 h-10 rounded-full border border-white/10 bg-white/5 text-white text-xl flex items-center justify-center hover:bg-white/10 transition-colors"
              >−</button>
              <span className="text-2xl font-bold text-amber-400 w-8 text-center">{partySize}</span>
              <button
                type="button"
                onClick={() => setPartySize(s => Math.min(20, s + 1))}
                className="w-10 h-10 rounded-full border border-white/10 bg-white/5 text-white text-xl flex items-center justify-center hover:bg-white/10 transition-colors"
              >+</button>
              <span className="text-gray-400 text-sm">شخص</span>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">التاريخ *</label>
              <input
                type="date"
                value={date}
                min={today}
                onChange={e => { setDate(e.target.value); setError('') }}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">الوقت *</label>
              <input
                type="time"
                value={time}
                onChange={e => { setTime(e.target.value); setError('') }}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">ملاحظات (اختياري)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="أي طلبات خاصة..."
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold py-4 text-base transition-colors"
          >
            {submitting ? '⏳ جاري الحجز...' : '📅 تأكيد الحجز'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600">
          سيتم التواصل معك لتأكيد الحجز
        </p>
      </div>
    </div>
  )
}
