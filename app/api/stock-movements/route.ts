import { NextResponse } from 'next/server'
import { listMovements, recordMovement } from '@/lib/inventory-engine'
import { toBase } from '@/lib/units'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    const ingredientId = searchParams.get('ingredient_id') || undefined
    const type = searchParams.get('type') || undefined
    const limit = parseInt(searchParams.get('limit') || '200')
    const rows = await listMovements({ placeId, ingredientId, type, limit })
    return NextResponse.json(rows)
  } catch (e) {
    console.error('GET /api/stock-movements', e)
    return NextResponse.json([], { status: 200 })
  }
}

/** Manual movement (waste / adjustment / transfer / return). Quantity is in the entered unit. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ingredient_id, movement_type, quantity, unit, base_unit, reason, place_id, user_name, cost_per_unit } = body
    const conv = toBase(Number(quantity), unit || base_unit || 'g')
    // For waste/adjustment-decrement we expect negative; for adjustment-increment positive.
    let signed = conv.qty
    if (movement_type === 'waste' && signed > 0) signed = -signed
    if (body.direction === 'out' && signed > 0) signed = -signed
    if (body.direction === 'in' && signed < 0) signed = -signed
    await recordMovement({
      ingredient_id,
      movement_type,
      quantity: signed,
      unit: base_unit || conv.base,
      reason,
      reference_type: 'manual',
      user_name: user_name || null,
      cost_total: cost_per_unit ? Math.abs(signed) * Number(cost_per_unit) * (signed < 0 ? -1 : 1) : 0,
      place_id: place_id || null,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('POST /api/stock-movements', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
