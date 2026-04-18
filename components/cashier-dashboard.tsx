'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { User, Place, OrderWithDetails } from '@/lib/types'
import {
  LogOut, RefreshCw, Printer, CheckCircle2, Banknote, X, Clock, AlertCircle,
  FileText, ChevronRight, Eye, CalendarDays, Loader2, Activity, TrendingUp,
  Utensils, Search, ArrowLeftRight, RotateCcw, Wallet, CreditCard,
  Smartphone, DollarSign, Percent, Shield, PlayCircle, StopCircle, Filter,
  Receipt, ChevronDown, Minus, Plus, RefreshCcw
} from 'lucide-react'
import { toast, Toaster } from 'sonner'

/* ─────────────────────── Types ─────────────────────── */
type PaymentMethod = 'cash' | 'visa' | 'instapay' | 'vodafone'
type DiscountType = 'amount' | 'percent'
type InvoiceStatus = 'paid' | 'refunded'
type TableFilter = 'all' | 'open' | 'paid'

interface SplitPayment { method: PaymentMethod; amount: number }

interface SettlementItem { name: string; quantity: number; unitPrice: number; total: number }

interface Settlement {
  id: string
  invoiceNum: string
  tableNum: string
  items: SettlementItem[]
  subtotal: number
  discountType: DiscountType
  discountValue: number
  discountAmount: number
  serviceCharge: number
  taxRate: number
  total: number
  settledAt: Date
  orderIds: string[]
  splitPayments: SplitPayment[]
  status: InvoiceStatus
  cashierName: string
}

interface ReceiptData {
  tableNum: string
  items: SettlementItem[]
  subtotal: number
  discountAmount: number
  serviceCharge: number
  taxRate: number
  total: number
  cashier: string
  place: string
  invoiceNum: string
  date: Date
  splitPayments: SplitPayment[]
}

interface Shift {
  isOpen: boolean
  startAmount: number
  openedAt: Date
  cashierName: string
}

interface Reservation {
  id: string; place_id: string; customer_name: string; customer_phone: string | null
  party_size: number; reserved_at: string; status: 'pending' | 'confirmed' | 'cancelled'
  notes: string | null; table_number: string | null
}

interface CashierDashboardProps {
  currentUser: User
  currentPlace: Place
  onLogout: () => void
}

/* ─────────────────────── Constants ─────────────────────── */
const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'cash', label: 'كاش', icon: <Banknote className="h-5 w-5" />, color: '#16a34a' },
  { key: 'visa', label: 'فيزا', icon: <CreditCard className="h-5 w-5" />, color: '#2563eb' },
  { key: 'instapay', label: 'إنستاباي', icon: <Smartphone className="h-5 w-5" />, color: '#7c3aed' },
  { key: 'vodafone', label: 'فودافون كاش', icon: <Wallet className="h-5 w-5" />, color: '#dc2626' },
]

const LARGE_DISCOUNT_THRESHOLD = 50

