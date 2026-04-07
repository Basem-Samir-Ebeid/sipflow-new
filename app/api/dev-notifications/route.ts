import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function ensureTable() {
  try {
    await db.setupDevNotifications()
  } catch (err) {
    console.error('Failed to ensure dev_notifications table:', err)
  }
}

export async function GET() {
  await ensureTable()
  try {
    const notifications = await db.getDevNotifications(50)
    const unreadCount = await db.getUnreadDevNotificationsCount()
    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('Error fetching dev notifications:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  await ensureTable()
  try {
    const body = await request.json()

    if (body.action === 'mark_read') {
      await db.markDevNotificationsRead()
      return NextResponse.json({ success: true })
    }

    if (body.action === 'clear') {
      await db.clearDevNotifications()
      return NextResponse.json({ success: true })
    }

    if (body.action === 'delete' && body.id) {
      await db.deleteDevNotification(body.id)
      return NextResponse.json({ success: true })
    }

    if (!body.place_name || !body.action) {
      return NextResponse.json({ error: 'place_name and action are required' }, { status: 400 })
    }

    const notification = await db.createDevNotification({
      place_id: body.place_id || '',
      place_name: body.place_name,
      action: body.action,
      details: body.details || null
    })
    return NextResponse.json(notification)
  } catch (error) {
    console.error('Error processing dev notification:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
