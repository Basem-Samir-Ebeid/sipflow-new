import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Scenario = {
  id: string
  name: string
  inputs: Record<string, string>
  createdAt: string
}

async function loadScenarios(flagKey: string): Promise<Scenario[]> {
  const raw = await db.getSetting(`${flagKey}_sandbox_scenarios`)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveScenarios(flagKey: string, scenarios: Scenario[]) {
  await db.setSetting(`${flagKey}_sandbox_scenarios`, JSON.stringify(scenarios))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const flagKey = searchParams.get('flagKey')
    if (!flagKey) {
      return NextResponse.json({ error: 'flagKey required' }, { status: 400 })
    }
    const scenarios = await loadScenarios(flagKey)
    return NextResponse.json({ success: true, flagKey, scenarios })
  } catch (error) {
    console.error('Error fetching scenarios:', error)
    return NextResponse.json({ error: 'Failed to fetch scenarios' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { flagKey, name, inputs } = body
    if (!flagKey || typeof flagKey !== 'string') {
      return NextResponse.json({ error: 'flagKey required' }, { status: 400 })
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    if (!inputs || typeof inputs !== 'object') {
      return NextResponse.json({ error: 'inputs required' }, { status: 400 })
    }

    const scenarios = await loadScenarios(flagKey)
    const newScenario: Scenario = {
      id: `scn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim().slice(0, 60),
      inputs: Object.fromEntries(
        Object.entries(inputs).map(([k, v]) => [String(k), String(v ?? '')])
      ),
      createdAt: new Date().toISOString(),
    }
    scenarios.unshift(newScenario)
    const trimmed = scenarios.slice(0, 20)
    await saveScenarios(flagKey, trimmed)

    return NextResponse.json({ success: true, flagKey, scenarios: trimmed, scenario: newScenario })
  } catch (error) {
    console.error('Error saving scenario:', error)
    return NextResponse.json({ error: 'Failed to save scenario' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const flagKey = searchParams.get('flagKey')
    const id = searchParams.get('id')
    if (!flagKey || !id) {
      return NextResponse.json({ error: 'flagKey and id required' }, { status: 400 })
    }
    const scenarios = await loadScenarios(flagKey)
    const next = scenarios.filter(s => s.id !== id)
    await saveScenarios(flagKey, next)
    return NextResponse.json({ success: true, flagKey, scenarios: next })
  } catch (error) {
    console.error('Error deleting scenario:', error)
    return NextResponse.json({ error: 'Failed to delete scenario' }, { status: 500 })
  }
}
