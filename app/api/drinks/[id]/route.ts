import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const drink = await db.updateDrink(id, body)
    return NextResponse.json(drink)
  } catch (error) {
    console.error('Error updating drink:', error)
    return NextResponse.json({ error: 'Failed to update drink' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.deleteDrink(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting drink:', error)
    return NextResponse.json({ error: 'Failed to delete drink' }, { status: 500 })
  }
}
