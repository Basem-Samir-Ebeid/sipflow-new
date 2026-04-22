// Unit conversion utilities for ingredient inventory
// Base units: g (mass), ml (volume), piece (count)

export type BaseUnit = 'g' | 'ml' | 'piece'
export type DisplayUnit = 'g' | 'kg' | 'ml' | 'l' | 'piece'

const TO_BASE: Record<string, { base: BaseUnit; factor: number }> = {
  g: { base: 'g', factor: 1 },
  gram: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  kilo: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  L: { base: 'ml', factor: 1000 },
  litre: { base: 'ml', factor: 1000 },
  liter: { base: 'ml', factor: 1000 },
  piece: { base: 'piece', factor: 1 },
  pcs: { base: 'piece', factor: 1 },
  unit: { base: 'piece', factor: 1 },
}

export function normalizeUnit(unit: string): { base: BaseUnit; factor: number } {
  const u = (unit || '').toLowerCase().trim()
  return TO_BASE[u] || TO_BASE[unit] || { base: 'g', factor: 1 }
}

/** Convert any quantity in any unit to the ingredient's base unit. */
export function toBase(qty: number, unit: string): { qty: number; base: BaseUnit } {
  const n = normalizeUnit(unit)
  return { qty: qty * n.factor, base: n.base }
}

/** Format a quantity in the ingredient's base unit nicely (auto kg/L when large). */
export function formatStock(qty: number, baseUnit: string): string {
  const u = (baseUnit || '').toLowerCase()
  const q = Number(qty) || 0
  if (u === 'g') {
    if (Math.abs(q) >= 1000) return `${(q / 1000).toFixed(2)} كجم`
    return `${q.toFixed(0)} جم`
  }
  if (u === 'ml') {
    if (Math.abs(q) >= 1000) return `${(q / 1000).toFixed(2)} لتر`
    return `${q.toFixed(0)} مل`
  }
  return `${q.toFixed(0)} قطعة`
}

export const UNIT_OPTIONS: { value: string; label: string; baseHint: BaseUnit }[] = [
  { value: 'g', label: 'جرام (g)', baseHint: 'g' },
  { value: 'kg', label: 'كيلو (kg)', baseHint: 'g' },
  { value: 'ml', label: 'مل (ml)', baseHint: 'ml' },
  { value: 'l', label: 'لتر (L)', baseHint: 'ml' },
  { value: 'piece', label: 'قطعة', baseHint: 'piece' },
]

export const CATEGORY_OPTIONS = [
  { value: 'coffee', label: 'بُن وقهوة', icon: '☕' },
  { value: 'milk', label: 'حليب ومنتجات ألبان', icon: '🥛' },
  { value: 'sweetener', label: 'محليات وسكر', icon: '🍬' },
  { value: 'syrup', label: 'شراب نكهات', icon: '🧴' },
  { value: 'cup', label: 'أكواب وأغطية', icon: '🥤' },
  { value: 'addon', label: 'إضافات', icon: '✨' },
  { value: 'tea', label: 'شاي وأعشاب', icon: '🍵' },
  { value: 'food', label: 'طعام ومخبوزات', icon: '🥐' },
  { value: 'other', label: 'أخرى', icon: '📦' },
]
