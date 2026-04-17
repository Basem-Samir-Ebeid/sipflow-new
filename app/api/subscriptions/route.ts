import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { getPlansFromDb } from '@/app/api/subscription-plans/route'

export async function GET() {
  try {
    const sql = getSql()
    await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free'`.catch(() => {})
    await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ`.catch(() => {})

    const [places, planConfigs] = await Promise.all([
      sql`
        SELECT id, name, code, is_active,
               subscription_plan,
               subscription_expires_at,
               created_at
        FROM places
        ORDER BY created_at DESC
      `,
      getPlansFromDb(),
    ])

    const now = new Date()
    const result = places.map((p: any) => {
      const plan = p.subscription_plan || 'free'
      const config = planConfigs[plan] || planConfigs['free']
      let daysLeft: number | null = null
      let isExpired = false
      let expiringSoon = false

      if (p.subscription_expires_at) {
        const expiry = new Date(p.subscription_expires_at)
        const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        daysLeft = diff
        isExpired = diff <= 0
        expiringSoon = diff > 0 && diff <= 7
      }

      return {
        ...p,
        subscription_plan: plan,
        plan_config: config,
        days_left: daysLeft,
        is_expired: isExpired,
        expiring_soon: expiringSoon,
      }
    })

    return NextResponse.json({ places: result, planConfigs })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { place_id, subscription_plan, subscription_expires_at } = body

    if (!place_id) {
      return NextResponse.json({ error: 'place_id is required' }, { status: 400 })
    }

    const sql = getSql()
    const planConfigs = await getPlansFromDb()

    if (subscription_plan && !planConfigs[subscription_plan]) {
      return NextResponse.json({ error: 'Invalid subscription plan' }, { status: 400 })
    }

    let expiresAt: string | null = null
    if (subscription_expires_at) {
      expiresAt = subscription_expires_at
    } else if (subscription_plan && subscription_plan !== 'free' && subscription_plan !== 'premium') {
      const config = planConfigs[subscription_plan]
      if (config?.durationDays) {
        const expiry = new Date()
        expiry.setDate(expiry.getDate() + config.durationDays)
        expiresAt = expiry.toISOString()
      }
    }

    const plan = subscription_plan || 'free'
    const planConfig = planConfigs[plan]

    if (expiresAt) {
      await sql`
        UPDATE places SET
          subscription_plan = ${plan},
          subscription_expires_at = ${expiresAt},
          reservations_enabled = ${planConfig.reservationsEnabled},
          updated_at = NOW()
        WHERE id = ${place_id}
      `
    } else {
      await sql`
        UPDATE places SET
          subscription_plan = ${plan},
          subscription_expires_at = NULL,
          reservations_enabled = ${planConfig.reservationsEnabled},
          updated_at = NOW()
        WHERE id = ${place_id}
      `
    }

    const updated = await sql`SELECT * FROM places WHERE id = ${place_id}`
    return NextResponse.json(updated[0])
  } catch (error) {
    console.error('Error updating subscription:', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}
