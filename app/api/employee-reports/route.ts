import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    const month = searchParams.get('month') // format: YYYY-MM
    if (!placeId || !month) {
      return NextResponse.json({ error: 'place_id and month are required' }, { status: 400 })
    }
    const rows = await db.getEmployeeMonthlyReport(placeId, month)
    const report = await Promise.all(
      rows.map(async (row: any) => {
        const breakdown = await db.getEmployeeDrinksBreakdown(row.employee_id, month)
        return {
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          employee_email: row.employee_email,
          month,
          total_orders: parseInt(row.total_orders || '0'),
          total_drinks: parseInt(row.total_drinks || '0'),
          total_amount: parseFloat(row.total_amount || '0'),
          drinks_breakdown: breakdown.map((b: any) => ({
            drink_name: b.drink_name,
            quantity: parseInt(b.quantity || '0'),
            total: parseFloat(b.total || '0')
          }))
        }
      })
    )
    return NextResponse.json(report)
  } catch (error) {
    console.error('Error fetching employee reports:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}
