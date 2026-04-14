import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { DEV_ADMIN_SESSION_COOKIE, adminSessionValue, getDevAdminSecret } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const sql = getSql()
    const expectedSecret = await getDevAdminSecret(sql)
    const sessionToken = request.cookies.get(DEV_ADMIN_SESSION_COOKIE)?.value

    if (!expectedSecret || sessionToken !== adminSessionValue(expectedSecret)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { password } = await request.json()
    const nextPassword = typeof password === 'string' ? password.trim() : ''

    if (nextPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('dev_admin_password', ${nextPassword}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${nextPassword}, updated_at = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Dev admin password update error:', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
