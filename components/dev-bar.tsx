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
          "linear-gradient(90deg, #05060d 0%, #0a0b1a 22%, #131330 50%, #0a0b1a 78%, #05060d 100%)",
        padding: "9px 0",
      }}
    >
      {/* Top hairline */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.55) 18%, rgba(168,85,247,0.85) 50%, rgba(6,182,212,0.55) 82%, transparent 100%)",
        }}
      />

      {/* Soft inner glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(139,92,246,0.18), transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative flex items-center justify-center gap-2.5 px-3" dir="ltr">
        {/* Left ornament */}
        <span
          aria-hidden
          className="hidden sm:inline-block h-px w-8"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(167,139,250,0.55))",
          }}
        />

        {/* Version pill */}
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[9px] font-bold tabular-nums"
          style={{
            background:
              "linear-gradient(135deg, rgba(34,211,238,0.14), rgba(99,102,241,0.14))",
            border: "1px solid rgba(99,102,241,0.3)",
            color: "#a5b4fc",
            letterSpacing: "0.04em",
            boxShadow: "0 0 12px rgba(99,102,241,0.18) inset",
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: "#34d399",
              boxShadow: "0 0 6px #34d399, 0 0 10px rgba(52,211,153,0.4)",
            }}
          />
          v{version}
        </span>

        {/* DEVELOPED BY tag */}
        <span
          style={{
            fontSize: "8.5px",
            letterSpacing: "0.32em",
            fontWeight: 600,
            color: "rgba(148,163,184,0.45)",
            fontFamily:
              'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            textTransform: "uppercase",
          }}
        >
          Developed by
        </span>

        {/* Name — premium metallic violet */}
        <span
          style={{
            fontSize: "11.5px",
            letterSpacing: "0.18em",
            fontWeight: 800,
            background:
              "linear-gradient(180deg, #ede9fe 0%, #c4b5fd 45%, #a78bfa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "0 0 18px rgba(167,139,250,0.45)",
            textTransform: "uppercase",
          }}
        >
          Basem Samir Ebeid
        </span>

        {/* Right ornament */}
        <span
          aria-hidden
          className="hidden sm:inline-block h-px w-8"
          style={{
            background:
              "linear-gradient(90deg, rgba(167,139,250,0.55), transparent)",
          }}
        />
      </div>

      {/* Bottom hairline */}
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.32) 30%, rgba(99,102,241,0.32) 70%, transparent 100%)",
        }}
      />
    </div>
  )
}

export default DevBar
