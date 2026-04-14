import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { ADMIN_SESSION_MAX_AGE, DEV_ADMIN_SESSION_COOKIE, adminSessionValue, getDevAdminSecret } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    const sql = getSql()

    const adminSecret = await getDevAdminSecret(sql)

    if (!adminSecret) {
      return NextResponse.json({ success: false, error: 'Admin secret not configured' }, { status: 500 })
    }

    if (password === adminSecret) {
      const response = NextResponse.json({ success: true })
      response.cookies.set(DEV_ADMIN_SESSION_COOKIE, adminSessionValue(adminSecret), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: ADMIN_SESSION_MAX_AGE,
      })
      return response
    }

    return NextResponse.json({ success: false, error: 'Invalid password' })
  } catch (error) {
    console.error('Dev verify error:', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
