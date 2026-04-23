import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

// GET /api/customers/marketing?place_id=...&days=90
// Returns aggregated customer profiles built from orders (name + phone + visits + total spent + last visit)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '90', 10) || 90))

    const sql = getSql()
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    let rows: Array<Record<string, unknown>> = []
    try {
      if (placeId) {
        rows = await sql`
          SELECT o.customer_name, o.customer_phone, o.total_price, o.created_at, o.drink_id, d.name as drink_name
          FROM orders o
          LEFT JOIN sessions s ON s.id = o.session_id
          LEFT JOIN drinks d ON d.id = o.drink_id
          WHERE s.place_id = ${placeId} AND s.date >= ${since}
                AND o.customer_phone IS NOT NULL AND length(trim(o.customer_phone)) > 0
        `
      } else {
        rows = await sql`
          SELECT o.customer_name, o.customer_phone, o.total_price, o.created_at, o.drink_id, d.name as drink_name
          FROM orders o
          LEFT JOIN sessions s ON s.id = o.session_id
          LEFT JOIN drinks d ON d.id = o.drink_id
          WHERE s.date >= ${since}
                AND o.customer_phone IS NOT NULL AND length(trim(o.customer_phone)) > 0
        `
      }
    } catch {}

    type Profile = {
      phone: string
      name: string
      visits: Set<string>
      total_spent: number
      orders: number
      last_visit: string
      favorite_counts: Record<string, number>
    }

    const profiles: Record<string, Profile> = {}
    for (const r of rows) {
      const phoneRaw = String(r.customer_phone || '').replace(/\D/g, '')
      if (phoneRaw.length < 8) continue
      const name = String(r.customer_name || '').trim() || 'زبون'
      const ts = r.created_at as string
      const dateKey = new Date(ts).toISOString().split('T')[0]
      const drinkName = String(r.drink_name || '')

      if (!profiles[phoneRaw]) {
        profiles[phoneRaw] = {
          phone: phoneRaw,
          name,
          visits: new Set(),
          total_spent: 0,
          orders: 0,
          last_visit: ts,
          favorite_counts: {},
        }
      }
      const p = profiles[phoneRaw]
      // Keep most recent name
      if (new Date(ts).getTime() > new Date(p.last_visit).getTime()) {
        p.last_visit = ts
        if (name && name !== 'زبون') p.name = name
      }
      p.visits.add(dateKey)
      p.orders += 1
      p.total_spent += Number(r.total_price || 0)
      if (drinkName) p.favorite_counts[drinkName] = (p.favorite_counts[drinkName] || 0) + 1
    }

    const customers = Object.values(profiles).map(p => {
      const fav = Object.entries(p.favorite_counts).sort((a, b) => b[1] - a[1])[0]
      return {
        phone: p.phone,
        name: p.name,
        visits: p.visits.size,
        orders: p.orders,
        total_spent: Math.round(p.total_spent),
        last_visit: p.last_visit,
        favorite: fav ? fav[0] : null,
        days_since_last: Math.floor((Date.now() - new Date(p.last_visit).getTime()) / (1000 * 60 * 60 * 24)),
      }
    }).sort((a, b) => b.total_spent - a.total_spent)

    return NextResponse.json({ customers, total: customers.length, days })
  } catch (error) {
    console.error('customers marketing error', error)
    return NextResponse.json({ customers: [], total: 0, error: 'Failed to load' }, { status: 500 })
  }
}
