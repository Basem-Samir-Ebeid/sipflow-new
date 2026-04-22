import { getSql } from './db'
import { toBase, normalizeUnit } from './units'

const sql = getSql()

// ─────────────────────────────────────────────────────────────
// Schema bootstrap (idempotent)
// ─────────────────────────────────────────────────────────────
let _schemaReady = false
export async function ensureInventorySchema() {
  if (_schemaReady) return
  try {
    await sql`CREATE TABLE IF NOT EXISTS suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL, phone TEXT, email TEXT, notes TEXT, payment_terms TEXT,
      place_id UUID REFERENCES places(id) ON DELETE CASCADE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE TABLE IF NOT EXISTS ingredients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name_ar TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      unit TEXT NOT NULL DEFAULT 'g',
      current_stock NUMERIC(14,3) DEFAULT 0,
      min_threshold NUMERIC(14,3) DEFAULT 0,
      reorder_point NUMERIC(14,3) DEFAULT 0,
      reorder_quantity NUMERIC(14,3) DEFAULT 0,
      cost_per_unit NUMERIC(12,4) DEFAULT 0,
      supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
      expiry_date DATE,
      place_id UUID REFERENCES places(id) ON DELETE CASCADE,
      is_active BOOLEAN DEFAULT true, notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE INDEX IF NOT EXISTS idx_ingredients_place ON ingredients(place_id)`
    await sql`CREATE TABLE IF NOT EXISTS recipes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      drink_id UUID REFERENCES drinks(id) ON DELETE CASCADE,
      size TEXT DEFAULT 'default', is_addon BOOLEAN DEFAULT false, addon_name TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE INDEX IF NOT EXISTS idx_recipes_drink ON recipes(drink_id)`
    await sql`CREATE TABLE IF NOT EXISTS recipe_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
      ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
      quantity NUMERIC(12,3) NOT NULL, unit TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE TABLE IF NOT EXISTS stock_movements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
      movement_type TEXT NOT NULL,
      quantity NUMERIC(14,3) NOT NULL, unit TEXT NOT NULL,
      reason TEXT, reference_id UUID, reference_type TEXT,
      user_id UUID, user_name TEXT,
      cost_total NUMERIC(12,4) DEFAULT 0,
      place_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE INDEX IF NOT EXISTS idx_movements_ingredient ON stock_movements(ingredient_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at DESC)`
    await sql`CREATE TABLE IF NOT EXISTS purchase_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      po_number TEXT UNIQUE,
      supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'draft',
      total_cost NUMERIC(12,2) DEFAULT 0,
      expected_date DATE, received_date DATE,
      place_id UUID REFERENCES places(id) ON DELETE CASCADE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE TABLE IF NOT EXISTS purchase_order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
      ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
      quantity_ordered NUMERIC(14,3) NOT NULL,
      quantity_received NUMERIC(14,3) DEFAULT 0,
      unit TEXT NOT NULL,
      unit_cost NUMERIC(12,4) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
    _schemaReady = true
  } catch (e) {
    console.error('ensureInventorySchema error', e)
  }
}

// ─────────────────────────────────────────────────────────────
// Ingredients CRUD
// ─────────────────────────────────────────────────────────────
export async function listIngredients(opts: { placeId?: string | null; includeGlobal?: boolean } = {}) {
  await ensureInventorySchema()
  const { placeId, includeGlobal = true } = opts
  if (placeId && includeGlobal) {
    return await sql`SELECT i.*, s.name as supplier_name FROM ingredients i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.place_id = ${placeId} OR i.place_id IS NULL
      ORDER BY i.category, i.name_ar`
  }
  if (placeId) {
    return await sql`SELECT i.*, s.name as supplier_name FROM ingredients i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.place_id = ${placeId}
      ORDER BY i.category, i.name_ar`
  }
  return await sql`SELECT i.*, s.name as supplier_name FROM ingredients i
    LEFT JOIN suppliers s ON i.supplier_id = s.id
    ORDER BY i.category, i.name_ar`
}

export async function getIngredient(id: string) {
  await ensureInventorySchema()
  const r = await sql`SELECT * FROM ingredients WHERE id = ${id}`
  return r[0] || null
}

export async function createIngredient(data: any) {
  await ensureInventorySchema()
  const r = await sql`INSERT INTO ingredients
    (name_ar, category, unit, current_stock, min_threshold, reorder_point, reorder_quantity,
     cost_per_unit, supplier_id, expiry_date, place_id, notes)
    VALUES (${data.name_ar}, ${data.category || 'other'}, ${data.unit || 'g'},
      ${data.current_stock || 0}, ${data.min_threshold || 0}, ${data.reorder_point || 0},
      ${data.reorder_quantity || 0}, ${data.cost_per_unit || 0}, ${data.supplier_id || null},
      ${data.expiry_date || null}, ${data.place_id || null}, ${data.notes || null})
    RETURNING *`
  return r[0]
}

export async function updateIngredient(id: string, data: any) {
  await ensureInventorySchema()
  const r = await sql`UPDATE ingredients SET
    name_ar = COALESCE(${data.name_ar ?? null}, name_ar),
    category = COALESCE(${data.category ?? null}, category),
    unit = COALESCE(${data.unit ?? null}, unit),
    current_stock = COALESCE(${data.current_stock ?? null}, current_stock),
    min_threshold = COALESCE(${data.min_threshold ?? null}, min_threshold),
    reorder_point = COALESCE(${data.reorder_point ?? null}, reorder_point),
    reorder_quantity = COALESCE(${data.reorder_quantity ?? null}, reorder_quantity),
    cost_per_unit = COALESCE(${data.cost_per_unit ?? null}, cost_per_unit),
    supplier_id = CASE WHEN ${data.supplier_id !== undefined} THEN ${data.supplier_id ?? null} ELSE supplier_id END,
    expiry_date = CASE WHEN ${data.expiry_date !== undefined} THEN ${data.expiry_date ?? null} ELSE expiry_date END,
    place_id = CASE WHEN ${data.place_id !== undefined} THEN ${data.place_id ?? null} ELSE place_id END,
    is_active = COALESCE(${data.is_active ?? null}, is_active),
    notes = CASE WHEN ${data.notes !== undefined} THEN ${data.notes ?? null} ELSE notes END,
    updated_at = NOW()
    WHERE id = ${id} RETURNING *`
  return r[0]
}

export async function deleteIngredient(id: string) {
  await sql`DELETE FROM ingredients WHERE id = ${id}`
}

// ─────────────────────────────────────────────────────────────
// Recipes
// ─────────────────────────────────────────────────────────────
export async function getRecipesForDrink(drinkId: string) {
  await ensureInventorySchema()
  const recipes = await sql`SELECT * FROM recipes WHERE drink_id = ${drinkId} ORDER BY is_addon, size`
  if (!recipes.length) return []
  const ids = recipes.map((r: any) => r.id)
  const items = await sql`SELECT ri.*, i.name_ar as ingredient_name, i.unit as base_unit, i.cost_per_unit
    FROM recipe_items ri
    LEFT JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE ri.recipe_id = ANY(${ids})`
  return recipes.map((r: any) => ({ ...r, items: items.filter((it: any) => it.recipe_id === r.id) }))
}

export async function saveRecipe(payload: {
  drink_id: string
  size?: string
  is_addon?: boolean
  addon_name?: string | null
  notes?: string | null
  items: { ingredient_id: string; quantity: number; unit: string }[]
  recipe_id?: string | null
}) {
  await ensureInventorySchema()
  let recipeId = payload.recipe_id
  if (recipeId) {
    await sql`UPDATE recipes SET size = ${payload.size || 'default'},
      is_addon = ${payload.is_addon || false},
      addon_name = ${payload.addon_name || null},
      notes = ${payload.notes || null},
      updated_at = NOW() WHERE id = ${recipeId}`
    await sql`DELETE FROM recipe_items WHERE recipe_id = ${recipeId}`
  } else {
    const r = await sql`INSERT INTO recipes (drink_id, size, is_addon, addon_name, notes)
      VALUES (${payload.drink_id}, ${payload.size || 'default'},
        ${payload.is_addon || false}, ${payload.addon_name || null}, ${payload.notes || null})
      RETURNING id`
    recipeId = r[0].id
  }
  for (const it of payload.items) {
    await sql`INSERT INTO recipe_items (recipe_id, ingredient_id, quantity, unit)
      VALUES (${recipeId}, ${it.ingredient_id}, ${it.quantity}, ${it.unit})`
  }
  return recipeId
}

export async function deleteRecipe(id: string) {
  await sql`DELETE FROM recipes WHERE id = ${id}`
}

// ─────────────────────────────────────────────────────────────
// Stock movements & auto-deduct on order
// ─────────────────────────────────────────────────────────────
export async function recordMovement(m: {
  ingredient_id: string
  movement_type: 'sale' | 'purchase' | 'waste' | 'adjustment' | 'transfer' | 'return'
  quantity: number // in the ingredient's base unit, signed
  unit: string
  reason?: string
  reference_id?: string | null
  reference_type?: string | null
  user_id?: string | null
  user_name?: string | null
  cost_total?: number
  place_id?: string | null
  applyToStock?: boolean // default true
}) {
  await ensureInventorySchema()
  const apply = m.applyToStock !== false
  if (apply) {
    await sql`UPDATE ingredients SET current_stock = GREATEST(0, current_stock + ${m.quantity}),
      updated_at = NOW() WHERE id = ${m.ingredient_id}`
  }
  await sql`INSERT INTO stock_movements
    (ingredient_id, movement_type, quantity, unit, reason, reference_id, reference_type,
     user_id, user_name, cost_total, place_id)
    VALUES (${m.ingredient_id}, ${m.movement_type}, ${m.quantity}, ${m.unit},
      ${m.reason || null}, ${m.reference_id || null}, ${m.reference_type || null},
      ${m.user_id || null}, ${m.user_name || null}, ${m.cost_total || 0}, ${m.place_id || null})`
}

/** Auto-deduct ingredients when an order is created. Returns { deducted, missing } */
export async function deductForOrder(opts: {
  drink_id: string
  quantity: number
  size?: string
  order_id?: string | null
  place_id?: string | null
  user_name?: string | null
}) {
  await ensureInventorySchema()
  const size = opts.size || 'default'
  let recipe = (await sql`SELECT * FROM recipes WHERE drink_id = ${opts.drink_id} AND size = ${size} AND is_addon = false LIMIT 1`)[0]
  if (!recipe) {
    recipe = (await sql`SELECT * FROM recipes WHERE drink_id = ${opts.drink_id} AND is_addon = false ORDER BY created_at LIMIT 1`)[0]
  }
  if (!recipe) return { deducted: 0, missing: [], note: 'no_recipe' }

  const items = await sql`SELECT ri.*, i.unit as base_unit, i.name_ar, i.cost_per_unit, i.current_stock
    FROM recipe_items ri JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE ri.recipe_id = ${recipe.id}`

  const missing: any[] = []
  let deducted = 0
  for (const it of items) {
    const conv = toBase(Number(it.quantity) * opts.quantity, it.unit)
    const required = conv.qty
    const available = Number(it.current_stock || 0)
    if (available < required) {
      missing.push({ ingredient_id: it.ingredient_id, name: it.name_ar, required, available, unit: it.base_unit })
    }
    const cost = Number(it.cost_per_unit || 0) * required
    await recordMovement({
      ingredient_id: it.ingredient_id,
      movement_type: 'sale',
      quantity: -required,
      unit: it.base_unit,
      reason: `بيع: ${opts.quantity}× مشروب`,
      reference_id: opts.order_id || null,
      reference_type: 'order',
      user_name: opts.user_name || null,
      cost_total: -cost,
      place_id: opts.place_id || null,
    })
    deducted++
  }
  return { deducted, missing }
}

// ─────────────────────────────────────────────────────────────
// Movements log
// ─────────────────────────────────────────────────────────────
export async function listMovements(opts: { placeId?: string | null; ingredientId?: string; type?: string; limit?: number } = {}) {
  await ensureInventorySchema()
  const limit = opts.limit || 200
  const placeId = opts.placeId || null
  const ingredientId = opts.ingredientId || null
  const type = opts.type || null
  return await sql`SELECT m.*, i.name_ar as ingredient_name, i.unit as base_unit
    FROM stock_movements m
    LEFT JOIN ingredients i ON m.ingredient_id = i.id
    WHERE (${placeId}::uuid IS NULL OR m.place_id = ${placeId}::uuid OR i.place_id = ${placeId}::uuid OR i.place_id IS NULL)
      AND (${ingredientId}::uuid IS NULL OR m.ingredient_id = ${ingredientId}::uuid)
      AND (${type}::text IS NULL OR m.movement_type = ${type}::text)
    ORDER BY m.created_at DESC LIMIT ${limit}`
}

// ─────────────────────────────────────────────────────────────
// Suppliers
// ─────────────────────────────────────────────────────────────
export async function listSuppliers(placeId?: string | null) {
  await ensureInventorySchema()
  if (placeId) return await sql`SELECT * FROM suppliers WHERE place_id = ${placeId} OR place_id IS NULL ORDER BY name`
  return await sql`SELECT * FROM suppliers ORDER BY name`
}
export async function createSupplier(data: any) {
  await ensureInventorySchema()
  const r = await sql`INSERT INTO suppliers (name, phone, email, notes, payment_terms, place_id)
    VALUES (${data.name}, ${data.phone || null}, ${data.email || null}, ${data.notes || null},
      ${data.payment_terms || null}, ${data.place_id || null}) RETURNING *`
  return r[0]
}
export async function updateSupplier(id: string, data: any) {
  await ensureInventorySchema()
  const r = await sql`UPDATE suppliers SET
    name = COALESCE(${data.name ?? null}, name),
    phone = CASE WHEN ${data.phone !== undefined} THEN ${data.phone ?? null} ELSE phone END,
    email = CASE WHEN ${data.email !== undefined} THEN ${data.email ?? null} ELSE email END,
    notes = CASE WHEN ${data.notes !== undefined} THEN ${data.notes ?? null} ELSE notes END,
    payment_terms = CASE WHEN ${data.payment_terms !== undefined} THEN ${data.payment_terms ?? null} ELSE payment_terms END,
    is_active = COALESCE(${data.is_active ?? null}, is_active),
    updated_at = NOW() WHERE id = ${id} RETURNING *`
  return r[0]
}
export async function deleteSupplier(id: string) {
  await sql`DELETE FROM suppliers WHERE id = ${id}`
}

// ─────────────────────────────────────────────────────────────
// Purchase Orders
// ─────────────────────────────────────────────────────────────
export async function listPurchaseOrders(placeId?: string | null) {
  await ensureInventorySchema()
  let pos: any[]
  if (placeId) {
    pos = await sql`SELECT po.*, s.name as supplier_name FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.place_id = ${placeId} OR po.place_id IS NULL
      ORDER BY po.created_at DESC`
  } else {
    pos = await sql`SELECT po.*, s.name as supplier_name FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY po.created_at DESC`
  }
  if (!pos.length) return []
  const ids = pos.map((p: any) => p.id)
  const items = await sql`SELECT pi.*, i.name_ar as ingredient_name, i.unit as base_unit
    FROM purchase_order_items pi
    LEFT JOIN ingredients i ON pi.ingredient_id = i.id
    WHERE pi.po_id = ANY(${ids})`
  return pos.map((p: any) => ({ ...p, items: items.filter((it: any) => it.po_id === p.id) }))
}

export async function createPurchaseOrder(data: {
  supplier_id?: string | null
  expected_date?: string | null
  place_id?: string | null
  notes?: string | null
  items: { ingredient_id: string; quantity_ordered: number; unit: string; unit_cost: number }[]
}) {
  await ensureInventorySchema()
  const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`
  const total = data.items.reduce((s, it) => s + Number(it.quantity_ordered) * Number(it.unit_cost), 0)
  const r = await sql`INSERT INTO purchase_orders (po_number, supplier_id, expected_date, place_id, notes, total_cost, status)
    VALUES (${poNumber}, ${data.supplier_id || null}, ${data.expected_date || null},
      ${data.place_id || null}, ${data.notes || null}, ${total}, 'draft')
    RETURNING *`
  const po = r[0]
  for (const it of data.items) {
    await sql`INSERT INTO purchase_order_items (po_id, ingredient_id, quantity_ordered, unit, unit_cost)
      VALUES (${po.id}, ${it.ingredient_id}, ${it.quantity_ordered}, ${it.unit}, ${it.unit_cost})`
  }
  return po
}

export async function updatePurchaseOrderStatus(id: string, status: string) {
  await ensureInventorySchema()
  const r = await sql`UPDATE purchase_orders SET status = ${status},
    received_date = CASE WHEN ${status} = 'received' THEN CURRENT_DATE ELSE received_date END,
    updated_at = NOW() WHERE id = ${id} RETURNING *`
  return r[0]
}

/** Receive items: increments stock, records movement, updates PO status. */
export async function receivePurchaseOrder(id: string, receipts: { item_id: string; quantity_received: number }[], userName?: string) {
  await ensureInventorySchema()
  const po = (await sql`SELECT * FROM purchase_orders WHERE id = ${id}`)[0]
  if (!po) throw new Error('PO not found')
  for (const rec of receipts) {
    if (!rec.quantity_received || rec.quantity_received <= 0) continue
    const item = (await sql`SELECT pi.*, i.unit as base_unit FROM purchase_order_items pi
      JOIN ingredients i ON pi.ingredient_id = i.id WHERE pi.id = ${rec.item_id}`)[0]
    if (!item) continue
    const inBase = toBase(rec.quantity_received, item.unit)
    await sql`UPDATE purchase_order_items SET quantity_received = quantity_received + ${rec.quantity_received}
      WHERE id = ${rec.item_id}`
    await recordMovement({
      ingredient_id: item.ingredient_id,
      movement_type: 'purchase',
      quantity: inBase.qty,
      unit: item.base_unit,
      reason: `استلام شحنة ${po.po_number}`,
      reference_id: po.id,
      reference_type: 'po',
      user_name: userName || null,
      cost_total: rec.quantity_received * Number(item.unit_cost || 0),
      place_id: po.place_id,
    })
  }
  // Determine if fully received
  const items = await sql`SELECT * FROM purchase_order_items WHERE po_id = ${id}`
  const allFull = items.every((it: any) => Number(it.quantity_received) >= Number(it.quantity_ordered))
  const partial = items.some((it: any) => Number(it.quantity_received) > 0)
  const newStatus = allFull ? 'received' : (partial ? 'partial' : po.status)
  await updatePurchaseOrderStatus(id, newStatus)
  return { status: newStatus }
}

export async function deletePurchaseOrder(id: string) {
  await sql`DELETE FROM purchase_orders WHERE id = ${id}`
}

// ─────────────────────────────────────────────────────────────
// Smart features: dashboard, forecast, leak, profitability
// ─────────────────────────────────────────────────────────────
export async function dashboardKPIs(placeId?: string | null) {
  await ensureInventorySchema()
  const ings = await listIngredients({ placeId, includeGlobal: true })
  const totalValue = ings.reduce((s: number, i: any) => s + Number(i.current_stock || 0) * Number(i.cost_per_unit || 0), 0)
  const lowStock = ings.filter((i: any) => Number(i.current_stock) <= Number(i.reorder_point) && Number(i.reorder_point) > 0)
  const outOfStock = ings.filter((i: any) => Number(i.current_stock) <= 0)
  const expiringSoon = ings.filter((i: any) => {
    if (!i.expiry_date) return false
    const d = new Date(i.expiry_date)
    const days = (d.getTime() - Date.now()) / 86400000
    return days <= 7 && days >= 0
  })
  // Top consumed (last 30 days)
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const placeIdParam = placeId || null
  const topConsumed = await sql`SELECT m.ingredient_id, i.name_ar, i.unit,
    SUM(ABS(m.quantity)) as total_used, SUM(ABS(m.cost_total)) as total_cost
    FROM stock_movements m JOIN ingredients i ON m.ingredient_id = i.id
    WHERE m.movement_type = 'sale' AND m.created_at >= ${since}
      AND (${placeIdParam}::uuid IS NULL OR i.place_id = ${placeIdParam}::uuid OR i.place_id IS NULL)
    GROUP BY m.ingredient_id, i.name_ar, i.unit
    ORDER BY total_used DESC LIMIT 5`
  // Waste cost this month
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const wasteRow = await sql`SELECT COALESCE(SUM(ABS(cost_total)), 0) as waste_cost
    FROM stock_movements WHERE movement_type = 'waste' AND created_at >= ${monthStart.toISOString()}
      AND (${placeIdParam}::uuid IS NULL OR place_id = ${placeIdParam}::uuid)`
  return {
    totalValue,
    ingredientCount: ings.length,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    expiringSoonCount: expiringSoon.length,
    lowStock,
    outOfStock,
    expiringSoon,
    topConsumed,
    wasteCost: Number(wasteRow[0]?.waste_cost || 0),
  }
}

/** Forecast days remaining per ingredient based on avg daily consumption (last 14 days). */
export async function forecastIngredients(placeId?: string | null) {
  await ensureInventorySchema()
  const ings = await listIngredients({ placeId, includeGlobal: true })
  const since = new Date(Date.now() - 14 * 86400000).toISOString()
  const usage = await sql`SELECT ingredient_id, SUM(ABS(quantity)) as total_used
    FROM stock_movements WHERE movement_type = 'sale' AND created_at >= ${since}
    GROUP BY ingredient_id`
  const usageMap: Record<string, number> = {}
  for (const u of usage) usageMap[u.ingredient_id] = Number(u.total_used)
  return ings.map((i: any) => {
    const dailyAvg = (usageMap[i.id] || 0) / 14
    const daysLeft = dailyAvg > 0 ? Number(i.current_stock) / dailyAvg : null
    return {
      id: i.id, name_ar: i.name_ar, unit: i.unit, current_stock: Number(i.current_stock),
      daily_avg: dailyAvg, days_left: daysLeft, reorder_point: Number(i.reorder_point),
      reorder_quantity: Number(i.reorder_quantity), supplier_id: i.supplier_id,
    }
  })
}

/** Leak detection: compare expected (recipe × sales) vs actual movements. */
export async function leakDetection(placeId?: string | null, days = 7) {
  await ensureInventorySchema()
  const since = new Date(Date.now() - days * 86400000).toISOString()
  // Sales orders
  const placeIdParam = placeId || null
  const orders = await sql`SELECT o.drink_id, SUM(o.quantity) as qty
    FROM orders o LEFT JOIN sessions s ON o.session_id = s.id
    WHERE o.created_at >= ${since}
      AND (${placeIdParam}::uuid IS NULL OR s.place_id = ${placeIdParam}::uuid)
    GROUP BY o.drink_id`
  // Expected per ingredient
  const expectedMap: Record<string, number> = {}
  for (const o of orders) {
    const recipe = (await sql`SELECT * FROM recipes WHERE drink_id = ${o.drink_id} AND is_addon = false LIMIT 1`)[0]
    if (!recipe) continue
    const items = await sql`SELECT ri.*, i.unit as base_unit FROM recipe_items ri
      JOIN ingredients i ON ri.ingredient_id = i.id WHERE ri.recipe_id = ${recipe.id}`
    for (const it of items) {
      const conv = toBase(Number(it.quantity) * Number(o.qty), it.unit)
      expectedMap[it.ingredient_id] = (expectedMap[it.ingredient_id] || 0) + conv.qty
    }
  }
  // Actual deductions
  const actual = await sql`SELECT ingredient_id, SUM(ABS(quantity)) as total
    FROM stock_movements WHERE movement_type IN ('sale','waste','adjustment')
    AND created_at >= ${since} GROUP BY ingredient_id`
  const actualMap: Record<string, number> = {}
  for (const a of actual) actualMap[a.ingredient_id] = Number(a.total)
  const ings = await listIngredients({ placeId, includeGlobal: true })
  const report = ings.map((i: any) => {
    const expected = expectedMap[i.id] || 0
    const consumed = actualMap[i.id] || 0
    const variance = consumed - expected
    return { id: i.id, name_ar: i.name_ar, unit: i.unit, expected, actual: consumed, variance }
  }).filter((r: any) => Math.abs(r.variance) > 0.01)
  return report
}

/** Profitability of every drink. */
export async function profitability(placeId?: string | null) {
  await ensureInventorySchema()
  const drinks = placeId
    ? await sql`SELECT * FROM drinks WHERE place_id = ${placeId} OR place_id IS NULL ORDER BY name`
    : await sql`SELECT * FROM drinks ORDER BY name`
  const result: any[] = []
  for (const d of drinks) {
    const recipe = (await sql`SELECT * FROM recipes WHERE drink_id = ${d.id} AND is_addon = false LIMIT 1`)[0]
    if (!recipe) { result.push({ ...d, cost: null, margin: null, margin_pct: null }); continue }
    const items = await sql`SELECT ri.*, i.cost_per_unit, i.unit as base_unit FROM recipe_items ri
      JOIN ingredients i ON ri.ingredient_id = i.id WHERE ri.recipe_id = ${recipe.id}`
    const cost = items.reduce((s: number, it: any) => {
      const conv = toBase(Number(it.quantity), it.unit)
      return s + conv.qty * Number(it.cost_per_unit || 0)
    }, 0)
    const margin = Number(d.price) - cost
    const margin_pct = d.price > 0 ? (margin / Number(d.price)) * 100 : 0
    result.push({ id: d.id, name: d.name, price: Number(d.price), cost, margin, margin_pct })
  }
  return result.sort((a, b) => (b.margin_pct || 0) - (a.margin_pct || 0))
}

/** Auto-suggest POs for ingredients at/below reorder point. */
export async function suggestPurchaseOrders(placeId?: string | null) {
  const fc = await forecastIngredients(placeId)
  const lows = fc.filter((i: any) => i.current_stock <= i.reorder_point && i.reorder_point > 0)
  // Group by supplier
  const ings = await listIngredients({ placeId, includeGlobal: true })
  const byId: Record<string, any> = {}
  for (const i of ings) byId[i.id] = i
  const grouped: Record<string, any[]> = {}
  for (const l of lows) {
    const ing = byId[l.id]
    const supId = ing?.supplier_id || 'no_supplier'
    if (!grouped[supId]) grouped[supId] = []
    grouped[supId].push({
      ingredient_id: l.id,
      name_ar: l.name_ar,
      quantity_ordered: l.reorder_quantity || (l.daily_avg * 14),
      unit: ing?.unit || 'g',
      unit_cost: Number(ing?.cost_per_unit || 0),
      current_stock: l.current_stock,
      days_left: l.days_left,
    })
  }
  return grouped
}
