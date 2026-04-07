import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    await db.setupReservations()
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    const status = searchParams.get('status') || undefined
    if (!placeId) return NextResponse.json({ error: 'place_id required' }, { status: 400 })
    const reservations = await db.getReservations(placeId, status)
    return NextResponse.json(reservations)
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await db.setupReservations()
    const body = await request.json()
    const { place_id, customer_name, customer_phone, party_size, reserved_at, notes } = body
    if (!place_id || !customer_name || !reserved_at) {
      return NextResponse.json({ error: 'place_id, customer_name, and reserved_at are required' }, { status: 400 })
    }
    const place = await db.getPlaceById(place_id)
    if (!place) return NextResponse.json({ error: 'المكان غير موجود' }, { status: 404 })
    if (place.reservations_enabled === false) return NextResponse.json({ error: 'الحجز غير متاح لهذا المكان حالياً' }, { status: 403 })
    const reservation = await db.createReservation({
      place_id,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone?.trim() || undefined,
      party_size: parseInt(party_size) || 2,
      reserved_at,
      notes: notes?.trim() || undefined,
    })
    return NextResponse.json(reservation)
  } catch (error) {
    console.error('Error creating reservation:', error)
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 })
  }
}
