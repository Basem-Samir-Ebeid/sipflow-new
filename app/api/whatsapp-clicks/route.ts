import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    if (!placeId) return NextResponse.json({ error: 'place_id required' }, { status: 400 })
    const stats = await db.getWaClickStats(placeId)
    return NextResponse.json(stats)
  } catch (error) {
    console.error('whatsapp-clicks GET error:', error)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { place_id } = await request.json()
    if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })
    await db.logWaClick(String(place_id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('whatsapp-clicks POST error:', error)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
