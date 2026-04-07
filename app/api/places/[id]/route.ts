import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const place = await db.updatePlace(id, body)
    return NextResponse.json(place)
  } catch (error) {
    console.error('Error updating place:', error)
    return NextResponse.json({ error: 'Failed to update place' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.deletePlace(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting place:', error)
    return NextResponse.json({ error: 'Failed to delete place' }, { status: 500 })
  }
}
