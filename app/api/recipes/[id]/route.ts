import { NextResponse } from 'next/server'
import { deleteRecipe } from '@/lib/inventory-engine'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteRecipe(id)
  return NextResponse.json({ ok: true })
}
