import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { order } = body as { order: { id: string; sort_order: number }[] }
    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    for (const { id, sort_order } of order) {
      await db.updateDrinkSortOrder(id, sort_order)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering drinks:', error)
    return NextResponse.json({ error: 'Failed to reorder drinks' }, { status: 500 })
  }
}
