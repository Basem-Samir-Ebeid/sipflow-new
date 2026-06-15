import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getTier(points: number, silver: number, gold: number) {
  if (points >= gold) return 'gold'
  if (points >= silver) return 'silver'
  return 'bronze'
}

export async function GET(req: NextRequest) {
  const sql = getSql()
  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get('place_id')
  const userId  = searchParams.get('user_id')

  if (!placeId || !UUID_RE.test(placeId)) return NextResponse.json({ error: 'place_id required' }, { status: 400 })

  const settings = await sql`
    SELECT key, value FROM app_settings
    WHERE key IN ('loyalty_points_per_egp','loyalty_redeem_rate','loyalty_silver_threshold','loyalty_gold_threshold','loyalty_enabled')
  `
  const cfg: Record<string,string> = {}
  for (const r of settings) cfg[r.key] = r.value

  const silverThreshold = Number(cfg.loyalty_silver_threshold ?? 500)
  const goldThreshold   = Number(cfg.loyalty_gold_threshold   ?? 2000)

  if (userId && UUID_RE.test(userId)) {
    const rows = await sql`SELECT * FROM loyalty_points WHERE user_id=${userId} AND place_id=${placeId} LIMIT 1`
    const lp = rows[0] ?? { points: 0, total_earned: 0, total_redeemed: 0 }
    const txns = await sql`
      SELECT * FROM loyalty_transactions
      WHERE user_id=${userId} AND place_id=${placeId}
      ORDER BY created_at DESC LIMIT 20
    `
    return NextResponse.json({
      points: Number(lp.points ?? 0),
      totalEarned: Number(lp.total_earned ?? 0),
      totalRedeemed: Number(lp.total_redeemed ?? 0),
      tier: getTier(Number(lp.points ?? 0), silverThreshold, goldThreshold),
      silverThreshold,
      goldThreshold,
      pointsPerEgp: Number(cfg.loyalty_points_per_egp ?? 1),
      redeemRate: Number(cfg.loyalty_redeem_rate ?? 10),
      enabled: cfg.loyalty_enabled === 'true',
      transactions: txns,
    })
  }

  const leaderboard = await sql`
    SELECT lp.user_id, u.name, lp.points, lp.total_earned, lp.total_redeemed
    FROM loyalty_points lp
    JOIN users u ON u.id = lp.user_id
    WHERE lp.place_id = ${placeId}
    ORDER BY lp.points DESC
    LIMIT 20
  `

  return NextResponse.json({
    leaderboard: leaderboard.map(r => ({
      userId: r.user_id,
      name: r.name,
      points: Number(r.points),
      totalEarned: Number(r.total_earned),
      totalRedeemed: Number(r.total_redeemed),
      tier: getTier(Number(r.points), silverThreshold, goldThreshold),
    })),
    silverThreshold,
    goldThreshold,
    pointsPerEgp: Number(cfg.loyalty_points_per_egp ?? 1),
    redeemRate: Number(cfg.loyalty_redeem_rate ?? 10),
    enabled: cfg.loyalty_enabled === 'true',
  })
}

export async function POST(req: NextRequest) {
  const sql = getSql()
  const body = await req.json()
  const { user_id, place_id, amount, order_id, type = 'earn', note } = body

  if (!user_id || !place_id || !UUID_RE.test(user_id) || !UUID_RE.test(place_id))
    return NextResponse.json({ error: 'user_id and place_id required' }, { status: 400 })

  const settingRows = await sql`
    SELECT key,value FROM app_settings WHERE key IN ('loyalty_points_per_egp','loyalty_redeem_rate')
  `
  const cfg: Record<string,string> = {}
  for (const r of settingRows) cfg[r.key] = r.value

  const pointsPerEgp = Number(cfg.loyalty_points_per_egp ?? 1)
  const redeemRate   = Number(cfg.loyalty_redeem_rate ?? 10)

  let pointsDelta = 0
  if (type === 'earn' && amount) {
    pointsDelta = Math.floor(Number(amount) * pointsPerEgp)
  } else if (type === 'redeem' && amount) {
    pointsDelta = -Math.floor(Number(amount) / redeemRate)
  } else if (type === 'bonus' && amount) {
    pointsDelta = Number(amount)
  }

  if (pointsDelta === 0) return NextResponse.json({ error: 'No points to apply' }, { status: 400 })

  await sql`
    INSERT INTO loyalty_points (user_id, place_id, points, total_earned, total_redeemed, updated_at)
    VALUES (
      ${user_id}, ${place_id},
      ${Math.max(0, pointsDelta)},
      ${pointsDelta > 0 ? pointsDelta : 0},
      ${pointsDelta < 0 ? Math.abs(pointsDelta) : 0},
      NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `.catch(() => {})

  await sql`
    INSERT INTO loyalty_points (user_id, place_id, points, total_earned, total_redeemed, updated_at)
    SELECT ${user_id}, ${place_id}, 0, 0, 0, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM loyalty_points WHERE user_id=${user_id} AND place_id=${place_id})
  `.catch(() => {})

  await sql`
    UPDATE loyalty_points
    SET
      points        = GREATEST(0, points + ${pointsDelta}),
      total_earned  = total_earned + ${pointsDelta > 0 ? pointsDelta : 0},
      total_redeemed= total_redeemed + ${pointsDelta < 0 ? Math.abs(pointsDelta) : 0},
      updated_at    = NOW()
    WHERE user_id=${user_id} AND place_id=${place_id}
  `

  await sql`
    INSERT INTO loyalty_transactions (user_id, place_id, points, type, order_id, note)
    VALUES (${user_id}, ${place_id}, ${pointsDelta}, ${type}, ${order_id || null}, ${note || null})
  `

  const updated = await sql`SELECT * FROM loyalty_points WHERE user_id=${user_id} AND place_id=${place_id} LIMIT 1`
  return NextResponse.json({ success: true, points: Number(updated[0]?.points ?? 0), delta: pointsDelta })
}

export async function PATCH(req: NextRequest) {
  const sql = getSql()
  const body = await req.json()
  const { key, value, place_id } = body

  if (key && value !== undefined) {
    await sql`
      INSERT INTO app_settings (key, value) VALUES (${key}, ${String(value)})
      ON CONFLICT (key) DO UPDATE SET value = ${String(value)}, updated_at = NOW()
    `
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
