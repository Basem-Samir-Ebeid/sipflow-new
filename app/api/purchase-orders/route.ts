import { NextResponse } from 'next/server'
import { listPurchaseOrders, createPurchaseOrder } from '@/lib/inventory-engine'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    const rows = await listPurchaseOrders(placeId)
    return NextResponse.json(rows)
  } catch (e) {
    console.error('GET /api/purchase-orders', e)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const po = await createPurchaseOrder(body)
    return NextResponse.json(po)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
