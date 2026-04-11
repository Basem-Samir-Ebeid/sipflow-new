import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { source_place_id, new_name, new_code } = await request.json()

    if (!source_place_id || !new_name?.trim() || !new_code?.trim()) {
      return NextResponse.json({ error: 'اسم المكان والكود مطلوبان' }, { status: 400 })
    }

    const sql = getSql()

    const sources = await sql`SELECT * FROM places WHERE id = ${source_place_id}`
    if (!sources.length) return NextResponse.json({ error: 'المكان المصدر غير موجود' }, { status: 404 })
    const source = sources[0]

    const existing = await sql`SELECT id FROM places WHERE code = ${new_code.trim().toLowerCase()}`
    if (existing.length) return NextResponse.json({ error: 'هذا الكود مستخدم بالفعل' }, { status: 409 })

    const newPlaces = await sql`
      INSERT INTO places (name, code, description, is_active, service_charge, tax_rate)
      VALUES (
        ${new_name.trim()},
        ${new_code.trim().toLowerCase()},
        ${source.description || null},
        true,
        ${source.service_charge || 0},
        ${source.tax_rate || 0}
      )
      RETURNING *
    `
    const newPlace = newPlaces[0]

    const drinks = await sql`SELECT * FROM drinks WHERE place_id = ${source_place_id} ORDER BY id`
    let drinksCopied = 0
    for (const drink of drinks) {
      await sql`
        INSERT INTO drinks (name, description, price, category, is_available, place_id, image_url)
        VALUES (
          ${drink.name},
          ${drink.description || null},
          ${drink.price},
          ${drink.category || 'hot'},
          ${drink.is_available !== false},
          ${newPlace.id},
          ${drink.image_url || null}
        )
      `
      drinksCopied++
    }

    return NextResponse.json({ ok: true, place: newPlace, drinks_copied: drinksCopied })
  } catch (error) {
    console.error('Error cloning place:', error)
    return NextResponse.json({ error: 'فشل نسخ المكان' }, { status: 500 })
  }
}
