import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    
    if (!key) {
      return NextResponse.json({ error: 'Key required' }, { status: 400 })
    }
    
    const value = await db.getSetting(key)
    return NextResponse.json({ key, value })
  } catch (error) {
    console.error('Error fetching setting:', error)
    return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { key, value } = await request.json()
    await db.setSetting(key, value)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving setting:', error)
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 })
  }
}
