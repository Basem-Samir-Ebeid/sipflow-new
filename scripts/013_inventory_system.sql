-- 013_inventory_system.sql — Smart ingredient-based inventory
-- Adds: suppliers, ingredients, recipes, recipe_items, stock_movements,
-- purchase_orders, purchase_order_items

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  payment_terms TEXT,
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredients (
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
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ingredients_place ON ingredients(place_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drink_id UUID REFERENCES drinks(id) ON DELETE CASCADE,
  size TEXT DEFAULT 'default',
  is_addon BOOLEAN DEFAULT false,
  addon_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_drink_size ON recipes(drink_id, size) WHERE is_addon = false;
CREATE INDEX IF NOT EXISTS idx_recipes_drink ON recipes(drink_id);

CREATE TABLE IF NOT EXISTS recipe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON recipe_items(recipe_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL,
  unit TEXT NOT NULL,
  reason TEXT,
  reference_id UUID,
  reference_type TEXT,
  user_id UUID,
  user_name TEXT,
  cost_total NUMERIC(12,4) DEFAULT 0,
  place_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_type ON stock_movements(movement_type);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft',
  total_cost NUMERIC(12,2) DEFAULT 0,
  expected_date DATE,
  received_date DATE,
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_ordered NUMERIC(14,3) NOT NULL,
  quantity_received NUMERIC(14,3) DEFAULT 0,
  unit TEXT NOT NULL,
  unit_cost NUMERIC(12,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
