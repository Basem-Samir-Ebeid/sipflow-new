import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })
    const place = await db.getPlaceByCode(code)
    if (!place) return NextResponse.json({ error: 'المكان مش موجود' }, { status: 404 })
    if (!place.is_active) return NextResponse.json({ error: 'هذا المكان غير مفعّل حالياً' }, { status: 403 })
    return NextResponse.json(place)
  } catch (error) {
    console.error('Error looking up place:', error)
    return NextResponse.json({ error: 'Failed to lookup place' }, { status: 500 })
  }
}
