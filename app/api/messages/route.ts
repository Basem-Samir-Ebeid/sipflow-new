import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id') || null
    const limit = parseInt(searchParams.get('limit') || '5', 10)
    const messages = await db.getMessages(limit, placeId)
    return NextResponse.json(messages)
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (body.action === 'delete_all') {
      await db.deleteAllMessages(body.place_id || null)
      return NextResponse.json({ success: true })
    }

    const message = await db.createMessage({ ...body, place_id: body.place_id || null })
    return NextResponse.json(message)
  } catch (error) {
    console.error('Error creating message:', error)
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
  }
}
