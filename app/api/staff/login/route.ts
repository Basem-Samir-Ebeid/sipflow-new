import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    const staff = await db.getStaffByUsername(username)

    const passwordMatches = staff && staff.password
      ? await verifyPassword(password, staff.password)
      : false

    if (!staff || !passwordMatches || !staff.is_active) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    return NextResponse.json({
      id: staff.id,
      username: staff.username,
      name: staff.name,
      is_active: staff.is_active,
      place_id: staff.place_id || null
    })
  } catch (error) {
    console.error('Staff login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
