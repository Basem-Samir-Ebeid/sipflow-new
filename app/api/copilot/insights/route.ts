import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

type Severity = 'critical' | 'warning' | 'info' | 'success'
type Insight = {
  id: string
  icon: string
  severity: Severity
  title: string
  message: string
  metric?: string
  action?: string
}

const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    if (!placeId) return NextResponse.json({ insights: [], error: 'place_id required' }, { status: 400 })

    const sql = getSql()
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const currentHour = now.getHours()
    const currentWeekday = now.getDay()

    const insights: Insight[] = []

    // ── Today's active session (fail-safe) ──
    let sessionId: string | null = null
    try {
      const todaySessions = await sql`
        SELECT id FROM sessions WHERE date = ${today} AND place_id = ${placeId} AND is_active = true LIMIT 1
      `
      sessionId = todaySessions[0]?.id ?? null
    } catch {}

    // ── Pull today's orders (if any) ──
    let todayOrders: Array<Record<string, unknown>> = []
    if (sessionId) {
      try {
        todayOrders = await sql`
          SELECT o.id, o.drink_id, o.quantity, o.total_price, o.status, o.created_at,
                 d.name as drink_name, d.price as drink_price
          FROM orders o
          LEFT JOIN drinks d ON d.id = o.drink_id
          WHERE o.session_id = ${sessionId}
          ORDER BY o.created_at ASC
        `
      } catch {}
    }

    // ── Pull last 28 days of orders for this place to build baseline ──
    const histStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    let histRows: Array<Record<string, unknown>> = []
    try {
      histRows = await sql`
        SELECT o.drink_id, o.quantity, o.total_price, o.created_at,
               d.name as drink_name
        FROM orders o
        LEFT JOIN drinks d ON d.id = o.drink_id
        LEFT JOIN sessions s ON s.id = o.session_id
        WHERE s.place_id = ${placeId} AND s.date >= ${histStart} AND s.date < ${today}
      `
    } catch {}

    // ─────────────────────────────────────────────────────────
    // 1) PACE FORECAST: today's orders so far vs same-weekday avg
    // ─────────────────────────────────────────────────────────
    {
      const ordersSoFar = todayOrders.length
      const revSoFar = todayOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0)
      // For each historical day = currentWeekday, count orders up to currentHour
      const dayBuckets: Record<string, { orders: number; revenue: number }> = {}
      for (const r of histRows) {
        const d = new Date(r.created_at as string)
        if (d.getDay() !== currentWeekday) continue
        if (d.getHours() > currentHour) continue
        const key = d.toISOString().split('T')[0]
        if (!dayBuckets[key]) dayBuckets[key] = { orders: 0, revenue: 0 }
        dayBuckets[key].orders += 1
        dayBuckets[key].revenue += Number(r.total_price || 0)
      }
      const sameWeekdayCount = Object.keys(dayBuckets).length
      if (sameWeekdayCount >= 1) {
        const avgOrders = Object.values(dayBuckets).reduce((s, b) => s + b.orders, 0) / sameWeekdayCount
        const avgRev = Object.values(dayBuckets).reduce((s, b) => s + b.revenue, 0) / sameWeekdayCount
        if (avgOrders >= 3) {
          const diffPct = Math.round(((ordersSoFar - avgOrders) / avgOrders) * 100)
          if (diffPct >= 20) {
            insights.push({
              id: 'pace_high', icon: '🔥', severity: 'success',
              title: 'يوم نشط فوق المعتاد',
              message: `لحد دلوقتي ${ordersSoFar} طلب — أعلى ${diffPct}% من متوسط ${dayNames[currentWeekday]} في نفس التوقيت.`,
              metric: `${Math.round(revSoFar)} ج/${Math.round(avgRev)} ج`,
              action: 'جهّز البار وزوّد المخزون السريع — اليوم واعد بأرباح أعلى.',
            })
          } else if (diffPct <= -20) {
            insights.push({
              id: 'pace_low', icon: '📉', severity: 'warning',
              title: 'حركة أبطأ من المعتاد',
              message: `لحد دلوقتي ${ordersSoFar} طلب فقط — أقل ${Math.abs(diffPct)}% من متوسط ${dayNames[currentWeekday]}.`,
              action: 'فكر في عرض سريع لمدة ساعتين، أو ابعت رسالة للزبائن الدائمين.',
            })
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // 2) NEXT-HOUR FORECAST: how many orders to expect in next 60 min
    // ─────────────────────────────────────────────────────────
    {
      const nextHour = (currentHour + 1) % 24
      const nextHourCounts: Record<string, number> = {}
      for (const r of histRows) {
        const d = new Date(r.created_at as string)
        if (d.getDay() !== currentWeekday) continue
        const h = d.getHours()
        if (h !== currentHour && h !== nextHour) continue
        const key = d.toISOString().split('T')[0]
        nextHourCounts[key] = (nextHourCounts[key] || 0) + 1
      }
      const days = Object.values(nextHourCounts)
      if (days.length >= 2) {
        const expected = Math.round(days.reduce((a, b) => a + b, 0) / days.length)
        if (expected >= 5) {
          insights.push({
            id: 'next_hour_forecast', icon: '⏰', severity: 'info',
            title: `توقّع الساعة الجاية`,
            message: `بناءً على آخر 4 أسابيع، متوقع ${expected} طلب في الساعة الجاية (${currentHour}:00 — ${nextHour}:00).`,
            action: expected >= 15 ? 'تأكد إن في 2 موظفين على الأقل في البار.' : 'الحركة معتدلة — تابع الطلبات.',
          })
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // 3) HOT PRODUCT TODAY (with trend vs baseline)
    // ─────────────────────────────────────────────────────────
    {
      const todayByDrink: Record<string, { name: string; qty: number }> = {}
      for (const o of todayOrders) {
        const id = String(o.drink_id || '')
        if (!id) continue
        if (!todayByDrink[id]) todayByDrink[id] = { name: String(o.drink_name || ''), qty: 0 }
        todayByDrink[id].qty += Number(o.quantity || 1)
      }
      const sorted = Object.entries(todayByDrink).sort((a, b) => b[1].qty - a[1].qty)
      if (sorted.length > 0 && sorted[0][1].qty >= 3) {
        const [topId, topData] = sorted[0]
        // Avg daily qty from history
        const dailyQty: Record<string, number> = {}
        for (const r of histRows) {
          if (String(r.drink_id) !== topId) continue
          const key = new Date(r.created_at as string).toISOString().split('T')[0]
          dailyQty[key] = (dailyQty[key] || 0) + Number(r.quantity || 1)
        }
        const avgQty = Object.values(dailyQty).length
          ? Object.values(dailyQty).reduce((a, b) => a + b, 0) / Object.values(dailyQty).length
          : 0
        let trendNote = ''
        if (avgQty > 0) {
          const diff = Math.round(((topData.qty - avgQty) / avgQty) * 100)
          if (diff >= 30) trendNote = ` (أعلى من متوسطه اليومي بـ ${diff}%)`
          else if (diff <= -30) trendNote = ` (أقل من متوسطه بـ ${Math.abs(diff)}%)`
        }
        insights.push({
          id: 'hot_product', icon: '🌟', severity: 'success',
          title: 'المنتج النجم النهاردة',
          message: `"${topData.name}" اتباع ${topData.qty} مرة${trendNote}.`,
          action: 'اعرضه بشكل بارز في القائمة، وتأكد إن مكوناته متوفرة.',
        })
      }
    }

    // ─────────────────────────────────────────────────────────
    // 4) LOW-STOCK PREDICTION (drinks inventory)
    // ─────────────────────────────────────────────────────────
    try {
      const inv: Array<Record<string, unknown>> = await sql`
        SELECT i.drink_id, i.quantity, d.name
        FROM inventory i
        LEFT JOIN drinks d ON d.id = i.drink_id
        WHERE d.place_id = ${placeId}
      `
      // Compute today's qty consumed per drink
      const consumedToday: Record<string, number> = {}
      for (const o of todayOrders) {
        const id = String(o.drink_id || '')
        consumedToday[id] = (consumedToday[id] || 0) + Number(o.quantity || 1)
      }
      const hoursElapsed = Math.max(1, currentHour - 9) // assume cafe opens ~9am
      for (const item of inv) {
        const id = String(item.drink_id)
        const qty = Number(item.quantity || 0)
        const consumed = consumedToday[id] || 0
        if (qty <= 0) continue
        const ratePerHour = consumed / hoursElapsed
        if (ratePerHour < 0.5) continue
        const hoursLeft = qty / ratePerHour
        if (hoursLeft <= 2) {
          insights.push({
            id: `lowstock_${id}`,
            icon: '⚠️',
            severity: hoursLeft <= 1 ? 'critical' : 'warning',
            title: `مخزون "${item.name}" قارب على الانتهاء`,
            message: `متبقي ${qty} وحدة، وبمعدل البيع الحالي هيخلص خلال ~${Math.max(1, Math.round(hoursLeft))} ساعة.`,
            action: 'جهّز كمية إضافية أو فعّل إخفاء المنتج تلقائياً.',
          })
        }
      }
    } catch {}

    // ─────────────────────────────────────────────────────────
    // 5) STUCK ORDERS NOW
    // ─────────────────────────────────────────────────────────
    {
      let stuck = 0
      for (const o of todayOrders) {
        if (o.status === 'pending' || o.status === 'preparing') {
          const ageMin = (now.getTime() - new Date(o.created_at as string).getTime()) / 60000
          if (ageMin >= 20) stuck++
        }
      }
      if (stuck > 0) {
        insights.push({
          id: 'stuck_now', icon: '🚨', severity: 'critical',
          title: 'طلبات متأخرة في البار',
          message: `في ${stuck} طلب مرّ عليه أكتر من 20 دقيقة بدون تسليم.`,
          action: 'راجع البار فوراً — التأخير بيقلل التقييمات.',
        })
      }
    }

    // ─────────────────────────────────────────────────────────
    // 6) CROSS-SELL SUGGESTION (most common pairing)
    // ─────────────────────────────────────────────────────────
    {
      // Group historical orders by table+date+hour to detect simple pairs
      const pairs: Record<string, number> = {}
      const groups: Record<string, Set<string>> = {}
      for (const r of histRows) {
        const d = new Date(r.created_at as string)
        const key = `${d.toISOString().split('T')[0]}_${d.getHours()}`
        if (!groups[key]) groups[key] = new Set()
        if (r.drink_name) groups[key].add(String(r.drink_name))
      }
      for (const set of Object.values(groups)) {
        const arr = [...set]
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            const k = [arr[i], arr[j]].sort().join(' + ')
            pairs[k] = (pairs[k] || 0) + 1
          }
        }
      }
      const topPair = Object.entries(pairs).sort((a, b) => b[1] - a[1])[0]
      if (topPair && topPair[1] >= 5) {
        insights.push({
          id: 'cross_sell', icon: '🤝', severity: 'info',
          title: 'اقتراح بيع إضافي',
          message: `"${topPair[0]}" بيتطلبوا مع بعض كتير (${topPair[1]} مرة آخر شهر).`,
          action: 'اعرضهم كـ "كومبو" بسعر مخفّض شوية لزيادة متوسط الفاتورة.',
        })
      }
    }

    // ─────────────────────────────────────────────────────────
    // 7) NO DATA CASE — onboarding insight
    // ─────────────────────────────────────────────────────────
    if (insights.length === 0) {
      insights.push({
        id: 'no_data', icon: '🧠', severity: 'info',
        title: 'المساعد الذكي في وضع التعلم',
        message: 'لسه بجمع بيانات كفاية عن مكانك. كل ما يدخل طلبات أكتر، التوصيات هتبقى أدق.',
        action: todayOrders.length === 0 ? 'ابدأ تشغيل الجلسة واستقبل أول طلب.' : 'استمر — التوقعات بتتحسن كل يوم.',
      })
    }

    return NextResponse.json({
      insights,
      meta: {
        today_orders: todayOrders.length,
        history_orders: histRows.length,
        generated_at: now.toISOString(),
      },
    })
  } catch (error) {
    console.error('copilot insights error', error)
    return NextResponse.json({ insights: [], error: 'Failed to generate insights' }, { status: 500 })
  }
}
