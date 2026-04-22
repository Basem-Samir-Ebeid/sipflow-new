import { NextResponse } from 'next/server'
import { listIngredients, createIngredient } from '@/lib/inventory-engine'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    const includeGlobal = searchParams.get('include_global') !== 'false'
    const rows = await listIngredients({ placeId, includeGlobal })
    return NextResponse.json(rows)
  } catch (e) {
    console.error('GET /api/ingredients', e)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const ing = await createIngredient(body)
    return NextResponse.json(ing)
  } catch (e: any) {
    console.error('POST /api/ingredients', e)
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 })
  }
}
