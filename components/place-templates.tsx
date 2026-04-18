'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Place = { id: string; name: string; code: string }
type Template = { id: string; name: string; description: string; drinkCount: number; createdAt: string }

interface PlaceTemplatesProps {
  places: Place[]
}

export function PlaceTemplates({ places }: PlaceTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [savePlaceId, setSavePlaceId] = useState('')
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [applyTemplateId, setApplyTemplateId] = useState('')
  const [applyPlaceId, setApplyPlaceId] = useState('')
  const [isApplying, setIsApplying] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/place-templates')
      const data = await res.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch {
      toast.error('فشل في تحميل القوالب')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  const handleSave = async () => {
    if (!savePlaceId) { toast.error('اختر المكان المصدر'); return }
    if (!saveName.trim()) { toast.error('أدخل اسم القالب'); return }
    setIsSaving(true)
    try {
      const res = await fetch('/api/place-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', place_id: savePlaceId, name: saveName.trim(), description: saveDesc.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'فشل الحفظ'); return }
      toast.success(`تم حفظ القالب بـ ${data.drinkCount} مشروب ✅`)
      setSaveName('')
      setSaveDesc('')
      setSavePlaceId('')
      loadTemplates()
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setIsSaving(false)
    }
  }

  const handleApply = async () => {
    if (!applyTemplateId) { toast.error('اختر القالب'); return }
    if (!applyPlaceId) { toast.error('اختر المكان الهدف'); return }
    setIsApplying(true)
    try {
      const res = await fetch('/api/place-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', template_id: applyTemplateId, place_id: applyPlaceId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'فشل التطبيق'); return }
      toast.success(`تم إضافة ${data.created} مشروب للمكان ✅`)
      setApplyTemplateId('')
      setApplyPlaceId('')
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setIsApplying(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`حذف قالب "${name}"؟`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/place-templates?id=${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('تم حذف القالب'); loadTemplates() }
      else toast.error('فشل الحذف')
    } catch {
      toast.error('خطأ في الاتصال')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return iso }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="rounded-2xl p-4 space-y-1" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">📦</span>
          <div>
            <h3 className="text-sm font-bold text-foreground">قوالب المكان</h3>
            <p className="text-xs text-muted-foreground">احفظ منيو أي مكان كقالب وطبّقه على مكان جديد بضغطة</p>
          </div>
        </div>
      </div>

      {/* Save new template */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest">💾 حفظ قالب جديد</h4>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">المكان المصدر (اللي تحفظ منيوه)</Label>
          <select
            value={savePlaceId}
            onChange={e => setSavePlaceId(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          >
            <option value="">— اختر مكاناً —</option>
            {places.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">اسم القالب</Label>
          <Input
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder="مثال: منيو كافيه كلاسيكي"
            className="border-border bg-muted text-foreground"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">وصف (اختياري)</Label>
          <Input
            value={saveDesc}
            onChange={e => setSaveDesc(e.target.value)}
            placeholder="مثال: منيو كامل للكافيهات المتوسطة"
            className="border-border bg-muted text-foreground"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving || !savePlaceId || !saveName.trim()}
          className="w-full h-10 text-sm font-bold rounded-xl"
          style={{
            background: isSaving ? 'rgba(168,85,247,0.3)' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
            color: '#fff', border: 'none',
            boxShadow: isSaving ? 'none' : '0 2px 14px rgba(168,85,247,0.3)',
          }}
        >
          {isSaving ? 'جاري الحفظ...' : '📦 حفظ كقالب'}
        </Button>
      </div>

      {/* Apply template */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">🚀 تطبيق قالب على مكان</h4>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">اختر القالب</Label>
          <select
            value={applyTemplateId}
            onChange={e => setApplyTemplateId(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="">— اختر قالباً —</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.drinkCount} مشروب)</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">المكان الهدف (اللي تطبق عليه)</Label>
          <select
            value={applyPlaceId}
            onChange={e => setApplyPlaceId(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="">— اختر مكاناً —</option>
            {places.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {applyTemplateId && applyPlaceId && (
          <div className="rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fcd34d' }}>
            ⚠️ ستُضاف مشروبات القالب إلى المكان المختار. المشروبات الموجودة لن تُحذف.
          </div>
        )}

        <Button
          onClick={handleApply}
          disabled={isApplying || !applyTemplateId || !applyPlaceId}
          className="w-full h-10 text-sm font-bold rounded-xl"
          style={{
            background: isApplying ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff', border: 'none',
            boxShadow: isApplying ? 'none' : '0 2px 14px rgba(16,185,129,0.3)',
          }}
        >
          {isApplying ? 'جاري التطبيق...' : '🚀 تطبيق القالب'}
        </Button>
      </div>

      {/* Templates list */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">القوالب المحفوظة</h4>
          <button onClick={loadTemplates} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">↻ تحديث</button>
        </div>

        {isLoading ? (
          <div className="text-center py-6 text-sm text-muted-foreground">جاري التحميل...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <div className="text-3xl">📭</div>
            <p className="text-sm text-muted-foreground">لا توجد قوالب محفوظة بعد</p>
            <p className="text-xs text-muted-foreground/60">احفظ منيو مكان لتظهر هنا</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                  style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
                  📦
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">{t.drinkCount} مشروب</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-[11px] text-muted-foreground">{formatDate(t.createdAt)}</span>
                  </div>
                  {t.description && <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{t.description}</p>}
                </div>
                <button
                  onClick={() => handleDelete(t.id, t.name)}
                  disabled={deletingId === t.id}
                  className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  {deletingId === t.id ? '...' : '✕'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
