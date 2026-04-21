import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { place_id, email, password } = body
    if (!place_id || !email || !password) {
      return NextResponse.json({ error: 'place_id, email, password مطلوبة' }, { status: 400 })
    }
    const employee = await db.getCompanyEmployeeByEmail(place_id, email)
    if (!employee) {
      return NextResponse.json({ error: 'الإيميل غير موجود أو الحساب غير مفعل' }, { status: 404 })
    }
    if (employee.password !== password) {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 })
    }
    return NextResponse.json({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      place_id: employee.place_id,
      avatar_url: employee.avatar_url ?? null,
      department: employee.department ?? null,
      title: employee.title ?? null,
    })
  } catch (error) {
    console.error('Error employee login:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
