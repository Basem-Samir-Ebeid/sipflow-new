import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET() {
  try {
    const sql = getSql()
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const alerts: {
      id: string
      place_id: string
      place_name: string
      type: string
      severity: 'critical' | 'warning' | 'info'
      message: string
      details: Record<string, unknown>
      created_at: string
    }[] = []

    const places = await sql`SELECT id, name FROM places WHERE is_active = true ORDER BY name`
    if (!places.length) {
      return NextResponse.json({ alerts: [], analyzed_places: 0, critical_count: 0, warning_count: 0, info_count: 0, timestamp: now.toISOString() })
    }

    const placeIds = places.map((p: any) => p.id)

    // ── Batch query 1: active sessions for today ───────────────────────────
    const sessions = await sql`
      SELECT id, place_id FROM sessions
      WHERE date = ${today}
        AND place_id = ANY(${placeIds})
        AND is_active = true
    `
    const sessionByPlace = new Map<string, string>()
    for (const s of sessions) sessionByPlace.set(s.place_id, s.id)

    const activeSessionIds = sessions.map((s: any) => s.id)
    if (!activeSessionIds.length) {
      return NextResponse.json({ alerts: [], analyzed_places: places.length, critical_count: 0, warning_count: 0, info_count: 0, timestamp: now.toISOString() })
    }

    // ── Batch query 2: all orders for all active sessions ──────────────────
    const [orders, waiterCalls] = await Promise.all([
      sql`
        SELECT o.id, o.session_id, o.status, o.table_number, o.created_at, o.updated_at
        FROM orders o
        WHERE o.session_id = ANY(${activeSessionIds})
        ORDER BY o.created_at ASC
      `,
      // ── Batch query 3: waiter calls per place in last 30 min ──────────────
      sql`
        SELECT place_id, COUNT(*) as count
        FROM admin_messages
        WHERE place_id = ANY(${placeIds})
          AND title LIKE '%نداء نادل%'
          AND created_at > NOW() - INTERVAL '30 minutes'
        GROUP BY place_id
      `,
    ])

    const waiterCallsByPlace = new Map<string, number>()
    for (const wc of waiterCalls) waiterCallsByPlace.set(wc.place_id, Number(wc.count))

    // ── Group orders by session ────────────────────────────────────────────
    const ordersBySession = new Map<string, any[]>()
    for (const o of orders) {
      if (!ordersBySession.has(o.session_id)) ordersBySession.set(o.session_id, [])
      ordersBySession.get(o.session_id)!.push(o)
    }

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

    for (const place of places) {
      const sessionId = sessionByPlace.get(place.id)
      if (!sessionId) continue

      const placeOrders = ordersBySession.get(sessionId) || []

      // ── Rule 1: Stuck orders ───────────────────────────────────────────
      let stuck30 = 0, stuck60 = 0
      for (const order of placeOrders) {
        if (order.status === 'pending' || order.status === 'preparing') {
          const ageMin = (now.getTime() - new Date(order.created_at).getTime()) / 60000
          if (ageMin >= 60) stuck60++
          else if (ageMin >= 30) stuck30++
        }
      }
      if (stuck60 > 0) {
        alerts.push({ id: `stuck_crit_${place.id}`, place_id: place.id, place_name: place.name, type: 'stuck_orders', severity: 'critical', message: `${stuck60} طلب متوقف أكثر من ساعة كاملة بدون تحضير`, details: { count: stuck60, threshold_min: 60 }, created_at: now.toISOString() })
      } else if (stuck30 > 0) {
        alerts.push({ id: `stuck_warn_${place.id}`, place_id: place.id, place_name: place.name, type: 'stuck_orders', severity: 'warning', message: `${stuck30} طلب منتظر أكثر من 30 دقيقة بدون تحديث`, details: { count: stuck30, threshold_min: 30 }, created_at: now.toISOString() })
      }

      // ── Rule 2: Silent cashier ─────────────────────────────────────────
      const activeTables = new Set(
        placeOrders.filter(o => o.table_number && o.status !== 'completed').map(o => o.table_number)
      ).size
      const recentCompletions = placeOrders.filter(
        o => o.status === 'completed' && new Date(o.updated_at || o.created_at) > twoHoursAgo
      ).length
      if (activeTables >= 3 && recentCompletions === 0 && placeOrders.length >= 5) {
        alerts.push({ id: `cashier_silent_${place.id}`, place_id: place.id, place_name: place.name, type: 'cashier_silent', severity: 'warning', message: `${activeTables} طاولة نشطة بدون أي تسليم من أكثر من ساعتين`, details: { active_tables: activeTables, recent_completions: recentCompletions }, created_at: now.toISOString() })
      }

      // ── Rule 3: High pending ratio ─────────────────────────────────────
      const activeOrders = placeOrders.filter(o => o.status !== 'completed')
      const pendingOrders = placeOrders.filter(o => o.status === 'pending')
      if (activeOrders.length >= 6 && pendingOrders.length / activeOrders.length > 0.7) {
        alerts.push({ id: `high_pending_${place.id}`, place_id: place.id, place_name: place.name, type: 'high_pending', severity: 'critical', message: `${pendingOrders.length} من ${activeOrders.length} طلب لسه pending — البار محتاج تدخل`, details: { pending_count: pendingOrders.length, total: activeOrders.length, ratio_pct: Math.round((pendingOrders.length / activeOrders.length) * 100) }, created_at: now.toISOString() })
      }

      // ── Rule 4: Ghost session ──────────────────────────────────────────
      const hour = now.getHours()
      if (hour >= 10 && hour <= 23 && placeOrders.length > 0) {
        const recentActivity = placeOrders.filter(o => new Date(o.created_at) > twoHoursAgo)
        if (recentActivity.length === 0) {
          const lastOrder = placeOrders[placeOrders.length - 1]
          const idleMin = Math.round((now.getTime() - new Date(lastOrder.created_at).getTime()) / 60000)
          alerts.push({ id: `ghost_${place.id}`, place_id: place.id, place_name: place.name, type: 'ghost_session', severity: 'info', message: `مفيش طلبات جديدة من ${idleMin} دقيقة — هل المكان لسه شغال؟`, details: { idle_min: idleMin, total_today: placeOrders.length, last_order_at: lastOrder.created_at }, created_at: now.toISOString() })
        }
      }

      // ── Rule 5: Waiter call spike ──────────────────────────────────────
      const callCount = waiterCallsByPlace.get(place.id) || 0
      if (callCount >= 4) {
        alerts.push({ id: `waiter_spike_${place.id}`, place_id: place.id, place_name: place.name, type: 'waiter_spike', severity: callCount >= 7 ? 'critical' : 'warning', message: `${callCount} نداء نادل في آخر 30 دقيقة — في مشكلة في الخدمة`, details: { call_count: callCount }, created_at: now.toISOString() })
      }
    }

    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
    alerts.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2))

    return NextResponse.json({
      alerts,
      analyzed_places: places.length,
      critical_count: alerts.filter(a => a.severity === 'critical').length,
      warning_count: alerts.filter(a => a.severity === 'warning').length,
      info_count: alerts.filter(a => a.severity === 'info').length,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('Smart alerts error:', error)
    return NextResponse.json({ error: 'Failed to analyze' }, { status: 500 })
  }
}
