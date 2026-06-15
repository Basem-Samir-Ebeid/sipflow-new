import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const sql = getSql()
  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get('place_id')
  if (!placeId || !UUID_RE.test(placeId))
    return NextResponse.json({ error: 'place_id required' }, { status: 400 })

  const since30 = new Date(); since30.setDate(since30.getDate() - 30)
  const since90 = new Date(); since90.setDate(since90.getDate() - 90)

  const drinkStats = await sql`
    SELECT
      d.id, d.name, d.price, d.category,
      COUNT(o.id)                          AS orders_30d,
      COALESCE(SUM(o.total_price), 0)      AS revenue_30d,
      ROUND(AVG(o.rating)::numeric, 2)     AS avg_rating,
      COUNT(o.rating)                      AS rating_count
    FROM drinks d
    LEFT JOIN orders o   ON o.drink_id = d.id AND o.created_at >= ${since30}
    LEFT JOIN sessions s ON s.id = o.session_id AND s.place_id = ${placeId}
    WHERE d.place_id = ${placeId} AND d.is_available = true
    GROUP BY d.id, d.name, d.price, d.category
  `

  const historicStats = await sql`
    SELECT
      d.id,
      COUNT(o.id) AS orders_90d,
      COALESCE(SUM(o.total_price), 0) AS revenue_90d
    FROM drinks d
    LEFT JOIN orders o   ON o.drink_id = d.id AND o.created_at >= ${since90}
    LEFT JOIN sessions s ON s.id = o.session_id AND s.place_id = ${placeId}
    WHERE d.place_id = ${placeId}
    GROUP BY d.id
  `

  const historicMap: Record<string,{orders90:number,revenue90:number}> = {}
  for (const r of historicStats as any[]) {
    historicMap[r.id] = { orders90: Number(r.orders_90d), revenue90: Number(r.revenue_90d) }
  }

  const combos = await sql`
    SELECT
      d1.name AS item1,
      d2.name AS item2,
      COUNT(*) AS together_count
    FROM orders o1
    JOIN orders o2 ON o2.session_id = o1.session_id AND o2.drink_id > o1.drink_id
    JOIN drinks d1 ON d1.id = o1.drink_id
    JOIN drinks d2 ON d2.id = o2.drink_id
    JOIN sessions s ON s.id = o1.session_id AND s.place_id = ${placeId}
    WHERE o1.created_at >= ${since90}
    GROUP BY d1.name, d2.name
    HAVING COUNT(*) >= 2
    ORDER BY together_count DESC
    LIMIT 5
  `.catch(() => [])

  const drinks = (drinkStats as any[]).map(r => {
    const orders30 = Number(r.orders_30d)
    const rev30    = Number(r.revenue_30d)
    const hist     = historicMap[r.id] ?? { orders90: 0, revenue90: 0 }
    const orders90 = hist.orders90
    const trend    = orders90 > 0
      ? ((orders30 * 3) - orders90) / orders90 * 100
      : orders30 > 0 ? 100 : 0

    let priceAdvice: string | null = null
    const avgRating = r.avg_rating ? Number(r.avg_rating) : null
    const price = Number(r.price)
    if (orders30 > 10 && (avgRating === null || avgRating >= 4.0)) {
      priceAdvice = `يمكن رفع السعر بـ ${Math.round(price * 0.1)} جنيه (${price} ← ${price + Math.round(price * 0.1)})`
    } else if (orders30 < 2 && price > 20) {
      priceAdvice = `جرب خفض السعر بـ ${Math.round(price * 0.1)} جنيه لتحفيز الطلبات (${price} ← ${price - Math.round(price * 0.1)})`
    }

    let tag: 'star' | 'rising' | 'falling' | 'dead' | 'hidden_gem' | 'normal' = 'normal'
    if (orders30 >= 15) tag = 'star'
    else if (trend > 30 && orders30 >= 5) tag = 'rising'
    else if (trend < -30 && orders90 >= 10) tag = 'falling'
    else if (orders30 === 0 && orders90 === 0) tag = 'dead'
    else if (orders30 < 3 && avgRating && avgRating >= 4.5) tag = 'hidden_gem'

    return {
      id: r.id,
      name: r.name,
      price,
      category: r.category,
      orders30,
      revenue30: rev30,
      orders90,
      trend: Math.round(trend),
      avgRating,
      ratingCount: Number(r.rating_count),
      tag,
      priceAdvice,
    }
  })

  const recommendations: string[] = []
  const deadItems = drinks.filter(d => d.tag === 'dead')
  const risingItems = drinks.filter(d => d.tag === 'rising')
  const hiddenGems = drinks.filter(d => d.tag === 'hidden_gem')
  const fallingItems = drinks.filter(d => d.tag === 'falling')

  if (deadItems.length > 0)
    recommendations.push(`🗑️ فكر في إزالة أو تطوير ${deadItems.length} منتج بدون طلبات: ${deadItems.slice(0,3).map(d=>d.name).join('، ')}`)
  if (risingItems.length > 0)
    recommendations.push(`🚀 ${risingItems[0].name} في صعود قوي — اعمل عليه بروموشن`)
  if (hiddenGems.length > 0)
    recommendations.push(`💎 ${hiddenGems[0].name} تقييمه ممتاز لكن مش معروف — سلط الضوء عليه`)
  if (fallingItems.length > 0)
    recommendations.push(`📉 ${fallingItems[0].name} في تراجع — راجع السعر أو السبب`)

  const combosArr = (combos as any[]).map(r => ({
    item1: r.item1,
    item2: r.item2,
    count: Number(r.together_count),
  }))
  if (combosArr.length > 0)
    recommendations.push(`🔗 الناس بتطلب "${combosArr[0].item1}" مع "${combosArr[0].item2}" معاً ${combosArr[0].count} مرة — اعمل كومبو`)

  return NextResponse.json({
    drinks,
    combos: combosArr,
    recommendations,
    summary: {
      stars: drinks.filter(d => d.tag === 'star').length,
      rising: drinks.filter(d => d.tag === 'rising').length,
      falling: drinks.filter(d => d.tag === 'falling').length,
      dead: drinks.filter(d => d.tag === 'dead').length,
      hiddenGems: drinks.filter(d => d.tag === 'hidden_gem').length,
    }
  })
}
