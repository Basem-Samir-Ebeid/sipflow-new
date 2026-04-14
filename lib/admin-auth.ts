import { createHash } from 'crypto'

export const DEV_ADMIN_SESSION_COOKIE = 'qa3da_dev_admin_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8

export function adminSessionValue(secret: string) {
  return createHash('sha256').update(secret).digest('hex')
}

export async function getDevAdminSecret(sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>) {
  let adminSecret: string | null = null

  try {
    const rows = await sql`SELECT value FROM app_settings WHERE key = 'dev_admin_password'`
    if (rows[0]?.value) {
      adminSecret = rows[0].value
    }
  } catch {}

  return adminSecret || process.env.ADMIN_SECRET || null
}
