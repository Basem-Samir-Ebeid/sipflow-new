import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const sql = getSql()
  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get('place_id')
  if (!placeId || !UUID_RE.test(placeId))
    return NextResponse.json({ error: 'place_id required' }, { status: 400 })

  const now = new Date()
  const day7  = new Date(now); day7.setDate(now.getDate() - 7)
  const day14 = new Date(now); day14.setDate(now.getDate() - 14)
  const day30 = new Date(now); day30.setDate(now.getDate() - 30)

  const rows = await sql`
    SELECT
      u.id,
      u.name,
      u.created_at,
      COUNT(o.id)                          AS total_orders,
      COALESCE(SUM(o.total_price), 0)      AS total_spent,
      MAX(o.created_at)                    AS last_order_at,
      ROUND(AVG(o.rating)::numeric, 1)     AS avg_rating,
      COUNT(o.rating)                      AS rated_orders
    FROM users u
    LEFT JOIN sessions s ON s.place_id = ${placeId}
    LEFT JOIN orders o   ON o.session_id = s.id AND o.user_id = u.id
    WHERE u.place_id = ${placeId}
      AND u.name NOT LIKE '__زبون__%'
    GROUP BY u.id, u.name, u.created_at
    ORDER BY total_spent DESC
  `

  const customers = rows.map((r: any) => {
    const totalOrders  = Number(r.total_orders)
    const totalSpent   = Number(r.total_spent)
    const lastOrderAt  = r.last_order_at ? new Date(r.last_order_at) : null
    const createdAt    = new Date(r.created_at)
    const daysSinceLast = lastOrderAt ? Math.floor((now.getTime() - lastOrderAt.getTime()) / 86400000) : null
    const isNew        = createdAt >= day7

    let segment: 'vip' | 'regular' | 'at_risk' | 'lost' | 'new' = 'new'
    if (totalSpent >= 500 && totalOrders >= 5) {
      segment = 'vip'
    } else if (isNew && totalOrders === 0) {
      segment = 'new'
    } else if (daysSinceLast !== null && daysSinceLast > 30) {
      segment = 'lost'
    } else if (daysSinceLast !== null && daysSinceLast > 14) {
      segment = 'at_risk'
    } else if (totalOrders > 0) {
      segment = 'regular'
    }

    return {
      id: r.id,
      name: r.name,
      totalOrders,
      totalSpent,
      avgRating: r.avg_rating ? Number(r.avg_rating) : null,
      lastOrderAt: r.last_order_at,
      daysSinceLast,
      segment,
      isNew,
    }
  })

  const summary = {
    vip:     customers.filter((c: any) => c.segment === 'vip').length,
    regular: customers.filter((c: any) => c.segment === 'regular').length,
    at_risk: customers.filter((c: any) => c.segment === 'at_risk').length,
    lost:    customers.filter((c: any) => c.segment === 'lost').length,
    new:     customers.filter((c: any) => c.segment === 'new').length,
    total:   customers.length,
  }

  const topSpenders = customers.slice(0, 10)

  return NextResponse.json({ customers, summary, topSpenders })
}
