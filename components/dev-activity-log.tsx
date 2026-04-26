'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Download, Loader2, RefreshCw, Search, Filter, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'

interface DevActivityRow {
  id: number
  actor_name: string | null
  actor_role: string | null
  action: string
  target: string | null
  status: string
  details: string | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

interface ApiResponse {
  ok?: boolean
  rows?: DevActivityRow[]
  total?: number
  error?: string
}

const ACTION_LABELS: Record<string, string> = {
  login_success: 'تسجيل دخول ناجح',
  login_failed: 'محاولة دخول فاشلة',
  password_change: 'تغيير كلمة المرور',
  password_change_failed: 'فشل تغيير كلمة المرور',
  reset_admin_credentials: 'ريسيت بيانات الأدمن',
  reset_user_sessions: 'ريسيت جلسات المستخدمين',
  reset_admin_and_users: 'ريسيت كامل (أدمن + مستخدمين)',
  reset_failed: 'محاولة ريسيت فاشلة',
  dev_admin_create: 'إنشاء حساب مطور',
  dev_admin_update: 'تعديل حساب مطور',
  dev_admin_delete: 'حذف حساب مطور',
  activity_log_export: 'تصدير سجل النشاط',
}

const ACTION_OPTIONS = Object.keys(ACTION_LABELS)

function formatDate(value: string): string {
  try {
    const d = new Date(value)
    return d.toLocaleString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return value
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
        <CheckCircle2 className="h-3 w-3" />
        ناجح
      </span>
    )
  }
  if (status === 'failure') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
        <XCircle className="h-3 w-3" />
        فشل
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(217,119,6,0.15)', color: '#fde68a', border: '1px solid rgba(217,119,6,0.3)' }}>
      <AlertCircle className="h-3 w-3" />
      تحذير
    </span>
  )
}

