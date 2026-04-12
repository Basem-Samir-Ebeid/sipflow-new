import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  // Auth check
  const secret = request.headers.get('x-admin-secret')
  if (secret !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { command } = await request.json()
    const cmd = command.trim().toLowerCase()
    const parts = cmd.split(/\s+/)

    // ── SHOW Commands ──
    if (parts[0] === 'show') {
      const target = parts[1]

      if (target === 'places') {
        const { data, error } = await supabase
          .from('places')
          .select('id, name, code, is_active, table_count, created_at')
          .order('created_at', { ascending: false })
        if (error) return NextResponse.json({ type: 'error', message: error.message })
        return NextResponse.json({
          type: 'table',
          message: `تم العثور على ${data?.length || 0} مكان`,
          rows: data?.map(p => ({
            ID: p.id.slice(0, 8),
            الاسم: p.name,
            الكود: p.code,
            الحالة: p.is_active ? 'نشط' : 'غير نشط',
            الطاولات: p.table_count || 0,
          })) || []
        })
      }

      if (target === 'drinks') {
        const placeId = parts[2]
        let query = supabase.from('drinks').select('id, name, price, category, place_id')
        if (placeId) query = query.eq('place_id', placeId)
        const { data, error } = await query.order('created_at', { ascending: false }).limit(50)
        if (error) return NextResponse.json({ type: 'error', message: error.message })
        return NextResponse.json({
          type: 'table',
          message: `تم العثور على ${data?.length || 0} مشروب`,
          rows: data?.map(d => ({
            ID: d.id.slice(0, 8),
            الاسم: d.name,
            السعر: `${d.price} ج.م`,
            الفئة: d.category,
          })) || []
        })
      }

      if (target === 'users') {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, role, table_number, place_id, created_at')
          .order('created_at', { ascending: false })
          .limit(50)
        if (error) return NextResponse.json({ type: 'error', message: error.message })
        return NextResponse.json({
          type: 'table',
          message: `تم العثور على ${data?.length || 0} مستخدم`,
          rows: data?.map(u => ({
            ID: u.id.slice(0, 8),
            الاسم: u.name || '—',
            الدور: u.role,
            الطاولة: u.table_number || '—',
          })) || []
        })
      }

      if (target === 'sessions') {
        const activeOnly = parts[2] === 'active'
        let query = supabase.from('sessions').select('id, user_id, place_id, is_active, created_at')
        if (activeOnly) query = query.eq('is_active', true)
        const { data, error } = await query.order('created_at', { ascending: false }).limit(30)
        if (error) return NextResponse.json({ type: 'error', message: error.message })
        return NextResponse.json({
          type: 'table',
          message: `تم العثور على ${data?.length || 0} جلسة${activeOnly ? ' نشطة' : ''}`,
          rows: data?.map(s => ({
            ID: s.id.slice(0, 8),
            المستخدم: s.user_id?.slice(0, 8) || '—',
            المكان: s.place_id?.slice(0, 8) || '—',
            نشط: s.is_active ? '✓' : '✗',
            التاريخ: new Date(s.created_at).toLocaleDateString('ar-EG'),
          })) || []
        })
      }

      if (target === 'orders') {
        const placeId = parts[2]
        let query = supabase.from('orders').select('id, quantity, status, total_price, created_at, drink:drinks(name)')
        if (placeId) query = query.eq('place_id', placeId)
        const { data, error } = await query.order('created_at', { ascending: false }).limit(20)
        if (error) return NextResponse.json({ type: 'error', message: error.message })
        return NextResponse.json({
          type: 'table',
          message: `آخر ${data?.length || 0} طلب`,
          rows: data?.map(o => ({
            ID: o.id.slice(0, 8),
            المشروب: (o.drink as { name: string } | null)?.name || '—',
            الكمية: o.quantity,
            الحالة: o.status,
            السعر: `${o.total_price} ج.م`,
          })) || []
        })
      }

      return NextResponse.json({ type: 'error', message: `أمر غير معروف: show ${target}` })
    }

    // ── COUNT Commands ──
    if (parts[0] === 'count') {
      const target = parts[1]
      const period = parts[2]

      if (target === 'orders') {
        let query = supabase.from('orders').select('id', { count: 'exact', head: true })
        
        if (period === 'today') {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          query = query.gte('created_at', today.toISOString())
        } else if (period === 'week') {
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          query = query.gte('created_at', weekAgo.toISOString())
        }
        
        const { count, error } = await query
        if (error) return NextResponse.json({ type: 'error', message: error.message })
        return NextResponse.json({
          type: 'success',
          message: `عدد الطلبات${period === 'today' ? ' اليوم' : period === 'week' ? ' هذا الأسبوع' : ''}: ${count || 0}`
        })
      }

      if (target === 'users') {
        const { count, error } = await supabase.from('users').select('id', { count: 'exact', head: true })
        if (error) return NextResponse.json({ type: 'error', message: error.message })
        return NextResponse.json({ type: 'success', message: `عدد المستخدمين: ${count || 0}` })
      }

      if (target === 'places') {
        const { count, error } = await supabase.from('places').select('id', { count: 'exact', head: true })
        if (error) return NextResponse.json({ type: 'error', message: error.message })
        return NextResponse.json({ type: 'success', message: `عدد الأماكن: ${count || 0}` })
      }

      if (target === 'drinks') {
        const { count, error } = await supabase.from('drinks').select('id', { count: 'exact', head: true })
        if (error) return NextResponse.json({ type: 'error', message: error.message })
        return NextResponse.json({ type: 'success', message: `عدد المشروبات: ${count || 0}` })
      }

      return NextResponse.json({ type: 'error', message: `أمر غير معروف: count ${target}` })
    }

    // ── DB Commands ──
    if (parts[0] === 'db') {
      const subCommand = parts[1]

      if (subCommand === 'stats') {
        const [places, users, drinks, orders, sessions] = await Promise.all([
          supabase.from('places').select('id', { count: 'exact', head: true }),
          supabase.from('users').select('id', { count: 'exact', head: true }),
          supabase.from('drinks').select('id', { count: 'exact', head: true }),
          supabase.from('orders').select('id', { count: 'exact', head: true }),
          supabase.from('sessions').select('id', { count: 'exact', head: true }),
        ])

        return NextResponse.json({
          type: 'success',
          message: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  إحصائيات قاعدة البيانات
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  الأماكن:    ${places.count || 0}
  المستخدمين: ${users.count || 0}
  المشروبات:  ${drinks.count || 0}
  الطلبات:    ${orders.count || 0}
  الجلسات:    ${sessions.count || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          `
        })
      }

      if (subCommand === 'tables') {
        return NextResponse.json({
          type: 'table',
          message: 'جداول قاعدة البيانات',
          rows: [
            { الجدول: 'places', الوصف: 'الأماكن/الكافيهات' },
            { الجدول: 'users', الوصف: 'المستخدمين' },
            { الجدول: 'drinks', الوصف: 'المشروبات' },
            { الجدول: 'orders', الوصف: 'الطلبات' },
            { الجدول: 'sessions', الوصف: 'الجلسات' },
            { الجدول: 'inventory', الوصف: 'المخزون' },
            { الجدول: 'reservations', الوصف: 'الحجوزات' },
            { الجدول: 'messages', الوصف: 'الرسائل' },
            { الجدول: 'settings', الوصف: 'الإعدادات' },
            { الجدول: 'clients', الوصف: 'العملاء' },
          ]
        })
      }

      return NextResponse.json({ type: 'error', message: `أمر غير معروف: db ${subCommand}` })
    }

    // ── SQL Command ──
    if (parts[0] === 'sql') {
      const sqlQuery = command.slice(4).trim()
      if (!sqlQuery) {
        return NextResponse.json({ type: 'error', message: 'أدخل استعلام SQL' })
      }

      // Only allow SELECT queries for safety
      if (!sqlQuery.toLowerCase().startsWith('select')) {
        return NextResponse.json({ type: 'error', message: 'فقط استعلامات SELECT مسموحة للأمان' })
      }

      try {
        const { data, error } = await supabase.rpc('exec_sql', { query: sqlQuery })
        if (error) {
          // If RPC doesn't exist, inform the user
          return NextResponse.json({ type: 'error', message: `خطأ: ${error.message}` })
        }
        return NextResponse.json({
          type: 'table',
          message: `تم تنفيذ الاستعلام — ${Array.isArray(data) ? data.length : 0} نتيجة`,
          rows: data || []
        })
      } catch {
        return NextResponse.json({ type: 'error', message: 'فشل تنفيذ الاستعلام — تأكد من صحة الصيغة' })
      }
    }

    // ── Unknown Command ──
    return NextResponse.json({
      type: 'error',
      message: `أمر غير معروف: ${parts[0]}\nاكتب "help" لعرض الأوامر المتاحة`
    })

  } catch (err) {
    return NextResponse.json({
      type: 'error',
      message: `خطأ: ${err instanceof Error ? err.message : 'غير معروف'}`
    })
  }
}
