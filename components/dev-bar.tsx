"use client"

import { useEffect, useState } from "react"

const DEFAULT_VERSION = "1.0.0"

let cachedVersion: string | null = null
let inflight: Promise<string> | null = null

export function setCachedVersion(v: string) {
  cachedVersion = v
}

function fetchVersion(): Promise<string> {
  if (cachedVersion) return Promise.resolve(cachedVersion)
  if (inflight) return inflight
  inflight = fetch("/api/settings?key=system_version")
    .then(r => r.json())
    .then(d => {
      const v = d?.value ? String(d.value) : DEFAULT_VERSION
      cachedVersion = v
      return v
    })
    .catch(() => DEFAULT_VERSION)
    .finally(() => { inflight = null })
  return inflight
}

export function DevBar() {
  const [version, setVersion] = useState<string>(cachedVersion || DEFAULT_VERSION)

  useEffect(() => {
    let cancelled = false
    fetchVersion().then(v => { if (!cancelled) setVersion(v) })
    return () => { cancelled = true }
  }, [])

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(90deg, #050505 0%, #0a0a0c 30%, #0d0d10 50%, #0a0a0c 70%, #050505 100%)",
        padding: "10px 0",
      }}
    >
      {/* Top champagne hairline */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(212,175,98,0.0) 8%, rgba(212,175,98,0.45) 38%, rgba(244,219,156,0.85) 50%, rgba(212,175,98,0.45) 62%, rgba(212,175,98,0.0) 92%, transparent 100%)",
        }}
      />

      {/* Subtle warm vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 120% at 50% 0%, rgba(212,175,98,0.08), transparent 70%)",
        }}
      />

      {/* Content */}
      <div
        className="relative flex items-center justify-center gap-3 px-4"
        dir="ltr"
      >
        {/* Version badge — minimal pearl */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[8.5px] font-semibold tabular-nums"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
            border: "1px solid rgba(212,175,98,0.22)",
            color: "rgba(244,219,156,0.85)",
            letterSpacing: "0.08em",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 8px rgba(212,175,98,0.06)",
          }}
        >
          <span
            className="inline-block h-[5px] w-[5px] rounded-full"
            style={{
              background: "#86efac",
              boxShadow: "0 0 5px #86efac, 0 0 10px rgba(134,239,172,0.5)",
            }}
          />
          v{version}
        </span>

        {/* Left ornament — diamond */}
        <span aria-hidden className="hidden sm:flex items-center gap-2">
          <span
            className="h-px w-10"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(212,175,98,0.45))",
            }}
          />
          <span
            className="h-1 w-1 rotate-45"
            style={{
              background:
                "linear-gradient(135deg, #f4db9c, #b8893f)",
              boxShadow: "0 0 6px rgba(244,219,156,0.5)",
            }}
          />
        </span>

        {/* DEVELOPED BY tag */}
        <span
          style={{
            fontSize: "8px",
            letterSpacing: "0.42em",
            fontWeight: 500,
            color: "rgba(180,160,120,0.55)",
            fontFamily:
              'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            textTransform: "uppercase",
          }}
        >
          Designed &amp; Developed by
        </span>

        {/* Name — champagne gold metallic */}
        <span
          className="relative"
          style={{
            fontSize: "12px",
            letterSpacing: "0.34em",
            fontWeight: 700,
            background:
              "linear-gradient(180deg, #fff5d6 0%, #f4db9c 35%, #d4af62 70%, #b8893f 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "0 0 14px rgba(212,175,98,0.25)",
            textTransform: "uppercase",
            paddingRight: "0.34em",
          }}
        >
          Basem Samir Ebeid
        </span>

        {/* Right ornament — diamond */}
        <span aria-hidden className="hidden sm:flex items-center gap-2">
          <span
            className="h-1 w-1 rotate-45"
            style={{
              background:
                "linear-gradient(135deg, #f4db9c, #b8893f)",
              boxShadow: "0 0 6px rgba(244,219,156,0.5)",
            }}
          />
          <span
            className="h-px w-10"
            style={{
              background:
                "linear-gradient(90deg, rgba(212,175,98,0.45), transparent)",
            }}
          />
        </span>

        {/* Monogram crest */}
        <span
          className="hidden sm:inline-flex items-center justify-center rounded-[4px]"
          style={{
            width: "18px",
            height: "18px",
            background:
              "linear-gradient(180deg, rgba(244,219,156,0.12) 0%, rgba(184,137,63,0.06) 100%)",
            border: "1px solid rgba(212,175,98,0.35)",
            color: "#f4db9c",
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 10px rgba(212,175,98,0.12)",
          }}
        >
          BSE
        </span>
      </div>

      {/* Bottom hairline — finer */}
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(212,175,98,0.18) 35%, rgba(212,175,98,0.18) 65%, transparent 100%)",
        }}
      />
    </div>
  )
}

export default DevBar
