import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEFAULT_LOGO_PATH = '/images/sipflow-logo.png'

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url)
    const requestedSize = searchParams.get('size')
    const size = requestedSize ? Math.min(Math.max(parseInt(requestedSize, 10) || 0, 16), 1024) : 0

    let logoUrl: string | null = null
    try {
      logoUrl = (await db.getSetting('system_logo_url')) as string | null
    } catch {
      logoUrl = null
    }

    const resolved = logoUrl && logoUrl.trim().length > 0 ? logoUrl.trim() : DEFAULT_LOGO_PATH
    const absoluteUrl = resolved.startsWith('http') ? resolved : `${origin}${resolved}`

    const upstream = await fetch(absoluteUrl, { cache: 'no-store' })
    if (!upstream.ok) {
      return NextResponse.json({ error: 'logo fetch failed' }, { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') || 'image/png'
    let buffer = Buffer.from(await upstream.arrayBuffer())

    if (size > 0) {
      try {
        const sharp = (await import('sharp')).default
        buffer = await sharp(buffer)
          .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png()
          .toBuffer()
      } catch {
        // sharp not available — return original
      }
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': size > 0 ? 'image/png' : contentType,
        'Cache-Control': 'public, max-age=300, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Error serving logo:', error)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
