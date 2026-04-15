'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { User, Place, OrderWithDetails } from '@/lib/types'
import { LogOut, RefreshCw, Printer, CheckCircle2, Banknote, X, Clock, AlertCircle, FileText, ChevronRight, Eye, CalendarDays, CalendarCheck, CalendarX, Users, Phone, Loader2, Activity, TrendingUp, Utensils } from 'lucide-react'
import { toast, Toaster } from 'sonner'

interface Reservation {
  id: string
  place_id: string
  customer_name: string
  customer_phone: string | null
  party_size: number
  reserved_at: string
  status: 'pending' | 'confirmed' | 'cancelled'
  notes: string | null
  table_number: string | null
}

interface CashierDashboardProps {
  currentUser: User
  currentPlace: Place
  onLogout: () => void
}

type SettlementItem = { name: string; quantity: number; unitPrice: number; total: number }
type Settlement = {
  id: string
  tableNum: string
  items: SettlementItem[]
  subtotal: number
  serviceCharge: number
  taxRate: number
  total: number
  settledAt: Date
  orderIds: string[]
}
type ReceiptData = {
  tableNum: string
  items: SettlementItem[]
  subtotal: number
  serviceCharge: number
  taxRate: number
  total: number
  cashier: string
  place: string
  receiptNum: string
  date: Date
}

const genReceiptNum = () => Math.floor(100000 + Math.random() * 900000).toString()

