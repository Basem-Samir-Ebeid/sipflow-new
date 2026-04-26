import type { NextRequest } from 'next/server'
import {
  DEV_ADMIN_SESSION_COOKIE,
  adminSessionValue,
  devAdminSessionValue,
  getDevAdminAccounts,
  getDevAdminSecret,
  type DevAdminAccount,
  type DevAdminRole,
} from './admin-auth'

type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>

let tableReady = false

async function ensureTable(sql: Sql) {
  if (tableReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS dev_activity_log (
      id BIGSERIAL PRIMARY KEY,
      actor_name TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      target TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      details TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_dev_activity_created_at ON dev_activity_log (created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_dev_activity_action ON dev_activity_log (action)`
  await sql`CREATE INDEX IF NOT EXISTS idx_dev_activity_actor ON dev_activity_log (actor_name)`
  tableReady = true
}

export function getRequestIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

export function getRequestUserAgent(request: NextRequest): string {
  return (request.headers.get('user-agent') || 'unknown').slice(0, 500)
}

export async function resolveSessionActor(
  sql: Sql,
  sessionToken: string | undefined,
): Promise<{ name: string | null; role: DevAdminRole | null }> {
  if (!sessionToken) return { name: null, role: null }
  try {
    const secret = await getDevAdminSecret(sql)
    if (!secret) return { name: null, role: null }

    if (sessionToken === adminSessionValue(secret)) {
      let name = 'master'
      try {
        const rows = await sql`SELECT value FROM app_settings WHERE key = 'dev_admin_username'`
        if (rows[0]?.value) name = String(rows[0].value)
      } catch {}
      return { name, role: 'super_developer' }
    }

    const accounts = await getDevAdminAccounts(sql)
    const match = accounts.find((account: DevAdminAccount) =>
      sessionToken === devAdminSessionValue(account, secret),
    )
    if (match) return { name: match.name, role: match.role }
  } catch {}
  return { name: null, role: null }
}

export interface LogDevActivityInput {
  request?: NextRequest
  actorName?: string | null
  actorRole?: DevAdminRole | null
  action: string
  target?: string | null
  status?: 'success' | 'failure' | 'warning'
  details?: string | Record<string, any> | null
  ip?: string | null
  userAgent?: string | null
}

export async function logDevActivity(sql: Sql, input: LogDevActivityInput): Promise<void> {
  try {
    await ensureTable(sql)

    let actorName = input.actorName ?? null
    let actorRole = input.actorRole ?? null

    if ((!actorName || !actorRole) && input.request) {
      const sessionToken = input.request.cookies.get(DEV_ADMIN_SESSION_COOKIE)?.value
      const resolved = await resolveSessionActor(sql, sessionToken)
      actorName = actorName ?? resolved.name
      actorRole = actorRole ?? resolved.role
    }

    const ip = input.ip ?? (input.request ? getRequestIp(input.request) : null)
    const userAgent = input.userAgent ?? (input.request ? getRequestUserAgent(input.request) : null)
    const status = input.status ?? 'success'
    const target = input.target ?? null

    let detailsText: string | null = null
    if (input.details !== null && input.details !== undefined) {
      detailsText = typeof input.details === 'string' ? input.details : JSON.stringify(input.details)
      if (detailsText.length > 2000) detailsText = detailsText.slice(0, 2000)
    }

    await sql`
      INSERT INTO dev_activity_log (actor_name, actor_role, action, target, status, details, ip, user_agent)
      VALUES (${actorName}, ${actorRole}, ${input.action}, ${target}, ${status}, ${detailsText}, ${ip}, ${userAgent})
    `
  } catch (error) {
    console.error('[dev-activity] log failed:', error)
  }
}

export interface DevActivityRow {
  id: number
  actor_name: string | null
  actor_role: string | null
  action: string
  target: string | null
  status: string
  details: string | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

export interface ListDevActivityOptions {
  limit?: number
  offset?: number
  actor?: string | null
  action?: string | null
  status?: string | null
  since?: string | null
  until?: string | null
}

export async function listDevActivity(
  sql: Sql,
  opts: ListDevActivityOptions = {},
): Promise<{ rows: DevActivityRow[]; total: number }> {
  await ensureTable(sql)
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500))
  const offset = Math.max(0, opts.offset ?? 0)
  const actor = opts.actor?.trim() || null
  const action = opts.action?.trim() || null
  const status = opts.status?.trim() || null
  const since = opts.since || null
  const until = opts.until || null

  const rows = (await sql`
    SELECT id, actor_name, actor_role, action, target, status, details, ip, user_agent, created_at
    FROM dev_activity_log
    WHERE
      (${actor}::text IS NULL OR LOWER(actor_name) LIKE LOWER('%' || ${actor}::text || '%'))
      AND (${action}::text IS NULL OR action = ${action}::text)
      AND (${status}::text IS NULL OR status = ${status}::text)
      AND (${since}::timestamptz IS NULL OR created_at >= ${since}::timestamptz)
      AND (${until}::timestamptz IS NULL OR created_at <= ${until}::timestamptz)
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit} OFFSET ${offset}
  `) as DevActivityRow[]

  const totalRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM dev_activity_log
    WHERE
      (${actor}::text IS NULL OR LOWER(actor_name) LIKE LOWER('%' || ${actor}::text || '%'))
      AND (${action}::text IS NULL OR action = ${action}::text)
      AND (${status}::text IS NULL OR status = ${status}::text)
      AND (${since}::timestamptz IS NULL OR created_at >= ${since}::timestamptz)
      AND (${until}::timestamptz IS NULL OR created_at <= ${until}::timestamptz)
  `
  const total = Number(totalRows[0]?.count ?? 0)
  return { rows, total }
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function rowsToCsv(rows: DevActivityRow[]): string {
  const header = ['id', 'created_at', 'actor_name', 'actor_role', 'action', 'target', 'status', 'ip', 'user_agent', 'details']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([
      r.id,
      r.created_at,
      r.actor_name,
      r.actor_role,
      r.action,
      r.target,
      r.status,
      r.ip,
      r.user_agent,
      r.details,
    ].map(csvEscape).join(','))
  }
  return lines.join('\n')
}
