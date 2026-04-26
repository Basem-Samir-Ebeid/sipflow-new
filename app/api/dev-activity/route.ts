import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { DEV_ADMIN_SESSION_COOKIE, isSuperDevAdminSession } from '@/lib/admin-auth'
import { listDevActivity } from '@/lib/dev-activity'

export async function GET(request: NextRequest) {
  try {
    const sql = getSql()
    const sessionToken = request.cookies.get(DEV_ADMIN_SESSION_COOKIE)?.value
    if (!(await isSuperDevAdminSession(sql, sessionToken))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '100', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)
    const actor = url.searchParams.get('actor')
    const action = url.searchParams.get('action')
    const status = url.searchParams.get('status')
    const since = url.searchParams.get('since')
    const until = url.searchParams.get('until')

    const result = await listDevActivity(sql, { limit, offset, actor, action, status, since, until })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Dev activity list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
