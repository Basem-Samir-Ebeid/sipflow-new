'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type Place = { id: string; name: string; code: string }

interface OrderSimulatorProps {
  places: Place[]
}

type SimResult = { success: boolean; drink: string; name: string; error?: string }

export function OrderSimulator({ places }: OrderSimulatorProps) {
  const [selectedPlace, setSelectedPlace] = useState('')
  const [count, setCount] = useState(5)
  const [delay, setDelay] = useState(200)
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<SimResult[]>([])
  const [summary, setSummary] = useState('')

  const handleRun = async () => {
    if (!selectedPlace) { toast.error('اختر مكاناً أولاً'); return }
    setIsRunning(true)
    setResults([])
    setSummary('')
    try {
      const res = await fetch('/api/simulate-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_id: selectedPlace, count, delay_ms: delay }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'فشلت المحاكاة'); return }
      setResults(data.results || [])
      setSummary(data.message || '')
      toast.success(data.message)
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setIsRunning(false)
    }
  }

  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="rounded-2xl p-4 space-y-1" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🎮</span>
          <div>
            <h3 className="text-sm font-bold text-foreground">محاكي الطلبات</h3>
            <p className="text-xs text-muted-foreground">ينشئ طلبات وهمية حقيقية على مكان لاختبار النظام تحت الضغط</p>
          </div>
        </div>
      </div>

      {/* Config */}
      <div className="rounded-2xl p-4 space-y-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">المكان المستهدف</Label>
          <select
            value={selectedPlace}
            onChange={e => setSelectedPlace(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            <option value="">— اختر مكاناً —</option>
            {places.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">عدد الطلبات</Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={50}
                value={count}
                onChange={e => setCount(Number(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-sm font-bold text-indigo-400 w-8 text-center">{count}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">التأخير بين الطلبات</Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={1000}
                step={50}
                value={delay}
                onChange={e => setDelay(Number(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-[11px] font-bold text-indigo-400 w-14 text-center">{delay}ms</span>
            </div>
          </div>
        </div>

        {/* Info chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: `${count} طلب`, color: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.3)', text: '#a5b4fc' },
            { label: delay === 0 ? 'فوري' : `${(count * delay / 1000).toFixed(1)}ث تقريباً`, color: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', text: '#6ee7b7' },
            { label: 'أسماء وهمية تبدأ بـ [SIM]', color: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#fcd34d' },
          ].map((chip, i) => (
            <span key={i} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{ background: chip.color, border: `1px solid ${chip.border}`, color: chip.text }}>
              {chip.label}
            </span>
          ))}
        </div>

        <Button
          onClick={handleRun}
          disabled={isRunning || !selectedPlace}
          className="w-full h-11 text-sm font-bold rounded-xl"
          style={{
            background: isRunning ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#fff',
            border: 'none',
            boxShadow: isRunning ? 'none' : '0 2px 14px rgba(99,102,241,0.35)',
          }}
        >
          {isRunning ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              جاري المحاكاة...
            </span>
          ) : (
            `▶ تشغيل المحاكي`
          )}
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">نتائج المحاكاة</h4>
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                ✓ {successCount}
              </span>
              {failCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                  ✗ {failCount}
                </span>
              )}
            </div>
          </div>
          {summary && <p className="text-xs text-muted-foreground">{summary}</p>}

          <div className="space-y-1.5 max-h-52 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs"
                style={{
                  background: r.success ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
                  border: `1px solid ${r.success ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                }}>
                <span>{r.success ? '✅' : '❌'}</span>
                <span className="font-medium" style={{ color: r.success ? '#6ee7b7' : '#fca5a5' }}>{r.name}</span>
                <span className="text-muted-foreground">←</span>
                <span className="text-foreground">{r.drink}</span>
                {r.error && <span className="text-red-400 text-[10px] mr-auto">{r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
