import { getSql } from '@/lib/db'

export type PlanConfig = {
  label: string
  emoji: string
  color: string
  maxTables: number | null
  maxStaff: number | null
  maxProducts: number | null
  reservationsEnabled: boolean
  reportsEnabled: boolean
  durationDays: number | null
}

export const DEFAULT_PLANS: Record<string, PlanConfig> = {
  free: {
    label: 'مجانية',
    emoji: '🎁',
    color: '#6b7280',
    maxTables: 10,
    maxStaff: 3,
    maxProducts: 30,
    reservationsEnabled: false,
    reportsEnabled: false,
    durationDays: null,
  },
  monthly: {
    label: 'شهرية',
    emoji: '📅',
    color: '#3b82f6',
    maxTables: 20,
    maxStaff: 10,
    maxProducts: 100,
    reservationsEnabled: true,
    reportsEnabled: true,
    durationDays: 30,
  },
  yearly: {
    label: 'سنوية',
    emoji: '📆',
    color: '#8b5cf6',
    maxTables: 30,
    maxStaff: 15,
    maxProducts: 200,
    reservationsEnabled: true,
    reportsEnabled: true,
    durationDays: 365,
  },
  premium: {
    label: 'بريميوم',
    emoji: '👑',
    color: '#f59e0b',
    maxTables: null,
    maxStaff: null,
    maxProducts: null,
    reservationsEnabled: true,
    reportsEnabled: true,
    durationDays: null,
  },
}

export async function getPlansFromDb(): Promise<Record<string, PlanConfig>> {
  try {
    const sql = getSql()
    const rows = await sql`SELECT value FROM app_settings WHERE key = 'subscription_plans_config' LIMIT 1`
    if (rows.length > 0) {
      const parsed = JSON.parse(rows[0].value)
      return { ...DEFAULT_PLANS, ...parsed }
    }
  } catch {}
  return { ...DEFAULT_PLANS }
}
