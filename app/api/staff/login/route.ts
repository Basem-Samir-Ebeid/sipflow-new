import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    if (!checkRateLimit(`login:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts, please wait a minute' }, { status: 429 })
    }

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
