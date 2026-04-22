import { NextResponse } from 'next/server'
import { updateSupplier, deleteSupplier } from '@/lib/inventory-engine'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const updated = await updateSupplier(id, body)
  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteSupplier(id)
  return NextResponse.json({ ok: true })
}
