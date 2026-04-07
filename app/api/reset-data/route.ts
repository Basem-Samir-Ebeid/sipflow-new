import { NextResponse } from 'next/server'
import { db, getSql } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const secret = request.headers.get('x-admin-secret')
    const expectedSecret = process.env.ADMIN_SECRET

    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { place_id } = body
    const sql = getSql()

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
