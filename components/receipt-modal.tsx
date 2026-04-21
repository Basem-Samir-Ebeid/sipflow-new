'use client'

import { OrderWithDetails, User, Drink } from '@/lib/types'
import { X, Printer, Coffee, Users, Receipt } from 'lucide-react'
import { printHTML } from '@/lib/print'
import { Button } from '@/components/ui/button'
import { useRef, useState } from 'react'

interface ReceiptModalProps {
  orders: OrderWithDetails[]
  drinks: Drink[]
  currentUser: User | null
  onClose: () => void
}

type ReceiptType = 'all' | 'user'

const PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Share+Tech+Mono&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #e5e5e5;
    display: flex;
    justify-content: center;
    padding: 30px 10px;
    min-height: 100vh;
    font-family: 'Cairo', sans-serif;
    direction: rtl;
  }
  .paper {
    width: 300px;
    background: #fffef8;
    position: relative;
    filter: drop-shadow(0 8px 32px rgba(0,0,0,0.22));
  }
  .tear-top, .tear-bottom {
    width: 100%;
    height: 16px;
    background: #e5e5e5;
    position: relative;
  }
  .tear-top::after, .tear-bottom::after {
    content: '';
    position: absolute;
    left: 0; right: 0;
    height: 16px;
    background-image: radial-gradient(circle at 50% 0%, #e5e5e5 8px, #fffef8 8px);
    background-size: 18px 16px;
    background-repeat: repeat-x;
  }
  .tear-top::after { bottom: 0; background-image: radial-gradient(circle at 50% 100%, #e5e5e5 8px, #fffef8 8px); }
  .tear-bottom::after { top: 0; background-image: radial-gradient(circle at 50% 0%, #e5e5e5 8px, #fffef8 8px); }
  .body { padding: 4px 18px 18px; }
  .center { text-align: center; }
  .store-name {
    font-size: 36px;
    font-weight: 700;
    color: #1a1008;
    letter-spacing: 3px;
    line-height: 1.1;
    font-family: 'Cairo', sans-serif;
  }
  .store-sub {
    font-size: 10px;
    color: #78716c;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-top: 2px;
  }
  .mono {
    font-family: 'Share Tech Mono', 'Courier New', monospace;
    font-size: 10px;
    color: #57534e;
  }
  .sep { border: none; border-top: 1px dashed #c7bdb0; margin: 10px 0; }
  .sep-solid { border: none; border-top: 1px solid #c7bdb0; margin: 10px 0; }
  .sep-double { border: none; border-top: 2px double #c7bdb0; margin: 10px 0; }
  .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #78716c;
    font-family: 'Share Tech Mono', 'Courier New', monospace;
    margin: 3px 0;
  }
  .section-title {
    font-size: 9px;
    font-weight: 700;
    color: #a8a29e;
    letter-spacing: 3px;
    text-transform: uppercase;
    text-align: center;
    margin: 8px 0 6px;
  }
  .guest-name {
    font-size: 12px;
    font-weight: 700;
    color: #292524;
    margin: 8px 0 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .table-badge {
    font-size: 9px;
    background: #fef3c7;
    color: #92400e;
    padding: 1px 6px;
    border-radius: 3px;
    font-family: 'Share Tech Mono', monospace;
    margin-right: auto;
    border: 1px solid #fde68a;
  }
  .item-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-size: 11.5px;
    color: #292524;
    padding: 3px 0;
    gap: 4px;
  }
  .item-name { flex: 1; }
  .item-dots {
    flex: 1;
    border-bottom: 1px dotted #d6cfc8;
    margin: 0 4px;
    height: 10px;
  }
  .item-qty {
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px;
    color: #78716c;
    white-space: nowrap;
  }
  .item-price {
    font-family: 'Share Tech Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    color: #292524;
    white-space: nowrap;
    min-width: 52px;
    text-align: left;
  }
  .note-row {
    font-size: 9.5px;
    color: #a8a29e;
    font-style: italic;
    padding: 0 0 3px 2px;
  }
  .subtotal-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: #57534e;
    font-family: 'Share Tech Mono', monospace;
    padding: 4px 0;
  }
  .subtotal-val { font-weight: 700; color: #292524; }
  .total-section { margin: 6px 0; }
  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 4px 0;
  }
  .total-label { font-size: 11px; color: #57534e; }
  .total-val {
    font-size: 22px;
    font-weight: 700;
    color: #1c1917;
    font-family: 'Share Tech Mono', monospace;
    letter-spacing: -1px;
  }
  .total-currency { font-size: 12px; color: #78716c; margin-right: 2px; }
  .stats-row {
    display: flex;
    justify-content: space-around;
    margin: 6px 0;
  }
  .stat-box {
    text-align: center;
    padding: 4px 8px;
    border: 1px dashed #d6cfc8;
    border-radius: 4px;
  }
  .stat-num { font-size: 14px; font-weight: 700; color: #292524; font-family: 'Share Tech Mono', monospace; }
  .stat-lbl { font-size: 9px; color: #a8a29e; }
  .barcode-section { text-align: center; margin: 12px 0 6px; }
  .barcode {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 1px;
    height: 36px;
    margin-bottom: 4px;
  }
  .bar { background: #292524; border-radius: 1px; }
  .barcode-num { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #78716c; letter-spacing: 3px; }
  .footer-msg { font-size: 12px; font-weight: 700; color: #292524; }
  .footer-sub { font-size: 9px; color: #a8a29e; margin-top: 2px; letter-spacing: 1px; }
  .powered { font-size: 8px; color: #c7bdb0; margin-top: 4px; letter-spacing: 2px; text-transform: uppercase; }
  @media print {
    body { background: white; padding: 0; }
    .paper { filter: none; width: 100%; }
  }
`

export function ReceiptModal({ orders, drinks, currentUser, onClose }: ReceiptModalProps) {
  const isStaff = currentUser?.role === 'order_receiver'
  const [receiptType, setReceiptType] = useState<ReceiptType>(isStaff ? 'user' : 'all')
  const printRef = useRef<HTMLDivElement>(null)

  const ordersByUser = orders.reduce((acc, order) => {
    const userId = order.user_id
    if (!acc[userId]) acc[userId] = { user: order.user, orders: [] }
    acc[userId].orders.push(order)
    return acc
  }, {} as Record<string, { user: User; orders: OrderWithDetails[] }>)

  const calculateUserTotal = (userOrders: OrderWithDetails[]) =>
    userOrders.reduce((total, order) => {
      const drink = drinks.find(d => d.id === order.drink_id)
      return total + (Number(drink?.price) || 0) * order.quantity
    }, 0)

  const totalOrdersPrice = orders.reduce((total, order) =>
    total + (Number(order.drink?.price) || 0) * order.quantity, 0)

  const currentUserOrders = currentUser ? orders.filter(o => o.user_id === currentUser.id) : []
  const currentUserTotal = calculateUserTotal(currentUserOrders)

  const now = new Date()
  const dateStr = now.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })
  const receiptNo = `INV-${String(now.getTime()).slice(-7)}`

  // Generate deterministic fake barcode bars from receipt number
  const barHeights = Array.from(receiptNo.replace('INV-', '')).flatMap((ch) => {
    const n = parseInt(ch, 10)
    return [n % 3 === 0 ? 36 : n % 2 === 0 ? 28 : 20, n % 2 === 0 ? 36 : 24]
  })

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return
    printHTML(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${receiptNo}</title><style>${PRINT_STYLES}</style></head><body>${printContent.innerHTML}</body></html>`)
  }

  const ItemRows = ({ itemOrders }: { itemOrders: OrderWithDetails[] }) => (
    <>
      {itemOrders.map((order, i) => {
        const itemTotal = (Number(order.drink?.price) || 0) * order.quantity
        return (
          <div key={order.id}>
            <div className="item-row">
              <span className="item-name">{order.drink?.name}</span>
              <span className="item-dots" />
              <span className="item-qty">{order.quantity > 1 ? `${order.quantity}×` : ''}</span>
              <span className="item-price">{itemTotal > 0 ? `${itemTotal.toFixed(0)} ج` : '—'}</span>
            </div>
            {order.notes && <div className="note-row">↳ {order.notes}</div>}
          </div>
        )
      })}
    </>
  )

  const BarcodeEl = () => (
    <div className="barcode-section">
      <div className="barcode">
        {barHeights.map((h, i) => (
          <div key={i} className="bar" style={{ width: i % 3 === 0 ? 3 : 1.5, height: h }} />
        ))}
      </div>
      <div className="barcode-num">{receiptNo}</div>
    </div>
  )

  const ReceiptContent = () => (
    <div ref={printRef} className="paper">
      {/* Torn edge top */}
      <div className="tear-top" />

      <div className="body">
        {/* Store header */}
        <div className="center" style={{ padding: '8px 0 4px' }}>
          <div className="store-name">SîpFlõw</div>
          <div className="store-sub">Qaada Café · SipFlow</div>
        </div>

        <hr className="sep" />

        {/* Meta */}
        <div className="meta-row"><span>التاريخ</span><span>{dateStr}</span></div>
        <div className="meta-row"><span>الوقت</span><span>{timeStr}</span></div>
        <div className="meta-row"><span>رقم الفاتورة</span><span>{receiptNo}</span></div>

        <hr className="sep-double" />

        {receiptType === 'all' ? (
          <>
            <div className="section-title">· تفاصيل الطلبات ·</div>

            {Object.entries(ordersByUser).map(([userId, { user, orders: userOrders }]) => {
              const userTotal = calculateUserTotal(userOrders)
              return (
                <div key={userId} style={{ marginBottom: 10 }}>
                  <div className="guest-name">
                    <span>▸</span>
                    <span>{(user.name?.startsWith('Guest-') && user.table_number) ? `طاولة ${user.table_number}` : user.name}</span>
                  </div>
                  <ItemRows itemOrders={userOrders} />
                  {userTotal > 0 && (
                    <div className="subtotal-row" style={{ marginTop: 4 }}>
                      <span>مجموع {(user.name?.startsWith('Guest-') && user.table_number) ? `طاولة ${user.table_number}` : user.name}</span>
                      <span className="subtotal-val">{userTotal.toFixed(0)} ج.م</span>
                    </div>
                  )}
                  <hr className="sep" />
                </div>
              )
            })}

            {/* Stats */}
            <div className="stats-row">
              <div className="stat-box">
                <div className="stat-num">{Object.keys(ordersByUser).length}</div>
                <div className="stat-lbl">أشخاص</div>
              </div>
              <div className="stat-box">
                <div className="stat-num">{orders.length}</div>
                <div className="stat-lbl">طلبات</div>
              </div>
            </div>

            <hr className="sep-solid" />

            {/* Grand total */}
            <div className="total-section">
              <div className="total-row">
                <span className="total-label" style={{ fontWeight: 700 }}>الإجمالي الكلي</span>
                <div>
                  <span className="total-currency">ج.م</span>
                  <span className="total-val">{totalOrdersPrice.toFixed(0)}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="section-title">· فاتورة {currentUser?.name} ·</div>

            {currentUserOrders.length > 0 ? (
              <>
                <ItemRows itemOrders={currentUserOrders} />
                <hr className="sep-solid" />
                <div className="total-section">
                  <div className="total-row">
                    <span className="total-label" style={{ fontWeight: 700 }}>الإجمالي</span>
                    <div>
                      <span className="total-currency">ج.م</span>
                      <span className="total-val">{currentUserTotal.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#a8a29e' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>☕</div>
                <div className="mono">لا توجد طلبات بعد</div>
              </div>
            )}
          </>
        )}

        <hr className="sep" />

        {/* Barcode */}
        <BarcodeEl />

        <hr className="sep" />

        {/* Footer */}
        <div className="center" style={{ paddingBottom: 8 }}>
          <div className="footer-msg">شكراً لوجودك معنا</div>
          <div className="footer-sub">كل SîpFlõw حكاية</div>
          <div className="powered">Powered by SipFlow</div>
        </div>
      </div>

      {/* Torn edge bottom */}
      <div className="tear-bottom" />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
          <h2 className="font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            الفاتورة
          </h2>
          <div className="w-8" />
        </div>

        {/* Tabs — hidden for staff */}
        {!isStaff && (
          <div className="flex border-b border-border">
            <button
              onClick={() => setReceiptType('all')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                receiptType === 'all'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              SîpFlõw كلها
            </button>
            <button
              onClick={() => setReceiptType('user')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                receiptType === 'user'
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Coffee className="h-3.5 w-3.5" />
              فاتورتي فقط
            </button>
          </div>
        )}

        {/* Receipt Preview */}
        <div className="flex-1 overflow-y-auto py-4 px-2" style={{ background: '#e5e5e5' }}>
          <div className="flex justify-center">
            <ReceiptContent />
          </div>
        </div>

        {/* Print Button */}
        <div className="border-t border-border p-3">
          <Button
            className="w-full h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            طباعة الفاتورة
          </Button>
        </div>
      </div>
    </div>
  )
}
