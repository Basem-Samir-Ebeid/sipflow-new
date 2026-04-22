import { NextResponse } from 'next/server'
import { listSuppliers, createSupplier } from '@/lib/inventory-engine'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    const rows = await listSuppliers(placeId)
    return NextResponse.json(rows)
  } catch (e) {
    console.error('GET /api/suppliers', e)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const row = await createSupplier(body)
    return NextResponse.json(row)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
