import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    const drinks = await db.getDrinks(placeId)
    return NextResponse.json(drinks)
  } catch (error) {
    console.error('Error fetching drinks:', error)
    return NextResponse.json({ error: 'Failed to fetch drinks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const drink = await db.createDrink(body)
    return NextResponse.json(drink)
  } catch (error) {
    console.error('Error creating drink:', error)
    return NextResponse.json({ error: 'Failed to create drink' }, { status: 500 })
  }
}