export function CashierDashboard({ currentUser, currentPlace, onLogout }: CashierDashboardProps) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [paidTables, setPaidTables] = useState<Set<string>>(new Set())
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [registeredTables, setRegisteredTables] = useState<string[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [showReport, setShowReport] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<ReceiptData | null>(null)
  // Reservations state
  const [showReservations, setShowReservations] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isFetchingReservations, setIsFetchingReservations] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [tableInputs, setTableInputs] = useState<Record<string, string>>({})
  const prevPendingCountRef = useRef<number>(-1)
  const prevOrderCountRef = useRef<number>(-1)
  const [alarmActive, setAlarmActive] = useState(false)
  const alarmLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const playBeepOnce = () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const pattern = [
        { freq: 880, dur: 0.15 },
        { freq: 1100, dur: 0.15 },
        { freq: 1320, dur: 0.2 },
      ]
      let offset = 0
      const t = ctx.currentTime
      for (const note of pattern) {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.type = 'sine'
        const st = t + offset
        osc.frequency.setValueAtTime(note.freq, st)
        g.gain.setValueAtTime(0, st)
        g.gain.linearRampToValueAtTime(0.8, st + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, st + note.dur)
        osc.start(st)
        osc.stop(st + note.dur)
        offset += note.dur + 0.05
      }
      setTimeout(() => { try { ctx.close() } catch {} }, 900)
    } catch {}
  }

  const triggerAlarm = () => {
    if (alarmLoopRef.current) return
    setAlarmActive(true)
    playBeepOnce()
    alarmLoopRef.current = setInterval(() => playBeepOnce(), 2500)
  }

  const stopAlarm = () => {
    if (alarmLoopRef.current) { clearInterval(alarmLoopRef.current); alarmLoopRef.current = null }
    setAlarmActive(false)
  }

  const tableCount = currentPlace.table_count ?? 10
  const sequentialTables = Array.from({ length: tableCount }, (_, i) => String(i + 1))
  const allTables = Array.from(new Set([...sequentialTables, ...registeredTables])).sort((a, b) => {
    const na = parseInt(a), nb = parseInt(b)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return a.localeCompare(b)
  })

  const fetchRegisteredTables = useCallback(async () => {
    try {
      const res = await fetch(`/api/users?place_id=${currentPlace.id}`)
      const users = await res.json()
      if (Array.isArray(users)) {
        const tables = users
          .filter((u: { name?: string; table_number?: string }) => u.name?.startsWith('Guest-') && u.table_number)
          .map((u: { table_number: string }) => u.table_number)
        setRegisteredTables(tables)
      }
    } catch { /* silent */ }
  }, [currentPlace.id])

  const fetchReservations = useCallback(async (silent = false) => {
    if (!silent) setIsFetchingReservations(true)
    try {
      const res = await fetch(`/api/reservations?place_id=${currentPlace.id}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setReservations(data)
        const pendingCount = data.filter((r: Reservation) => r.status === 'pending').length
        if (prevPendingCountRef.current >= 0 && pendingCount > prevPendingCountRef.current) {
          toast.info(`حجز جديد وصل! (${pendingCount} في الانتظار)`, {
            description: 'اضغط على زرار الحجوزات لمراجعتها',
            duration: 6000,
          })
          triggerAlarm()
        }
        prevPendingCountRef.current = pendingCount
      }
    } catch { /* silent */ }
    finally { if (!silent) setIsFetchingReservations(false) }
  }, [currentPlace.id])

  const handleConfirmReservation = async (id: string) => {
    const tableNum = tableInputs[id]?.trim()
    if (!tableNum) { toast.error('ادخل رقم الطاولة أولاً'); return }
    setConfirmingId(id)
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed', table_number: tableNum }),
      })
      if (!res.ok) throw new Error()
      toast.success(`تم تأكيد الحجز — طاولة ${tableNum}`)
      setTableInputs(prev => { const n = { ...prev }; delete n[id]; return n })
      fetchReservations(true)
    } catch { toast.error('فشل تأكيد الحجز') }
    finally { setConfirmingId(null) }
  }

  const handleCancelReservation = async (id: string) => {
    setCancellingId(id)
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (!res.ok) throw new Error()
      toast.success('تم إلغاء الحجز')
      fetchReservations(true)
    } catch { toast.error('فشل إلغاء الحجز') }
    finally { setCancellingId(null) }
  }

  const fetchOrders = useCallback(async () => {
    setIsFetching(true)
    try {
      const sessRes = await fetch(`/api/sessions?readonly=true&place_id=${currentPlace.id}`)
      const sess = await sessRes.json()
      if (!sess?.id) { setOrders([]); return }
      const ordRes = await fetch(`/api/orders?session_id=${sess.id}`)
      const data = await ordRes.json()
      const fetched = Array.isArray(data) ? data : []
      const pendingCount = fetched.filter((o: { status: string }) => o.status === 'pending').length
      if (prevOrderCountRef.current >= 0 && pendingCount > prevOrderCountRef.current) {
        toast.success('طلب جديد وصل!')
        triggerAlarm()
      }
      prevOrderCountRef.current = pendingCount
      setOrders(fetched)
      setSecondsAgo(0)
    } catch { setOrders([]) }
    finally { setIsFetching(false) }
  }, [currentPlace.id])

  useEffect(() => {
    fetchRegisteredTables(); fetchOrders()
    const iv = setInterval(() => { fetchOrders(); fetchRegisteredTables() }, 15000)
    return () => clearInterval(iv)
  }, [fetchOrders, fetchRegisteredTables])

  useEffect(() => {
    fetchReservations()
    const iv = setInterval(() => fetchReservations(true), 15000)
    return () => clearInterval(iv)
  }, [fetchReservations])

  useEffect(() => {
    const t = setInterval(() => setSecondsAgo(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [orders])

  const getTableNum = (o: OrderWithDetails): string => {
    if (o.user?.table_number) return o.user.table_number
    if (o.notes?.includes('مطور')) {
      const m = o.notes.match(/طاولة\s+(\S+)/)
      if (m) return m[1]
    }
    return 'x'
  }

  const tableMap = new Map<string, OrderWithDetails[]>()
  orders.forEach(o => {
    const tbl = getTableNum(o)
    if (!tableMap.has(tbl)) tableMap.set(tbl, [])
    tableMap.get(tbl)!.push(o)
  })

  const settledRevenue = settlements.reduce((s, st) => s + st.total, 0)
  const activeRevenue = orders.filter(o => !paidTables.has(getTableNum(o))).reduce((s, o) => s + (Number(o.drink?.price) || 0) * o.quantity, 0)
  const selectedOrders = selectedTable ? (tableMap.get(selectedTable) || []) : []
  const selectedTotal = selectedOrders.reduce((s, o) => s + (Number(o.drink?.price) || 0) * o.quantity, 0)
  const selectedIsPaid = selectedTable ? paidTables.has(selectedTable) : false

  const serviceChargeRate = currentPlace.service_charge ?? 0
  const taxRateVal = currentPlace.tax_rate ?? 0

  const calcTotals = (subtotal: number, sc: number, tr: number) => {
    const serviceAmt = subtotal * sc / 100
    const taxAmt = (subtotal + serviceAmt) * tr / 100
    return { serviceAmt, taxAmt, grandTotal: subtotal + serviceAmt + taxAmt }
  }

  const ordersToReceiptItems = (ords: OrderWithDetails[]): SettlementItem[] =>
    ords.map(o => ({
      name: o.drink?.name ?? '—',
      quantity: o.quantity,
      unitPrice: Number(o.drink?.price) || 0,
      total: (Number(o.drink?.price) || 0) * o.quantity
    }))

  const openReceiptPreview = (tableNum: string, ords: OrderWithDetails[], subtotal: number) => {
    const { grandTotal } = calcTotals(subtotal, serviceChargeRate, taxRateVal)
    setReceiptPreview({
      tableNum,
      items: ordersToReceiptItems(ords),
      subtotal,
      serviceCharge: serviceChargeRate,
      taxRate: taxRateVal,
      total: grandTotal,
      cashier: currentUser.name,
      place: currentPlace.name,
      receiptNum: genReceiptNum(),
      date: new Date()
    })
  }

  const openSettlementPreview = (s: Settlement) => {
    setReceiptPreview({
      tableNum: s.tableNum,
      items: s.items,
      subtotal: s.subtotal,
      serviceCharge: s.serviceCharge,
      taxRate: s.taxRate,
      total: s.total,
      cashier: currentUser.name,
      place: currentPlace.name,
      receiptNum: s.id.split('-')[1] || genReceiptNum(),
      date: s.settledAt
    })
  }

  const triggerPrint = (r: ReceiptData) => {
    const rows = r.items.map(item => `
      <tr>
        <td style="padding:6px 4px;text-align:right;border-bottom:1px dashed #e0e0e0">${item.name}</td>
        <td style="padding:6px 4px;text-align:center;border-bottom:1px dashed #e0e0e0;font-weight:700">${item.quantity}</td>
        <td style="padding:6px 4px;text-align:right;border-bottom:1px dashed #e0e0e0">${item.unitPrice.toFixed(2)}</td>
        <td style="padding:6px 4px;text-align:right;border-bottom:1px dashed #e0e0e0;font-weight:700">${item.total.toFixed(2)}</td>
      </tr>`).join('')
    const win = window.open('', '_blank', 'width=360,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ${r.receiptNum}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a2e;background:#fff;max-width:300px;margin:0 auto;padding:20px 12px}
      @media print{body{padding:5px}}
    </style></head><body>${buildReceiptBody(r, rows)}</body></html>`)
    win.document.close(); win.focus()
    setTimeout(() => { win.print(); win.close() }, 600)
  }

  const buildReceiptBody = (r: ReceiptData, rows: string) => {
    const { serviceAmt, taxAmt } = calcTotals(r.subtotal, r.serviceCharge, r.taxRate)
    const feesRows = [
      r.serviceCharge > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;margin:3px 0"><span>رسوم الخدمة (${r.serviceCharge}%):</span><span>${serviceAmt.toFixed(2)}</span></div>` : '',
      r.taxRate > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;margin:3px 0"><span>الضريبة (${r.taxRate}%):</span><span>${taxAmt.toFixed(2)}</span></div>` : ''
    ].filter(Boolean).join('')
    return `
    <div style="text-align:center;margin-bottom:6px">
      <img src="${window.location.origin}/images/sipflow-logo.jpg" alt="SîpFlõw" style="width:90px;height:90px;object-fit:contain;display:block;margin:0 auto 4px" />
      <div style="font-size:20px;font-weight:900;letter-spacing:2px;color:#1a1a2e">SîpFlõw</div>
      <div style="font-size:10px;letter-spacing:3px;color:#666;margin:2px 0 10px">— SYSTEM POS —</div>
    </div>
    <div style="border-top:1px dashed #aaa;margin:8px 0"></div>
    <div style="font-size:12px;margin:3px 0">Receipt #: ${r.receiptNum}</div>
    <div style="font-size:12px;margin:3px 0">Date: ${r.date.toLocaleDateString('en-GB')} &nbsp; ${r.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
    <div style="font-size:12px;margin:3px 0">Cashier: ${r.cashier}</div>
    <div style="font-size:12px;margin:3px 0">Table: ${r.tableNum}</div>
    <div style="border-top:1px dashed #aaa;margin:8px 0"></div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:1px solid #1a1a2e">
          <th style="padding:5px 4px;text-align:right;font-size:12px">Item</th>
          <th style="padding:5px 4px;text-align:center;font-size:12px">Qty</th>
          <th style="padding:5px 4px;text-align:right;font-size:12px">Price</th>
          <th style="padding:5px 4px;text-align:right;font-size:12px">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="border-top:1px dashed #aaa;margin:10px 0 6px"></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin:3px 0"><span>Subtotal:</span><span style="font-weight:700">${r.subtotal.toFixed(2)}</span></div>
    ${feesRows}
    <div style="border-top:1px dashed #aaa;margin:6px 0"></div>
    <div style="background:#1a1a2e;color:#fff;padding:9px 10px;display:flex;justify-content:space-between;font-size:15px;font-weight:900;margin:8px 0;border-radius:2px">
      <span>Grand Total:</span><span>${r.total.toFixed(2)}</span>
    </div>
    <div style="border-top:1px dashed #aaa;margin:6px 0"></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0"><span>Paid by: Cash</span><span style="font-weight:700">${r.total.toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin:4px 0"><span>Change:</span><span>0.00</span></div>
    <div style="border-top:1px dashed #aaa;margin:10px 0 6px"></div>
    <div style="text-align:center;font-size:13px;margin:10px 0 4px">شكراً لزيارتكم! 🙏</div>
    <div style="text-align:center;font-size:10px;color:#666">SîpFlõw — نظام الطلبات</div>
    <div style="text-align:center;margin-top:14px">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=SipFlow-${r.receiptNum}" width="80" height="80" />
    </div>`
  }

  const handleMarkPaid = () => {
    if (!selectedTable || selectedOrders.length === 0) return
    const { grandTotal } = calcTotals(selectedTotal, serviceChargeRate, taxRateVal)
    const settlement: Settlement = {
      id: `${selectedTable}-${Date.now()}`,
      tableNum: selectedTable,
      items: ordersToReceiptItems(selectedOrders),
      subtotal: selectedTotal,
      serviceCharge: serviceChargeRate,
      taxRate: taxRateVal,
      total: grandTotal,
      settledAt: new Date(),
      orderIds: selectedOrders.map(o => o.id)
    }
    setSettlements(prev => [settlement, ...prev])
    setPaidTables(prev => new Set([...prev, selectedTable]))
    setSelectedTable(null)
  }

  const handleClearTable = async () => {
    if (!selectedTable) return
    setIsClearing(true)
    const tableOrds = tableMap.get(selectedTable) || []
    try {
      await Promise.all(tableOrds.map(o => fetch(`/api/orders/${o.id}`, { method: 'DELETE' })))
      setPaidTables(prev => { const n = new Set(prev); n.delete(selectedTable); return n })
      setOrders(prev => prev.filter(o => getTableNum(o) !== selectedTable))
      setSelectedTable(null)
    } catch { /* silent */ }
    finally { setIsClearing(false) }
  }

  return (
    <div className="min-h-screen bg-black" dir="rtl">

      {/* Persistent Alarm Banner */}
      {alarmActive && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3"
          style={{ background: 'linear-gradient(90deg, #7f1d1d, #b91c1c, #7f1d1d)', borderBottom: '3px solid #ef4444', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-bounce">🔔</span>
            <div>
              <p className="font-black text-white text-sm">تنبيه جديد وصل!</p>
              <p className="text-red-200 text-xs">اضغط لإيقاف التنبيه</p>
            </div>
          </div>
          <button onClick={stopAlarm}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }}>
            <X className="h-4 w-4" />
            إيقاف التنبيه
          </button>
        </div>
      )}

      {/* Header */}
      <header className={`sticky z-40 border-b border-zinc-700/60 bg-zinc-900/95 backdrop-blur-sm ${alarmActive ? 'top-14' : 'top-0'}`}>
        <div className="relative overflow-hidden py-[5px]" style={{ background: 'linear-gradient(90deg, #1a0a00, #3d1f00, #6b3a00, #D4A017, #6b3a00, #3d1f00, #1a0a00)' }}>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] tracking-widest uppercase text-amber-200/60">✦</span>
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: '#ffe8a0' }}>SîpFlõw · نظام الكاشير</span>
            <span className="text-[10px] tracking-widest uppercase text-amber-200/60">✦</span>
          </div>
        </div>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden bg-black border-2" style={{ borderColor: '#D4A017' }}>
              {currentPlace.logo_url
                ? <img src={currentPlace.logo_url} alt={currentPlace.name} className="h-full w-full object-cover" />
                : <Banknote className="h-4 w-4 text-amber-500" />}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{currentPlace.name}</p>
              <p className="text-[10px] text-amber-400/70">كاشير: {currentUser.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const pendingCount = reservations.filter(r => r.status === 'pending').length
              return (
                <button onClick={() => setShowReservations(true)}
                  className="relative flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors">
                  <CalendarDays className="h-3.5 w-3.5 text-amber-400" />
                  حجوزات
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-orange-500 px-1.5 text-[10px] font-black text-white animate-pulse">{pendingCount}</span>
                  )}
                </button>
              )
            })()}
            <button onClick={() => setShowReport(v => !v)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${showReport ? 'border-amber-500 bg-amber-500/15 text-amber-300' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
              <FileText className="h-3.5 w-3.5" />
              ريبورت{settlements.length > 0 && <span className="mr-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-black">{settlements.length}</span>}
            </button>
            <button onClick={fetchOrders} disabled={isFetching}
              className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'جاري...' : `${secondsAgo}ث`}
            </button>
            <button onClick={onLogout} className="flex h-9 w-9 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10 transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── REPORT VIEW ── */}
      {showReport ? (
        <main className="mx-auto max-w-4xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white">تقرير تقفيلات اليوم</h2>
              <p className="text-xs text-zinc-500">{settlements.length} قعدة تم تسويتها</p>
            </div>
            <div className="rounded-2xl border border-green-500/30 bg-green-500/5 px-4 py-2 text-center">
              <p className="text-[10px] text-green-400/70">إجمالي اليوم</p>
              <p className="text-xl font-black text-green-400">{settledRevenue.toFixed(0)} <span className="text-xs">ج.م</span></p>
            </div>
          </div>

          {settlements.length === 0 ? (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-10 text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-zinc-700" />
              <p className="text-zinc-500 text-sm">لا توجد تقفيلات حتى الآن</p>
              <p className="text-zinc-600 text-xs mt-1">ستظهر هنا كل قعدة يتم تسويتها</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((s, idx) => (
                <div key={s.id} className="rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800"
                    style={{ background: 'linear-gradient(135deg, #0d1a0d, #122012)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">#{settlements.length - idx}</span>
                      <p className="font-black text-white">🪑 طاولة {s.tableNum}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500">{s.settledAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-lg font-black text-green-400">{s.total.toFixed(0)} <span className="text-xs text-green-600">ج.م</span></span>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-1.5">
                    {s.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-300">{item.name}{item.quantity > 1 && <span className="text-zinc-500 mr-1">× {item.quantity}</span>}</span>
                        <span className="text-zinc-500 tabular-nums">{item.total.toFixed(0)} ج.م</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 pb-3">
                    <button onClick={() => openSettlementPreview(s)}
                      className="w-full rounded-xl border border-zinc-700 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors flex items-center justify-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      معاينة وطباعة الرسيت
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

      ) : (
        /* ── MAIN CASHIER VIEW ── */
        <main className="mx-auto max-w-4xl p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-3 text-center">
              <p className="text-[10px] text-zinc-500 mb-1">نشطة / كل الطاولات</p>
              <p className="text-xl font-black text-white">{tableMap.size} <span className="text-zinc-500 text-sm">/ {allTables.length}</span></p>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-center">
              <p className="text-[10px] text-amber-400/70 mb-1">قيد التحصيل</p>
              <p className="text-xl font-black text-amber-400">{activeRevenue.toFixed(0)}<span className="text-xs"> ج.م</span></p>
            </div>
            <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-3 text-center">
              <p className="text-[10px] text-green-400/70 mb-1">تم التقفيل</p>
              <p className="text-xl font-black text-green-400">{settledRevenue.toFixed(0)}<span className="text-xs"> ج.م</span></p>
            </div>
          </div>

          {/* Quick Activity Summary */}
          {orders.length > 0 && (
            <div className="rounded-2xl border border-zinc-700/50 bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-bold text-white">نشاط اليوم</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <Utensils className="h-4 w-4 mx-auto mb-1 text-amber-400" />
                  <p className="text-lg font-black text-amber-400">{[...tableMap.keys()].filter(t => t !== 'x' && (tableMap.get(t)?.length || 0) > 0 && !paidTables.has(t)).length}</p>
                  <p className="text-[9px] text-amber-400/70">طاولة نشطة</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                  <Clock className="h-4 w-4 mx-auto mb-1 text-sky-400" />
                  <p className="text-lg font-black text-sky-400">{orders.filter(o => o.status === 'pending').length}</p>
                  <p className="text-[9px] text-sky-400/70">طلب معلق</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-green-400" />
                  <p className="text-lg font-black text-green-400">{paidTables.size}</p>
                  <p className="text-[9px] text-green-400/70">تم التسوية</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <TrendingUp className="h-4 w-4 mx-auto mb-1 text-purple-400" />
                  <p className="text-lg font-black text-purple-400">{(settledRevenue + activeRevenue).toFixed(0)}</p>
                  <p className="text-[9px] text-purple-400/70">ج.م اليوم</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" /> تحديث كل 15 ث
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-500/30 border border-amber-500" /> نشطة</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-zinc-800 border border-zinc-700" /> فاضية</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-500/20 border border-green-500" /> تسوية</span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {allTables.map(tableNum => {
              const tOrds = tableMap.get(tableNum) || []
              const isActive = tOrds.length > 0
              const isPaid = paidTables.has(tableNum)
              const total = tOrds.reduce((s, o) => s + (Number(o.drink?.price) || 0) * o.quantity, 0)
              const hasPending = tOrds.some(o => o.status === 'pending')
              let cardClass = 'border-zinc-700 bg-zinc-800/60 text-zinc-500'
              if (isPaid) cardClass = 'border-green-500/60 bg-green-500/15 text-green-400 cursor-pointer hover:bg-green-500/25 active:scale-95'
              else if (isActive) cardClass = 'border-amber-500/50 bg-amber-500/10 text-amber-300 cursor-pointer hover:bg-amber-500/20 hover:border-amber-400 active:scale-95'
              return (
                <button key={tableNum}
                  onClick={() => (isActive || isPaid) ? setSelectedTable(tableNum) : undefined}
                  disabled={!isActive && !isPaid}
                  className={`relative rounded-2xl border p-3 text-center transition-all duration-200 ${cardClass}`}>
                  {hasPending && !isPaid && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-orange-500 animate-pulse" />}
                  <p className="text-lg font-black">{tableNum}</p>
                  {isActive && !isPaid && <p className="text-[10px] mt-0.5 font-medium">{total.toFixed(0)} ج</p>}
                  {isPaid && <CheckCircle2 className="h-3.5 w-3.5 mx-auto mt-0.5" />}
                </button>
              )
            })}
          </div>

          {[...tableMap.keys()].filter(t => !allTables.includes(t) && t !== 'x').length > 0 && (
            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-3">
              <p className="text-xs text-orange-400 font-medium mb-2 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> طاولات خارج النطاق:
              </p>
              <div className="flex flex-wrap gap-2">
                {[...tableMap.keys()].filter(t => !allTables.includes(t) && t !== 'x').map(t => (
                  <button key={t} onClick={() => setSelectedTable(t)}
                    className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-sm font-bold text-orange-300 hover:bg-orange-500/20 transition-colors">
                    طاولة {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── TABLE MODAL ── */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelectedTable(null) }}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700"
              style={{ background: selectedIsPaid ? 'linear-gradient(135deg, #0a1a0a, #122012)' : 'linear-gradient(135deg, #1a1000, #2a1800)' }}>
              <div>
                <p className="font-black text-white text-lg">🪑 طاولة {selectedTable}</p>
                <p className={`text-xs ${selectedIsPaid ? 'text-green-400' : 'text-amber-400/70'}`}>
                  {selectedIsPaid ? '✓ تمت التسوية — في انتظار التصفير' : `${selectedOrders.length} طلب`}
                </p>
              </div>
              <button onClick={() => setSelectedTable(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-700 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 max-h-72 overflow-y-auto space-y-2.5">
              {selectedOrders.length === 0
                ? <p className="text-center text-zinc-500 py-6">لا توجد طلبات</p>
                : selectedOrders.map(o => {
                  const isReady     = o.status === 'ready' || o.status === 'completed'
                  const isPreparing = o.status === 'preparing'
                  const nextStatus  = o.status === 'pending' ? 'preparing' : (o.status === 'preparing' ? 'ready' : null)
                  const nextLabel   = nextStatus === 'preparing' ? '☕ تحضير' : nextStatus === 'ready' ? '✅ جاهز' : null
                  return (
                    <div key={o.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition-colors ${isReady ? 'bg-green-500/10' : isPreparing ? 'bg-amber-500/10' : 'bg-zinc-800/40'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">
                          {isReady ? '✅' : isPreparing ? '☕' : '⏳'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-zinc-200 text-sm font-medium truncate">
                            {o.drink?.name ?? '—'}
                            {o.quantity > 1 && <span className="text-zinc-500 mr-1 text-xs">× {o.quantity}</span>}
                          </p>
                          <p className={`text-[11px] ${isReady ? 'text-green-400' : isPreparing ? 'text-amber-400' : 'text-zinc-500'}`}>
                            {isReady ? 'جاهز ✓' : isPreparing ? 'جاري التحضير' : 'في الانتظار'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-zinc-400 text-xs tabular-nums">{((Number(o.drink?.price) || 0) * o.quantity).toFixed(0)} ج</span>
                        {nextLabel && (
                          <button
                            onClick={async () => {
                              await fetch(`/api/orders/${o.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: nextStatus })
                              })
                              fetchOrders()
                            }}
                            className={`rounded-lg px-2 py-1 text-[11px] font-bold transition-all ${nextStatus === 'ready' ? 'bg-green-600/80 hover:bg-green-600 text-white' : 'bg-amber-600/80 hover:bg-amber-600 text-white'}`}
                          >
                            {nextLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              }
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-700 bg-zinc-800/50">
              <span className="font-bold text-zinc-200">الإجمالي</span>
              <span className="text-2xl font-black tabular-nums" style={{ color: '#D4A017' }}>
                {selectedTotal.toFixed(0)} <span className="text-sm text-zinc-400">ج.م</span>
              </span>
            </div>

            <div className="px-5 pb-5 pt-3 space-y-2">
              {!selectedIsPaid ? (
                <>
                  <button onClick={handleMarkPaid} disabled={selectedOrders.length === 0}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                    <CheckCircle2 className="h-4 w-4" /> تسوية الحساب
                  </button>
                  <button onClick={() => openReceiptPreview(selectedTable, selectedOrders, selectedTotal)}
                    className="w-full rounded-xl border border-zinc-600 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
                    <Eye className="h-4 w-4" /> معاينة وطباعة الرسيت
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-center mb-1">
                    <p className="text-xs text-green-400 font-medium">✓ تمت تسوية الحساب بنجاح</p>
                    <p className="text-[11px] text-green-600 mt-0.5">اضغط أدناه لتصفير القعدة للزبون الجاي</p>
                  </div>
                  <button onClick={handleClearTable} disabled={isClearing}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #b45309, #92400e)' }}>
                    {isClearing ? '⏳ جاري التصفير...' : <><ChevronRight className="h-4 w-4" /> تصفير القعدة</>}
                  </button>
                  <button onClick={() => openReceiptPreview(selectedTable, selectedOrders, selectedTotal)}
                    className="w-full rounded-xl border border-zinc-600 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
                    <Eye className="h-4 w-4" /> معاينة وطباعة الرسيت
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── RECEIPT PREVIEW MODAL ── */}
      {receiptPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setReceiptPreview(null) }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-zinc-700">
            {/* Preview Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-700">
              <p className="text-white font-bold text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-400" />
                معاينة الرسيت
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { triggerPrint(receiptPreview); setReceiptPreview(null) }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #1a1a2e, #2d2d5e)' }}>
                  <Printer className="h-3.5 w-3.5" /> طباعة
                </button>
                <button onClick={() => setReceiptPreview(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-700 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Receipt Preview Body */}
            <div className="overflow-y-auto bg-gray-100" style={{ maxHeight: '75vh' }}>
              <div className="bg-white mx-auto shadow-md" style={{ maxWidth: '300px', padding: '20px 14px', fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#1a1a2e' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <img src="/images/sipflow-logo.jpg" alt="SîpFlõw" style={{ width: '90px', height: '90px', objectFit: 'contain', margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '2px', color: '#1a1a2e' }}>SîpFlõw</div>
                  <div style={{ fontSize: '10px', letterSpacing: '3px', color: '#666', margin: '2px 0 8px' }}>— SYSTEM POS —</div>
                </div>

                <div style={{ borderTop: '1px dashed #aaa', margin: '8px 0' }} />

                <div style={{ fontSize: '12px', margin: '3px 0' }}>Receipt #: {receiptPreview.receiptNum}</div>
                <div style={{ fontSize: '12px', margin: '3px 0' }}>
                  Date: {receiptPreview.date.toLocaleDateString('en-GB')} &nbsp;
                  {receiptPreview.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: '12px', margin: '3px 0' }}>Cashier: {receiptPreview.cashier}</div>
                <div style={{ fontSize: '12px', margin: '3px 0' }}>Table: {receiptPreview.tableNum}</div>

                <div style={{ borderTop: '1px dashed #aaa', margin: '8px 0' }} />

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
                      <th style={{ padding: '5px 3px', textAlign: 'right', fontSize: '12px', fontWeight: 700 }}>Item</th>
                      <th style={{ padding: '5px 3px', textAlign: 'center', fontSize: '12px', fontWeight: 700 }}>Qty</th>
                      <th style={{ padding: '5px 3px', textAlign: 'right', fontSize: '12px', fontWeight: 700 }}>Price</th>
                      <th style={{ padding: '5px 3px', textAlign: 'right', fontSize: '12px', fontWeight: 700 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptPreview.items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px dashed #e0e0e0' }}>
                        <td style={{ padding: '6px 3px', textAlign: 'right', fontSize: '12px' }}>{item.name}</td>
                        <td style={{ padding: '6px 3px', textAlign: 'center', fontSize: '12px', fontWeight: 700 }}>{item.quantity}</td>
                        <td style={{ padding: '6px 3px', textAlign: 'right', fontSize: '12px' }}>{item.unitPrice.toFixed(2)}</td>
                        <td style={{ padding: '6px 3px', textAlign: 'right', fontSize: '12px', fontWeight: 700 }}>{item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(() => {
                  const { serviceAmt, taxAmt } = calcTotals(receiptPreview.subtotal, receiptPreview.serviceCharge, receiptPreview.taxRate)
                  return (
                    <>
                      <div style={{ borderTop: '1px dashed #aaa', margin: '10px 0 6px' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '3px 0' }}>
                        <span>Subtotal:</span><span style={{ fontWeight: 700 }}>{receiptPreview.subtotal.toFixed(2)}</span>
                      </div>
                      {receiptPreview.serviceCharge > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '3px 0', color: '#555' }}>
                          <span>رسوم الخدمة ({receiptPreview.serviceCharge}%):</span>
                          <span>{serviceAmt.toFixed(2)}</span>
                        </div>
                      )}
                      {receiptPreview.taxRate > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '3px 0', color: '#555' }}>
                          <span>الضريبة ({receiptPreview.taxRate}%):</span>
                          <span>{taxAmt.toFixed(2)}</span>
                        </div>
                      )}
                      <div style={{ borderTop: '1px dashed #aaa', margin: '6px 0' }} />
                      <div style={{ background: '#1a1a2e', color: '#fff', padding: '9px 10px', display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 900, margin: '8px 0', borderRadius: '2px' }}>
                        <span>Grand Total:</span>
                        <span>{receiptPreview.total.toFixed(2)}</span>
                      </div>
                      <div style={{ borderTop: '1px dashed #aaa', margin: '6px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '4px 0' }}>
                        <span>Paid by: Cash</span><span style={{ fontWeight: 700 }}>{receiptPreview.total.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '4px 0' }}>
                        <span>Change:</span><span>0.00</span>
                      </div>
                    </>
                  )
                })()}
                <div style={{ borderTop: '1px dashed #aaa', margin: '10px 0 6px' }} />

                <div style={{ textAlign: 'center', fontSize: '13px', margin: '10px 0 4px' }}>شكراً لزيارتكم! 🙏</div>
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#666' }}>SîpFlõw — نظام الطلبات</div>
                <div style={{ textAlign: 'center', marginTop: '14px' }}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=SipFlow-${receiptPreview.receiptNum}`}
                    width="80" height="80" alt="QR" style={{ display: 'inline-block' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RESERVATIONS MODAL ── */}
      {showReservations && (
        <div className="fixed inset-0 z-50 flex flex-col" dir="rtl">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowReservations(false)} />
          <div className="relative mt-auto w-full max-h-[85vh] flex flex-col rounded-t-3xl border-t border-zinc-700 bg-zinc-950 overflow-hidden">
            {/* Handle */}
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-zinc-700" />
            </div>
            {/* Title bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-black text-white">الحجوزات</h2>
                {reservations.filter(r => r.status === 'pending').length > 0 && (
                  <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white">
                    {reservations.filter(r => r.status === 'pending').length} جديد
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => fetchReservations()} disabled={isFetchingReservations}
                  className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
                  {isFetchingReservations
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => setShowReservations(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isFetchingReservations && reservations.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                </div>
              ) : reservations.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
                  <CalendarDays className="h-10 w-10 mx-auto mb-3 text-zinc-700" />
                  <p className="text-zinc-500 text-sm">لا توجد حجوزات حتى الآن</p>
                </div>
              ) : (
                reservations.map(r => {
                  const dt = new Date(r.reserved_at)
                  const dateStr = dt.toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })
                  const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                  const isPending = r.status === 'pending'
                  const isConfirmed = r.status === 'confirmed'
                  const isCancelled = r.status === 'cancelled'
                  return (
                    <div key={r.id}
                      className={`rounded-2xl border overflow-hidden ${isPending ? 'border-orange-500/40 bg-orange-500/5' : isConfirmed ? 'border-green-500/30 bg-green-500/5' : 'border-zinc-700 bg-zinc-900 opacity-60'}`}>
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isPending && <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />}
                          {isConfirmed && <CalendarCheck className="h-4 w-4 text-green-400" />}
                          {isCancelled && <CalendarX className="h-4 w-4 text-zinc-500" />}
                          <div>
                            <p className="text-sm font-bold text-white">{r.customer_name}</p>
                            <p className="text-[10px] text-zinc-400">{dateStr} — {timeStr}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-1 text-xs text-zinc-400">
                            <Users className="h-3.5 w-3.5" />
                            <span>{r.party_size} أشخاص</span>
                          </div>
                          {r.customer_phone && (
                            <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                              <Phone className="h-3 w-3" />
                              <span>{r.customer_phone}</span>
                            </div>
                          )}
                          {isConfirmed && r.table_number && (
                            <p className="text-xs font-bold text-green-400 mt-0.5">طاولة {r.table_number}</p>
                          )}
                        </div>
                      </div>
                      {r.notes && (
                        <div className="px-4 pb-2">
                          <p className="text-[10px] text-zinc-500 bg-zinc-800 rounded-lg px-2 py-1">💬 {r.notes}</p>
                        </div>
                      )}
                      {isPending && (
                        <div className="px-4 pb-3 flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="رقم الط��ولة"
                            value={tableInputs[r.id] ?? ''}
                            onChange={e => setTableInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                          />
                          <button
                            onClick={() => handleConfirmReservation(r.id)}
                            disabled={confirmingId === r.id}
                            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-60 transition-colors">
                            {confirmingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
                            تأكيد
                          </button>
                          <button
                            onClick={() => handleCancelReservation(r.id)}
                            disabled={cancellingId === r.id}
                            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-400 hover:bg-zinc-700 disabled:opacity-60 transition-colors">
                            {cancellingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                            إلغاء
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-center" richColors />
    </div>
  )
}
