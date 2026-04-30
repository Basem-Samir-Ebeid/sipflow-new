'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useAnimationControls } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ShoppingBag, ChevronUp, Plus, Minus, MapPin, X, Loader2 } from 'lucide-react'
import Image from 'next/image'
import type { Drink } from '@/lib/types'

interface FloatingCartProps {
  cart: Record<string, number>
  drinks: Drink[]
  cartCount: number
  cartTotal: number
  tableNumber?: string
  onAdd: (drinkId: string) => void
  onRemove: (drinkId: string) => void
  onSubmit: () => void
  isSubmitting?: boolean
  disabled?: boolean
  disabledLabel?: string
  freeDrinkId?: string | null
  freeDrinksLeft?: number
  submitSuccessKey?: number
}

const CONFETTI_COLORS = ['#fbbf24', '#D4A017', '#f59e0b', '#fde68a', '#10b981', '#ef4444', '#ffffff']

function ConfettiBurst({ burstId }: { burstId: number }) {
  const particles = Array.from({ length: 36 }, (_, i) => {
    const angle = (Math.PI * (i / 36)) + (Math.random() * 0.4 - 0.2)
    const distance = 140 + Math.random() * 180
    const x = Math.cos(angle) * distance * (Math.random() > 0.5 ? 1 : -1)
    const y = -Math.sin(angle) * distance - Math.random() * 80
    return {
      id: i,
      x,
      y,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 8,
      rotate: Math.random() * 720 - 360,
      delay: Math.random() * 0.08,
      duration: 1.1 + Math.random() * 0.6,
      shape: i % 3,
    }
  })
  return (
    <div
      key={burstId}
      className="pointer-events-none fixed bottom-12 left-1/2 z-[60] -translate-x-1/2"
      aria-hidden="true"
    >
      {particles.map(p => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: p.x,
            y: [0, p.y * 0.6, p.y + 200],
            scale: [0, 1, 1, 0.85],
            opacity: [1, 1, 1, 0],
            rotate: p.rotate,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeOut',
            times: [0, 0.25, 0.7, 1],
          }}
          className="absolute"
          style={{
            width: p.size,
            height: p.shape === 0 ? p.size : p.size * 0.45,
            background: p.color,
            borderRadius: p.shape === 1 ? '50%' : '2px',
            boxShadow: `0 0 8px ${p.color}66`,
          }}
        />
      ))}
    </div>
  )
}

