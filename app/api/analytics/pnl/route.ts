import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const sql = getSql()
  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get('place_id')
  const months  = Math.min(Number(searchParams.get('months') ?? 3), 12)

  if (!placeId || !UUID_RE.test(placeId))
    return NextResponse.json({ error: 'place_id required' }, { status: 400 })

  const since = new Date()
  since.setMonth(since.getMonth() - months)

  const monthly = await sql`
    SELECT
      TO_CHAR(o.created_at AT TIME ZONE 'Africa/Cairo', 'YYYY-MM') AS month,
      COALESCE(SUM(o.total_price), 0)            AS revenue,
      COUNT(o.id)                                AS orders,
      COUNT(DISTINCT o.user_id)                  AS unique_customers,
      ROUND(AVG(o.total_price)::numeric, 2)      AS avg_order_value
    FROM orders o
    JOIN sessions s ON s.id = o.session_id
    WHERE s.place_id = ${placeId}
      AND o.created_at >= ${since}
    GROUP BY 1
    ORDER BY 1
  `

  const drinkPerformance = await sql`
    SELECT
      d.name,
      d.price,
      d.category,
      COUNT(o.id)                             AS times_ordered,
      SUM(o.quantity)                         AS total_qty,
      COALESCE(SUM(o.total_price), 0)         AS total_revenue,
      ROUND(AVG(o.rating)::numeric, 1)        AS avg_rating,
      COUNT(o.rating)                         AS rating_count
    FROM drinks d
    LEFT JOIN orders o   ON o.drink_id = d.id
    LEFT JOIN sessions s ON s.id = o.session_id AND s.place_id = ${placeId}
    WHERE d.place_id = ${placeId}
    GROUP BY d.id, d.name, d.price, d.category
    ORDER BY total_revenue DESC
  `

  const costData = await sql`
    SELECT
      d.id AS drink_id,
      d.name,
      d.price,
      COALESCE(SUM(ri.quantity * i.cost_per_unit), 0) AS cost_per_unit
    FROM drinks d
    LEFT JOIN recipes r   ON r.drink_id = d.id
    LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
    LEFT JOIN ingredients i  ON i.id = ri.ingredient_id
    WHERE d.place_id = ${placeId}
    GROUP BY d.id, d.name, d.price
  `.catch(() => [])

  const costMap: Record<string, number> = {}
  for (const r of costData as any[]) costMap[r.drink_id] = Number(r.cost_per_unit ?? 0)

  const drinks = (drinkPerformance as any[]).map(r => {
    const revenue     = Number(r.total_revenue)
    const qty         = Number(r.total_qty ?? 0)
    const cost        = costMap[r.drink_id ?? ''] ?? 0
    const totalCost   = cost * qty
    const grossProfit = revenue - totalCost
    const margin      = revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0

    return {
      name: r.name,
      price: Number(r.price),
      category: r.category,
      timesOrdered: Number(r.times_ordered),
      totalQty: qty,
      revenue,
      costPerUnit: cost,
      totalCost,
      grossProfit,
      margin,
      avgRating: r.avg_rating ? Number(r.avg_rating) : null,
      ratingCount: Number(r.rating_count),
      performance: qty === 0 ? 'dead' : qty < 3 ? 'slow' : qty < 10 ? 'normal' : 'star',
    }
  })

  const totalRevenue   = drinks.reduce((s, d) => s + d.revenue, 0)
  const totalCost      = drinks.reduce((s, d) => s + d.totalCost, 0)
  const grossProfit    = totalRevenue - totalCost
  const overallMargin  = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0

  const stars = drinks.filter(d => d.performance === 'star')
  const dead  = drinks.filter(d => d.performance === 'dead')
  const slow  = drinks.filter(d => d.performance === 'slow')

  return NextResponse.json({
    monthly: (monthly as any[]).map(r => ({
      month: r.month,
      revenue: Number(r.revenue),
      orders: Number(r.orders),
      uniqueCustomers: Number(r.unique_customers),
      avgOrderValue: Number(r.avg_order_value),
    })),
    drinks,
    summary: {
      totalRevenue,
      totalCost,
      grossProfit,
      overallMargin,
      starCount: stars.length,
      deadCount: dead.length,
      slowCount: slow.length,
    },
    insights: {
      stars: stars.slice(0, 3).map(d => d.name),
      deadItems: dead.slice(0, 5).map(d => d.name),
      highMargin: [...drinks].sort((a,b) => b.margin - a.margin).slice(0, 3).map(d => d.name),
      lowMargin: [...drinks].filter(d => d.timesOrdered > 0).sort((a,b) => a.margin - b.margin).slice(0, 3).map(d => d.name),
    }
  })
}
