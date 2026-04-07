import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { name, password, place_id } = await request.json()

    try {
      // If password is provided, find by name+password directly (handles duplicate names)
      if (password) {
        const user = await db.getUserByNameAndPassword(name, password, place_id || null)
        if (!user) {
          return NextResponse.json({ exists: true, error: 'Invalid password' }, { status: 401 })
        }
        return NextResponse.json({ exists: true, user })
      }

      // No password provided — check if any user with this name exists
      const user = await db.getUserByName(name, place_id || null)
      if (!user) {
        return NextResponse.json({ exists: false, user: null })
      }

      // User exists and has a password — request it
      if (user.password) {
        return NextResponse.json({ exists: true, requiresPassword: true, user: null })
      }

      // User exists with no password — log them in
      return NextResponse.json({ exists: true, user })
    } catch (dbError: any) {
      if (dbError.message.includes('DATABASE_URL')) {
        return NextResponse.json({
          error: 'Database not configured. Please set DATABASE_URL in environment variables.'
        }, { status: 503 })
      }
      throw dbError
    }
  } catch (error) {
    console.error('[v0] Error logging in:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
