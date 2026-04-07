import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

let migrated = false

export async function GET(request: Request) {
  try {
    if (!migrated) {
      await db.migrateAddTableCount()
      migrated = true
    }
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    if (code) {
      const place = await db.getPlaceByCode(code)
      if (!place) return NextResponse.json({ error: 'Place not found' }, { status: 404 })
      return NextResponse.json(place)
    }
    const places = await db.getPlaces()
    return NextResponse.json(places)
  } catch (error) {
    console.error('Error fetching places:', error)
    return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.name || !body.code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 })
    }
    const place = await db.createPlace(body)
    return NextResponse.json(place)
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'هذا الكود مستخدم بالفعل', code: '23505' }, { status: 400 })
    }
    console.error('Error creating place:', error)
    return NextResponse.json({ error: 'Failed to create place' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, table_count, ...rest } = body
    if (!id) return NextResponse.json({ error: 'Place id required' }, { status: 400 })
    const place = await db.updatePlace(id, { ...rest, table_count: table_count ?? undefined })
    return NextResponse.json(place)
  } catch (error) {
    console.error('Error updating place:', error)
    return NextResponse.json({ error: 'Failed to update place' }, { status: 500 })
  }
}
