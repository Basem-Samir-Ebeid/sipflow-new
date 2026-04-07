import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

function sinceDate(period: string): Date {
  const now = new Date()
  if (period === 'today')  now.setDate(now.getDate() - 1)
  else if (period === 'month') now.setDate(now.getDate() - 30)
  else                     now.setDate(now.getDate() - 7)   // default: week
  return now
}

export async function GET(req: Request) {
  const sql = getSql()
  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get('place_id')
  const period  = searchParams.get('period') || 'week'
  const isGlobal = searchParams.get('global') === 'true'

  const since = sinceDate(period)

  try {
    if (isGlobal) {
      // ── Dev-admin global view ─────────────────────────────
      const placeComparison = await sql`
        SELECT
          p.id,
          p.name,
          COUNT(DISTINCT s.id)  AS total_sessions,
          COUNT(o.id)           AS total_orders,
          COALESCE(SUM(o.total_price), 0) AS total_revenue
        FROM places p
        LEFT JOIN sessions s ON s.place_id = p.id
        LEFT JOIN orders   o ON o.session_id = s.id AND o.created_at >= ${since}
        WHERE p.is_active = true
        GROUP BY p.id, p.name
        ORDER BY total_revenue DESC
      `

      const globalStats = await sql`
        SELECT
          COUNT(id)  AS total_orders,
          COALESCE(SUM(total_price), 0) AS total_revenue
        FROM orders
        WHERE created_at >= ${since}
      `

      const topDrinksGlobal = await sql`
        SELECT
          d.name,
          SUM(o.quantity)    AS total_qty,
          SUM(o.total_price) AS total_revenue
        FROM orders  o
        JOIN drinks  d ON d.id = o.drink_id
        WHERE o.created_at >= ${since}
        GROUP BY d.id, d.name
        ORDER BY total_qty DESC
        LIMIT 8
      `

      const peakHoursGlobal = await sql`
        SELECT
          EXTRACT(hour FROM created_at AT TIME ZONE 'Africa/Cairo')::int AS hour,
          COUNT(*) AS count
        FROM orders
        WHERE created_at >= ${since}
        GROUP BY 1
        ORDER BY 1
      `

      return NextResponse.json({
        global: true,
        period,
        totalRevenue : Number(globalStats[0]?.total_revenue ?? 0),
        totalOrders  : Number(globalStats[0]?.total_orders  ?? 0),
        placeComparison: placeComparison.map(r => ({
          id           : r.id,
          name         : r.name,
          totalOrders  : Number(r.total_orders),
          totalRevenue : Number(r.total_revenue),
          totalSessions: Number(r.total_sessions),
        })),
        topDrinks: topDrinksGlobal.map(r => ({
          name   : r.name,
          qty    : Number(r.total_qty),
          revenue: Number(r.total_revenue),
        })),
        peakHours: peakHoursGlobal.map(r => ({
          hour : Number(r.hour),
          count: Number(r.count),
        })),
      })
    }

    // ── Place-specific view ───────────────────────────────────
    if (!placeId) {
      return NextResponse.json({ error: 'place_id required' }, { status: 400 })
    }

    const stats = await sql`
      SELECT
        COUNT(o.id)  AS total_orders,
        COALESCE(SUM(o.total_price), 0) AS total_revenue,
        COUNT(DISTINCT s.id) AS total_sessions
      FROM sessions s
      JOIN orders   o ON o.session_id = s.id
      WHERE s.place_id = ${placeId}
        AND o.created_at >= ${since}
    `

    const topDrinks = await sql`
      SELECT
        d.name,
        SUM(o.quantity)    AS total_qty,
        SUM(o.total_price) AS total_revenue
      FROM orders  o
      JOIN sessions s ON s.id = o.session_id
      JOIN drinks   d ON d.id = o.drink_id
      WHERE s.place_id = ${placeId}
        AND o.created_at >= ${since}
      GROUP BY d.id, d.name
      ORDER BY total_qty DESC
      LIMIT 8
    `

    const peakHours = await sql`
      SELECT
        EXTRACT(hour FROM o.created_at AT TIME ZONE 'Africa/Cairo')::int AS hour,
        COUNT(*) AS count
      FROM orders  o
      JOIN sessions s ON s.id = o.session_id
      WHERE s.place_id = ${placeId}
        AND o.created_at >= ${since}
      GROUP BY 1
      ORDER BY 1
    `

    const dailyRevenue = await sql`
      SELECT
        TO_CHAR(o.created_at AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') AS day,
        COALESCE(SUM(o.total_price), 0) AS revenue,
        COUNT(o.id) AS orders
      FROM orders  o
      JOIN sessions s ON s.id = o.session_id
      WHERE s.place_id = ${placeId}
        AND o.created_at >= ${since}
      GROUP BY 1
      ORDER BY 1
    `

    const totalRev  = Number(stats[0]?.total_revenue  ?? 0)
    const totalOrd  = Number(stats[0]?.total_orders   ?? 0)
    const totalSess = Number(stats[0]?.total_sessions ?? 0)

    return NextResponse.json({
      global: false,
      period,
      placeId,
      totalRevenue : totalRev,
      totalOrders  : totalOrd,
      totalSessions: totalSess,
      avgOrderValue: totalOrd > 0 ? +(totalRev / totalOrd).toFixed(2) : 0,
      topDrinks: topDrinks.map(r => ({
        name   : r.name,
        qty    : Number(r.total_qty),
        revenue: Number(r.total_revenue),
      })),
      peakHours: peakHours.map(r => ({
        hour : Number(r.hour),
        count: Number(r.count),
      })),
      dailyRevenue: dailyRevenue.map(r => ({
        day    : String(r.day),
        revenue: Number(r.revenue),
        orders : Number(r.orders),
      })),
    })
  } catch (err: any) {
    console.error('[analytics]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
