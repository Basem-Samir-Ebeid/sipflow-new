import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET() {
  try {
    const sql = getSql()
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const currentHour = now.getHours()
    const currentWeekday = now.getDay()

    let places: Array<Record<string, unknown>> = []
    try {
      places = await sql`SELECT id, name, code, logo_url FROM places WHERE is_active = true ORDER BY name`
    } catch {}

    const result = []
    let totalRevenue = 0
    let totalOrders = 0
    let activePlaces = 0

    for (const place of places) {
      // Active session today
      const sessions = await sql`
        SELECT id FROM sessions WHERE date = ${today} AND place_id = ${place.id} AND is_active = true LIMIT 1
      `
      const sessionId = sessions[0]?.id
      const hasSession = !!sessionId
      if (hasSession) activePlaces++

      // Today's orders
      let todayStats = { orders: 0, revenue: 0, pending: 0, ready: 0, paid: 0, last_order_at: null as string | null }
      if (sessionId) {
        const rows: Array<Record<string, unknown>> = await sql`
          SELECT status, total_price, created_at FROM orders WHERE session_id = ${sessionId}
        `
        let lastTs = 0
        for (const r of rows) {
          todayStats.orders += 1
          todayStats.revenue += Number(r.total_price || 0)
          if (r.status === 'pending') todayStats.pending += 1
          else if (r.status === 'ready' || r.status === 'completed') todayStats.ready += 1
          if (r.status === 'paid') todayStats.paid += 1
          const ts = new Date(r.created_at as string).getTime()
          if (ts > lastTs) { lastTs = ts; todayStats.last_order_at = r.created_at as string }
        }
      }

      // Same weekday avg orders/revenue at this hour over last 4 weeks
      let baseline = { avg_orders: 0, avg_revenue: 0, sample: 0 }
      try {
        const histStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const histRows: Array<Record<string, unknown>> = await sql`
          SELECT o.total_price, o.created_at
          FROM orders o
          LEFT JOIN sessions s ON s.id = o.session_id
          WHERE s.place_id = ${place.id} AND s.date >= ${histStart} AND s.date < ${today}
        `
        const buckets: Record<string, { orders: number; revenue: number }> = {}
        for (const r of histRows) {
          const d = new Date(r.created_at as string)
          if (d.getDay() !== currentWeekday) continue
          if (d.getHours() > currentHour) continue
          const key = d.toISOString().split('T')[0]
          if (!buckets[key]) buckets[key] = { orders: 0, revenue: 0 }
          buckets[key].orders += 1
          buckets[key].revenue += Number(r.total_price || 0)
        }
        const arr = Object.values(buckets)
        if (arr.length > 0) {
          baseline = {
            avg_orders: Math.round(arr.reduce((s, b) => s + b.orders, 0) / arr.length),
            avg_revenue: Math.round(arr.reduce((s, b) => s + b.revenue, 0) / arr.length),
            sample: arr.length,
          }
        }
      } catch {}

      // Stuck orders alert
      let stuck = 0
      if (sessionId) {
        const stuckRows: Array<Record<string, unknown>> = await sql`
          SELECT created_at FROM orders
          WHERE session_id = ${sessionId} AND status IN ('pending','preparing')
        `
        for (const r of stuckRows) {
          const ageMin = (now.getTime() - new Date(r.created_at as string).getTime()) / 60000
          if (ageMin >= 30) stuck += 1
        }
      }

      const trend = baseline.avg_orders > 0
        ? Math.round(((todayStats.orders - baseline.avg_orders) / baseline.avg_orders) * 100)
        : null

      totalOrders += todayStats.orders
      totalRevenue += todayStats.revenue

      result.push({
        id: place.id,
        name: place.name,
        code: place.code,
        logo_url: place.logo_url,
        has_session: hasSession,
        today: todayStats,
        baseline,
        trend_pct: trend,
        alerts: { stuck_orders: stuck },
      })
    }

    return NextResponse.json({
      places: result,
      totals: {
        revenue: Math.round(totalRevenue),
        orders: totalOrders,
        places_active: activePlaces,
        places_total: places.length,
      },
      generated_at: now.toISOString(),
    })
  } catch (error) {
    console.error('owner dashboard error', error)
    return NextResponse.json({ places: [], totals: { revenue: 0, orders: 0, places_active: 0, places_total: 0 }, error: 'Failed to load' }, { status: 500 })
  }
}
