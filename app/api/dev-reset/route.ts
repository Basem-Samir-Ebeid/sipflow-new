import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { logDevActivity } from '@/lib/dev-activity'

async function applyAdminCredentials(
  sql: ReturnType<typeof getSql>,
  newUsername: string | undefined,
  newPassword: string | undefined,
) {
  const username = (newUsername ?? '').trim()
  const password = (newPassword ?? '').trim()

  if (!username && !password) {
    return { ok: false as const, error: 'أدخل اسم المستخدم أو كلمة المرور الجديدة' }
  }

  if (password) {
    if (password.length < 4) {
      return { ok: false as const, error: 'كلمة المرور قصيرة جداً' }
    }
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('dev_admin_password', ${password}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${password}, updated_at = NOW()
    `
  }

  if (username) {
    if (username.length < 2) {
      return { ok: false as const, error: 'اسم المستخدم قصير جداً' }
    }
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('dev_admin_username', ${username}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${username}, updated_at = NOW()
    `
  }

  const parts: string[] = []
  if (username) parts.push('اسم المستخدم')
  if (password) parts.push('كلمة المرور')
  return { ok: true as const, changed: parts.join(' و') }
}

export async function POST(request: NextRequest) {
  try {
    const RESET_CODE = process.env.DEV_RESET_CODE
    if (!RESET_CODE) {
      return NextResponse.json({ success: false, error: 'خاصية الريسيت غير مفعلة في هذه البيئة' }, { status: 503 })
    }

    const { resetCode, type, newPassword, newUsername } = await request.json()

    const sql = getSql()

    if (resetCode !== RESET_CODE) {
      await logDevActivity(sql, {
        request,
        action: 'reset_failed',
        target: type || 'unknown',
        status: 'failure',
        details: { reason: 'invalid_reset_code' },
      })
      return NextResponse.json({ success: false, error: 'كود الريسيت غلط' })
    }

    if (type === 'admin') {
      const result = await applyAdminCredentials(sql, newUsername, newPassword)
      if (!result.ok) return NextResponse.json({ success: false, error: result.error })
      await logDevActivity(sql, {
        request,
        action: 'reset_admin_credentials',
        target: 'dev-admin',
        details: { changed: result.changed, newUsernameProvided: !!newUsername, newPasswordProvided: !!newPassword },
      })
      return NextResponse.json({ success: true, message: `تم تغيير ${result.changed} للأدمن المطور بنجاح` })
    }

    if (type === 'user') {
      await sql`UPDATE sessions SET is_active = false, ended_at = NOW() WHERE is_active = true`
      await logDevActivity(sql, {
        request,
        action: 'reset_user_sessions',
        target: 'all-users',
        details: { scope: 'all_active_sessions' },
      })
      return NextResponse.json({ success: true, message: 'تم إعادة ضبط جلسات المستخدمين بنجاح' })
    }

    if (type === 'both') {
      const result = await applyAdminCredentials(sql, newUsername, newPassword)
      if (!result.ok) return NextResponse.json({ success: false, error: result.error })
      await sql`UPDATE sessions SET is_active = false, ended_at = NOW() WHERE is_active = true`
      await logDevActivity(sql, {
        request,
        action: 'reset_admin_and_users',
        target: 'dev-admin+users',
        details: { changed: result.changed },
      })
      return NextResponse.json({ success: true, message: `تم تغيير ${result.changed} للأدمن وإعادة ضبط المستخدمين بنجاح` })
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
