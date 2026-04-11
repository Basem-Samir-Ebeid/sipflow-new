'use client'

import { Drink } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Plus, Minus, PackageX, MessageSquare } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'

interface DrinkCardProps {
  drink: Drink
  quantity: number
  stock: number
  note: string
  onAdd: () => void
  onRemove: () => void
  onNoteChange: (note: string) => void
}

export function DrinkCard({ drink, quantity, stock, note, onAdd, onRemove, onNoteChange }: DrinkCardProps) {
  const isOutOfStock = stock <= 0
  const [showNote, setShowNote] = useState(false)

  return (
    <div
      className={`relative flex flex-col rounded-2xl overflow-hidden transition-all ${isOutOfStock ? 'opacity-50' : ''} ${quantity > 0 ? 'ring-1 ring-amber-500/30' : ''}`}
      style={{
        background: 'linear-gradient(160deg, #141210, #1a1714)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {isOutOfStock && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-black/70 backdrop-blur-sm">
          <PackageX className="mb-2 h-8 w-8" style={{ color: '#f87171' }} />
          <span className="text-xs font-bold" style={{ color: '#f87171' }}>غير متوفر</span>
        </div>
      )}

      <div className="relative px-3 pt-3 pb-2">
        <div className="absolute top-2 right-2 z-10">
          <span
            className="inline-block rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
            style={{ background: isOutOfStock ? '#6b7280' : 'linear-gradient(135deg, #D4A017, #b8860b)' }}
          >
            {drink.name}
          </span>
        </div>

        <div className="mx-auto mt-3 mb-1 flex h-[72px] w-[72px] items-center justify-center">
          {drink.image_url ? (
            <div className="relative h-[72px] w-[72px] rounded-full overflow-hidden" style={{ border: '2px solid rgba(212,160,23,0.2)' }}>
              <Image
                src={drink.image_url}
                alt={drink.name}
                fill
                className="object-cover"
                sizes="72px"
              />
            </div>
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.06)' }}>
              <span className="text-2xl">☕</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pb-1 text-center">
        <h3 className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {drink.name}
        </h3>
        {Number(drink.price) > 0 && (
          <p className="text-xs font-semibold mt-0.5" style={{ color: '#D4A017' }}>{Number(drink.price).toFixed(2)} ج.م</p>
        )}
      </div>

      <div className="px-3 pb-3 pt-2 mt-auto">
        <div className="flex items-center justify-between rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <Button
            size="icon"
            className="h-8 w-8 rounded-lg bg-amber-500/90 text-black hover:bg-amber-500 disabled:opacity-30 disabled:bg-transparent disabled:text-white/30"
            onClick={onAdd}
            disabled={isOutOfStock}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[2rem] text-center text-base font-bold" style={{ color: quantity > 0 ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>{quantity}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-white/40 hover:bg-white/5 hover:text-white/70 disabled:opacity-20"
            onClick={onRemove}
            disabled={quantity === 0 || isOutOfStock}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {quantity > 0 && (
          <div className="mt-1.5">
            <button
              onClick={() => setShowNote(v => !v)}
              className="flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[11px] transition-colors"
              style={{ color: note.trim() ? '#D4A017' : 'rgba(255,255,255,0.35)' }}
            >
              <MessageSquare className="h-3 w-3" />
              {note.trim() ? 'عدّل الملاحظة' : 'ملاحظة'}
            </button>
            {showNote && (
              <textarea
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="سكر أقل، بارد..."
                rows={2}
                autoFocus
                className="mt-1 w-full resize-none rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
