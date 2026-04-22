import { NextResponse } from 'next/server'
import { getRecipesForDrink, saveRecipe } from '@/lib/inventory-engine'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const drinkId = searchParams.get('drink_id')
    if (!drinkId) return NextResponse.json([], { status: 200 })
    const rows = await getRecipesForDrink(drinkId)
    return NextResponse.json(rows)
  } catch (e) {
    console.error('GET /api/recipes', e)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const id = await saveRecipe(body)
    return NextResponse.json({ id })
  } catch (e: any) {
    console.error('POST /api/recipes', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
