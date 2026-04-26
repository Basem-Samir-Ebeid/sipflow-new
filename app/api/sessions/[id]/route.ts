import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'معرّف الجلسة مفقود' }, { status: 400 })
    }
    // Basic UUID shape check to avoid 22P02 (invalid_text_representation) Postgres errors
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRe.test(id)) {
      return NextResponse.json({ error: 'معرّف الجلسة غير صحيح' }, { status: 400 })
    }
    await db.deleteSession(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[v0] Error deleting session:', msg)
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 })
  }
}
