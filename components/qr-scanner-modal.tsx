'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ScanLine, Camera, Loader2, AlertTriangle, Keyboard } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface QrScannerModalProps {
  open: boolean
  onClose: () => void
  onResult: (text: string) => void
  lang?: 'ar' | 'en'
}

const T = {
  ar: {
    title: 'امسح كود الطاولة',
    subtitle: 'QR من باركود الطاولة',
    cameraError: 'تعذّر فتح الكاميرا. تأكد من السماح بإذن الكاميرا.',
    manualLabel: 'أدخل كود المكان أو الصق رابط الـ QR',
    manualPlaceholder: 'مثلاً: CAFE01 أو رابط الـ QR',
    submit: 'دخول',
    switchToManual: 'أو أدخل الكود يدوياً',
  },
  en: {
    title: 'Scan table QR',
    subtitle: 'QR from the table barcode',
    cameraError: "Couldn't open the camera. Please allow camera access.",
    manualLabel: 'Enter the place code or paste the QR link',
    manualPlaceholder: 'e.g. CAFE01 or a QR link',
    submit: 'Enter',
    switchToManual: 'Or enter the code manually',
  },
} as const

export function QrScannerModal({ open, onClose, onResult, lang = 'ar' }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [manualValue, setManualValue] = useState('')

  const t = T[lang]

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const stop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }

    const start = async () => {
      setError('')
      const BD: any = (window as any).BarcodeDetector
      if (!BD) {
        setSupported(false)
        setManualMode(true)
        return
      }
      try {
        const formats = await BD.getSupportedFormats?.()
        if (Array.isArray(formats) && !formats.includes('qr_code')) {
          setSupported(false)
          setManualMode(true)
          return
        }
      } catch {}
      setSupported(true)
      setStarting(true)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        detectorRef.current = new BD({ formats: ['qr_code'] })
        const tick = async () => {
          if (cancelled || !videoRef.current || !detectorRef.current) return
          try {
            const codes = await detectorRef.current.detect(videoRef.current)
            if (codes && codes.length > 0) {
              const raw = codes[0].rawValue || ''
              if (raw) {
                stop()
                onResult(raw)
                return
              }
            }
          } catch {}
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch (e: any) {
        setError(t.cameraError)
        setManualMode(true)
      } finally {
        setStarting(false)
      }
    }

    start()
    return () => {
      cancelled = true
      stop()
    }
  }, [open, onResult, t.cameraError])

  if (!open) return null

  const handleManualSubmit = () => {
    const v = manualValue.trim()
    if (!v) return
    onResult(v)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, #0c0905 0%, #1a1308 60%, #0a0805 100%)',
          border: '1px solid rgba(212,175,98,0.4)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(184,137,63,0.18)',
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(244,219,156,0.6), transparent)' }} />

        <div className="flex items-center justify-between border-b border-amber-500/15 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(184,137,63,0.25), rgba(244,219,156,0.1))', border: '1px solid rgba(212,175,98,0.45)' }}>
              <ScanLine className="h-4.5 w-4.5 text-[#f4db9c]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{t.title}</h3>
              <p className="text-[10px] text-amber-200/55">{t.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {!manualMode && supported !== false && (
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black" style={{ border: '1px solid rgba(212,175,98,0.25)' }}>
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              {/* Scan frame overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-2/3 w-2/3 rounded-2xl" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}>
                  <span className="absolute -top-px -right-px h-6 w-6 rounded-tr-2xl border-t-2 border-r-2" style={{ borderColor: '#f4db9c' }} />
                  <span className="absolute -top-px -left-px h-6 w-6 rounded-tl-2xl border-t-2 border-l-2" style={{ borderColor: '#f4db9c' }} />
                  <span className="absolute -bottom-px -right-px h-6 w-6 rounded-br-2xl border-b-2 border-r-2" style={{ borderColor: '#f4db9c' }} />
                  <span className="absolute -bottom-px -left-px h-6 w-6 rounded-bl-2xl border-b-2 border-l-2" style={{ borderColor: '#f4db9c' }} />
                  {/* Scanning line */}
                  <span className="absolute left-2 right-2 h-px animate-pulse" style={{ top: '50%', background: 'linear-gradient(90deg, transparent, #f4db9c, transparent)', boxShadow: '0 0 12px #f4db9c' }} />
                </div>
              </div>
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200" style={{ border: '1px solid rgba(244,63,94,0.25)' }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {manualMode && (
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-amber-200/70">
                <Keyboard className="h-3.5 w-3.5" />
                <span>{t.manualLabel}</span>
              </label>
              <Input
                value={manualValue}
                onChange={e => setManualValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                placeholder={t.manualPlaceholder}
                className="bg-zinc-900 text-white placeholder:text-zinc-600"
                style={{ borderColor: 'rgba(212,175,98,0.25)' }}
                autoFocus
              />
              <Button onClick={handleManualSubmit} disabled={!manualValue.trim()} className="w-full bg-amber-500/90 text-black hover:bg-amber-400">
                {t.submit}
              </Button>
            </div>
          )}

          {!manualMode && supported !== false && (
            <button
              onClick={() => setManualMode(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 py-2 text-[11px] font-medium text-white/70 hover:bg-white/10"
            >
              <Keyboard className="h-3.5 w-3.5" />
              {t.switchToManual}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
