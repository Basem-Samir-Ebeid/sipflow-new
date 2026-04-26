'use client'

import { OrderWithDetails, User, Drink } from '@/lib/types'
import { Trash2, Coffee, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OrderBoardProps {
  orders: OrderWithDetails[]
  drinks: Drink[]
  currentUser: User | null
  onDeleteOrder: (orderId: string) => void
  isAdmin?: boolean
}

const formatDisplayName = (
  customerName: string | null | undefined, 
  tableNumber: string | null | undefined,
  userName?: string | null | undefined
): string => {
  // Show customer_name from order if available (highest priority)
  if (customerName && customerName.trim()) {
    return tableNumber ? `${customerName} - طاولة ${tableNumber}` : customerName
  }
  // Fallback to table number only
  if (tableNumber) return `طاولة ${tableNumber}`
  // Hide UUID-like names (shared users) - only if no customer_name or table_number
  if (userName?.startsWith('__زبون__')) return '—'
  if (userName?.startsWith('Guest-')) return '—'
  // Return user name if available
  return userName || '—'
}

export function OrderBoard({ orders, drinks, currentUser, onDeleteOrder, isAdmin = false }: OrderBoardProps) {
  // Group orders by customer_name + table_number (from order), fallback to user_id
  const ordersByCustomer = orders.reduce((acc, order) => {
    // Use customer_name + table_number from order if available, otherwise fallback to user_id
    const customerKey = (order.customer_name && order.table_number) 
      ? `${order.customer_name}_${order.table_number}`
      : order.table_number 
        ? `table_${order.table_number}`
        : order.user_id
    
    if (!acc[customerKey]) {
      acc[customerKey] = {
        user: order.user,
        customerName: order.customer_name,
        tableNumber: order.table_number,
        orders: []
      }
    }
    acc[customerKey].orders.push(order)
    return acc
  }, {} as Record<string, { user: User; customerName?: string | null; tableNumber?: string | null; orders: OrderWithDetails[] }>)

  const calculateTotal = (userOrders: OrderWithDetails[]) => {
    return userOrders.reduce((total, order) => {
      const drink = drinks.find(d => d.id === order.drink_id)
      return total + (Number(drink?.price) || 0) * order.quantity
    }, 0)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('ar-EG', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ar-EG', { 
      day: 'numeric',
      month: 'short'
    })
  }

  const countTotalItems = (userOrders: OrderWithDetails[]) => {
    return userOrders.reduce((count, order) => count + order.quantity, 0)
  }

  if (Object.keys(ordersByCustomer).length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl px-6 py-12 text-center"
        style={{
          background: 'linear-gradient(160deg, #14110d 0%, #1a1611 50%, #14110d 100%)',
          border: '1px solid rgba(212,160,23,0.18)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}>
        {/* corner accents */}
        <div className="absolute pointer-events-none" style={{ top: '-40px', left: '-40px', width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(212,160,23,0.1), transparent 70%)', filter: 'blur(8px)' }} />
        <div className="absolute pointer-events-none" style={{ bottom: '-40px', right: '-40px', width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(244,219,156,0.07), transparent 70%)', filter: 'blur(8px)' }} />
        {/* gold top shimmer */}
        <div className="absolute top-0 inset-x-0" style={{ height: '1.5px', background: 'linear-gradient(90deg, transparent, rgba(212,160,23,0.5), transparent)' }} />

        <div className="relative">
          {/* icon orb with concentric rings */}
          <div className="mb-5 flex justify-center">
            <div className="relative">
              {/* outer ring */}
              <div className="absolute inset-0 -m-3 rounded-full" style={{ border: '1px solid rgba(212,160,23,0.12)' }} />
              <div className="absolute inset-0 -m-1.5 rounded-full" style={{ border: '1px solid rgba(212,160,23,0.18)' }} />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(212,160,23,0.18), rgba(212,160,23,0.04))',
                  border: '1px solid rgba(212,160,23,0.3)',
                  boxShadow: '0 0 28px rgba(212,160,23,0.22), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}>
                <Coffee className="h-7 w-7" style={{ color: '#fbbf24' }} />
              </div>
            </div>
          </div>

          <h3 className="mb-2 text-lg font-black tracking-wide" style={{ color: '#f5f0e8' }}>SîpFlõw لسه فاضية</h3>
          <p className="text-xs font-medium mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>اطلب أول مشروب وافتح جلستك!</p>

          {/* decorative divider */}
          <div className="flex items-center justify-center gap-2 mt-5">
            <span style={{ height: '1px', width: '40px', background: 'linear-gradient(90deg, transparent, rgba(212,160,23,0.3))' }} />
            <span className="text-[10px] font-bold tracking-[3px]" style={{ color: 'rgba(212,160,23,0.55)' }}>SîpFlõw</span>
            <span style={{ height: '1px', width: '40px', background: 'linear-gradient(90deg, rgba(212,160,23,0.3), transparent)' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(ordersByCustomer).map(([customerKey, { user, customerName, tableNumber, orders: customerOrders }]) => {
        const total = calculateTotal(customerOrders)
        const totalItems = countTotalItems(customerOrders)
        const isVip = customerOrders.some(o => o.notes?.includes('مطور'))
        const displayName = formatDisplayName(customerName, tableNumber, user?.name)
        
        return (
          <div 
            key={customerKey} 
            className={`relative rounded-2xl p-4 shadow-sm${isVip ? ' mt-3' : ''}`}
            style={isVip ? {
              border: '2px solid #f59e0b',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.07), var(--card))',
              boxShadow: '0 0 22px rgba(245,158,11,0.35), inset 0 0 12px rgba(245,158,11,0.05)'
            } : {
              border: '1px solid var(--border)',
              background: 'var(--card)'
            }}
          >
            {/* VIP Badge */}
            {isVip && (
              <div className="absolute -top-3.5 left-4 z-20 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold shadow-xl"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)', color: '#fff', letterSpacing: '0.05em' }}>
                VIP مطور
              </div>
            )}
            {/* User Header with Summary */}
            <div className="mb-3 flex items-center justify-between border-b pb-3"
              style={{ borderColor: isVip ? 'rgba(245,158,11,0.3)' : 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="rounded-full px-3 py-1 text-sm font-medium"
                  style={isVip
                    ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#1a0a00' }
                    : { background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                  {total > 0 ? `${total.toFixed(0)} ج.م` : '-'}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {totalItems} {totalItems === 1 ? 'صنف' : 'أصناف'}
                </span>
              </div>
              <h3 className="text-lg font-bold" style={{ color: isVip ? '#f59e0b' : 'var(--foreground)' }}>
                {displayName}
              </h3>
            </div>
            
            {/* Orders List with Date/Time */}
            <div className="space-y-2">
              {customerOrders.map((order) => {
                const drinkPrice = Number(order.drink?.price) || 0
                const orderTotal = drinkPrice * order.quantity
                return (
                  <div 
                    key={order.id} 
                    className="group rounded-xl bg-muted px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      {(isAdmin || currentUser?.id === order.user_id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => onDeleteOrder(order.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      <div className="flex flex-1 items-center justify-end gap-3">
                        <span className="text-sm text-primary font-medium">
                          {orderTotal > 0 ? `${orderTotal.toFixed(0)} ج.م` : ''}
                        </span>
                        <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                          x{order.quantity}
                        </span>
                        <span className="font-medium text-foreground">{order.drink?.name ?? '—'}</span>
                      </div>
                    </div>
                    {/* Date & Time Row */}
                    <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(order.created_at)}</span>
                      <span>-</span>
                      <span>{formatDate(order.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* User Total Summary Footer */}
            <div className="mt-3 flex items-center justify-between border-t pt-3"
              style={{ borderColor: isVip ? 'rgba(245,158,11,0.3)' : 'var(--border)' }}>
              <span className="text-lg font-bold" style={{ color: isVip ? '#f59e0b' : 'var(--primary)' }}>
                {total > 0 ? `${total.toFixed(0)} ج.م` : '-'}
              </span>
              <span className="text-sm text-muted-foreground">
                إجمالي {displayName}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
