import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down'
  latency: number
  message: string
}

async function checkDatabase(): Promise<HealthStatus> {
  const start = Date.now()
  try {
    const { error } = await supabase.from('places').select('id').limit(1)
    const latency = Date.now() - start
    
    if (error) {
      return { status: 'down', latency, message: error.message }
    }
    
    if (latency > 500) {
      return { status: 'degraded', latency, message: 'استجابة بطيئة' }
    }
    
    return { status: 'healthy', latency, message: 'يعمل بشكل طبيعي' }
  } catch (err) {
    return { status: 'down', latency: Date.now() - start, message: err instanceof Error ? err.message : 'فشل الاتصال' }
  }
}

async function checkAPI(): Promise<HealthStatus> {
  const start = Date.now()
  try {
    // Simple API check - verify environment is configured
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
    const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    const latency = Date.now() - start
    
    if (!hasUrl || !hasKey) {
      return { status: 'down', latency, message: 'إعدادات مفقودة' }
    }
    
    return { status: 'healthy', latency, message: 'يعمل بشكل طبيعي' }
  } catch (err) {
    return { status: 'down', latency: Date.now() - start, message: err instanceof Error ? err.message : 'خطأ' }
  }
}

async function checkStorage(): Promise<HealthStatus> {
  const start = Date.now()
  try {
    // Check if storage bucket exists by listing
    const { error } = await supabase.storage.listBuckets()
    const latency = Date.now() - start
    
    if (error) {
      return { status: 'degraded', latency, message: error.message }
    }
    
    if (latency > 1000) {
      return { status: 'degraded', latency, message: 'استجابة بطيئة' }
    }
    
    return { status: 'healthy', latency, message: 'يعمل بشكل طبيعي' }
  } catch (err) {
    return { status: 'down', latency: Date.now() - start, message: err instanceof Error ? err.message : 'فشل الاتصال' }
  }
}

export async function GET(request: NextRequest) {
  // Auth check
  const secret = request.headers.get('x-admin-secret')
  if (secret !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Run all health checks in parallel
    const [dbCheck, apiCheck, storageCheck] = await Promise.all([
      checkDatabase(),
      checkAPI(),
      checkStorage(),
    ])

    // Determine overall status
    const statuses = [dbCheck.status, apiCheck.status, storageCheck.status]
    let overall: 'healthy' | 'degraded' | 'down' = 'healthy'
    
    if (statuses.includes('down')) {
      overall = 'down'
    } else if (statuses.includes('degraded')) {
      overall = 'degraded'
    }

    // Fetch system stats
    const [
      placesResult,
      usersResult,
      drinksResult,
      ordersResult,
      sessionsResult,
    ] = await Promise.all([
      supabase.from('places').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('drinks').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ])

    // Estimate DB size (rough approximation)
    const totalRecords = 
      (placesResult.count || 0) +
      (usersResult.count || 0) +
      (drinksResult.count || 0) +
      (ordersResult.count || 0)
    
    const estimatedSizeKB = totalRecords * 0.5 // ~0.5KB per record estimate
    const dbSize = estimatedSizeKB > 1024 
      ? `${(estimatedSizeKB / 1024).toFixed(1)} MB`
      : `${estimatedSizeKB.toFixed(0)} KB`

    // Get recent errors (from dev_notifications if exists, otherwise empty)
    let recentErrors: { id: string; message: string; timestamp: string; type: string }[] = []
    try {
      const { data: notifications } = await supabase
        .from('dev_notifications')
        .select('id, message, created_at, type')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (notifications) {
        recentErrors = notifications.map(n => ({
          id: n.id,
          message: n.message,
          timestamp: n.created_at,
          type: n.type || 'error'
        }))
      }
    } catch {
      // Table might not exist, ignore
    }

    return NextResponse.json({
      overall,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
        api: apiCheck,
        storage: storageCheck,
      },
      stats: {
        totalPlaces: placesResult.count || 0,
        totalUsers: usersResult.count || 0,
        totalDrinks: drinksResult.count || 0,
        totalOrders: ordersResult.count || 0,
        activeSessionsCount: sessionsResult.count || 0,
        dbSize,
      },
      recentErrors,
    })

  } catch (err) {
    return NextResponse.json({
      overall: 'down',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'down', latency: 0, message: 'فشل الفحص' },
        api: { status: 'down', latency: 0, message: 'فشل الفحص' },
        storage: { status: 'down', latency: 0, message: 'فشل الفحص' },
      },
      stats: {
        totalPlaces: 0,
        totalUsers: 0,
        totalDrinks: 0,
        totalOrders: 0,
        activeSessionsCount: 0,
        dbSize: '—',
      },
      recentErrors: [{
        id: 'check-error',
        message: err instanceof Error ? err.message : 'خطأ غير معروف',
        timestamp: new Date().toISOString(),
        type: 'system'
      }],
    })
  }
}