const genInvoiceNum = () => {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`
}

const pmLabel = (m: PaymentMethod) => PAYMENT_METHODS.find(p => p.key === m)?.label ?? m

/* ─────────────────────── Main Component ─────────────────────── */
export function CashierDashboard({ currentUser, currentPlace, onLogout }: CashierDashboardProps) {
  /* ── Core state ── */
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [paidTables, setPaidTables] = useState<Set<string>>(new Set())
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [registeredTables, setRegisteredTables] = useState<string[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null)

  /* ── UI state ── */
  const [showReport, setShowReport] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<ReceiptData | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tableFilter, setTableFilter] = useState<TableFilter>('all')
  const [showOnlyOpen, setShowOnlyOpen] = useState(false)

  /* ── Discount state (inside table modal) ── */
  const [discountType, setDiscountType] = useState<DiscountType>('amount')
  const [discountValue, setDiscountValue] = useState('')
  const [discountUnlocked, setDiscountUnlocked] = useState(false)
  const [discountCodeInput, setDiscountCodeInput] = useState('')
  const [discountCodeError, setDiscountCodeError] = useState('')

  /* ── Payment modal ── */
  const [showPayment, setShowPayment] = useState(false)
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([{ method: 'cash', amount: 0 }])
  const [isSplitMode, setIsSplitMode] = useState(false)

  /* ── Admin password modal ── */
  const [adminModal, setAdminModal] = useState<{ isOpen: boolean; action: string; cb: () => void } | null>(null)
  const [adminPwInput, setAdminPwInput] = useState('')
  const [adminPwError, setAdminPwError] = useState('')
  const [adminPwLoading, setAdminPwLoading] = useState(false)

  /* ── Table transfer modal ── */
  const [transferModal, setTransferModal] = useState<{ fromTable: string } | null>(null)
  const [transferTarget, setTransferTarget] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)

  /* ── Shift state ── */
  const [shift, setShift] = useState<Shift | null>(null)
  const [showShiftOpen, setShowShiftOpen] = useState(false)
  const [showShiftClose, setShowShiftClose] = useState(false)
  const [shiftStartInput, setShiftStartInput] = useState('')

  /* ── Reservations ── */
  const [showReservations, setShowReservations] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isFetchingReservations, setIsFetchingReservations] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [tableInputs, setTableInputs] = useState<Record<string, string>>({})

  /* ── Alarm ── */
  const [alarmActive, setAlarmActive] = useState(false)
  const alarmLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPendingCountRef = useRef<number>(-1)
  const prevOrderCountRef = useRef<number>(-1)

  /* ─────────── Computed ─────────── */
  const tableCount = currentPlace.table_count ?? 10
  const sequentialTables = Array.from({ length: tableCount }, (_, i) => String(i + 1))
  const allTables = Array.from(new Set([...sequentialTables, ...registeredTables])).sort((a, b) => {
    const na = parseInt(a), nb = parseInt(b)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return a.localeCompare(b)
  })

  const serviceChargeRate = currentPlace.service_charge ?? 0
  const taxRateVal = currentPlace.tax_rate ?? 0

  const getTableNum = (o: OrderWithDetails): string => {
    if (o.table_number) return String(o.table_number)
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

  const calcTotals = (subtotal: number, discAmt: number, sc: number, tr: number) => {
    const afterDiscount = Math.max(0, subtotal - discAmt)
    const serviceAmt = afterDiscount * sc / 100
    const taxAmt = (afterDiscount + serviceAmt) * tr / 100
    return { afterDiscount, serviceAmt, taxAmt, grandTotal: afterDiscount + serviceAmt + taxAmt }
  }

  const calcDiscount = (subtotal: number, type: DiscountType, val: string): number => {
    const v = parseFloat(val) || 0
    if (type === 'percent') return Math.min(subtotal, subtotal * v / 100)
    return Math.min(subtotal, v)
  }

  const selectedOrders = selectedTable ? (tableMap.get(selectedTable) || []) : []
  const selectedSubtotal = selectedOrders.reduce((s, o) => s + (Number(o.drink?.price) || 0) * o.quantity, 0)
  const placeRequiresDiscountCode = !!(currentPlace.discount_code)
  const discountActive = !placeRequiresDiscountCode || discountUnlocked
  const selectedDiscountAmt = discountActive ? calcDiscount(selectedSubtotal, discountType, discountValue) : 0
  const selectedTotals = calcTotals(selectedSubtotal, selectedDiscountAmt, serviceChargeRate, taxRateVal)
  const selectedIsPaid = selectedTable ? paidTables.has(selectedTable) : false

  const settledRevenue = settlements.filter(s => s.status === 'paid').reduce((s, st) => s + st.total, 0)
  const activeRevenue = orders.filter(o => !paidTables.has(getTableNum(o))).reduce((s, o) => s + (Number(o.drink?.price) || 0) * o.quantity, 0)

  /* ─────────── Shift helpers ─────────── */
  const shiftTotals = () => {
    const byMethod: Record<PaymentMethod, number> = { cash: 0, visa: 0, instapay: 0, vodafone: 0 }
    let totalDiscounts = 0
    settlements.filter(s => s.status === 'paid').forEach(s => {
      s.splitPayments.forEach(sp => { byMethod[sp.method] = (byMethod[sp.method] || 0) + sp.amount })
      totalDiscounts += s.discountAmount
    })
    return { byMethod, totalDiscounts, invoiceCount: settlements.filter(s => s.status === 'paid').length, total: settledRevenue }
  }

  /* ─────────── Audio ─────────── */
  const playBeepOnce = () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const pattern = [{ freq: 880, dur: 0.15 }, { freq: 1100, dur: 0.15 }, { freq: 1320, dur: 0.2 }]
      let offset = 0; const t = ctx.currentTime
      for (const note of pattern) {
        const osc = ctx.createOscillator(); const g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination); osc.type = 'sine'
        const st = t + offset
        osc.frequency.setValueAtTime(note.freq, st)
        g.gain.setValueAtTime(0, st)
        g.gain.linearRampToValueAtTime(0.8, st + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, st + note.dur)
        osc.start(st); osc.stop(st + note.dur)
        offset += note.dur + 0.05
      }
      setTimeout(() => { try { ctx.close() } catch {} }, 900)
    } catch {}
  }

  const triggerAlarm = () => {
    if (alarmLoopRef.current) return
    setAlarmActive(true); playBeepOnce()
    alarmLoopRef.current = setInterval(() => playBeepOnce(), 2500)
  }

  const stopAlarm = () => {
    if (alarmLoopRef.current) { clearInterval(alarmLoopRef.current); alarmLoopRef.current = null }
    setAlarmActive(false)
  }

  /* ─────────── Data fetching ─────────── */
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
    } catch {}
  }, [currentPlace.id])

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
        toast.success('طلب جديد وصل!'); triggerAlarm()
      }
      prevOrderCountRef.current = pendingCount
      setOrders(fetched); setSecondsAgo(0)
    } catch { setOrders([]) }
    finally { setIsFetching(false) }
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
          toast.info(`حجز جديد! (${pendingCount} في الانتظار)`, { duration: 6000 }); triggerAlarm()
        }
        prevPendingCountRef.current = pendingCount
      }
    } catch {}
    finally { if (!silent) setIsFetchingReservations(false) }
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

  /* ─────────── Admin password verification ─────────── */
  const requireAdmin = (action: string, cb: () => void) => {
    setAdminPwInput(''); setAdminPwError('')
    setAdminModal({ isOpen: true, action, cb })
  }

  const verifyAdmin = async () => {
    if (!adminPwInput.trim()) { setAdminPwError('ادخل كلمة السر'); return }
    setAdminPwLoading(true); setAdminPwError('')
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'admin', password: adminPwInput, place_id: currentPlace.id })
      })
      const data = await res.json()
      if (data.user && (data.user.role === 'admin' || data.user.role === 'cashier')) {
        adminModal?.cb()
        setAdminModal(null)
      } else {
        // Try staff login
        const staffRes = await fetch('/api/staff/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: adminPwInput })
        })
        if (staffRes.ok) {
          adminModal?.cb()
          setAdminModal(null)
        } else {
          setAdminPwError('كلمة سر الأدمن غلط')
        }
      }
    } catch { setAdminPwError('حدث خطأ، حاول تاني') }
    finally { setAdminPwLoading(false) }
  }

  /* ─────────── Settlement / Payment ─────────── */
  const openPaymentModal = () => {
    if (!selectedTable || selectedOrders.length === 0) return
    // Check if large discount needs admin
    if (selectedDiscountAmt > LARGE_DISCOUNT_THRESHOLD) {
      requireAdmin('خصم كبير يحتاج موافقة أدمن', () => {
        setIsSplitMode(false)
        setSplitPayments([{ method: 'cash', amount: selectedTotals.grandTotal }])
        setShowPayment(true)
      })
      return
    }
    setIsSplitMode(false)
    setSplitPayments([{ method: 'cash', amount: selectedTotals.grandTotal }])
    setShowPayment(true)
  }

  const totalPaid = splitPayments.reduce((s, p) => s + (p.amount || 0), 0)
  const changeAmount = Math.max(0, totalPaid - selectedTotals.grandTotal)
  const remainingToPay = Math.max(0, selectedTotals.grandTotal - totalPaid)

  const confirmPayment = () => {
    if (!selectedTable) return
    if (!isSplitMode && totalPaid < selectedTotals.grandTotal - 0.01) {
      toast.error('المبلغ المدفوع أقل من الإجمالي'); return
    }
    if (isSplitMode && remainingToPay > 0.01) {
      toast.error(`لازم تكمل ${remainingToPay.toFixed(2)} ج.م`); return
    }

    const invoiceNum = genInvoiceNum()
    const settlement: Settlement = {
      id: `${selectedTable}-${Date.now()}`,
      invoiceNum,
      tableNum: selectedTable,
      items: selectedOrders.map(o => ({
        name: o.drink?.name ?? '—',
        quantity: o.quantity,
        unitPrice: Number(o.drink?.price) || 0,
        total: (Number(o.drink?.price) || 0) * o.quantity
      })),
      subtotal: selectedSubtotal,
      discountType,
      discountValue: parseFloat(discountValue) || 0,
      discountAmount: selectedDiscountAmt,
      serviceCharge: serviceChargeRate,
      taxRate: taxRateVal,
      total: selectedTotals.grandTotal,
      settledAt: new Date(),
      orderIds: selectedOrders.map(o => o.id),
      splitPayments: isSplitMode ? splitPayments.filter(p => p.amount > 0) : splitPayments,
      status: 'paid',
      cashierName: currentUser.name
    }

    const receipt: ReceiptData = {
      tableNum: selectedTable,
      items: settlement.items,
      subtotal: selectedSubtotal,
      discountAmount: selectedDiscountAmt,
      serviceCharge: serviceChargeRate,
      taxRate: taxRateVal,
      total: selectedTotals.grandTotal,
      cashier: currentUser.name,
      place: currentPlace.name,
      invoiceNum,
      date: new Date(),
      splitPayments: settlement.splitPayments
    }

    setSettlements(prev => [settlement, ...prev])
    setPaidTables(prev => new Set([...prev, selectedTable]))
    setLastReceipt(receipt)
    setShowPayment(false)
    setSelectedTable(null)
    setDiscountValue('')
    setDiscountUnlocked(false)
    setDiscountCodeInput('')
    setDiscountCodeError('')
    toast.success(`✓ تم تسوية طاولة ${selectedTable} — فاتورة #${invoiceNum}`)
  }

  /* ─────────── Clear table ─────────── */
  const handleClearTable = async () => {
    if (!selectedTable) return
    setIsClearing(true)
    const tableOrds = tableMap.get(selectedTable) || []
    try {
      await Promise.all(tableOrds.map(o => fetch(`/api/orders/${o.id}`, { method: 'DELETE' })))
      setPaidTables(prev => { const n = new Set(prev); n.delete(selectedTable); return n })
      setOrders(prev => prev.filter(o => getTableNum(o) !== selectedTable))
      setSelectedTable(null)
      toast.success('تم تصفير الطاولة')
    } catch { toast.error('فشل التصفير') }
    finally { setIsClearing(false) }
  }

  /* ─────────── Delete order (needs admin) ─────────── */
  const handleDeleteOrder = (orderId: string) => {
    requireAdmin('حذف طلب يحتاج موافقة أدمن', async () => {
      try {
        await fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
        setOrders(prev => prev.filter(o => o.id !== orderId))
        toast.success('تم حذف الطلب')
      } catch { toast.error('فشل الحذف') }
    })
  }

  /* ─────────── Table Transfer ─────────── */
  const handleTransfer = async () => {
    if (!transferModal || !transferTarget.trim()) { toast.error('ادخل رقم الطاولة الجديدة'); return }
    setIsTransferring(true)
    const fromOrders = tableMap.get(transferModal.fromTable) || []
    try {
      await Promise.all(fromOrders.map(o =>
        fetch(`/api/users/${o.user_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_number: transferTarget.trim() })
        })
      ))
      await fetchOrders()
      toast.success(`تم نقل الطلبات من طاولة ${transferModal.fromTable} إلى ${transferTarget}`)
      setTransferModal(null)
      setTransferTarget('')
      setSelectedTable(null)
    } catch { toast.error('فشل النقل') }
    finally { setIsTransferring(false) }
  }

  /* ─────────── Mark refunded ─────────── */
  const handleRefund = (settlementId: string) => {
    requireAdmin('إسترجاع فاتورة يحتاج موافقة أدمن', () => {
      setSettlements(prev => prev.map(s => s.id === settlementId ? { ...s, status: 'refunded' } : s))
      toast.success('تم تسجيل الاسترجاع')
    })
  }

  /* ─────────── Reservations ─────────── */
  const handleConfirmReservation = async (id: string) => {
    const tableNum = tableInputs[id]?.trim()
    if (!tableNum) { toast.error('ادخل رقم الطاولة'); return }
    setConfirmingId(id)
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed', table_number: tableNum })
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
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      })
      if (!res.ok) throw new Error()
      toast.success('تم إلغاء الحجز')
      fetchReservations(true)
    } catch { toast.error('فشل إلغاء الحجز') }
    finally { setCancellingId(null) }
  }

  /* ─────────── Receipt printing ─────────── */
  const buildReceiptHTML = (r: ReceiptData) => {
    const { serviceAmt, taxAmt } = calcTotals(r.subtotal, r.discountAmount, r.serviceCharge, r.taxRate)
    const rows = r.items.map(item => `
      <tr>
        <td style="padding:5px 3px;text-align:right;border-bottom:1px dashed #e0e0e0">${item.name}</td>
        <td style="padding:5px 3px;text-align:center;border-bottom:1px dashed #e0e0e0;font-weight:700">${item.quantity}</td>
        <td style="padding:5px 3px;text-align:right;border-bottom:1px dashed #e0e0e0">${item.unitPrice.toFixed(2)}</td>
        <td style="padding:5px 3px;text-align:right;border-bottom:1px dashed #e0e0e0;font-weight:700">${item.total.toFixed(2)}</td>
      </tr>`).join('')
    const payRows = r.splitPayments.map(sp =>
      `<div style="display:flex;justify-content:space-between;font-size:12px;margin:3px 0"><span>${pmLabel(sp.method)}:</span><span style="font-weight:700">${sp.amount.toFixed(2)} ج.م</span></div>`
    ).join('')
    const change = Math.max(0, r.splitPayments.reduce((s, p) => s + p.amount, 0) - r.total)
    return `
    <div style="text-align:center;margin-bottom:6px">
      <img src="${window.location.origin}/images/sipflow-logo.jpg" alt="SîpFlõw" style="width:80px;height:80px;object-fit:contain;display:block;margin:0 auto 4px"/>
      <div style="font-size:18px;font-weight:900;letter-spacing:2px">${r.place}</div>
      <div style="font-size:10px;letter-spacing:2px;color:#666;margin:2px 0 8px">— SîpFlõw POS —</div>
    </div>
    <div style="border-top:1px dashed #aaa;margin:6px 0"></div>
    <div style="font-size:11px;margin:2px 0">فاتورة #: ${r.invoiceNum}</div>
    <div style="font-size:11px;margin:2px 0">التاريخ: ${r.date.toLocaleDateString('ar-EG')} ${r.date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
    <div style="font-size:11px;margin:2px 0">الكاشير: ${r.cashier}</div>
    <div style="font-size:11px;margin:2px 0">الطاولة: ${r.tableNum}</div>
    <div style="border-top:1px dashed #aaa;margin:6px 0"></div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:1px solid #1a1a2e">
        <th style="padding:4px 3px;text-align:right;font-size:11px">الصنف</th>
        <th style="padding:4px 3px;text-align:center;font-size:11px">ك</th>
        <th style="padding:4px 3px;text-align:right;font-size:11px">سعر</th>
        <th style="padding:4px 3px;text-align:right;font-size:11px">إجمالي</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="border-top:1px dashed #aaa;margin:8px 0 4px"></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin:2px 0"><span>المجموع:</span><span>${r.subtotal.toFixed(2)}</span></div>
    ${r.discountAmount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px;margin:2px 0;color:#b45309"><span>خصم:</span><span>- ${r.discountAmount.toFixed(2)}</span></div>` : ''}
    ${r.serviceCharge > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px;margin:2px 0;color:#555"><span>خدمة (${r.serviceCharge}%):</span><span>${serviceAmt.toFixed(2)}</span></div>` : ''}
    ${r.taxRate > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px;margin:2px 0;color:#555"><span>ضريبة (${r.taxRate}%):</span><span>${taxAmt.toFixed(2)}</span></div>` : ''}
    <div style="border-top:1px dashed #aaa;margin:4px 0"></div>
    <div style="background:#1a1a2e;color:#fff;padding:8px 10px;display:flex;justify-content:space-between;font-size:14px;font-weight:900;margin:6px 0;border-radius:2px">
      <span>الإجمالي:</span><span>${r.total.toFixed(2)} ج.م</span>
    </div>
    <div style="border-top:1px dashed #aaa;margin:4px 0"></div>
    ${payRows}
    <div style="display:flex;justify-content:space-between;font-size:11px;margin:2px 0"><span>الباقي:</span><span style="font-weight:700">${change.toFixed(2)} ج.م</span></div>
    <div style="border-top:1px dashed #aaa;margin:8px 0 4px"></div>
    <div style="text-align:center;font-size:12px;margin:8px 0 3px">شكراً لزيارتكم! 🙏</div>
    <div style="text-align:center;font-size:10px;color:#666">SîpFlõw — نظام الطلبات</div>
    <div style="text-align:center;margin-top:12px">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=SipFlow-${r.invoiceNum}" width="70" height="70"/>
    </div>`
  }

  const triggerPrint = (r: ReceiptData) => {
    const win = window.open('', '_blank', 'width=360,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>فاتورة ${r.invoiceNum}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:13px;max-width:300px;margin:0 auto;padding:16px 10px}@media print{body{padding:4px}}</style></head><body>${buildReceiptHTML(r)}</body></html>`)
    win.document.close(); win.focus()
    setTimeout(() => { win.print(); win.close() }, 600)
  }

  const printShiftReport = () => {
    const t = shiftTotals()
    const win = window.open('', '_blank', 'width=360,height=700')
    if (!win) return
    const pmRows = PAYMENT_METHODS.map(pm =>
      t.byMethod[pm.key] > 0 ? `<div style="display:flex;justify-content:space-between;margin:4px 0"><span>${pm.label}:</span><span style="font-weight:700">${t.byMethod[pm.key].toFixed(2)} ج.م</span></div>` : ''
    ).join('')
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير الوردية</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:13px;max-width:300px;margin:0 auto;padding:16px 10px}</style></head><body>
      <div style="text-align:center;font-size:16px;font-weight:900;margin-bottom:8px">${currentPlace.name}</div>
      <div style="text-align:center;font-size:12px;color:#666">تقرير الوردية — ${new Date().toLocaleDateString('ar-EG')}</div>
      <div style="text-align:center;font-size:11px;color:#999">الكاشير: ${currentUser.name}</div>
      <div style="border-top:1px dashed #aaa;margin:10px 0"></div>
      <div style="display:flex;justify-content:space-between;margin:4px 0"><span>مبلغ البداية:</span><span>${shift?.startAmount.toFixed(2) ?? '0.00'} ج.م</span></div>
      <div style="display:flex;justify-content:space-between;margin:4px 0"><span>عدد الفواتير:</span><span>${t.invoiceCount}</span></div>
      <div style="display:flex;justify-content:space-between;margin:4px 0"><span>إجمالي الخصومات:</span><span>${t.totalDiscounts.toFixed(2)} ج.م</span></div>
      <div style="border-top:1px dashed #aaa;margin:8px 0"></div>
      ${pmRows}
      <div style="border-top:1px dashed #aaa;margin:8px 0"></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:900;background:#1a1a2e;color:#fff;padding:8px;border-radius:2px"><span>الإجمالي:</span><span>${t.total.toFixed(2)} ج.م</span></div>
    </body></html>`)
    win.document.close(); win.focus()
    setTimeout(() => { win.print(); win.close() }, 600)
  }

  /* ─────────── Filtered tables ─────────── */
  const filteredDisplayTables = allTables.filter(t => {
    if (searchQuery) return t.includes(searchQuery)
    if (tableFilter === 'open') return tableMap.has(t) && !paidTables.has(t)
    if (tableFilter === 'paid') return paidTables.has(t)
    return true
  })

  const filteredSettlements = settlements.filter(s => {
    if (searchQuery) return s.tableNum.includes(searchQuery) || s.invoiceNum.includes(searchQuery)
    return true
  })

  /* ─────────────────────────────── RENDER ─────────────────────────────── */
  return (
    <div className="min-h-screen bg-black" dir="rtl">
      <Toaster position="top-center" richColors />

      {/* ── Alarm Banner ── */}
      {alarmActive && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3"
          style={{ background: 'linear-gradient(90deg,#7f1d1d,#b91c1c,#7f1d1d)', borderBottom: '3px solid #ef4444', boxShadow: '0 4px 20px rgba(239,68,68,.5)' }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-bounce">🔔</span>
            <div>
              <p className="font-black text-white text-sm">تنبيه جديد!</p>
              <p className="text-red-200 text-xs">اضغط لإيقاف</p>
            </div>
          </div>
          <button onClick={stopAlarm}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white"
            style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)' }}>
            <X className="h-4 w-4" /> إيقاف
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className={`sticky z-40 border-b border-zinc-700/60 bg-zinc-900/95 backdrop-blur-sm ${alarmActive ? 'top-14' : 'top-0'}`}>
        <div className="relative py-[5px]" style={{ background: 'linear-gradient(90deg,#1a0a00,#3d1f00,#6b3a00,#D4A017,#6b3a00,#3d1f00,#1a0a00)' }}>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] text-amber-200/60">✦</span>
            <span className="text-[11px] font-semibold tracking-[.18em] uppercase" style={{ color: '#ffe8a0' }}>SîpFlõw · نظام الكاشير</span>
            <span className="text-[10px] text-amber-200/60">✦</span>
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden bg-black border-2" style={{ borderColor: '#D4A017' }}>
              {currentPlace.logo_url
                ? <img src={currentPlace.logo_url} alt={currentPlace.name} className="h-full w-full object-cover" />
                : <Banknote className="h-4 w-4 text-amber-500" />}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{currentPlace.name}</p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-amber-400/70">كاشير: {currentUser.name}</p>
                {shift?.isOpen && (
                  <span className="text-[10px] text-green-400 flex items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                    وردية مفتوحة
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Reprint last */}
            {lastReceipt && (
              <button onClick={() => { triggerPrint(lastReceipt) }}
                title="إعادة طباعة آخر فاتورة"
                className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors">
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">إعادة طباعة</span>
              </button>
            )}
            {/* Shift */}
            <button
              onClick={() => shift?.isOpen ? setShowShiftClose(true) : setShowShiftOpen(true)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${shift?.isOpen ? 'border-green-500/50 bg-green-500/10 text-green-300 hover:bg-green-500/20' : 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'}`}>
              {shift?.isOpen ? <><StopCircle className="h-3 w-3" /> إغلاق وردية</> : <><PlayCircle className="h-3 w-3" /> فتح وردية</>}
            </button>
            {/* Reservations */}
            {(() => {
              const pc = reservations.filter(r => r.status === 'pending').length
              return (
                <button onClick={() => setShowReservations(true)}
                  className="relative flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors">
                  <CalendarDays className="h-3 w-3 text-amber-400" />
                  <span className="hidden sm:inline">حجوزات</span>
                  {pc > 0 && <span className="rounded-full bg-orange-500 px-1 text-[9px] font-black text-white animate-pulse">{pc}</span>}
                </button>
              )
            })()}
            {/* Report */}
            <button onClick={() => setShowReport(v => !v)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${showReport ? 'border-amber-500 bg-amber-500/15 text-amber-300' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
              <FileText className="h-3 w-3" />
              <span className="hidden sm:inline">ريبورت</span>
              {settlements.length > 0 && <span className="rounded-full bg-amber-500 px-1 text-[9px] font-black text-black">{settlements.length}</span>}
            </button>
            {/* Refresh */}
            <button onClick={fetchOrders} disabled={isFetching}
              className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
              <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isFetching ? '...' : `${secondsAgo}ث`}</span>
            </button>
            {/* Logout */}
            <button onClick={onLogout} className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10 transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── No shift banner ── */}
      {!shift?.isOpen && !showReport && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-amber-300 font-bold text-sm">الوردية مش مفتوحة</p>
              <p className="text-amber-400/60 text-xs mt-0.5">افتح الوردية الأول عشان تسجل المبيعات</p>
            </div>
            <button onClick={() => setShowShiftOpen(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}>
              <PlayCircle className="h-4 w-4" /> فتح وردية
            </button>
          </div>
        </div>
      )}

      {/* ─────────── REPORT VIEW ─────────── */}
      {showReport ? (
        <main className="mx-auto max-w-5xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white">فواتير اليوم</h2>
              <p className="text-xs text-zinc-500">{settlements.length} فاتورة — {settlements.filter(s => s.status === 'paid').length} مدفوعة</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={printShiftReport}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">
                <Printer className="h-3.5 w-3.5" /> طباعة التقرير
              </button>
              <div className="rounded-2xl border border-green-500/30 bg-green-500/5 px-4 py-2 text-center">
                <p className="text-[10px] text-green-400/70">إجمالي اليوم</p>
                <p className="text-xl font-black text-green-400">{settledRevenue.toFixed(0)} <span className="text-xs">ج.م</span></p>
              </div>
            </div>
          </div>

          {/* Shift summary cards */}
          {settlements.length > 0 && (() => {
            const t = shiftTotals()
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PAYMENT_METHODS.map(pm => t.byMethod[pm.key] > 0 && (
                  <div key={pm.key} className="rounded-2xl border border-zinc-700 bg-zinc-900 p-3 text-center">
                    <div className="flex items-center justify-center mb-1" style={{ color: pm.color }}>{pm.icon}</div>
                    <p className="text-[10px] text-zinc-500">{pm.label}</p>
                    <p className="text-lg font-black text-white">{t.byMethod[pm.key].toFixed(0)}<span className="text-xs text-zinc-500"> ج.م</span></p>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Search invoices */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الطاولة أو رقم الفاتورة..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pr-9 pl-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {settlements.length === 0 ? (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-10 text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-zinc-700" />
              <p className="text-zinc-500 text-sm">لا توجد فواتير حتى الآن</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSettlements.map((s, idx) => (
                <div key={s.id} className={`rounded-2xl border overflow-hidden ${s.status === 'refunded' ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-700 bg-zinc-900'}`}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800"
                    style={{ background: s.status === 'refunded' ? 'rgba(239,68,68,0.05)' : 'linear-gradient(135deg,#0d1a0d,#122012)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">#{settlements.length - idx}</span>
                      <div>
                        <p className="font-black text-white text-sm">🪑 طاولة {s.tableNum}</p>
                        <p className="text-[10px] text-zinc-500">فاتورة #{s.invoiceNum}</p>
                      </div>
                      {s.status === 'refunded' && (
                        <span className="rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[10px] text-red-400 font-bold">مسترجع</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-left">
                        <p className="text-xs text-zinc-500">{s.settledAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                        <div className="flex gap-1">
                          {s.splitPayments.map((sp, i) => (
                            <span key={i} className="text-[10px] text-zinc-400">{pmLabel(sp.method)}</span>
                          ))}
                        </div>
                      </div>
                      <span className={`text-lg font-black ${s.status === 'refunded' ? 'text-red-400' : 'text-green-400'}`}>
                        {s.total.toFixed(0)}<span className="text-xs text-zinc-500 mr-0.5">ج.م</span>
                      </span>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-1">
                    {s.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-300">{item.name}{item.quantity > 1 && <span className="text-zinc-500 mr-1">× {item.quantity}</span>}</span>
                        <span className="text-zinc-500 tabular-nums">{item.total.toFixed(0)} ج.م</span>
                      </div>
                    ))}
                    {s.discountAmount > 0 && (
                      <div className="flex justify-between text-xs text-amber-500 mt-1">
                        <span>خصم</span><span>- {s.discountAmount.toFixed(0)} ج.م</span>
                      </div>
                    )}
                  </div>
                  <div className="px-4 pb-3 flex gap-2">
                    <button onClick={() => setReceiptPreview({
                      tableNum: s.tableNum, items: s.items, subtotal: s.subtotal,
                      discountAmount: s.discountAmount, serviceCharge: s.serviceCharge,
                      taxRate: s.taxRate, total: s.total, cashier: s.cashierName,
                      place: currentPlace.name, invoiceNum: s.invoiceNum,
                      date: s.settledAt, splitPayments: s.splitPayments
                    })}
                      className="flex-1 rounded-xl border border-zinc-700 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors flex items-center justify-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> معاينة وطباعة
                    </button>
                    {s.status === 'paid' && (
                      <button onClick={() => handleRefund(s.id)}
                        className="rounded-xl border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1">
                        <RefreshCcw className="h-3.5 w-3.5" /> استرجاع
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

      ) : (
        /* ─────────── MAIN CASHIER VIEW ─────────── */
        <main className="mx-auto max-w-5xl p-4 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-3 text-center">
              <p className="text-[10px] text-zinc-500 mb-1">نشطة / كل الطاولات</p>
              <p className="text-xl font-black text-white">
                {[...tableMap.keys()].filter(t => !paidTables.has(t)).length}
                <span className="text-zinc-500 text-sm"> / {allTables.length}</span>
              </p>
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

          {/* Search + Filter */}
          <div className="flex gap-2 flex-col sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الطاولة..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pr-9 pl-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="flex rounded-xl border border-zinc-700 overflow-hidden bg-zinc-900">
              {([['all', 'الكل'], ['open', 'مفتوحة'], ['paid', 'مدفوعة']] as [TableFilter, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setTableFilter(key)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${tableFilter === key ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" /> تحديث كل 15ث
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-500/20 border border-green-500" /> مدفوعة</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-500/20 border border-amber-500" /> عليها طلبات</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-500/20 border border-red-500" /> لم تُحاسب</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-zinc-800 border border-zinc-700" /> فاضية</span>
          </div>

          {/* Table Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {filteredDisplayTables.map(tableNum => {
              const tOrds = tableMap.get(tableNum) || []
              const isActive = tOrds.length > 0
              const isPaid = paidTables.has(tableNum)
              const hasPending = tOrds.some(o => o.status === 'pending')
              const total = tOrds.reduce((s, o) => s + (Number(o.drink?.price) || 0) * o.quantity, 0)

              // Color logic: green=paid, yellow=has orders(pending), red=has orders not paid(all ready/completed)
              let cardStyle = 'border-zinc-700 bg-zinc-800/60 text-zinc-500'
              if (isPaid) cardStyle = 'border-green-500/70 bg-green-500/15 text-green-300 cursor-pointer hover:bg-green-500/25 active:scale-95'
              else if (isActive && hasPending) cardStyle = 'border-amber-500/60 bg-amber-500/10 text-amber-300 cursor-pointer hover:bg-amber-500/20 active:scale-95'
              else if (isActive) cardStyle = 'border-red-500/60 bg-red-500/10 text-red-300 cursor-pointer hover:bg-red-500/20 active:scale-95'

              return (
                <button key={tableNum}
                  onClick={() => (isActive || isPaid) ? setSelectedTable(tableNum) : undefined}
                  disabled={!isActive && !isPaid}
                  className={`relative rounded-2xl border p-3 text-center transition-all duration-200 ${cardStyle}`}>
                  {hasPending && !isPaid && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-orange-500 animate-pulse" />}
                  <p className="text-lg font-black">{tableNum}</p>
                  {isActive && !isPaid && <p className="text-[10px] mt-0.5 font-medium">{total.toFixed(0)} ج</p>}
                  {isPaid && <CheckCircle2 className="h-3.5 w-3.5 mx-auto mt-0.5" />}
                </button>
              )
            })}
          </div>

          {/* Out of range tables */}
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

          {/* Today invoices quick list */}
          {settlements.length > 0 && (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-bold text-white">فواتير اليوم</span>
                  <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">{settlements.length}</span>
                </div>
                <button onClick={() => setShowReport(true)} className="text-xs text-amber-400 hover:text-amber-300">عرض الكل</button>
              </div>
              <div className="divide-y divide-zinc-800 max-h-48 overflow-y-auto">
                {settlements.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${s.status === 'paid' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm font-medium text-white">طاولة {s.tableNum}</span>
                      <span className="text-[10px] text-zinc-500">{s.settledAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{s.splitPayments.map(sp => pmLabel(sp.method)).join(' + ')}</span>
                      <span className="font-bold text-green-400 text-sm">{s.total.toFixed(0)} ج.م</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ══════════════ TABLE MODAL ══════════════ */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) { setSelectedTable(null); setDiscountValue(''); setDiscountUnlocked(false); setDiscountCodeInput(''); setDiscountCodeError('') } }}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700"
              style={{ background: selectedIsPaid ? 'linear-gradient(135deg,#0a1a0a,#122012)' : 'linear-gradient(135deg,#1a1000,#2a1800)' }}>
              <div>
                <p className="font-black text-white text-lg">🪑 طاولة {selectedTable}</p>
                <p className={`text-xs ${selectedIsPaid ? 'text-green-400' : 'text-amber-400/70'}`}>
                  {selectedIsPaid ? '✓ تمت التسوية — في انتظار التصفير' : `${selectedOrders.length} طلب`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!selectedIsPaid && selectedOrders.length > 0 && (
                  <button onClick={() => setTransferModal({ fromTable: selectedTable })}
                    title="نقل لطاولة أخرى"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-700 transition-colors">
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => { setSelectedTable(null); setDiscountValue(''); setDiscountUnlocked(false); setDiscountCodeInput(''); setDiscountCodeError('') }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-700 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Orders list */}
            <div className="px-5 py-4 max-h-64 overflow-y-auto space-y-2">
              {selectedOrders.length === 0
                ? <p className="text-center text-zinc-500 py-6">لا توجد طلبات</p>
                : selectedOrders.map(o => {
                  const isReady = o.status === 'ready' || o.status === 'completed'
                  const isPreparing = o.status === 'preparing'
                  const nextStatus = o.status === 'pending' ? 'preparing' : o.status === 'preparing' ? 'ready' : null
                  const nextLabel = nextStatus === 'preparing' ? '☕ تحضير' : nextStatus === 'ready' ? '✅ جاهز' : null
                  return (
                    <div key={o.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 ${isReady ? 'bg-green-500/10' : isPreparing ? 'bg-amber-500/10' : 'bg-zinc-800/40'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">{isReady ? '✅' : isPreparing ? '☕' : '⏳'}</span>
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-zinc-400 text-xs tabular-nums">{((Number(o.drink?.price) || 0) * o.quantity).toFixed(0)} ج</span>
                        {nextLabel && (
                          <button onClick={async () => {
                            await fetch(`/api/orders/${o.id}`, {
                              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: nextStatus })
                            })
                            fetchOrders()
                          }}
                            className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-all ${nextStatus === 'ready' ? 'bg-green-600/80 hover:bg-green-600 text-white' : 'bg-amber-600/80 hover:bg-amber-600 text-white'}`}>
                            {nextLabel}
                          </button>
                        )}
                        {!selectedIsPaid && (
                          <button onClick={() => handleDeleteOrder(o.id)}
                            className="rounded-lg p-1 text-red-400/50 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              }
            </div>

            {/* Totals + Discount */}
            {!selectedIsPaid && selectedOrders.length > 0 && (
              <div className="px-5 py-3 border-t border-zinc-800 space-y-3 bg-zinc-800/30">
                {/* Discount */}
                <div>
                  <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
                    <Percent className="h-3.5 w-3.5" /> خصم (اختياري)
                    {placeRequiresDiscountCode && (
                      <span className={`mr-1 flex items-center gap-0.5 text-xs ${discountUnlocked ? 'text-green-400' : 'text-amber-400'}`}>
                        <Shield className="h-3 w-3" />
                        {discountUnlocked ? 'مفعّل' : 'يحتاج كود'}
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
                      <button onClick={() => setDiscountType('amount')}
                        className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${discountType === 'amount' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200'}`}>
                        ج.م
                      </button>
                      <button onClick={() => setDiscountType('percent')}
                        className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${discountType === 'percent' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200'}`}>
                        %
                      </button>
                    </div>
                    <input
                      type="number" min="0" value={discountValue} onChange={e => { setDiscountValue(e.target.value); if (discountUnlocked) setDiscountCodeError('') }}
                      placeholder={discountType === 'amount' ? 'مبلغ الخصم' : 'نسبة الخصم'}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  {/* Discount code gate */}
                  {placeRequiresDiscountCode && discountValue && parseFloat(discountValue) > 0 && !discountUnlocked && (
                    <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2">
                      <p className="text-xs text-amber-400 flex items-center gap-1">
                        <Shield className="h-3 w-3" /> أدخل كود الخصم للمتابعة
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={discountCodeInput}
                          onChange={e => { setDiscountCodeInput(e.target.value); setDiscountCodeError('') }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              if (discountCodeInput.trim() === currentPlace.discount_code) {
                                setDiscountUnlocked(true); setDiscountCodeError('')
                              } else {
                                setDiscountCodeError('كود الخصم غلط')
                              }
                            }
                          }}
                          placeholder="كود الخصم"
                          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 font-mono tracking-widest"
                        />
                        <button
                          onClick={() => {
                            if (discountCodeInput.trim() === currentPlace.discount_code) {
                              setDiscountUnlocked(true); setDiscountCodeError('')
                            } else {
                              setDiscountCodeError('كود الخصم غلط')
                            }
                          }}
                          className="rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-3 py-1.5 transition-colors"
                        >
                          تأكيد
                        </button>
                      </div>
                      {discountCodeError && (
                        <p className="text-xs text-red-400 flex items-center gap-1">
                          <X className="h-3 w-3" /> {discountCodeError}
                        </p>
                      )}
                    </div>
                  )}
                  {discountUnlocked && discountValue && parseFloat(discountValue) > 0 && (
                    <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> الخصم مفعّل بالكود
                    </p>
                  )}
                  {selectedDiscountAmt > LARGE_DISCOUNT_THRESHOLD && (
                    <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> خصم كبير — يحتاج موافقة أدمن
                    </p>
                  )}
                </div>

                {/* Summary */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>المجموع الفرعي</span><span>{selectedSubtotal.toFixed(2)} ج.م</span>
                  </div>
                  {selectedDiscountAmt > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>خصم</span><span>- {selectedDiscountAmt.toFixed(2)} ج.م</span>
                    </div>
                  )}
                  {serviceChargeRate > 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>خدمة ({serviceChargeRate}%)</span><span>{selectedTotals.serviceAmt.toFixed(2)} ج.م</span>
                    </div>
                  )}
                  {taxRateVal > 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>ضريبة ({taxRateVal}%)</span><span>{selectedTotals.taxAmt.toFixed(2)} ج.م</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Grand total */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-700 bg-zinc-800/50">
              <span className="font-bold text-zinc-200">الإجمالي</span>
              <span className="text-2xl font-black tabular-nums" style={{ color: '#D4A017' }}>
                {selectedIsPaid
                  ? settlements.find(s => s.tableNum === selectedTable)?.total.toFixed(0)
                  : selectedTotals.grandTotal.toFixed(0)
                } <span className="text-sm text-zinc-400">ج.م</span>
              </span>
            </div>

            {/* Action buttons */}
            <div className="px-5 pb-5 pt-3 space-y-2">
              {!selectedIsPaid ? (
                <>
                  <button onClick={openPaymentModal} disabled={selectedOrders.length === 0}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                    <CheckCircle2 className="h-4 w-4" /> تسوية الحساب
                  </button>
                  <button onClick={() => {
                    const r: ReceiptData = {
                      tableNum: selectedTable, items: selectedOrders.map(o => ({
                        name: o.drink?.name ?? '—', quantity: o.quantity,
                        unitPrice: Number(o.drink?.price) || 0, total: (Number(o.drink?.price) || 0) * o.quantity
                      })),
                      subtotal: selectedSubtotal, discountAmount: selectedDiscountAmt,
                      serviceCharge: serviceChargeRate, taxRate: taxRateVal,
                      total: selectedTotals.grandTotal, cashier: currentUser.name,
                      place: currentPlace.name, invoiceNum: genInvoiceNum(),
                      date: new Date(), splitPayments: [{ method: 'cash', amount: selectedTotals.grandTotal }]
                    }
                    setReceiptPreview(r)
                  }}
                    className="w-full rounded-xl border border-zinc-600 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
                    <Eye className="h-4 w-4" /> معاينة الرسيت
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-center">
                    <p className="text-xs text-green-400 font-medium">✓ تمت التسوية</p>
                    <p className="text-[11px] text-green-600 mt-0.5">اضغط أدناه لتصفير الطاولة</p>
                  </div>
                  <button onClick={handleClearTable} disabled={isClearing}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#b45309,#92400e)' }}>
                    {isClearing ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري...</> : <><ChevronRight className="h-4 w-4" /> إغلاق الطاولة</>}
                  </button>
                  {(() => {
                    const s = settlements.find(st => st.tableNum === selectedTable)
                    if (!s) return null
                    return (
                      <button onClick={() => setReceiptPreview({
                        tableNum: s.tableNum, items: s.items, subtotal: s.subtotal,
                        discountAmount: s.discountAmount, serviceCharge: s.serviceCharge,
                        taxRate: s.taxRate, total: s.total, cashier: s.cashierName,
                        place: currentPlace.name, invoiceNum: s.invoiceNum,
                        date: s.settledAt, splitPayments: s.splitPayments
                      })}
                        className="w-full rounded-xl border border-zinc-600 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
                        <Eye className="h-4 w-4" /> معاينة وطباعة الرسيت
                      </button>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ PAYMENT MODAL ══════════════ */}
      {showPayment && selectedTable && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700"
              style={{ background: 'linear-gradient(135deg,#052e16,#14532d)' }}>
              <div>
                <p className="font-black text-white">💳 طريقة الدفع</p>
                <p className="text-xs text-green-400/80">طاولة {selectedTable}</p>
              </div>
              <button onClick={() => setShowPayment(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-black/30">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Total display */}
              <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-4 text-center">
                <p className="text-xs text-green-400/70 mb-1">الإجمالي المطلوب</p>
                <p className="text-3xl font-black text-green-300">{selectedTotals.grandTotal.toFixed(2)}</p>
                <p className="text-sm text-green-500">ج.م</p>
              </div>

              {/* Split toggle */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-300">تقسيم الفاتورة</p>
                <button onClick={() => {
                  setIsSplitMode(v => !v)
                  if (!isSplitMode) {
                    setSplitPayments([{ method: 'cash', amount: 0 }, { method: 'visa', amount: 0 }])
                  } else {
                    setSplitPayments([{ method: 'cash', amount: selectedTotals.grandTotal }])
                  }
                }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${isSplitMode ? 'bg-amber-500' : 'bg-zinc-700'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isSplitMode ? 'translate-x-0.5' : 'translate-x-5'}`} />
                </button>
              </div>

              {/* Payment method(s) */}
              {!isSplitMode ? (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">اختر طريقة الدفع</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map(pm => (
                      <button key={pm.key}
                        onClick={() => setSplitPayments([{ method: pm.key, amount: selectedTotals.grandTotal }])}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold transition-all ${splitPayments[0]?.method === pm.key ? 'border-transparent text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500'}`}
                        style={splitPayments[0]?.method === pm.key ? { background: pm.color, borderColor: pm.color } : {}}>
                        {pm.icon} {pm.label}
                      </button>
                    ))}
                  </div>
                  {/* Cash amount input */}
                  {splitPayments[0]?.method === 'cash' && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-1.5">المبلغ المدفوع (اختياري)</p>
                      <input
                        type="number" min="0"
                        value={splitPayments[0].amount || ''}
                        onChange={e => setSplitPayments([{ method: 'cash', amount: parseFloat(e.target.value) || selectedTotals.grandTotal }])}
                        placeholder={selectedTotals.grandTotal.toFixed(2)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-green-500/50"
                      />
                      {splitPayments[0].amount > selectedTotals.grandTotal && (
                        <p className="text-xs text-green-400 mt-1">
                          الباقي: {(splitPayments[0].amount - selectedTotals.grandTotal).toFixed(2)} ج.م
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Split payment */
                <div className="space-y-3">
                  {splitPayments.map((sp, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-zinc-500">طريقة {i + 1}</p>
                        {splitPayments.length > 1 && (
                          <button onClick={() => setSplitPayments(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-red-400 hover:text-red-300 text-xs">حذف</button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={sp.method}
                          onChange={e => setSplitPayments(prev => prev.map((p, idx) => idx === i ? { ...p, method: e.target.value as PaymentMethod } : p))}
                          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                        >
                          {PAYMENT_METHODS.map(pm => <option key={pm.key} value={pm.key}>{pm.label}</option>)}
                        </select>
                        <input type="number" min="0" value={sp.amount || ''}
                          onChange={e => setSplitPayments(prev => prev.map((p, idx) => idx === i ? { ...p, amount: parseFloat(e.target.value) || 0 } : p))}
                          placeholder="المبلغ"
                          className="w-28 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                  ))}
                  {splitPayments.length < 4 && (
                    <button onClick={() => setSplitPayments(prev => [...prev, { method: 'cash', amount: 0 }])}
                      className="w-full rounded-xl border border-dashed border-zinc-600 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-400 transition-colors flex items-center justify-center gap-1">
                      <Plus className="h-3.5 w-3.5" /> إضافة طريقة دفع
                    </button>
                  )}
                  {/* Remaining */}
                  <div className={`rounded-xl px-3 py-2 text-center text-sm font-bold ${remainingToPay > 0.01 ? 'bg-red-500/10 text-red-300' : 'bg-green-500/10 text-green-300'}`}>
                    {remainingToPay > 0.01 ? `متبقي: ${remainingToPay.toFixed(2)} ج.م` : '✓ مكتمل'}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div className="px-5 pb-5">
              <button onClick={confirmPayment}
                className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                <CheckCircle2 className="h-4 w-4" />
                تأكيد الدفع وإصدار الفاتورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ RECEIPT PREVIEW MODAL ══════════════ */}
      {receiptPreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setReceiptPreview(null) }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-zinc-700">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-700">
              <p className="text-white font-bold text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-400" /> معاينة الرسيت
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => { triggerPrint(receiptPreview); setReceiptPreview(null) }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#1a1a2e,#2d2d5e)' }}>
                  <Printer className="h-3.5 w-3.5" /> طباعة
                </button>
                <button onClick={() => setReceiptPreview(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto bg-gray-100" style={{ maxHeight: '75vh' }}>
              <div className="bg-white mx-auto shadow-md" style={{ maxWidth: '300px', padding: '16px 12px', fontFamily: 'Arial, sans-serif', fontSize: '13px', direction: 'rtl' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <img src="/images/sipflow-logo.jpg" alt="SîpFlõw" style={{ width: '70px', height: '70px', objectFit: 'contain', margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '16px', fontWeight: 900 }}>{receiptPreview.place}</div>
                  <div style={{ fontSize: '10px', color: '#666', marginBottom: '6px' }}>— SîpFlõw POS —</div>
                </div>
                <div style={{ borderTop: '1px dashed #aaa', margin: '6px 0' }} />
                <div style={{ fontSize: '11px', margin: '2px 0' }}>فاتورة #: {receiptPreview.invoiceNum}</div>
                <div style={{ fontSize: '11px', margin: '2px 0' }}>التاريخ: {receiptPreview.date.toLocaleDateString('ar-EG')} {receiptPreview.date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ fontSize: '11px', margin: '2px 0' }}>الكاشير: {receiptPreview.cashier}</div>
                <div style={{ fontSize: '11px', margin: '2px 0' }}>الطاولة: {receiptPreview.tableNum}</div>
                <div style={{ borderTop: '1px dashed #aaa', margin: '6px 0' }} />
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
                      <th style={{ padding: '4px 2px', textAlign: 'right', fontSize: '11px' }}>الصنف</th>
                      <th style={{ padding: '4px 2px', textAlign: 'center', fontSize: '11px' }}>ك</th>
                      <th style={{ padding: '4px 2px', textAlign: 'right', fontSize: '11px' }}>سعر</th>
                      <th style={{ padding: '4px 2px', textAlign: 'right', fontSize: '11px' }}>إجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptPreview.items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px dashed #e0e0e0' }}>
                        <td style={{ padding: '5px 2px', textAlign: 'right', fontSize: '12px' }}>{item.name}</td>
                        <td style={{ padding: '5px 2px', textAlign: 'center', fontSize: '12px', fontWeight: 700 }}>{item.quantity}</td>
                        <td style={{ padding: '5px 2px', textAlign: 'right', fontSize: '12px' }}>{item.unitPrice.toFixed(2)}</td>
                        <td style={{ padding: '5px 2px', textAlign: 'right', fontSize: '12px', fontWeight: 700 }}>{item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(() => {
                  const { serviceAmt, taxAmt } = calcTotals(receiptPreview.subtotal, receiptPreview.discountAmount, receiptPreview.serviceCharge, receiptPreview.taxRate)
                  const change = Math.max(0, receiptPreview.splitPayments.reduce((s, p) => s + p.amount, 0) - receiptPreview.total)
                  return (
                    <>
                      <div style={{ borderTop: '1px dashed #aaa', margin: '8px 0 4px' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '2px 0' }}><span>المجموع:</span><span>{receiptPreview.subtotal.toFixed(2)}</span></div>
                      {receiptPreview.discountAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '2px 0', color: '#b45309' }}><span>خصم:</span><span>- {receiptPreview.discountAmount.toFixed(2)}</span></div>}
                      {receiptPreview.serviceCharge > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '2px 0', color: '#555' }}><span>خدمة ({receiptPreview.serviceCharge}%):</span><span>{serviceAmt.toFixed(2)}</span></div>}
                      {receiptPreview.taxRate > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '2px 0', color: '#555' }}><span>ضريبة ({receiptPreview.taxRate}%):</span><span>{taxAmt.toFixed(2)}</span></div>}
                      <div style={{ borderTop: '1px dashed #aaa', margin: '4px 0' }} />
                      <div style={{ background: '#1a1a2e', color: '#fff', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 900, margin: '6px 0', borderRadius: '2px' }}>
                        <span>الإجمالي:</span><span>{receiptPreview.total.toFixed(2)} ج.م</span>
                      </div>
                      <div style={{ borderTop: '1px dashed #aaa', margin: '4px 0' }} />
                      {receiptPreview.splitPayments.map((sp, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '2px 0' }}>
                          <span>{pmLabel(sp.method)}:</span><span style={{ fontWeight: 700 }}>{sp.amount.toFixed(2)} ج.م</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '2px 0' }}><span>الباقي:</span><span style={{ fontWeight: 700 }}>{change.toFixed(2)} ج.م</span></div>
                    </>
                  )
                })()}
                <div style={{ borderTop: '1px dashed #aaa', margin: '8px 0 4px' }} />
                <div style={{ textAlign: 'center', fontSize: '12px', margin: '8px 0 3px' }}>شكراً لزيارتكم! 🙏</div>
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#666' }}>SîpFlõw — نظام الطلبات</div>
                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=SipFlow-${receiptPreview.invoiceNum}`} width="65" height="65" alt="QR" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ ADMIN PASSWORD MODAL ══════════════ */}
      {adminModal?.isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700"
              style={{ background: 'linear-gradient(135deg,#1a0a00,#2a0a00)' }}>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-400" />
                <p className="font-black text-white">تأكيد الأدمن</p>
              </div>
              <button onClick={() => setAdminModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-zinc-400">{adminModal.action}</p>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">كلمة سر الأدمن</label>
                <input
                  type="password" value={adminPwInput}
                  onChange={e => setAdminPwInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && verifyAdmin()}
                  placeholder="ادخل كلمة السر"
                  autoFocus
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                />
                {adminPwError && <p className="text-xs text-red-400 mt-1">{adminPwError}</p>}
              </div>
              <button onClick={verifyAdmin} disabled={adminPwLoading}
                className="w-full rounded-xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}>
                {adminPwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Shield className="h-4 w-4" /> تأكيد</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ TABLE TRANSFER MODAL ══════════════ */}
      {transferModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-amber-400" />
                <p className="font-black text-white">نقل طلبات</p>
              </div>
              <button onClick={() => { setTransferModal(null); setTransferTarget('') }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-zinc-400">
                نقل طلبات طاولة <span className="text-white font-bold">{transferModal.fromTable}</span> إلى:
              </p>
              <input
                type="text" value={transferTarget} onChange={e => setTransferTarget(e.target.value)}
                placeholder="رقم الطاولة الجديدة"
                autoFocus
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
              />
              <button onClick={handleTransfer} disabled={isTransferring || !transferTarget.trim()}
                className="w-full rounded-xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
                {isTransferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowLeftRight className="h-4 w-4" /> نقل</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ SHIFT OPEN MODAL ══════════════ */}
      {showShiftOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700"
              style={{ background: 'linear-gradient(135deg,#052e16,#14532d)' }}>
              <div className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-green-400" />
                <p className="font-black text-white">فتح وردية جديدة</p>
              </div>
              <button onClick={() => setShowShiftOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-black/30">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm text-zinc-400 mb-1">الكاشير: <span className="text-white">{currentUser.name}</span></p>
                <p className="text-xs text-zinc-500">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">مبلغ البداية (ج.م)</label>
                <input
                  type="number" min="0" value={shiftStartInput}
                  onChange={e => setShiftStartInput(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-green-500/50"
                />
              </div>
              <button
                onClick={() => {
                  setShift({ isOpen: true, startAmount: parseFloat(shiftStartInput) || 0, openedAt: new Date(), cashierName: currentUser.name })
                  setShowShiftOpen(false); setShiftStartInput('')
                  toast.success('تم فتح الوردية')
                }}
                className="w-full rounded-xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                <PlayCircle className="h-4 w-4" /> فتح الوردية
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ SHIFT CLOSE MODAL ══════════════ */}
      {showShiftClose && shift && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700"
              style={{ background: 'linear-gradient(135deg,#1a0000,#2a0000)' }}>
              <div className="flex items-center gap-2">
                <StopCircle className="h-5 w-5 text-red-400" />
                <p className="font-black text-white">إغلاق الوردية</p>
              </div>
              <button onClick={() => setShowShiftClose(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-black/30">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {(() => {
                const t = shiftTotals()
                const shiftDuration = Math.round((Date.now() - shift.openedAt.getTime()) / 60000)
                return (
                  <>
                    <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-3 space-y-2 text-sm">
                      <div className="flex justify-between text-zinc-400">
                        <span>الكاشير</span><span className="text-white">{shift.cashierName}</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>وقت الوردية</span><span className="text-white">{shiftDuration} دقيقة</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>مبلغ البداية</span><span className="text-white">{shift.startAmount.toFixed(2)} ج.م</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-3 space-y-2 text-sm">
                      <p className="text-xs text-zinc-500 font-medium">تفصيل المبيعات</p>
                      {PAYMENT_METHODS.map(pm => t.byMethod[pm.key] > 0 && (
                        <div key={pm.key} className="flex justify-between">
                          <span className="text-zinc-400 flex items-center gap-1">{pm.icon}<span className="text-xs">{pm.label}</span></span>
                          <span className="text-white font-bold">{t.byMethod[pm.key].toFixed(2)} ج.م</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-amber-400">
                        <span>إجمالي الخصومات</span><span>- {t.totalDiscounts.toFixed(2)} ج.م</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>عدد الفواتير</span><span className="text-white">{t.invoiceCount}</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 flex justify-between">
                      <span className="font-bold text-white">الإجمالي</span>
                      <span className="text-xl font-black text-green-400">{t.total.toFixed(2)} ج.م</span>
                    </div>
                    <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-3 text-sm">
                      <div className="flex justify-between text-zinc-400">
                        <span>المتوقع (كاش)</span><span className="text-white">{(shift.startAmount + t.byMethod.cash).toFixed(2)} ج.م</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={printShiftReport}
                        className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 flex items-center justify-center gap-1">
                        <Printer className="h-3.5 w-3.5" /> طباعة التقرير
                      </button>
                      <button
                        onClick={() => {
                          setShift(null); setShowShiftClose(false)
                          setSettlements([]); setPaidTables(new Set())
                          toast.success('تم إغلاق الوردية')
                        }}
                        className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white flex items-center justify-center gap-1"
                        style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                        <StopCircle className="h-3.5 w-3.5" /> إغلاق وتصفير
                      </button>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ RESERVATIONS MODAL ══════════════ */}
      {showReservations && (
        <div className="fixed inset-0 z-50 flex flex-col" dir="rtl">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowReservations(false)} />
          <div className="relative mt-auto w-full max-h-[85vh] flex flex-col rounded-t-3xl border-t border-zinc-700 bg-zinc-950 overflow-hidden">
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-zinc-700" />
            </div>
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
              <button onClick={() => setShowReservations(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {isFetchingReservations ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 text-amber-400 animate-spin" />
                </div>
              ) : reservations.length === 0 ? (
                <div className="text-center py-10 text-zinc-500">لا توجد حجوزات</div>
              ) : (
                reservations.map(r => (
                  <div key={r.id} className={`rounded-2xl border p-4 ${r.status === 'pending' ? 'border-orange-500/30 bg-orange-500/5' : r.status === 'confirmed' ? 'border-green-500/30 bg-green-500/5' : 'border-zinc-700 bg-zinc-900 opacity-60'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-white">{r.customer_name}</p>
                        {r.customer_phone && <p className="text-xs text-zinc-500">{r.customer_phone}</p>}
                        <p className="text-xs text-zinc-500 mt-0.5">{r.party_size} أشخاص — {new Date(r.reserved_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</p>
                        {r.notes && <p className="text-xs text-zinc-400 mt-1 italic">"{r.notes}"</p>}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.status === 'pending' ? 'bg-orange-500/20 text-orange-300' : r.status === 'confirmed' ? 'bg-green-500/20 text-green-300' : 'bg-zinc-700 text-zinc-400'}`}>
                        {r.status === 'pending' ? 'انتظار' : r.status === 'confirmed' ? `✓ طاولة ${r.table_number}` : 'ملغي'}
                      </span>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex gap-2">
                        <input
                          value={tableInputs[r.id] ?? ''} onChange={e => setTableInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="رقم الطاولة"
                          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
                        />
                        <button onClick={() => handleConfirmReservation(r.id)} disabled={confirmingId === r.id}
                          className="rounded-lg px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 flex items-center gap-1">
                          {confirmingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : '✓'} تأكيد
                        </button>
                        <button onClick={() => handleCancelReservation(r.id)} disabled={cancellingId === r.id}
                          className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50">
                          {cancellingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
