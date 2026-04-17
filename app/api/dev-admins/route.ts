import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { DEV_ADMIN_SESSION_COOKIE, DevAdminAccount, DevAdminRole, getDevAdminAccounts, isSuperDevAdminSession, passwordHash, saveDevAdminAccounts } from '@/lib/admin-auth'

const allowedRoles: DevAdminRole[] = ['super_developer', 'support_admin', 'sales_admin', 'finance_admin']

function publicAccount(account: DevAdminAccount) {
  return {
    id: account.id,
    name: account.name,
    role: account.role,
    active: account.active !== false,
    createdAt: account.createdAt || null,
  }
}

export async function GET(request: NextRequest) {
  const sql = getSql()
  const sessionToken = request.cookies.get(DEV_ADMIN_SESSION_COOKIE)?.value
  if (!(await isSuperDevAdminSession(sql, sessionToken))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accounts = await getDevAdminAccounts(sql)
  return NextResponse.json({ accounts: accounts.map(publicAccount) })
}

export async function POST(request: NextRequest) {
  try {
    const sql = getSql()
    const sessionToken = request.cookies.get(DEV_ADMIN_SESSION_COOKIE)?.value
    if (!(await isSuperDevAdminSession(sql, sessionToken))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const accounts = await getDevAdminAccounts(sql)

    if (body.action === 'delete') {
      const nextAccounts = accounts.filter((account) => account.id !== body.id)
      await saveDevAdminAccounts(sql, nextAccounts)
      return NextResponse.json({ success: true, accounts: nextAccounts.map(publicAccount) })
    }

    const name = String(body.name || '').trim()
    const role = body.role as DevAdminRole
    const password = String(body.password || '')

    if (!name) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })
    if (!allowedRoles.includes(role)) return NextResponse.json({ error: 'الدور غير صحيح' }, { status: 400 })

    if (body.id) {
      const nextAccounts = accounts.map((account) => {
        if (account.id !== body.id) return account
        return {
          ...account,
          name,
          role,
          active: body.active !== false,
          ...(password ? { passwordHash: passwordHash(password), password: undefined } : {}),
        }
      })
      await saveDevAdminAccounts(sql, nextAccounts)
      return NextResponse.json({ success: true, accounts: nextAccounts.map(publicAccount) })
    }

    if (!password) return NextResponse.json({ error: 'كلمة المرور مطلوبة' }, { status: 400 })
    if (accounts.some((account) => account.name.trim().toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'هذا الاسم موجود بالفعل' }, { status: 400 })
    }

    const nextAccounts: DevAdminAccount[] = [
      ...accounts,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name,
        role,
        active: body.active !== false,
        passwordHash: passwordHash(password),
        createdAt: new Date().toISOString(),
      },
    ]
    await saveDevAdminAccounts(sql, nextAccounts)
    return NextResponse.json({ success: true, accounts: nextAccounts.map(publicAccount) })
  } catch (error) {
    console.error('Dev admins error:', error)
    return NextResponse.json({ error: 'Failed to save dev admins' }, { status: 500 })
  }
}