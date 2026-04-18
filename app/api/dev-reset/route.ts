import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

const RESET_CODE = '246850'

export async function POST(request: NextRequest) {
  try {
    const { resetCode, type, newPassword } = await request.json()

    if (resetCode !== RESET_CODE) {
      return NextResponse.json({ success: false, error: 'كود الريسيت غلط' })
    }

    const sql = getSql()

    if (type === 'admin') {
      if (!newPassword || newPassword.trim().length < 4) {
        return NextResponse.json({ success: false, error: 'كلمة المرور قصيرة جداً' })
      }
      await sql`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('dev_admin_password', ${newPassword.trim()}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${newPassword.trim()}, updated_at = NOW()
      `
      return NextResponse.json({ success: true, message: 'تم تغيير باسورد الأدمن المطور بنجاح' })
    }

    if (type === 'user') {
      await sql`UPDATE sessions SET is_active = false, ended_at = NOW() WHERE is_active = true`
      return NextResponse.json({ success: true, message: 'تم إعادة ضبط جلسات المستخدمين بنجاح' })
    }

    if (type === 'both') {
      if (!newPassword || newPassword.trim().length < 4) {
        return NextResponse.json({ success: false, error: 'كلمة المرور قصيرة جداً' })
      }
      await sql`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('dev_admin_password', ${newPassword.trim()}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${newPassword.trim()}, updated_at = NOW()
      `
      await sql`UPDATE sessions SET is_active = false, ended_at = NOW() WHERE is_active = true`
      return NextResponse.json({ success: true, message: 'تم إعادة ضبط الأدمن والمستخدمين بنجاح' })
    }

    return NextResponse.json({ success: false, error: 'نوع الريسيت غير معروف' })
  } catch (error: any) {
    console.error('Dev reset error:', error)
    const isDbError =
      error?.message?.includes('getaddrinfo') ||
      error?.message?.includes('ECONNREFUSED') ||
      error?.message?.includes('DATABASE_URL') ||
      error?.code === 'ENOTFOUND'
    const msg = isDbError
      ? 'قاعدة البيانات غير متصلة في بيئة الإنتاج — تأكد من إعداد DATABASE_URL الصحيح'
      : 'حدث خطأ في السيرفر'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
