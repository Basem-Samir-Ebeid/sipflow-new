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

type ActiveIdea = {
  flagKey: string
  title: string
  tab: string
  tabLabel: string
  scope: 'developer_admin' | 'all_pages'
  enabled: boolean
  config: Record<string, unknown>
  implementedAt?: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab')
    const onlyEnabled = searchParams.get('onlyEnabled') !== 'false'
    const scope = searchParams.get('scope')

    const featureFlags = await parseJsonSetting<Record<string, boolean>>('feature_flags', {})
    const implementedIdeas = await parseJsonSetting<Record<string, ImplementedIdeaRecord>>('implemented_ideas', {})

    const flagKeys = Object.keys(implementedIdeas)
    if (flagKeys.length === 0) {
      return NextResponse.json({ success: true, ideas: [], byTab: {} })
    }

    const configs = await Promise.all(
      flagKeys.map(async (k) => [k, await parseJsonSetting<Record<string, unknown>>(`${k}_config`, {})] as const)
    )
    const configMap: Record<string, Record<string, unknown>> = {}
    for (const [k, c] of configs) configMap[k] = c

    const ideas: ActiveIdea[] = flagKeys.map((flagKey) => {
      const rec = implementedIdeas[flagKey] || {}
      return {
        flagKey,
        title: rec.title || flagKey,
        tab: rec.tab || 'general',
        tabLabel: rec.tabLabel || rec.tab || 'عام',
        scope: rec.scope === 'developer_admin' ? 'developer_admin' : 'all_pages',
        enabled: Boolean(featureFlags[flagKey]),
        config: configMap[flagKey] || {},
        implementedAt: rec.implementedAt,
      }
    })

    let filtered = ideas
    if (onlyEnabled) filtered = filtered.filter((i) => i.enabled)
    if (scope === 'all_pages') filtered = filtered.filter((i) => i.scope === 'all_pages')
    if (tab) filtered = filtered.filter((i) => i.tab === tab)

    const byTab: Record<string, ActiveIdea[]> = {}
    for (const i of filtered) {
      if (!byTab[i.tab]) byTab[i.tab] = []
      byTab[i.tab].push(i)
    }

    return NextResponse.json({ success: true, ideas: filtered, byTab })
  } catch (error) {
    console.error('Error listing active ideas:', error)
    return NextResponse.json({ error: 'Failed to list active ideas' }, { status: 500 })
  }
}
