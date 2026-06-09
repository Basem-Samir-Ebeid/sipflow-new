import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    if (!checkRateLimit(`login:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts, please wait a minute' }, { status: 429 })
    }

    const { name, password, place_id } = await request.json()

    try {
      if (password) {
        const user = await db.getUserByNameAndPassword(name, password, place_id || null)
        if (!user) {
          return NextResponse.json({ exists: true, error: 'Invalid password' }, { status: 401 })
        }
        const { password: _pw, ...safeUser } = user
        return NextResponse.json({ exists: true, user: safeUser })
      }

      const user = await db.getUserByName(name, place_id || null)
      if (!user) {
        return NextResponse.json({ exists: false, user: null })
      }

      if (user.password) {
        return NextResponse.json({ exists: true, requiresPassword: true, user: null })
      }

      const { password: _pw, ...safeUser } = user
      return NextResponse.json({ exists: true, user: safeUser })
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
