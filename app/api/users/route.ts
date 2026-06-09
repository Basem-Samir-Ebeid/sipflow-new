import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    if (!placeId) {
      return NextResponse.json({ error: 'place_id is required' }, { status: 400 })
    }
    const users = await db.getUsers(placeId)
    const safeUsers = users.map(({ password: _pw, ...u }: any) => u)
    return NextResponse.json(safeUsers)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const placeId = body.place_id || null

    const existing = await db.getUserByName(body.name, placeId)
    if (existing) {
      const { password: _pw, ...safeExisting } = existing as any
      return NextResponse.json(safeExisting)
    }

    const user = await db.createUser({ ...body, place_id: placeId })
    const { password: _pw, ...safeUser } = user as any
    return NextResponse.json(safeUser)
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
