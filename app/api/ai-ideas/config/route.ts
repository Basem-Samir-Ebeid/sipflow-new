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

type ImplementedIdeaRecord = {
  title?: string
  tab?: string
  tabLabel?: string
  scope?: 'developer_admin' | 'all_pages'
  implementedAt?: string
  steps?: string[]
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const flagKey = searchParams.get('flagKey')
    if (!flagKey) {
      return NextResponse.json({ error: 'flagKey required' }, { status: 400 })
    }

    const featureFlags = await parseJsonSetting<Record<string, boolean>>('feature_flags', {})
    const implementedIdeas = await parseJsonSetting<Record<string, ImplementedIdeaRecord>>('implemented_ideas', {})
    const config = await parseJsonSetting<Record<string, unknown>>(`${flagKey}_config`, {})

    return NextResponse.json({
      success: true,
      flagKey,
      enabled: Boolean(featureFlags[flagKey]),
      record: implementedIdeas[flagKey] || null,
      config,
    })
  } catch (error) {
    console.error('Error fetching idea config:', error)
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { flagKey } = body
    if (!flagKey || typeof flagKey !== 'string') {
      return NextResponse.json({ error: 'flagKey required' }, { status: 400 })
    }

    const featureFlags = await parseJsonSetting<Record<string, boolean>>('feature_flags', {})
    const implementedIdeas = await parseJsonSetting<Record<string, ImplementedIdeaRecord>>('implemented_ideas', {})
    const currentConfig = await parseJsonSetting<Record<string, unknown>>(`${flagKey}_config`, {})

    if (typeof body.enabled === 'boolean') {
      featureFlags[flagKey] = body.enabled
      await db.setSetting('feature_flags', JSON.stringify(featureFlags))
    }

    const existingRecord: ImplementedIdeaRecord = implementedIdeas[flagKey] || {}
    const updatedRecord: ImplementedIdeaRecord = { ...existingRecord }
    let recordChanged = false
    if (typeof body.title === 'string' && body.title.trim()) {
      updatedRecord.title = body.title.trim()
      recordChanged = true
    }
    if (body.scope === 'developer_admin' || body.scope === 'all_pages') {
      updatedRecord.scope = body.scope
      recordChanged = true
    }
    if (typeof body.tab === 'string' && body.tab.trim()) {
      updatedRecord.tab = body.tab.trim()
      recordChanged = true
    }
    if (typeof body.tabLabel === 'string' && body.tabLabel.trim()) {
      updatedRecord.tabLabel = body.tabLabel.trim()
      recordChanged = true
    }
    if (recordChanged) {
      implementedIdeas[flagKey] = updatedRecord
      await db.setSetting('implemented_ideas', JSON.stringify(implementedIdeas))
    }

    let nextConfig = currentConfig
    if (body.config && typeof body.config === 'object') {
      nextConfig = { ...currentConfig, ...body.config }
      await db.setSetting(`${flagKey}_config`, JSON.stringify(nextConfig))
    } else if (body.replaceConfig && typeof body.replaceConfig === 'object') {
      nextConfig = body.replaceConfig
      await db.setSetting(`${flagKey}_config`, JSON.stringify(nextConfig))
    }

    return NextResponse.json({
      success: true,
      flagKey,
      enabled: Boolean(featureFlags[flagKey]),
      record: implementedIdeas[flagKey] || null,
      config: nextConfig,
      featureFlags,
      implementedIdeas,
    })
  } catch (error) {
    console.error('Error updating idea config:', error)
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
  }
}
