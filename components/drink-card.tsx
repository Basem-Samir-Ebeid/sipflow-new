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
    <div className={`relative flex flex-col items-center rounded-2xl border border-border bg-card p-4 shadow-sm ${isOutOfStock ? 'opacity-60' : ''}`}>
      {/* Out of Stock Overlay */}
      {isOutOfStock && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-background/80 backdrop-blur-sm">
          <PackageX className="mb-2 h-10 w-10 text-destructive" />
          <span className="text-sm font-bold text-destructive">Out of Stock</span>
        </div>
      )}

      {/* Ribbon Label */}
      <div className="absolute -right-1 top-3 z-10">
        <div className="relative">
          <div className={`rounded-r-none rounded-l-md px-2 py-0.5 text-xs font-medium text-white shadow-sm ${isOutOfStock ? 'bg-gray-400' : 'bg-green-500'}`}>
            {drink.name}
          </div>
          <div className={`absolute -bottom-1 right-0 h-0 w-0 border-l-[4px] border-t-[4px] border-l-transparent ${isOutOfStock ? 'border-t-gray-600' : 'border-t-green-700'}`}></div>
        </div>
      </div>

      {/* Image */}
      <div className="relative mb-3 mt-4 h-20 w-20 overflow-hidden rounded-full bg-muted">
        {drink.image_url ? (
          <Image
            src={drink.image_url}
            alt={drink.name}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20H7a2 2 0 01-2-2V8a2 2 0 012-2h2l1-2h4l1 2h2a2 2 0 012 2v10a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Name */}
      <h3 className="mb-1 text-center text-base font-bold text-foreground">
        {drink.name}
      </h3>

      {/* Price */}
      {drink.price > 0 && (
        <p className="mb-3 text-sm text-primary">{drink.price} ج.م</p>
      )}

      {/* Controls */}
      <div className="flex w-full items-center justify-between rounded-xl bg-muted p-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
          onClick={onRemove}
          disabled={quantity === 0 || isOutOfStock}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="min-w-[2rem] text-center text-lg font-bold text-foreground">{quantity}</span>
        <Button
          size="icon"
          className="h-9 w-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          onClick={onAdd}
          disabled={isOutOfStock}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Note Button - visible when item is added to cart */}
      {quantity > 0 && (
        <div className="mt-2 w-full">
          <button
            onClick={() => setShowNote(v => !v)}
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs transition-colors ${
              note.trim()
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {note.trim() ? 'عدّل الملاحظة' : 'إضافة ملاحظة'}
          </button>
          {showNote && (
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="مثلاً: سكر أقل، بارد..."
              rows={2}
              autoFocus
              className="mt-1.5 w-full resize-none rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          )}
        </div>
      )}
    </div>
  )
}
