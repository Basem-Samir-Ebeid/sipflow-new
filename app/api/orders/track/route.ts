import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId      = searchParams.get('user_id')
  const sessionId   = searchParams.get('session_id')
  const tableNumber = searchParams.get('table_number') // optional — filter by table

  if (!userId && !sessionId) {
    return NextResponse.json({ error: 'user_id or session_id required' }, { status: 400 })
  }

  try {
    const sql = getSql()

    // Ensure column exists
    await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS order_tracking_enabled BOOLEAN DEFAULT true`.catch(() => {})

    let rows: any[]

    if (sessionId) {
      if (tableNumber) {
        // Filter by session AND table number (shared-user mode)
        rows = await sql`
          SELECT
            o.id, o.drink_id, o.quantity, o.status, o.created_at, o.updated_at,
            d.name AS drink_name,
            o.notes, o.total_price,
            p.order_tracking_enabled
          FROM orders o
          JOIN drinks   d ON d.id = o.drink_id
          JOIN sessions s ON s.id = o.session_id
          JOIN places   p ON p.id = s.place_id
          JOIN users    u ON u.id = o.user_id
          WHERE o.session_id = ${sessionId}
            AND u.table_number = ${tableNumber}
            AND o.status NOT IN ('cancelled')
          ORDER BY o.created_at DESC
          LIMIT 20
        `
      } else {
        rows = await sql`
          SELECT
            o.id, o.drink_id, o.quantity, o.status, o.created_at, o.updated_at,
            d.name AS drink_name,
            o.notes, o.total_price,
            p.order_tracking_enabled
          FROM orders o
          JOIN drinks   d ON d.id = o.drink_id
          JOIN sessions s ON s.id = o.session_id
          JOIN places   p ON p.id = s.place_id
          WHERE o.session_id = ${sessionId}
            AND o.status NOT IN ('cancelled')
          ORDER BY o.created_at DESC
          LIMIT 20
        `
      }
    } else {
      rows = await sql`
        SELECT
          o.id, o.drink_id, o.quantity, o.status, o.created_at, o.updated_at,
          d.name AS drink_name,
          o.notes, o.total_price,
          p.order_tracking_enabled
        FROM orders o
        JOIN drinks   d ON d.id = o.drink_id
        JOIN sessions s ON s.id = o.session_id
        JOIN places   p ON p.id = s.place_id
        WHERE o.user_id = ${userId}
          AND o.created_at >= NOW() - INTERVAL '12 hours'
          AND o.status NOT IN ('cancelled')
        ORDER BY o.created_at DESC
        LIMIT 10
      `
    }

    return NextResponse.json(rows.map(r => ({
      id                    : r.id,
      drinkName             : r.drink_name,
      quantity              : Number(r.quantity),
      status                : r.status,
      notes                 : r.notes,
      totalPrice            : Number(r.total_price),
      createdAt             : r.created_at,
      updatedAt             : r.updated_at,
      orderTrackingEnabled  : r.order_tracking_enabled !== false,
    })))
  } catch (err: any) {
    console.error('[orders/track]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
