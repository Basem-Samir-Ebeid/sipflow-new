import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type TemplateEntry = { id: string; name: string; description: string; drinkCount: number; createdAt: string }

async function getTemplatesIndex(): Promise<TemplateEntry[]> {
  try {
    const val = await db.getSetting('place_templates_index')
    if (val) return JSON.parse(val)
  } catch { /* silent */ }
  return []
}

async function saveTemplatesIndex(index: TemplateEntry[]) {
  await db.setSetting('place_templates_index', JSON.stringify(index))
}

export async function GET() {
  try {
    const index = await getTemplatesIndex()
    return NextResponse.json(index)
  } catch (error) {
    console.error('Get templates error:', error)
    return NextResponse.json({ error: 'فشل في جلب القوالب' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'save') {
      const { place_id, name, description } = body
      if (!place_id || !name) {
        return NextResponse.json({ error: 'place_id و name مطلوبان' }, { status: 400 })
      }

      const drinks = await db.getDrinks(place_id)
      if (!drinks || drinks.length === 0) {
        return NextResponse.json({ error: 'لا توجد مشروبات في هذا المكان لحفظها' }, { status: 400 })
      }

      const templateDrinks = drinks.map((d: { name: string; price: number; category: string; image_url?: string; description?: string }) => ({
        name: d.name,
        price: d.price,
        category: d.category,
        image_url: d.image_url || null,
        description: d.description || null,
      }))

      const id = `tpl_${Date.now()}`
      await db.setSetting(`place_template_${id}`, JSON.stringify(templateDrinks))

      const index = await getTemplatesIndex()
      index.unshift({ id, name, description: description || '', drinkCount: templateDrinks.length, createdAt: new Date().toISOString() })
      await saveTemplatesIndex(index)

      return NextResponse.json({ success: true, id, drinkCount: templateDrinks.length })

    } else if (action === 'apply') {
      const { template_id, place_id } = body
      if (!template_id || !place_id) {
        return NextResponse.json({ error: 'template_id و place_id مطلوبان' }, { status: 400 })
      }

      const val = await db.getSetting(`place_template_${template_id}`)
      if (!val) {
        return NextResponse.json({ error: 'القالب غير موجود' }, { status: 404 })
      }

      const templateDrinks: { name: string; price: number; category: string; image_url?: string | null; description?: string | null }[] = JSON.parse(val)
      let created = 0
      for (const drink of templateDrinks) {
        try {
          await db.createDrink({ ...drink, place_id, initial_stock: 100 })
          created++
        } catch { /* skip if error */ }
      }

      return NextResponse.json({ success: true, created })

    } else {
      return NextResponse.json({ error: 'action غير صحيح' }, { status: 400 })
    }
  } catch (error) {
    console.error('Place templates error:', error)
    return NextResponse.json({ error: 'فشل في معالجة القالب' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })

    await db.setSetting(`place_template_${id}`, '')
    const index = await getTemplatesIndex()
    const updated = index.filter(t => t.id !== id)
    await saveTemplatesIndex(updated)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete template error:', error)
    return NextResponse.json({ error: 'فشل في حذف القالب' }, { status: 500 })
  }
}
