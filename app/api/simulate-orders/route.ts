import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const FAKE_NAMES = ['أحمد', 'محمد', 'سارة', 'فاطمة', 'خالد', 'نور', 'علي', 'مريم', 'يوسف', 'هند']
const SUGAR_LEVELS = ['none', 'low', 'medium', 'high']
const NOTES_OPTIONS = ['', '', '', 'بدون ثلج', 'سخن جداً', 'مع سكر إضافي', '', 'تسليم سريع', '']

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { place_id, count = 5, delay_ms = 300 } = body

    if (!place_id) {
      return NextResponse.json({ error: 'place_id مطلوب' }, { status: 400 })
    }

    const drinks = await db.getDrinks(place_id)
    if (!drinks || drinks.length === 0) {
      return NextResponse.json({ error: 'لا توجد مشروبات في هذا المكان' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]
    let session = await db.getActiveSession(today, place_id)
    if (!session) {
      session = await db.createSession(today, place_id)
    }

    const results: { success: boolean; drink: string; name: string; error?: string }[] = []

    for (let i = 0; i < Math.min(count, 50); i++) {
      if (delay_ms > 0 && i > 0) {
        await new Promise(res => setTimeout(res, delay_ms))
      }

      const drink = randomFrom(drinks)
      const name = randomFrom(FAKE_NAMES)
      const tableNum = String(Math.floor(Math.random() * 10) + 1)

      try {
        await db.createOrder({
          user_id: null as unknown as string,
          session_id: session.id,
          drink_id: drink.id,
          quantity: 1,
          sugar_level: randomFrom(SUGAR_LEVELS),
          notes: randomFrom(NOTES_OPTIONS),
          customer_name: `[SIM] ${name}`,
          table_number: tableNum,
          total_price: drink.price,
        })
        results.push({ success: true, drink: drink.name, name })
      } catch (err) {
        results.push({ success: false, drink: drink.name, name, error: String(err) })
      }
    }

    const successCount = results.filter(r => r.success).length
    return NextResponse.json({
      message: `تم إنشاء ${successCount} طلب وهمي بنجاح`,
      session_id: session.id,
      results,
    })
  } catch (error) {
    console.error('Simulate orders error:', error)
    return NextResponse.json({ error: 'فشل في تشغيل المحاكاة' }, { status: 500 })
  }
}
