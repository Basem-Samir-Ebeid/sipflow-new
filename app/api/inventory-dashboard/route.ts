import { NextResponse } from 'next/server'
import { dashboardKPIs, forecastIngredients, leakDetection, profitability, suggestPurchaseOrders } from '@/lib/inventory-engine'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeIdRaw = searchParams.get('place_id')
    const placeId = placeIdRaw && UUID_RE.test(placeIdRaw) ? placeIdRaw : null
    const view = searchParams.get('view') || 'kpis'
    if (view === 'forecast') return NextResponse.json(await forecastIngredients(placeId))
    if (view === 'leak') return NextResponse.json(await leakDetection(placeId, parseInt(searchParams.get('days') || '7')))
    if (view === 'profitability') return NextResponse.json(await profitability(placeId))
    if (view === 'suggest_po') return NextResponse.json(await suggestPurchaseOrders(placeId))
    return NextResponse.json(await dashboardKPIs(placeId))
  } catch (e: any) {
    console.error('GET /api/inventory-dashboard', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
