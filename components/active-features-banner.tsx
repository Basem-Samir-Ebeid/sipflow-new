'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { useActiveIdeas, type ActiveIdea } from '@/lib/use-active-ideas'

type Props = {
  tab?: string
  title?: string
  compact?: boolean
  className?: string
  scope?: 'all_pages' | 'developer_admin'
}

function formatValue(v: unknown): string {
  if (v === true) return 'نعم'
  if (v === false) return 'لا'
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') {
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return String(v)
}

function IdeaCard({ idea }: { idea: ActiveIdea }) {
  const entries = Object.entries(idea.config || {})
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 999,
            background: 'rgba(168,85,247,0.18)',
            color: '#c4b5fd',
            border: '1px solid rgba(168,85,247,0.3)',
          }}
        >
          {idea.tabLabel}
        </span>
        <span style={{ color: '#fafafa', fontSize: 13, fontWeight: 600 }}>{idea.title}</span>
      </div>
      {entries.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
          {entries.map(([k, v]) => (
            <div
              key={k}
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                padding: '6px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span style={{ color: '#a1a1aa', fontSize: 10, direction: 'ltr', textAlign: 'left' }}>{k}</span>
              <span style={{ color: '#e4e4e7', fontSize: 12, fontWeight: 600 }}>{formatValue(v)}</span>
            </div>
          ))}
        </div>
      ) : (
        <span style={{ color: '#71717a', fontSize: 11 }}>الميزة مفعّلة بالإعدادات الافتراضية</span>
      )}
    </div>
  )
}

export function ActiveFeaturesBanner({ tab, title, compact, className, scope = 'all_pages' }: Props) {
  const { ideas, isLoading } = useActiveIdeas({ tab, scope })
  const [open, setOpen] = useState(!compact)

  if (isLoading || ideas.length === 0) return null

  return (
    <div
      className={className}
      style={{
        background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.06))',
        border: '1px solid rgba(168,85,247,0.25)',
        borderRadius: 14,
        padding: 12,
        margin: '12px 0',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          color: '#fafafa',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles className="h-4 w-4" style={{ color: '#c4b5fd' }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            {title || 'الميزات الذكية النشطة'}
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(168,85,247,0.18)',
              color: '#c4b5fd',
              border: '1px solid rgba(168,85,247,0.3)',
            }}
          >
            {ideas.length}
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ideas.map((idea) => (
            <IdeaCard key={idea.flagKey} idea={idea} />
          ))}
        </div>
      )}
    </div>
  )
}
