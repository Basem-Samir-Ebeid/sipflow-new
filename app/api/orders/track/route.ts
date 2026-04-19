import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId      = searchParams.get('user_id')
  const sessionId   = searchParams.get('session_id')
  const tableNumber = searchParams.get('table_number') // optional — filter by table
  const placeId     = searchParams.get('place_id')     // dev admin — all tables at place

  if (!userId && !sessionId && !placeId) {
    return NextResponse.json({ error: 'user_id, session_id, or place_id required' }, { status: 400 })
  }

  try {
    const sql = getSql()

    // Ensure column exists
    await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS order_tracking_enabled BOOLEAN DEFAULT true`.catch(() => {})

    let rows: any[]

    if (placeId) {
      // Dev admin: fetch ALL active orders for this place's current session
      rows = await sql`
        SELECT
          o.id, o.drink_id, o.quantity, o.status, o.created_at, o.updated_at,
          d.name AS drink_name,
          o.notes, o.total_price, o.table_number, o.customer_name,
          p.order_tracking_enabled
        FROM orders o
        JOIN drinks   d ON d.id = o.drink_id
        JOIN sessions s ON s.id = o.session_id
        JOIN places   p ON p.id = s.place_id
        WHERE s.place_id = ${placeId}
          AND s.is_active = true
          AND o.status NOT IN ('cancelled')
        ORDER BY o.table_number NULLS LAST, o.created_at DESC
        LIMIT 100
      `
    } else if (sessionId) {
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
      tableNumber           : r.table_number ?? null,
      customerName          : r.customer_name ?? null,
      createdAt             : r.created_at,
      updatedAt             : r.updated_at,
      orderTrackingEnabled  : r.order_tracking_enabled !== false,
    })))
  } catch (err: any) {
    console.error('[orders/track]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
