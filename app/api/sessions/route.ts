import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const readonly = searchParams.get('readonly') === 'true'
    const all = searchParams.get('all') === 'true'
    const placeId = searchParams.get('place_id') || null

    // Return ALL sessions for a date (for multi-session selector UI)
    if (all) {
      const sessions = await db.getAllSessionsByDate(date, placeId)
      return NextResponse.json(sessions)
    }

    let session = await db.getActiveSession(date, placeId)

    if (!session) {
      if (readonly) {
        // In readonly (archive) mode: find any session for that date (active or ended)
        session = await db.getSessionByDate(date, placeId)
      } else {
        // Live mode: create a new session for today if none exists
        session = await db.createSession(date, placeId)
      }
    }

    return NextResponse.json(session)
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, place_id } = body

    if (action === 'reset') {
      const today = new Date().toISOString().split('T')[0]

      // Archive ALL active sessions for this place before creating new one
      await db.endAllActiveSessions(place_id || null)

      // Create a fresh session for today
      const session = await db.createSession(today, place_id || null)

      return NextResponse.json(session)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error handling session:', error)
    return NextResponse.json({ error: 'Failed to handle session' }, { status: 500 })
  }
}
