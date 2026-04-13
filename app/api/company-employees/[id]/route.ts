import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const employee = await db.updateCompanyEmployee(id, body)
    return NextResponse.json(employee)
  } catch (error) {
    console.error('Error updating company employee:', error)
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.deleteCompanyEmployee(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting company employee:', error)
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
  }
}
