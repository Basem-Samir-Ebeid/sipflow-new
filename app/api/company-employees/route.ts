import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('place_id')
    if (!placeId) return NextResponse.json({ error: 'place_id required' }, { status: 400 })
    const employees = await db.getCompanyEmployees(placeId)
    return NextResponse.json(employees)
  } catch (error) {
    console.error('Error fetching company employees:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { place_id, name, email, password, avatar_url, department, title } = body
    if (!place_id || !name || !email || !password) {
      return NextResponse.json({ error: 'place_id, name, email, password are required' }, { status: 400 })
    }
    const employee = await db.createCompanyEmployee({ place_id, name, email, password, avatar_url, department, title })
    return NextResponse.json(employee)
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'هذا الإيميل مسجل بالفعل في هذا المكان' }, { status: 400 })
    }
    console.error('Error creating company employee:', error)
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}
