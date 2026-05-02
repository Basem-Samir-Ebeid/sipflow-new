import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    if (!placeId) return NextResponse.json({ error: 'place_id required' }, { status: 400 })

    const raw = await db.getSetting(`wa_clicks_${placeId}`)
    if (!raw) return NextResponse.json({ total: 0, today: 0, week: 0, last_click: null })

    const data = JSON.parse(raw)
    const todayKey = new Date().toISOString().slice(0, 10)
    const weekKey = getISOWeek()

    return NextResponse.json({
      total: data.total ?? 0,
      today: data.today_date === todayKey ? (data.today ?? 0) : 0,
      week: data.week_key === weekKey ? (data.week ?? 0) : 0,
      last_click: data.last_click ?? null,
    })
  } catch (error) {
    console.error('whatsapp-clicks GET error:', error)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { place_id } = await request.json()
    if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })

    const key = `wa_clicks_${place_id}`
    const raw = await db.getSetting(key)
    const todayKey = new Date().toISOString().slice(0, 10)
    const weekKey = getISOWeek()

    let data: Record<string, number | string> = { total: 0, today: 0, today_date: todayKey, week: 0, week_key: weekKey, last_click: '' }
    if (raw) {
      try { data = JSON.parse(raw) } catch {}
    }

    data.total = (Number(data.total) || 0) + 1
    data.today = (data.today_date === todayKey ? (Number(data.today) || 0) : 0) + 1
    data.today_date = todayKey
    data.week = (data.week_key === weekKey ? (Number(data.week) || 0) : 0) + 1
    data.week_key = weekKey
    data.last_click = new Date().toISOString()

    await db.setSetting(key, JSON.stringify(data))
    return NextResponse.json({ success: true, total: data.total, today: data.today })
  } catch (error) {
    console.error('whatsapp-clicks POST error:', error)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

function getISOWeek(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
