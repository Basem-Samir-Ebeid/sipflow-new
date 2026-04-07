import { type NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getSql } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params

  if (!filename || filename.includes('..') || filename.includes('/')) {
    return new NextResponse('Invalid filename', { status: 400 })
  }

  try {
    const sql = getSql()
    const rows = await sql`
      SELECT data, mime_type FROM drink_images WHERE filename = ${filename} LIMIT 1
    `

    if (rows.length > 0) {
      const { data, mime_type } = rows[0]
      const buffer = Buffer.from(data, 'base64')
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mime_type || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }
  } catch {
  }

  try {
    const filePath = join(process.cwd(), 'public', 'images', 'uploads', filename)
    const buffer = await readFile(filePath)
    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }
    const mime = mimeMap[ext || ''] || 'image/jpeg'
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
  }

  return new NextResponse('Image not found', { status: 404 })
}
