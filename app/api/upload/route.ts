import { type NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { getSql } from '@/lib/db'

async function ensureImagesTable() {
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS drink_images (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      data TEXT NOT NULL,
      mime_type VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'لم يتم اختيار ملف' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'نوع الملف غير مدعوم. يُسمح فقط بالصور.' }, { status: 400 })
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'حجم الملف كبير جداً. الحد الأقصى 5MB.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const timestamp = Date.now()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filename = `drink-${timestamp}.${ext}`

    await ensureImagesTable()
    const sql = getSql()
    const base64 = buffer.toString('base64')
    await sql`
      INSERT INTO drink_images (filename, data, mime_type)
      VALUES (${filename}, ${base64}, ${file.type})
      ON CONFLICT (filename) DO UPDATE SET data = EXCLUDED.data
    `

    try {
      const uploadsDir = join(process.cwd(), 'public', 'images', 'uploads')
      await mkdir(uploadsDir, { recursive: true })
      await writeFile(join(uploadsDir, filename), buffer)
    } catch {
    }

    const url = `/api/images/${filename}`
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'فشل رفع الصورة' }, { status: 500 })
  }
}
