import { NextResponse } from 'next/server'
import { db, getSql } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id') || null

    const sql = getSql()
    
    // Fetch all non-active (archived) sessions, ordered by date and created_at descending
    let sessions
    if (placeId) {
      sessions = await sql`
        SELECT * FROM sessions 
        WHERE place_id = ${placeId} AND is_active = false 
        ORDER BY date DESC, created_at DESC
        LIMIT 50
      `
    } else {
      sessions = await sql`
        SELECT * FROM sessions 
        WHERE place_id IS NULL AND is_active = false 
        ORDER BY date DESC, created_at DESC
        LIMIT 50
      `
    }

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error fetching archived sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch archived sessions' }, { status: 500 })
  }
}
