'use client'

import { useEffect, useState } from 'react'

const DEFAULT_LOGO = '/images/sipflow-logo.jpg'

export function useSystemLogo(): string {
  const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_LOGO)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/settings?key=system_logo_url', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data?.value && typeof data.value === 'string') {
          setLogoUrl(data.value)
        }
      } catch {
        /* keep default */
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return logoUrl
}
