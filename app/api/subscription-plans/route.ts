import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { DEFAULT_PLANS, getPlansFromDb, type PlanConfig } from '@/lib/subscription-plans'

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
