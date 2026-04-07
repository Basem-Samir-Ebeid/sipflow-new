import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, table_number } = body
    if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })
    const reservation = await db.updateReservationStatus(id, status, table_number)

    if (status === 'confirmed' && reservation) {
      const placeRes = await db.getPlaceById(reservation.place_id).catch(() => null)
      const placeName = placeRes?.name || 'المكان'
      const dt = new Date(reservation.reserved_at)
      const dateStr = dt.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      const tableLabel = table_number ? `طاولة رقم ${table_number}` : 'بدون رقم طاولة'
      const notifMsg = `🔔 حجز مؤكد — ${placeName}\n👤 ${reservation.customer_name}${reservation.customer_phone ? ` | 📞 ${reservation.customer_phone}` : ''}\n${tableLabel} | 👥 ${reservation.party_size} أشخاص\n📅 ${dateStr} — ⏰ ${timeStr}${reservation.notes ? `\n📝 ${reservation.notes}` : ''}`
      await db.createMessage({
        title: `حجز مؤكد — ${tableLabel}`,
        message: notifMsg,
        place_id: reservation.place_id,
      }).catch(() => {})
    }

    return NextResponse.json(reservation)
  } catch (error) {
    console.error('Error updating reservation:', error)
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.deleteReservation(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting reservation:', error)
    return NextResponse.json({ error: 'Failed to delete reservation' }, { status: 500 })
  }
}
