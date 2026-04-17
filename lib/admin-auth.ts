import { createHash } from 'crypto'

export const DEV_ADMIN_SESSION_COOKIE = 'qa3da_dev_admin_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8
export const DEV_ADMIN_ACCOUNTS_SETTING = 'dev_admin_accounts'

export type DevAdminRole = 'super_developer' | 'support_admin' | 'sales_admin' | 'finance_admin'

export interface DevAdminAccount {
  id: string
  name: string
  role: DevAdminRole
  passwordHash?: string
  password?: string
  active?: boolean
  createdAt?: string
}

export const DEV_ADMIN_ROLE_LABELS: Record<DevAdminRole, string> = {
  super_developer: 'Super Developer',
  support_admin: 'Support Admin',
  sales_admin: 'Sales Admin',
  finance_admin: 'Finance Admin',
}

export function adminSessionValue(secret: string) {
  return createHash('sha256').update(secret).digest('hex')
}

export function passwordHash(password: string) {
  return createHash('sha256').update(password).digest('hex')
}

export function devAdminSessionValue(account: Pick<DevAdminAccount, 'id' | 'name' | 'role'>, secret: string) {
  return createHash('sha256').update(`${account.id}:${account.name}:${account.role}:${secret}`).digest('hex')
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

export async function getDevAdminAccounts(sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>) {
  try {
    const rows = await sql`SELECT value FROM app_settings WHERE key = ${DEV_ADMIN_ACCOUNTS_SETTING}`
    const parsed = rows[0]?.value ? JSON.parse(rows[0].value) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((account: DevAdminAccount) => account?.id && account?.name && account?.role)
      .map((account: DevAdminAccount) => ({
        ...account,
        active: account.active !== false,
      })) as DevAdminAccount[]
  } catch {
    return []
  }
}

export async function saveDevAdminAccounts(
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>,
  accounts: DevAdminAccount[],
) {
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES (${DEV_ADMIN_ACCOUNTS_SETTING}, ${JSON.stringify(accounts)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `
}

export async function findDevAdminByCredentials(
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>,
  name: string,
  password: string,
) {
  const normalizedName = name.trim().toLowerCase()
  const accounts = await getDevAdminAccounts(sql)
  return accounts.find((account) => {
    if (account.active === false) return false
    if (account.name.trim().toLowerCase() !== normalizedName) return false
    if (account.passwordHash) return account.passwordHash === passwordHash(password)
    return account.password === password
  }) || null
}

export async function isSuperDevAdminSession(
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>,
  sessionToken: string | undefined,
) {
  if (!sessionToken) return false
  const secret = await getDevAdminSecret(sql)
  if (secret && sessionToken === adminSessionValue(secret)) return true

  const accounts = await getDevAdminAccounts(sql)
  return accounts.some((account) => (
    account.active !== false &&
    account.role === 'super_developer' &&
    secret &&
    sessionToken === devAdminSessionValue(account, secret)
  ))
}
