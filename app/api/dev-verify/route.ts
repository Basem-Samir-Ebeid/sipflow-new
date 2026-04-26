import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { ADMIN_SESSION_MAX_AGE, DEV_ADMIN_ROLE_LABELS, DEV_ADMIN_SESSION_COOKIE, adminSessionValue, devAdminSessionValue, findDevAdminByCredentials, getDevAdminSecret } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json()

    const sql = getSql()

    const adminSecret = await getDevAdminSecret(sql)

    if (!adminSecret) {
      return NextResponse.json({ success: false, error: 'Admin secret not configured' }, { status: 500 })
    }

    const configuredAccount = name ? await findDevAdminByCredentials(sql, name, password) : null

    if (configuredAccount) {
      const response = NextResponse.json({
        success: true,
        role: configuredAccount.role,
        roleLabel: DEV_ADMIN_ROLE_LABELS[configuredAccount.role],
        name: configuredAccount.name,
      })
      response.cookies.set(DEV_ADMIN_SESSION_COOKIE, devAdminSessionValue(configuredAccount, adminSecret), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: ADMIN_SESSION_MAX_AGE,
      })
      return response
    }

    if (password === adminSecret) {
      let savedUsername: string | null = null
      try {
        const rows = await sql`SELECT value FROM app_settings WHERE key = 'dev_admin_username'`
        if (rows[0]?.value) savedUsername = String(rows[0].value).trim()
      } catch {}

      if (savedUsername && savedUsername.length > 0) {
        const inputName = (name || '').trim().toLowerCase()
        if (inputName !== savedUsername.toLowerCase()) {
          return NextResponse.json({ success: false, error: 'Invalid name or password' })
        }
      }

      const response = NextResponse.json({
        success: true,
        role: 'super_developer',
        roleLabel: DEV_ADMIN_ROLE_LABELS.super_developer,
        name: savedUsername || name || 'Developer',
      })
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
