import { NextResponse } from 'next/server'
import { updatePurchaseOrderStatus, receivePurchaseOrder, deletePurchaseOrder } from '@/lib/inventory-engine'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  if (body.action === 'receive') {
    const r = await receivePurchaseOrder(id, body.receipts || [], body.user_name)
    return NextResponse.json(r)
  }
  const r = await updatePurchaseOrderStatus(id, body.status)
  return NextResponse.json(r)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deletePurchaseOrder(id)
  return NextResponse.json({ ok: true })
}
