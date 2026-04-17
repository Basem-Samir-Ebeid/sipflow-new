import { NextResponse } from 'next/server'
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

export async function GET() {
  try {
    const plans = await getPlansFromDb()
    return NextResponse.json(plans)
  } catch (error) {
    console.error('Error fetching plan configs:', error)
    return NextResponse.json({ error: 'Failed to fetch plan configs' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const sql = getSql()

    const merged: Record<string, PlanConfig> = {}
    for (const key of ['free', 'monthly', 'yearly', 'premium']) {
      if (body[key]) {
        const b = body[key]
        merged[key] = {
          ...DEFAULT_PLANS[key],
          maxTables: b.maxTables === '' || b.maxTables === null ? null : Number(b.maxTables),
          maxStaff: b.maxStaff === '' || b.maxStaff === null ? null : Number(b.maxStaff),
          maxProducts: b.maxProducts === '' || b.maxProducts === null ? null : Number(b.maxProducts),
          reservationsEnabled: Boolean(b.reservationsEnabled),
          reportsEnabled: Boolean(b.reportsEnabled),
          durationDays: b.durationDays === '' || b.durationDays === null ? null : Number(b.durationDays),
        }
      }
    }

    const value = JSON.stringify(merged)
    await sql`
      INSERT INTO app_settings (key, value)
      VALUES ('subscription_plans_config', ${value})
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
    `

    return NextResponse.json(merged)
  } catch (error) {
    console.error('Error saving plan configs:', error)
    return NextResponse.json({ error: 'Failed to save plan configs' }, { status: 500 })
  }
}
