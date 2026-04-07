import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    const users = await db.getUsers(placeId)
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const placeId = body.place_id || null
    // Use upsert: if (name, place_id) already exists, return the existing user
    const { getSql } = await import('@/lib/db')
    const sql = getSql()
    const existing = placeId && body.name
      ? (await sql`SELECT * FROM users WHERE name = ${body.name} AND place_id = ${placeId} LIMIT 1`)[0]
      : null
    if (existing) return NextResponse.json(existing)
    const user = await db.createUser({ ...body, place_id: placeId })
    return NextResponse.json(user)
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
