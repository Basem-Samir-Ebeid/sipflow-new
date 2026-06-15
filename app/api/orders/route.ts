import { NextResponse } from 'next/server'
import { db, getSql } from '@/lib/db'
import { deductForOrder } from '@/lib/inventory-engine'
import { z } from 'zod'

const OrderSchema = z.object({
  session_id: z.string().uuid({ message: 'session_id must be a valid UUID' }),
  drink_id: z.string().uuid({ message: 'drink_id must be a valid UUID' }),
  user_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().positive({ message: 'quantity must be a positive integer' }),
  sugar_level: z.string().optional(),
  notes: z.string().max(500).nullable().optional(),
  total_price: z.number().nonnegative().optional(),
  customer_name: z.string().max(100).nullable().optional(),
  table_number: z.string().max(20).nullable().optional(),
  customer_phone: z.string().max(20).nullable().optional(),
  employee_id: z.string().uuid().nullable().optional(),
  size: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }
    const orders = await db.getOrdersBySession(sessionId)
    return NextResponse.json(Array.isArray(orders) ? orders : [])
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = OrderSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.errors.map(e => e.message).join(', ')
      return NextResponse.json({ error: `Validation failed: ${messages}` }, { status: 400 })
    }

    const order = await db.createOrder(parsed.data as any)

    try {
      const sql = getSql()
      const session = parsed.data.session_id
        ? await sql`SELECT place_id FROM sessions WHERE id = ${parsed.data.session_id}`
        : []
      const placeId = (session as any[])[0]?.place_id || null
      const result = await deductForOrder({
        drink_id: parsed.data.drink_id,
        quantity: parsed.data.quantity,
        size: parsed.data.size || 'default',
        order_id: (order as any).id,
        place_id: placeId,
        user_name: parsed.data.customer_name || null,
      })
      ;(order as any)._inventory = result
    } catch (invErr) {
      console.error('Auto-deduct error:', invErr)
    }

    // ── Auto-earn loyalty points ─────────────────────────────
    try {
      const sql = getSql()
      const loyaltyEnabled = await sql`SELECT value FROM app_settings WHERE key='loyalty_enabled' LIMIT 1`
      if (loyaltyEnabled[0]?.value === 'true' && parsed.data.user_id && parsed.data.total_price) {
        const sessionRow = await sql`SELECT place_id FROM sessions WHERE id=${parsed.data.session_id} LIMIT 1`
        const placeIdForLoyalty = (sessionRow as any[])[0]?.place_id
        if (placeIdForLoyalty) {
          const rateRow = await sql`SELECT value FROM app_settings WHERE key='loyalty_points_per_egp' LIMIT 1`
          const pointsPerEgp = Number(rateRow[0]?.value ?? 1)
          const pointsDelta = Math.floor(Number(parsed.data.total_price) * pointsPerEgp)
          if (pointsDelta > 0) {
            await sql`
              INSERT INTO loyalty_points (user_id, place_id, points, total_earned, total_redeemed, updated_at)
              VALUES (${parsed.data.user_id}, ${placeIdForLoyalty}, 0, 0, 0, NOW())
              ON CONFLICT DO NOTHING
            `.catch(() => {})
            await sql`
              UPDATE loyalty_points
              SET points=points+${pointsDelta}, total_earned=total_earned+${pointsDelta}, updated_at=NOW()
              WHERE user_id=${parsed.data.user_id} AND place_id=${placeIdForLoyalty}
            `
            await sql`
              INSERT INTO loyalty_transactions (user_id, place_id, points, type, order_id, note)
              VALUES (${parsed.data.user_id}, ${placeIdForLoyalty}, ${pointsDelta}, 'earn', ${(order as any).id}, 'طلب جديد')
            `
          }
        }
      }
    } catch (loyErr) {
      console.error('Loyalty earn error:', loyErr)
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
