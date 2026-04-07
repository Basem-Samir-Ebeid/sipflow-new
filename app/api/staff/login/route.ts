import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()
    
    const staff = await db.getStaffByUsername(username)
    
    if (!staff || staff.password !== password || !staff.is_active) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    
    // Return staff info without password
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
