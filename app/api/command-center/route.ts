import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const secret = request.headers.get('x-admin-secret')
    const expectedSecret = process.env.ADMIN_SECRET
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = getSql()
    const today = new Date().toISOString().split('T')[0]

    const places = await sql`SELECT * FROM places WHERE is_active = true ORDER BY name`

    const placeStats = await Promise.all(
      places.map(async (place: any) => {
        const sessions = await sql`
          SELECT id FROM sessions WHERE date = ${today} AND place_id = ${place.id} AND is_active = true
        `
        const sessionId = sessions[0]?.id

        let orders: any[] = []
        let revenue = 0
        let pendingCount = 0
        let preparingCount = 0
        let readyCount = 0
        let completedCount = 0
        let activeTables = 0
        let recentOrders: any[] = []

        if (sessionId) {
          orders = await sql`
            SELECT o.*, d.name as drink_name, d.price as drink_price
            FROM orders o
            LEFT JOIN drinks d ON d.id = o.drink_id
            WHERE o.session_id = ${sessionId}
            ORDER BY o.created_at DESC
          `

          for (const o of orders) {
            const price = Number(o.drink_price) || 0
            revenue += price * o.quantity
            if (o.status === 'pending') pendingCount++
            else if (o.status === 'preparing') preparingCount++
            else if (o.status === 'ready') readyCount++
            else if (o.status === 'completed') completedCount++
          }

          const tableSet = new Set(orders.filter(o => o.table_number).map(o => o.table_number))
          activeTables = tableSet.size

          recentOrders = orders.slice(0, 3).map(o => ({
            id: o.id,
            drink_name: o.drink_name,
            quantity: o.quantity,
            status: o.status,
            table_number: o.table_number,
            customer_name: o.customer_name,
            created_at: o.created_at,
          }))
        }

        let isClosed = false
        try {
          const closedSetting = await sql`
            SELECT value FROM app_settings WHERE key = ${'place_closed_' + place.id}
          `
          isClosed = closedSetting[0]?.value === 'true'
        } catch {}

        let recentWaiterCalls = 0
        try {
          const waiterCalls = await sql`
            SELECT COUNT(*) as count FROM messages 
            WHERE place_id = ${place.id} 
            AND title LIKE '%نداء نادل%'
            AND created_at > NOW() - INTERVAL '30 minutes'
          `
          recentWaiterCalls = Number(waiterCalls[0]?.count) || 0
        } catch {}

        let health: 'green' | 'yellow' | 'red' = 'green'
        if (isClosed) health = 'red'
        else if (pendingCount > 5) health = 'red'
        else if (pendingCount > 2 || recentWaiterCalls > 2) health = 'yellow'

        return {
          id: place.id,
          name: place.name,
          code: place.code,
          logo_url: place.logo_url,
          isClosed,
          health,
          stats: {
            totalOrders: orders.length,
            pendingCount,
            preparingCount,
            readyCount,
            completedCount,
            revenue,
            activeTables,
            recentWaiterCalls,
          },
          recentOrders,
        }
      })
    )

    const globalStats = {
      totalPlaces: places.length,
      activePlaces: placeStats.filter(p => !p.isClosed).length,
      totalOrders: placeStats.reduce((s, p) => s + p.stats.totalOrders, 0),
      totalRevenue: placeStats.reduce((s, p) => s + p.stats.revenue, 0),
      totalPending: placeStats.reduce((s, p) => s + p.stats.pendingCount, 0),
      totalActiveTables: placeStats.reduce((s, p) => s + p.stats.activeTables, 0),
      healthySummary: {
        green: placeStats.filter(p => p.health === 'green').length,
        yellow: placeStats.filter(p => p.health === 'yellow').length,
        red: placeStats.filter(p => p.health === 'red').length,
      },
    }

    const allRecent = placeStats
      .flatMap(p => p.recentOrders.map(o => ({ ...o, place_name: p.name })))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)

    return NextResponse.json({
      globalStats,
      places: placeStats,
      recentActivity: allRecent,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Command center error:', error)
    return NextResponse.json({ error: 'Failed to fetch command center data' }, { status: 500 })
  }
}
