'use client'

import useSWR from 'swr'

export type ActiveIdea = {
  flagKey: string
  title: string
  tab: string
  tabLabel: string
  scope: 'developer_admin' | 'all_pages'
  enabled: boolean
  config: Record<string, unknown>
  implementedAt?: string
}

type ActiveIdeasResponse = {
  success: boolean
  ideas: ActiveIdea[]
  byTab: Record<string, ActiveIdea[]>
}

const fetcher = async (url: string): Promise<ActiveIdeasResponse> => {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('failed')
  return res.json()
}

export function useActiveIdeas(opts?: { tab?: string; scope?: 'all_pages' | 'developer_admin'; refreshMs?: number }) {
  const params = new URLSearchParams()
  if (opts?.tab) params.set('tab', opts.tab)
  if (opts?.scope) params.set('scope', opts.scope)
  const qs = params.toString()
  const url = `/api/ai-ideas/active${qs ? `?${qs}` : ''}`
  const { data, error, isLoading, mutate } = useSWR<ActiveIdeasResponse>(url, fetcher, {
    refreshInterval: opts?.refreshMs ?? 15000,
    revalidateOnFocus: true,
  })
  return {
    ideas: data?.ideas ?? [],
    byTab: data?.byTab ?? {},
    isLoading,
    error,
    mutate,
  }
}

export function readIdeaConfig<T = unknown>(idea: ActiveIdea | undefined, key: string, fallback: T): T {
  if (!idea) return fallback
  const v = idea.config?.[key]
  if (v === undefined || v === null) return fallback
  return v as T
}
