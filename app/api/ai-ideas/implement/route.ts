import { NextResponse } from 'next/server'
import { db, getSql } from '@/lib/db'

type IdeaSetup = {
  title: string
  tab: string
  tabLabel: string
  setup: () => Promise<string[]>
}

const sql = getSql()

const defaultFeatureFlags: Record<string, boolean> = {
  flag_reservations: true,
  flag_order_tracking: true,
  flag_inventory_alerts: true,
  flag_analytics: true,
  flag_waiter_calls: true,
  flag_global_banner: true,
  flag_simulator: true,
  flag_multi_place: true,
}

async function parseJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const value = await db.getSetting(key)
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const ideaSetups: Record<string, IdeaSetup> = {
  idea_order_rating: {
    title: 'نظام تقييم الطلب',
    tab: 'analytics',
    tabLabel: 'التقارير',
    setup: async () => {
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS rating INTEGER`
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS rating_comment TEXT`
      await db.setSetting('idea_order_rating_config', JSON.stringify({ enabled: true, min: 1, max: 5, comments: true }))
      return ['تم تجهيز أعمدة تقييم الطلبات', 'تم حفظ إعدادات التقييم']
    },
  },
  idea_table_map: {
    title: 'خريطة الطاولات التفاعلية',
    tab: 'cashier',
    tabLabel: 'الكاشير',
    setup: async () => {
      await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS table_count INTEGER DEFAULT 10`
      await db.setSetting('idea_table_map_config', JSON.stringify({ enabled: true, empty: 'available', active: 'occupied', waitingBill: 'waiting_bill' }))
      return ['تم تجهيز عدد الطاولات لكل فرع', 'تم تفعيل إعدادات خريطة الطاولات']
    },
  },
  idea_waitlist: {
    title: 'قائمة انتظار ذكية',
    tab: 'settings',
    tabLabel: 'الإعدادات',
    setup: async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS waitlist_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          place_id UUID REFERENCES places(id) ON DELETE CASCADE,
          customer_name TEXT NOT NULL,
          customer_phone TEXT,
          party_size INTEGER DEFAULT 1,
          status TEXT DEFAULT 'waiting',
          notified_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      await db.setSetting('idea_waitlist_config', JSON.stringify({ enabled: true, notifyWhenTableFree: true }))
      return ['تم إنشاء قائمة انتظار دائمة', 'تم تفعيل إعدادات التنبيه التلقائي']
    },
  },
  idea_drink_custom: {
    title: 'تخصيص المشروب',
    tab: 'drinks',
    tabLabel: 'المشاريب',
    setup: async () => {
      await sql`ALTER TABLE drinks ADD COLUMN IF NOT EXISTS customization_enabled BOOLEAN DEFAULT false`
      await sql`ALTER TABLE drinks ADD COLUMN IF NOT EXISTS customization_options JSONB DEFAULT '[]'::jsonb`
      await sql`
        CREATE TABLE IF NOT EXISTS drink_custom_options (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          drink_id UUID REFERENCES drinks(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          choices JSONB DEFAULT '[]'::jsonb,
          required BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      await db.setSetting('idea_drink_custom_config', JSON.stringify({ enabled: true, defaultOptions: ['سكر', 'ثلج', 'إضافات'] }))
      return ['تم تجهيز خيارات التخصيص على المشروبات', 'تم حفظ إعدادات تخصيص الطلبات']
    },
  },
  idea_auto_hide: {
    title: 'إخفاء المنتج تلقائياً',
    tab: 'inventory',
    tabLabel: 'المخزون',
    setup: async () => {
      await sql`ALTER TABLE drinks ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true`
      await sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5`
      await db.setSetting('idea_auto_hide_config', JSON.stringify({ enabled: true, hideAtQuantity: 0, alertAt: 5 }))
      return ['تم تجهيز حالة إتاحة المنتجات', 'تم حفظ حدود تنبيه المخزون']
    },
  },
  idea_split_bill: {
    title: 'تقسيم الحساب',
    tab: 'cashier',
    tabLabel: 'الكاشير',
    setup: async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS split_payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
          table_number TEXT,
          payer_name TEXT,
          amount NUMERIC(10,2) NOT NULL DEFAULT 0,
          method TEXT DEFAULT 'cash',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      await db.setSetting('idea_split_bill_config', JSON.stringify({ enabled: true, modes: ['equal', 'by_order'] }))
      return ['تم إنشاء سجل تقسيم الحسابات', 'تم تفعيل أوضاع التقسيم']
    },
  },
  idea_loyalty: {
    title: 'بطاقة الولاء الرقمية',
    tab: 'settings',
    tabLabel: 'الإعدادات',
    setup: async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS loyalty_points (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          place_id UUID REFERENCES places(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          points INTEGER DEFAULT 0,
          last_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(place_id, user_id)
        )
      `
      await db.setSetting('idea_loyalty_config', JSON.stringify({ enabled: true, pointsPerOrder: 1, rewardAt: 10 }))
      return ['تم إنشاء رصيد نقاط الولاء', 'تم حفظ قواعد المكافآت']
    },
  },
  idea_table_timer: {
    title: 'مؤقت الطاولة',
    tab: 'cashier',
    tabLabel: 'الكاشير',
    setup: async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS table_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          place_id UUID REFERENCES places(id) ON DELETE CASCADE,
          table_number TEXT NOT NULL,
          started_at TIMESTAMPTZ DEFAULT NOW(),
          ended_at TIMESTAMPTZ,
          status TEXT DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      await db.setSetting('idea_table_timer_config', JSON.stringify({ enabled: true, warningAfterMinutes: 45 }))
      return ['تم إنشاء جلسات زمنية للطاولات', 'تم حفظ مدة التحذير']
    },
  },
  idea_voice_announce: {
    title: 'إعلان صوتي للطلب',
    tab: 'settings',
    tabLabel: 'الإعدادات',
    setup: async () => {
      await db.setSetting('idea_voice_announce_config', JSON.stringify({ enabled: true, language: 'ar-EG', announceWhen: 'ready' }))
      return ['تم حفظ إعدادات الإعلان الصوتي', 'سيعمل الإعلان عند تجهيز الطلب']
    },
  },
  idea_pdf_reports: {
    title: 'تقارير PDF يومية',
    tab: 'analytics',
    tabLabel: 'التقارير',
    setup: async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS daily_report_exports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          place_id UUID REFERENCES places(id) ON DELETE CASCADE,
          period TEXT NOT NULL,
          generated_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      await db.setSetting('idea_pdf_reports_config', JSON.stringify({ enabled: true, includeSales: true, includeTopProducts: true, includeNetRevenue: true }))
      return ['تم إنشاء سجل تصدير التقارير', 'تم حفظ محتويات التقرير اليومية']
    },
  },
  idea_staff_perf: {
    title: 'لوحة أداء الموظفين',
    tab: 'staff',
    tabLabel: 'الموظفين',
    setup: async () => {
      await db.setupCompanyEmployees()
      await sql`
        CREATE TABLE IF NOT EXISTS employee_performance_snapshots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          place_id UUID REFERENCES places(id) ON DELETE CASCADE,
          employee_id UUID REFERENCES company_employees(id) ON DELETE CASCADE,
          total_orders INTEGER DEFAULT 0,
          total_amount NUMERIC(10,2) DEFAULT 0,
          period TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      await db.setSetting('idea_staff_perf_config', JSON.stringify({ enabled: true, monthlyRanking: true }))
      return ['تم تجهيز بيانات أداء الموظفين', 'تم تفعيل ترتيب الأداء الشهري']
    },
  },
  idea_branch_ctrl: {
    title: 'مركز تحكم الفروع',
    tab: 'live',
    tabLabel: 'البث المباشر',
    setup: async () => {
      await db.setupDevNotifications()
      await db.setSetting('idea_branch_ctrl_config', JSON.stringify({ enabled: true, liveRefreshSeconds: 5, alerts: true }))
      return ['تم تجهيز تنبيهات الفروع', 'تم حفظ إعدادات التحديث اللحظي']
    },
  },
}

export async function POST(request: Request) {
  try {
    const { flagKey } = await request.json()
    if (!flagKey || typeof flagKey !== 'string') {
      return NextResponse.json({ error: 'Idea key required' }, { status: 400 })
    }

    const idea = ideaSetups[flagKey]
    if (!idea) {
      return NextResponse.json({ error: 'Unknown idea' }, { status: 404 })
    }

    const steps = await idea.setup()
    const savedFeatureFlags = await parseJsonSetting<Record<string, boolean>>('feature_flags', {})
    const featureFlags = { ...defaultFeatureFlags, ...savedFeatureFlags }
    featureFlags[flagKey] = true
    await db.setSetting('feature_flags', JSON.stringify(featureFlags))

    const implementedIdeas = await parseJsonSetting<Record<string, unknown>>('implemented_ideas', {})
    implementedIdeas[flagKey] = {
      title: idea.title,
      tab: idea.tab,
      tabLabel: idea.tabLabel,
      implementedAt: new Date().toISOString(),
      steps,
    }
    await db.setSetting('implemented_ideas', JSON.stringify(implementedIdeas))

    return NextResponse.json({
      success: true,
      idea: {
        flagKey,
        title: idea.title,
        tab: idea.tab,
        tabLabel: idea.tabLabel,
      },
      featureFlags,
      implementedIdeas,
      steps,
    })
  } catch (error) {
    console.error('Error implementing AI idea:', error)
    return NextResponse.json({ error: 'Failed to implement idea' }, { status: 500 })
  }
}