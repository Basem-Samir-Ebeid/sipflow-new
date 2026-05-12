import { NextRequest, NextResponse } from 'next/server'
import { db, getSql } from '@/lib/db'
import { DEV_ADMIN_SESSION_COOKIE, isSuperDevAdminSession } from '@/lib/admin-auth'

const SENSITIVE_KEYS = new Set([
  'dev_admin_password',
  'dev_admin_accounts',
  'dev_admin_username',
])

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: 'Key required' }, { status: 400 })
    }

    const value = await db.getSetting(key)
    return NextResponse.json({ key, value })
  } catch (error) {
    console.error('Error fetching setting:', error)
    return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { key, value } = await request.json()

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Key required' }, { status: 400 })
    }

    if (SENSITIVE_KEYS.has(key)) {
      const sql = getSql()
      const sessionToken = request.cookies.get(DEV_ADMIN_SESSION_COOKIE)?.value
      const isAdmin = await isSuperDevAdminSession(sql, sessionToken)
      if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    await db.setSetting(key, String(value ?? ''))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving setting:', error)
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 })
  }
}
