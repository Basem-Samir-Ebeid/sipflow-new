'use client'
import { useEffect } from 'react'

export const THEME_VAR_KEYS = [
  'primary',
  'accent',
  'background',
  'card',
  'foreground',
  'border',
  'muted',
  'ring',
  'destructive',
] as const

export type ThemeVarKey = typeof THEME_VAR_KEYS[number]
export type ThemeColors = Partial<Record<ThemeVarKey, string>>

export const THEME_STORAGE_KEY = 'ui_theme_colors'
export const THEME_EVENT = 'ui-theme-colors-changed'

export function applyThemeColors(theme: ThemeColors) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  THEME_VAR_KEYS.forEach(k => {
    const v = theme[k]
    if (v && typeof v === 'string') {
      root.style.setProperty(`--${k}`, v)
    } else {
      root.style.removeProperty(`--${k}`)
    }
  })
}

export function emitThemeChange(theme: ThemeColors) {
  applyThemeColors(theme)
  try { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme)) } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }))
}

export function ThemeApplier() {
  useEffect(() => {
    try {
      const cached = localStorage.getItem(THEME_STORAGE_KEY)
      if (cached) applyThemeColors(JSON.parse(cached) as ThemeColors)
    } catch { /* ignore */ }

    fetch('/api/settings?key=' + THEME_STORAGE_KEY)
      .then(r => r.json())
      .then(d => {
        if (d?.value) {
          try {
            const theme = JSON.parse(d.value) as ThemeColors
            localStorage.setItem(THEME_STORAGE_KEY, d.value)
            applyThemeColors(theme)
          } catch { /* ignore */ }
        }
      })
      .catch(() => {})

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ThemeColors>).detail
      if (detail) applyThemeColors(detail)
    }
    window.addEventListener(THEME_EVENT, handler)
    return () => window.removeEventListener(THEME_EVENT, handler)
  }, [])

  return null
}
