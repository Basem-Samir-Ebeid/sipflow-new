import { NextRequest, NextResponse } from 'next/server'
import { db, getSql } from '@/lib/db'
import { DEV_ADMIN_SESSION_COOKIE, isSuperDevAdminSession } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')

    if (placeId) {
      const sql = getSql()
      const staff = await sql`
        SELECT id, username, name, is_active, role, place_id, created_at
        FROM staff_users
        WHERE place_id = ${placeId}
        ORDER BY created_at DESC
      `
      return NextResponse.json(staff)
    }

    const sessionToken = request.cookies.get(DEV_ADMIN_SESSION_COOKIE)?.value
    const sql = getSql()
    const isAdmin = await isSuperDevAdminSession(sql, sessionToken)
    if (!isAdmin) {
      return NextResponse.json({ error: 'place_id is required' }, { status: 400 })
    }

    const staff = await db.getStaffUsers()
    return NextResponse.json(staff)
  } catch (error) {
    console.error('Error fetching staff:', error)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body?.username || !body?.password || !body?.name) {
      return NextResponse.json({ error: 'الاسم واسم المستخدم وكلمة المرور كلهم مطلوبين' }, { status: 400 })
    }
    const existing = await db.getStaffByUsername(String(body.username).trim())
    if (existing) {
      return NextResponse.json({ error: 'اسم المستخدم ده موجود بالفعل، اختار اسم تاني' }, { status: 409 })
    }
    const staff = await db.createStaffUser({
      ...body,
      username: String(body.username).trim(),
      name: String(body.name).trim(),
    })
    return NextResponse.json(staff)
  } catch (error: any) {
    console.error('Error creating staff:', error)
    const msg: string = error?.message || ''
    if (msg.includes('duplicate key') || msg.includes('staff_users_username')) {
      return NextResponse.json({ error: 'اسم المستخدم ده موجود بالفعل، اختار اسم تاني' }, { status: 409 })
    }
    if (msg.includes('foreign key') || msg.includes('place_id')) {
      return NextResponse.json({ error: 'المكان غير موجود — اختار مكان صحيح' }, { status: 400 })
    }
    return NextResponse.json({ error: msg || 'حدث خطأ أثناء إضافة الكابتن' }, { status: 500 })
  }
}