export function FloatingCart({
  cart,
  drinks,
  cartCount,
  cartTotal,
  tableNumber,
  onAdd,
  onRemove,
  onSubmit,
  isSubmitting = false,
  disabled = false,
  disabledLabel,
  freeDrinkId = null,
  freeDrinksLeft = 0,
  submitSuccessKey = 0,
}: FloatingCartProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [pulseKey, setPulseKey] = useState(0)
  const [displayTotal, setDisplayTotal] = useState(cartTotal)
  const [lastAddedName, setLastAddedName] = useState<string>('')
  const [confettiKey, setConfettiKey] = useState(0)
  const prevSuccessKeyRef = useRef(submitSuccessKey)
  const prevCountRef = useRef(cartCount)
  const prevCartRef = useRef(cart)

  // Idle-nudge: gentle shake to remind the user when the order sits unconfirmed
  const nudgeControls = useAnimationControls()

  useEffect(() => {
    if (cartCount === 0 || isOpen || isSubmitting || disabled) {
      nudgeControls.stop()
      nudgeControls.set({ x: 0, rotate: 0 })
      return
    }
    const playNudge = () => {
      nudgeControls.start({
        x: [0, -5, 5, -4, 4, -2, 2, 0],
        rotate: [0, -2.2, 2.2, -1.6, 1.6, -1, 1, 0],
        transition: { duration: 0.75, ease: 'easeInOut' },
      })
    }
    const firstTimer = setTimeout(() => {
      playNudge()
    }, 12000)
    const repeatTimer = setInterval(() => {
      playNudge()
    }, 22000)
    return () => {
      clearTimeout(firstTimer)
      clearInterval(repeatTimer)
    }
  }, [cartCount, cart, isOpen, isSubmitting, disabled, nudgeControls])

  // Scroll-reactive motion: tilt + bob in response to scroll velocity
  const scrollVelocity = useMotionValue(0)
  const smoothedVelocity = useSpring(scrollVelocity, { stiffness: 220, damping: 22, mass: 0.5 })
  const tilt = useTransform(smoothedVelocity, [-60, 0, 60], [-9, 0, 9])
  const bob = useTransform(smoothedVelocity, [-60, 0, 60], [-7, 0, 7])
  const lastScrollYRef = useRef(0)
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    lastScrollYRef.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - lastScrollYRef.current
      lastScrollYRef.current = y
      const clamped = Math.max(-60, Math.min(60, dy))
      scrollVelocity.set(clamped)
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current)
      scrollIdleTimerRef.current = setTimeout(() => scrollVelocity.set(0), 110)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current)
    }
  }, [scrollVelocity])

  useEffect(() => {
    if (submitSuccessKey > prevSuccessKeyRef.current) {
      setConfettiKey(k => k + 1)
      setIsOpen(false)
    }
    prevSuccessKeyRef.current = submitSuccessKey
  }, [submitSuccessKey])

  useEffect(() => {
    if (cartCount > prevCountRef.current) {
      setPulseKey(k => k + 1)
      const addedId = Object.entries(cart).find(([id, q]) => q > (prevCartRef.current[id] || 0))?.[0]
      if (addedId) {
        const d = drinks.find(x => x.id === addedId)
        if (d) setLastAddedName(d.name)
      }
    }
    if (cartCount === 0) setIsOpen(false)
    prevCountRef.current = cartCount
    prevCartRef.current = cart
  }, [cartCount, cart, drinks])

  useEffect(() => {
    const start = displayTotal
    const end = cartTotal
    if (Math.abs(start - end) < 0.01) return
    const duration = 380
    const startTime = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayTotal(start + (end - start) * eased)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [cartTotal])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        return
      }
      if ((e.key === 'c' || e.key === 'C') && cartCount > 0) {
        setIsOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cartCount, isOpen])

  const items = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => {
      const drink = drinks.find(d => d.id === id)
      return drink ? { drink, qty } : null
    })
    .filter(Boolean) as { drink: Drink; qty: number }[]

  const goldGradient = 'linear-gradient(135deg, #D4A017, #b8860b)'
  const darkBg = 'linear-gradient(135deg, #1a0d00, #0f0800)'

  return (
    <>
      <span className="sr-only" aria-live="polite">
        {lastAddedName ? `تمت إضافة ${lastAddedName}، الإجمالي ${cartTotal.toFixed(2)} جنيه` : ''}
      </span>

      {confettiKey > 0 && <ConfettiBurst burstId={confettiKey} />}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            key="floating-cart"
            initial={{ y: 120, opacity: 0 }}
            animate={{
              opacity: 1,
              y: [0, -8, 0, -4, 0],
              x: [0, 2, 0, -2, 0],
            }}
            exit={{ y: 120, opacity: 0 }}
            transition={{
              opacity: { duration: 0.3 },
              y: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
              x: { duration: 5.6, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="fixed left-1/2 z-50 w-[calc(100%-1rem)] max-w-md -translate-x-1/2 px-1"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
            dir="rtl"
          >
            <AnimatePresence mode="wait" initial={false}>
              {isOpen ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.96, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 14 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden rounded-2xl"
                  style={{
                    background: darkBg,
                    border: '1px solid rgba(212,160,23,0.28)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.4)',
                  }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: '1px solid rgba(212,160,23,0.15)' }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ background: goldGradient }}
                      >
                        <ShoppingBag className="h-4 w-4 text-black" />
                      </div>
                      <div className="leading-tight">
                        <div className="text-sm font-bold text-white">طلبك</div>
                        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {cartCount} صنف
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tableNumber && (
                        <div
                          className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
                          style={{
                            background: 'rgba(212,160,23,0.12)',
                            color: '#fbbf24',
                            border: '1px solid rgba(212,160,23,0.25)',
                          }}
                        >
                          <MapPin className="h-3 w-3" />
                          طاولة {tableNumber}
                        </div>
                      )}
                      <button
                        onClick={() => setIsOpen(false)}
                        aria-label="إغلاق المعاينة"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/5 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[44vh] overflow-y-auto px-3 py-2">
                    <ul className="space-y-2">
                      {items.slice().reverse().map(({ drink, qty }) => {
                        const price = Number(drink.price) || 0
                        const isFree = freeDrinkId === drink.id && freeDrinksLeft > 0
                        const subtotal = price * qty
                        return (
                          <motion.li
                            key={drink.id}
                            layout
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.18 }}
                            className="flex items-center gap-3 rounded-xl p-2"
                            style={{
                              background: 'rgba(255,255,255,0.025)',
                              border: '1px solid rgba(255,255,255,0.04)',
                            }}
                          >
                            <div
                              className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                              style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(212,160,23,0.18)',
                              }}
                            >
                              {drink.image_url ? (
                                <Image src={drink.image_url} alt={drink.name} fill sizes="48px" className="object-cover" />
                              ) : (
                                <span className="text-lg">☕</span>
                              )}
                              {isFree && (
                                <span className="absolute right-0 top-0 rounded-bl-lg bg-emerald-500/90 px-1 text-[8px] font-bold text-black">
                                  🎁
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-bold text-white">{drink.name}</div>
                              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                {price > 0 ? `${price.toFixed(2)} ج.م × ${qty}` : 'مجاني'}
                              </div>
                            </div>

                            <div
                              className="flex items-center gap-1 rounded-lg p-0.5"
                              style={{ background: 'rgba(255,255,255,0.04)' }}
                            >
                              <button
                                aria-label={`أضف ${drink.name}`}
                                onClick={() => onAdd(drink.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-black transition active:scale-90"
                                style={{ background: '#fbbf24' }}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                              <span className="min-w-[1.25rem] text-center text-xs font-bold text-amber-300">
                                {qty}
                              </span>
                              <button
                                aria-label={`أزل ${drink.name}`}
                                onClick={() => onRemove(drink.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 transition hover:bg-white/5 hover:text-white active:scale-90"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {price > 0 && (
                              <div className="min-w-[3.25rem] shrink-0 text-left text-[11px] font-bold tabular-nums text-amber-400">
                                {subtotal.toFixed(2)}
                              </div>
                            )}
                          </motion.li>
                        )
                      })}
                    </ul>
                  </div>

                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderTop: '1px solid rgba(212,160,23,0.15)' }}
                  >
                    <div className="leading-tight">
                      <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        الإجمالي
                      </div>
                      <div className="text-lg font-bold tabular-nums text-amber-300">
                        {displayTotal.toFixed(2)} ج.م
                      </div>
                    </div>
                    <Button
                      className="h-11 rounded-xl px-6 text-sm font-bold"
                      style={{ background: goldGradient, color: '#0a0500' }}
                      onClick={onSubmit}
                      disabled={disabled || isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          جاري الإرسال...
                        </>
                      ) : disabled && disabledLabel ? (
                        disabledLabel
                      ) : (
                        'تأكيد الطلب'
                      )}
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="pill"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                  className="relative"
                  style={{ rotate: tilt, y: bob, transformOrigin: '50% 100%', willChange: 'transform' }}
                >
                  <motion.span
                    key={pulseKey}
                    initial={{ opacity: 0.6, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.25 }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    style={{
                      background: 'radial-gradient(circle, rgba(251,191,36,0.55) 0%, transparent 70%)',
                    }}
                  />
                  <motion.div
                    animate={nudgeControls}
                    className="relative flex items-stretch gap-1 rounded-2xl p-1"
                    style={{
                      background: darkBg,
                      border: '1px solid rgba(212,160,23,0.32)',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.55), 0 0 24px rgba(212,160,23,0.08)',
                      transformOrigin: '50% 100%',
                    }}
                  >
                    <button
                      onClick={() => setIsOpen(true)}
                      aria-label={`اعرض الطلب — ${cartCount} صنف، الإجمالي ${cartTotal.toFixed(2)} جنيه`}
                      aria-expanded={isOpen}
                      aria-keyshortcuts="C"
                      className="group flex flex-1 items-center gap-3 rounded-xl px-3 py-2 text-right transition hover:bg-white/5"
                    >
                      <div className="relative">
                        <motion.div
                          key={`bag-${pulseKey}`}
                          initial={{ scale: 1 }}
                          animate={{ scale: [1, 1.18, 1] }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-black"
                          style={{ background: goldGradient }}
                        >
                          <ShoppingBag className="h-5 w-5" />
                        </motion.div>
                        <motion.span
                          key={`badge-${pulseKey}`}
                          initial={{ scale: 0.6 }}
                          animate={{ scale: [0.6, 1.25, 1] }}
                          transition={{ duration: 0.4, ease: 'easeOut' }}
                          className="absolute -left-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-white tabular-nums"
                          style={{
                            background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                            border: '1.5px solid #0f0800',
                            boxShadow: '0 0 10px rgba(239,68,68,0.5)',
                          }}
                          aria-hidden="true"
                        >
                          {cartCount}
                        </motion.span>
                      </div>

                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
                            طلبك
                          </span>
                          {tableNumber && (
                            <span
                              className="flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-bold"
                              style={{
                                background: 'rgba(212,160,23,0.14)',
                                color: '#fbbf24',
                              }}
                            >
                              <MapPin className="h-2.5 w-2.5" />
                              {tableNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-extrabold tabular-nums text-amber-300">
                          {displayTotal.toFixed(2)} ج.م
                        </div>
                      </div>

                      <ChevronUp className="h-4 w-4 text-white/40 transition group-hover:text-white/70" />
                    </button>

                    <div className="relative">
                      {!disabled && !isSubmitting && (
                        <motion.span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-xl"
                          style={{ background: goldGradient }}
                          animate={{ opacity: [0.55, 0, 0.55], scale: [1, 1.18, 1] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                      <Button
                        className="relative h-auto min-h-[3rem] rounded-xl px-5 text-sm font-extrabold tracking-wide"
                        style={{
                          background: goldGradient,
                          color: '#0a0500',
                          boxShadow: '0 6px 18px rgba(212,160,23,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
                        }}
                        onClick={onSubmit}
                        disabled={disabled || isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : disabled && disabledLabel ? (
                          <span className="text-[11px]">{disabledLabel}</span>
                        ) : (
                          'تأكيد الطلب'
                        )}
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
