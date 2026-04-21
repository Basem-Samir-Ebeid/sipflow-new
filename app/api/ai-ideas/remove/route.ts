import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function parseJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const value = await db.getSetting(key)
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export async function POST(request: Request) {
  try {
    const { flagKey } = await request.json()
    if (!flagKey || typeof flagKey !== 'string') {
      return NextResponse.json({ error: 'Idea key required' }, { status: 400 })
    }

    const featureFlags = await parseJsonSetting<Record<string, boolean>>('feature_flags', {})
    featureFlags[flagKey] = false
    await db.setSetting('feature_flags', JSON.stringify(featureFlags))

    const implementedIdeas = await parseJsonSetting<Record<string, unknown>>('implemented_ideas', {})
    delete implementedIdeas[flagKey]
    await db.setSetting('implemented_ideas', JSON.stringify(implementedIdeas))

    await db.setSetting(`${flagKey}_config`, JSON.stringify({ enabled: false }))

    return NextResponse.json({
      success: true,
      flagKey,
      featureFlags,
      implementedIdeas,
    })
  } catch (error) {
    console.error('Error removing AI idea:', error)
    return NextResponse.json({ error: 'Failed to remove idea' }, { status: 500 })
  }
}
