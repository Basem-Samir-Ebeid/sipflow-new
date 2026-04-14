import { NextRequest, NextResponse } from 'next/server'
import { db, getSql } from '@/lib/db'
import { DEV_ADMIN_SESSION_COOKIE, adminSessionValue, getDevAdminSecret } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const sql = getSql()
    const secret = request.headers.get('x-admin-secret')
    const expectedSecret = await getDevAdminSecret(sql)
    const sessionToken = request.cookies.get(DEV_ADMIN_SESSION_COOKIE)?.value

    if (!expectedSecret || (secret !== expectedSecret && sessionToken !== adminSessionValue(expectedSecret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { place_id, action, months } = body

    // ── Bulk delete old sessions (dev admin) ──
    if (action === 'delete_old') {
      const m = Math.max(1, parseInt(months || '3', 10))
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - m)
      const cutoffStr = cutoff.toISOString()

      // Delete orders belonging to old sessions first
      await sql`
        DELETE FROM orders
        WHERE session_id IN (
          SELECT id FROM sessions WHERE created_at < ${cutoffStr}
        )
      `
      // Delete old sessions
      const result = await sql`
        DELETE FROM sessions WHERE created_at < ${cutoffStr} RETURNING id
      `
      return NextResponse.json({ ok: true, deleted_sessions: result.length })
    }

    // ── Default: reset current session ──
    await db.deleteAllOrders(place_id || null)

    if (place_id) {
      await sql`DELETE FROM sessions WHERE place_id = ${place_id}`
    } else {
      await sql`DELETE FROM sessions`
    }

    const today = new Date().toISOString().split('T')[0]
    const session = await db.createSession(today, place_id || null)

    return NextResponse.json({ ok: true, session })
  } catch (error) {
    console.error('Error resetting data:', error)
    return NextResponse.json({ error: 'Failed to reset data' }, { status: 500 })
  }
}
