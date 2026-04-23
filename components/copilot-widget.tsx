'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sparkles, X, RefreshCw, ChevronDown } from 'lucide-react'

type Severity = 'critical' | 'warning' | 'info' | 'success'
type Insight = {
  id: string
  icon: string
  severity: Severity
  title: string
  message: string
  metric?: string
  action?: string
}

const severityStyles: Record<Severity, { bg: string; border: string; chip: string; label: string }> = {
  critical: { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.4)',  chip: '#ef4444', label: 'عاجل' },
  warning:  { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.4)', chip: '#f59e0b', label: 'تنبيه' },
  info:     { bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.4)', chip: '#60a5fa', label: 'معلومة' },
  success:  { bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.4)', chip: '#34d399', label: 'إيجابي' },
}

export function CopilotWidget({ placeId }: { placeId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!placeId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/copilot/insights?place_id=${encodeURIComponent(placeId)}`, { cache: 'no-store' })
      const data = await res.json()
      setInsights(Array.isArray(data.insights) ? data.insights : [])
      setLastUpdate(new Date())
    } catch {
      setInsights([])
    } finally {
      setLoading(false)
    }
  }, [placeId])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 3 minutes when panel is open
  useEffect(() => {
    if (!open) return
    const t = setInterval(load, 3 * 60 * 1000)
    return () => clearInterval(t)
  }, [open, load])

  const criticalCount = insights.filter(i => i.severity === 'critical').length
  const badgeCount = insights.length

  return (
    <>
      {/* Floating launch button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="فتح المساعد الذكي"
        className="fixed z-40 flex items-center gap-2 rounded-full px-4 py-3 font-bold text-sm shadow-2xl transition-all duration-200 active:scale-95 hover:scale-105"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          insetInlineEnd: '16px',
          background: criticalCount > 0
            ? 'linear-gradient(135deg, #ef4444, #f59e0b)'
            : 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
          color: '#fff',
          boxShadow: criticalCount > 0
            ? '0 8px 32px rgba(239,68,68,0.5), 0 0 0 1px rgba(255,255,255,0.15) inset'
            : '0 8px 32px rgba(139,92,246,0.45), 0 0 0 1px rgba(255,255,255,0.15) inset',
        }}
      >
        <Sparkles className="h-4 w-4" />
        <span>المساعد الذكي</span>
        {badgeCount > 0 && (
          <span
            className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-black tabular-nums"
            style={{ background: '#fff', color: criticalCount > 0 ? '#ef4444' : '#8b5cf6' }}
          >
            {badgeCount}
          </span>
        )}
      </button>

      {/* Slide-up panel */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #1a1530, #0f0a20)',
              border: '1px solid rgba(139,92,246,0.3)',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.7)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 border-b"
              style={{ borderColor: 'rgba(139,92,246,0.2)', background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.08))' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', boxShadow: '0 0 20px rgba(139,92,246,0.5)' }}
                >
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">المساعد الذكي</h3>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {lastUpdate ? `آخر تحديث: ${lastUpdate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` : 'جاري التحليل...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={load}
                  disabled={loading}
                  aria-label="تحديث"
                  className="h-8 w-8 rounded-lg flex items-center justify-center transition-all active:scale-90"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="إغلاق"
                  className="h-8 w-8 rounded-lg flex items-center justify-center transition-all active:scale-90 sm:hidden"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="إغلاق"
                  className="h-8 w-8 rounded-lg hidden sm:flex items-center justify-center transition-all active:scale-90"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {loading && insights.length === 0 && (
                <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <Sparkles className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm">بيحلل الفرع لحظة بلحظة...</p>
                </div>
              )}

              {insights.map((ins) => {
                const s = severityStyles[ins.severity]
                return (
                  <div
                    key={ins.id}
                    className="rounded-2xl p-3.5 transition-all duration-200"
                    style={{ background: s.bg, border: `1px solid ${s.border}` }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{ins.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-sm font-black text-white">{ins.title}</h4>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${s.chip}25`, color: s.chip, border: `1px solid ${s.chip}50` }}
                          >
                            {s.label}
                          </span>
                          {ins.metric && (
                            <span className="text-[10px] font-black tabular-nums" style={{ color: s.chip }}>
                              {ins.metric}
                            </span>
                          )}
                        </div>
                        <p className="text-[12.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}>
                          {ins.message}
                        </p>
                        {ins.action && (
                          <div
                            className="mt-2 text-[11.5px] font-semibold rounded-lg px-2.5 py-1.5"
                            style={{ background: 'rgba(0,0,0,0.25)', color: s.chip, borderLeft: `3px solid ${s.chip}` }}
                          >
                            ← {ins.action}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div
              className="px-4 py-2.5 border-t text-center text-[10px]"
              style={{ borderColor: 'rgba(139,92,246,0.2)', color: 'rgba(255,255,255,0.4)' }}
            >
              التوصيات بتعتمد على بيانات آخر 28 يوم — وبتتحسن كل ما تشتغل أكتر
            </div>
          </div>
        </div>
      )}
    </>
  )
}
