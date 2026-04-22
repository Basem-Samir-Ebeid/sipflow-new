import { NextResponse } from 'next/server'
import { dashboardKPIs, forecastIngredients, leakDetection, profitability, suggestPurchaseOrders } from '@/lib/inventory-engine'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
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
