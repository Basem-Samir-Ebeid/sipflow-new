import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { DEV_ADMIN_SESSION_COOKIE, isSuperDevAdminSession } from '@/lib/admin-auth'
import { listDevActivity, logDevActivity, rowsToCsv } from '@/lib/dev-activity'

export async function GET(request: NextRequest) {
  try {
    const sql = getSql()
    const sessionToken = request.cookies.get(DEV_ADMIN_SESSION_COOKIE)?.value
    if (!(await isSuperDevAdminSession(sql, sessionToken))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const actor = url.searchParams.get('actor')
    const action = url.searchParams.get('action')
    const status = url.searchParams.get('status')
    const since = url.searchParams.get('since')
    const until = url.searchParams.get('until')

    const { rows } = await listDevActivity(sql, { limit: 500, offset: 0, actor, action, status, since, until })
    const csv = rowsToCsv(rows)
    const bom = '\uFEFF'
    const filename = `dev-activity-${new Date().toISOString().slice(0, 10)}.csv`

    await logDevActivity(sql, {
      request,
      action: 'activity_log_export',
      target: 'dev_activity_log',
      details: { rowCount: rows.length, filters: { actor, action, status, since, until } },
    })

    return new NextResponse(bom + csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Dev activity export error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
