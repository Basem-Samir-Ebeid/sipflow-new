import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drinkId: string }> }
) {
  try {
    const { drinkId } = await params
    const inventory = await db.getInventoryByDrinkId(drinkId)
    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventory not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(inventory)
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ drinkId: string }> }
) {
  try {
    const { drinkId } = await params
    const body = await request.json()
    const { quantity, action } = body

    // Support increment/decrement actions
    if (action === 'increment') {
      const inventory = await db.incrementInventory(drinkId, quantity || 1)
      return NextResponse.json(inventory)
    }
    
    if (action === 'decrement') {
      const inventory = await db.decrementInventory(drinkId, quantity || 1)
      return NextResponse.json(inventory)
    }

    // Direct quantity update
    if (quantity === undefined || typeof quantity !== 'number') {
      return NextResponse.json(
        { error: 'Invalid quantity value' },
        { status: 400 }
      )
    }

    const inventory = await db.updateInventory(drinkId, quantity)
    return NextResponse.json(inventory)
  } catch (error) {
    console.error('Error updating inventory:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory' },
      { status: 500 }
    )
  }
}
