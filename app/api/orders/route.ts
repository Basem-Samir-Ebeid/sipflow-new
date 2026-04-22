import { NextResponse } from 'next/server'
import { db, getSql } from '@/lib/db'
import { deductForOrder } from '@/lib/inventory-engine'

const sql = getSql()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }
    const orders = await db.getOrdersBySession(sessionId)
    const ordersList = Array.isArray(orders) ? orders : []
    return NextResponse.json(ordersList)
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const order = await db.createOrder(body)

    // Auto-deduct ingredients via recipe (silent on failure to avoid breaking order flow)
    try {
      const session = body.session_id ? await sql`SELECT place_id FROM sessions WHERE id = ${body.session_id}` : []
      const placeId = (session as any[])[0]?.place_id || null
      const result = await deductForOrder({
        drink_id: body.drink_id,
        quantity: body.quantity || 1,
        size: body.size || 'default',
        order_id: (order as any).id,
        place_id: placeId,
        user_name: body.customer_name || null,
      })
      ;(order as any)._inventory = result
    } catch (invErr) {
      console.error('Auto-deduct error:', invErr)
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