export function DevActivityLog() {
  const [rows, setRows] = useState<DevActivityRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const [filterActor, setFilterActor] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSince, setFilterSince] = useState('')
  const [filterUntil, setFilterUntil] = useState('')

  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (filterActor.trim()) params.set('actor', filterActor.trim())
    if (filterAction) params.set('action', filterAction)
    if (filterStatus) params.set('status', filterStatus)
    if (filterSince) params.set('since', new Date(filterSince).toISOString())
    if (filterUntil) params.set('until', new Date(filterUntil).toISOString())
    params.set('limit', '200')
    return params
  }, [filterActor, filterAction, filterStatus, filterSince, filterUntil])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/dev-activity?${queryParams.toString()}`)
      .then(async (res) => {
        const data: ApiResponse = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        return data
      })
      .then((data) => {
        if (cancelled) return
        setRows(data.rows || [])
        setTotal(data.total || 0)
      })
      .catch((err: any) => {
        if (cancelled) return
        setError(err?.message || 'فشل تحميل سجل النشاط')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [queryParams, refreshTick])

  function handleExport() {
    const params = new URLSearchParams(queryParams)
    params.delete('limit')
    window.open(`/api/dev-activity/export?${params.toString()}`, '_blank')
  }

  function clearFilters() {
    setFilterActor('')
    setFilterAction('')
    setFilterStatus('')
    setFilterSince('')
    setFilterUntil('')
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(184,137,63,0.10), rgba(212,175,98,0.04))',
          border: '1px solid rgba(184,137,63,0.25)',
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'rgba(184,137,63,0.15)', border: '1px solid rgba(184,137,63,0.35)' }}
            >
              <Activity className="h-5 w-5" style={{ color: '#f4db9c' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: '#fff5d6' }}>
                سجل نشاط المطور
              </h3>
              <p className="text-[11px]" style={{ color: '#d4af62' }}>
                كل عمليات تسجيل الدخول والريسيت وتعديل الحسابات والإعدادات الحساسة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshTick((t) => t + 1)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:scale-105"
              style={{
                background: 'rgba(184,137,63,0.12)',
                color: '#f4db9c',
                border: '1px solid rgba(184,137,63,0.3)',
              }}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              تحديث
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #fff5d6, #f4db9c, #d4af62, #b8893f)',
                color: '#1a1308',
                boxShadow: '0 4px 14px rgba(184,137,63,0.35)',
                border: '1px solid rgba(244,219,156,0.5)',
              }}
            >
              <Download className="h-3.5 w-3.5" />
              تصدير CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: '#9c8350' }} />
            <input
              type="text"
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
              placeholder="اسم المطور..."
              className="w-full rounded-lg bg-black/30 px-3 py-2 pr-7 text-xs text-[#fff5d6] placeholder:text-[#9c8350]/70 focus:outline-none focus:ring-1 focus:ring-[#b8893f]/50"
              style={{ border: '1px solid rgba(184,137,63,0.3)' }}
            />
          </div>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full rounded-lg bg-black/30 px-3 py-2 text-xs text-[#fff5d6] focus:outline-none focus:ring-1 focus:ring-[#b8893f]/50"
            style={{ border: '1px solid rgba(184,137,63,0.3)' }}
          >
            <option value="">كل الأفعال</option>
            {ACTION_OPTIONS.map((act) => (
              <option key={act} value={act}>
                {ACTION_LABELS[act]}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-lg bg-black/30 px-3 py-2 text-xs text-[#fff5d6] focus:outline-none focus:ring-1 focus:ring-[#b8893f]/50"
            style={{ border: '1px solid rgba(184,137,63,0.3)' }}
          >
            <option value="">كل الحالات</option>
            <option value="success">ناجح</option>
            <option value="failure">فشل</option>
            <option value="warning">تحذير</option>
          </select>
          <input
            type="datetime-local"
            value={filterSince}
            onChange={(e) => setFilterSince(e.target.value)}
            className="w-full rounded-lg bg-black/30 px-3 py-2 text-xs text-[#fff5d6] focus:outline-none focus:ring-1 focus:ring-[#b8893f]/50"
            style={{ border: '1px solid rgba(184,137,63,0.3)' }}
            title="من"
          />
          <input
            type="datetime-local"
            value={filterUntil}
            onChange={(e) => setFilterUntil(e.target.value)}
            className="w-full rounded-lg bg-black/30 px-3 py-2 text-xs text-[#fff5d6] focus:outline-none focus:ring-1 focus:ring-[#b8893f]/50"
            style={{ border: '1px solid rgba(184,137,63,0.3)' }}
            title="إلى"
          />
        </div>

        {(filterActor || filterAction || filterStatus || filterSince || filterUntil) && (
          <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: '#d4af62' }}>
            <Filter className="h-3 w-3" />
            <span>فلاتر نشطة</span>
            <button onClick={clearFilters} className="underline hover:text-[#fff5d6]">
              مسح
            </button>
          </div>
        )}

        <div className="mt-2 text-[11px]" style={{ color: '#9c8350' }}>
          الإجمالي: <span style={{ color: '#f4db9c', fontWeight: 700 }}>{total}</span> سجل
          {rows.length < total && (
            <span> · معروض {rows.length}</span>
          )}
        </div>
      </div>

      {error && (
        <div
          className="rounded-xl p-3 text-xs flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,8,5,0.6)',
          border: '1px solid rgba(184,137,63,0.22)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ background: 'rgba(184,137,63,0.10)', borderBottom: '1px solid rgba(184,137,63,0.25)' }}>
                <th className="px-3 py-2 text-right font-bold" style={{ color: '#f4db9c' }}>الوقت</th>
                <th className="px-3 py-2 text-right font-bold" style={{ color: '#f4db9c' }}>المطور</th>
                <th className="px-3 py-2 text-right font-bold" style={{ color: '#f4db9c' }}>الدور</th>
                <th className="px-3 py-2 text-right font-bold" style={{ color: '#f4db9c' }}>الفعل</th>
                <th className="px-3 py-2 text-right font-bold" style={{ color: '#f4db9c' }}>الهدف</th>
                <th className="px-3 py-2 text-right font-bold" style={{ color: '#f4db9c' }}>الحالة</th>
                <th className="px-3 py-2 text-right font-bold" style={{ color: '#f4db9c' }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center" style={{ color: '#9c8350' }}>
                    <Loader2 className="inline-block h-4 w-4 animate-spin ml-2" />
                    جاري التحميل...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && !error && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center" style={{ color: '#9c8350' }}>
                    لا توجد سجلات تطابق الفلاتر
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-black/30 transition-colors"
                  style={{ borderBottom: '1px solid rgba(184,137,63,0.10)' }}
                >
                  <td className="px-3 py-2 font-mono text-[10px] whitespace-nowrap" style={{ color: '#d4af62' }}>
                    {formatDate(row.created_at)}
                  </td>
                  <td className="px-3 py-2 font-bold" style={{ color: '#fff5d6' }}>
                    {row.actor_name || <span style={{ color: '#9c8350' }}>—</span>}
                  </td>
                  <td className="px-3 py-2 text-[10px]" style={{ color: '#d4af62' }}>
                    {row.actor_role || <span style={{ color: '#9c8350' }}>—</span>}
                  </td>
                  <td className="px-3 py-2" style={{ color: '#f4db9c' }}>
                    {ACTION_LABELS[row.action] || row.action}
                  </td>
                  <td className="px-3 py-2 text-[10px]" style={{ color: '#d4af62' }}>
                    {row.target || <span style={{ color: '#9c8350' }}>—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px]" style={{ color: '#9c8350' }}>
                    {row.ip || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-center" style={{ color: '#7a6332' }}>
        يحتفظ النظام بسجل كامل لكل العمليات الحساسة لأغراض المراجعة والتدقيق
      </p>
    </div>
  )
}
