import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    const sql = getSql()

    let adminSecret: string | null = null

    try {
      const rows = await sql`SELECT value FROM app_settings WHERE key = 'dev_admin_password'`
      if (rows[0]?.value) {
        adminSecret = rows[0].value
      }
    } catch {}

    if (!adminSecret) {
      adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || process.env.ADMIN_SECRET || null
    }

    if (!adminSecret) {
      return NextResponse.json({ success: false, error: 'Admin secret not configured' }, { status: 500 })
    }

    if (password === adminSecret) {
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Invalid password' })
  } catch (error) {
    console.error('Dev verify error:', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
