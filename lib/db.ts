import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

function getPool() {
  if (!global._pgPool) {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set.')
    }
    const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('/var/run')
    if (isLocalDb) {
      global._pgPool = new Pool({ connectionString: dbUrl, ssl: false })
    } else {
      const urlWithSsl = dbUrl.includes('sslmode=') ? dbUrl : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}sslmode=require`
      global._pgPool = new Pool({ connectionString: urlWithSsl })
    }
  }
  return global._pgPool
}

async function sql(strings: TemplateStringsArray, ...values: any[]) {
  const client = getPool()
  let query = ''
  const params: any[] = []
  strings.forEach((str, i) => {
    query += str
    if (i < values.length) {
      params.push(values[i])
      query += `$${params.length}`
    }
  })
  const result = await client.query(query, params)
  return result.rows
}

export function getSql() {
  return sql
}

export type QueryResult<T> = T[]

export const db = {
  // ─── Places ────────────────────────────────────────────
  async getPlaces() {
    return await sql`SELECT * FROM places ORDER BY created_at`
  },

  async getPlaceByCode(code: string) {
    const trimmed = code.trim()
    const result = await sql`SELECT * FROM places WHERE UPPER(code) = UPPER(${trimmed}) OR UPPER(name) = UPPER(${trimmed})`
    return result[0] || null
  },

  async getPlaceById(id: string) {
    const result = await sql`SELECT * FROM places WHERE id = ${id}`
    return result[0] || null
  },

  async createPlace(data: { name: string; code: string; description?: string; place_type?: string }) {
    const result = await sql`
      INSERT INTO places (name, code, description, is_active, place_type)
      VALUES (${data.name}, ${data.code}, ${data.description || null}, true, ${data.place_type || 'cafe'})
      RETURNING *
    `
    return result[0]
  },

  async updatePlace(id: string, data: { name?: string; description?: string; is_active?: boolean; logo_url?: string | null; table_count?: number | null; service_charge?: number | null; tax_rate?: number | null; reservations_enabled?: boolean | null; order_tracking_enabled?: boolean | null }) {
    await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS service_charge NUMERIC(5,2) DEFAULT 0`.catch(() => {})
    await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 0`.catch(() => {})
    await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS reservations_enabled BOOLEAN DEFAULT false`.catch(() => {})
    await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS order_tracking_enabled BOOLEAN DEFAULT true`.catch(() => {})
    const result = await sql`
      UPDATE places
      SET name = COALESCE(${data.name ?? null}, name),
          description = COALESCE(${data.description ?? null}, description),
          is_active = COALESCE(${data.is_active ?? null}, is_active),
          logo_url = CASE WHEN ${data.logo_url !== undefined} THEN ${data.logo_url ?? null} ELSE logo_url END,
          table_count = CASE WHEN ${data.table_count !== undefined} THEN ${data.table_count ?? null} ELSE table_count END,
          service_charge = CASE WHEN ${data.service_charge !== undefined} THEN ${data.service_charge ?? 0} ELSE service_charge END,
          tax_rate = CASE WHEN ${data.tax_rate !== undefined} THEN ${data.tax_rate ?? 0} ELSE tax_rate END,
          reservations_enabled = CASE WHEN ${data.reservations_enabled !== undefined} THEN ${data.reservations_enabled ?? false} ELSE reservations_enabled END,
          order_tracking_enabled = CASE WHEN ${data.order_tracking_enabled !== undefined} THEN ${data.order_tracking_enabled ?? true} ELSE order_tracking_enabled END,
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    return result[0]
  },

  async migrateAddTableCount() {
    try {
      await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS table_count INTEGER DEFAULT 10`
      await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS service_charge NUMERIC(5,2) DEFAULT 0`
      await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 0`
    } catch { /* columns may already exist */ }
  },

  async deletePlace(id: string) {
    await sql`DELETE FROM places WHERE id = ${id}`
  },

  // ─── Drinks ────────────────────────────────────────────
  async getDrinks(placeId?: string | null) {
    if (placeId) {
      return await sql`SELECT * FROM drinks WHERE place_id = ${placeId} ORDER BY sort_order`
    }
    return await sql`SELECT * FROM drinks ORDER BY sort_order`
  },

  async getDrinkById(id: string) {
    const result = await sql`SELECT * FROM drinks WHERE id = ${id}`
    return result[0] || null
  },

  async createDrink(data: { name: string; price?: number; image_url?: string | null; sort_order?: number; category?: string; place_id?: string | null }) {
    const result = await sql`
      INSERT INTO drinks (name, price, image_url, sort_order, category, place_id)
      VALUES (${data.name}, ${data.price || 0}, ${data.image_url || null}, ${data.sort_order || 0}, ${data.category || 'general'}, ${data.place_id || null})
      RETURNING *
    `
    return result[0]
  },

  async updateDrink(id: string, data: { name?: string; price?: number; image_url?: string | null }) {
    const result = await sql`
      UPDATE drinks 
      SET name = COALESCE(${data.name}, name),
          price = COALESCE(${data.price}, price),
          image_url = COALESCE(${data.image_url}, image_url),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    return result[0]
  },

  async deleteDrink(id: string) {
    await sql`DELETE FROM drinks WHERE id = ${id}`
  },

  // ─── Inventory ─────────────────────────────────────────
  async getInventory() {
    return await sql`SELECT * FROM inventory ORDER BY created_at`
  },

  async getInventoryByDrinkId(drinkId: string) {
    const result = await sql`SELECT * FROM inventory WHERE drink_id = ${drinkId}`
    return result[0] || null
  },

  async updateInventory(drinkId: string, quantity: number) {
    const result = await sql`
      INSERT INTO inventory (drink_id, quantity, updated_at)
      VALUES (${drinkId}, ${quantity}, NOW())
      ON CONFLICT (drink_id) DO UPDATE 
      SET quantity = ${quantity}, updated_at = NOW()
      RETURNING *
    `
    return result[0]
  },

  async incrementInventory(drinkId: string, amount: number = 1) {
    const result = await sql`
      INSERT INTO inventory (drink_id, quantity, updated_at)
      VALUES (${drinkId}, ${amount}, NOW())
      ON CONFLICT (drink_id) DO UPDATE 
      SET quantity = inventory.quantity + ${amount}, updated_at = NOW()
      RETURNING *
    `
    return result[0]
  },

  async decrementInventory(drinkId: string, amount: number = 1) {
    const result = await sql`
      INSERT INTO inventory (drink_id, quantity, updated_at)
      VALUES (${drinkId}, 0, NOW())
      ON CONFLICT (drink_id) DO UPDATE 
      SET quantity = GREATEST(0, inventory.quantity - ${amount}), updated_at = NOW()
      RETURNING *
    `
    return result[0]
  },

  // ─── Users ─────────────────────────────────────────────
  async getUsers(placeId?: string | null) {
    if (placeId) {
      return await sql`SELECT * FROM users WHERE place_id = ${placeId} ORDER BY created_at`
    }
    return await sql`SELECT * FROM users ORDER BY created_at`
  },

  async getUserByName(name: string, placeId?: string | null) {
    if (placeId) {
      const result = await sql`SELECT * FROM users WHERE name = ${name} AND place_id = ${placeId} LIMIT 1`
      return result[0] || null
    }
    const result = await sql`SELECT * FROM users WHERE name = ${name} LIMIT 1`
    return result[0] || null
  },

  async getUserByNameAndPassword(name: string, password: string, placeId?: string | null) {
    if (placeId) {
      const result = await sql`SELECT * FROM users WHERE name = ${name} AND password = ${password} AND place_id = ${placeId} LIMIT 1`
      return result[0] || null
    }
    const result = await sql`SELECT * FROM users WHERE name = ${name} AND password = ${password} LIMIT 1`
    return result[0] || null
  },

  async getUserById(id: string) {
    const result = await sql`SELECT * FROM users WHERE id = ${id}`
    return result[0] || null
  },

  async createUser(data: { name: string; password?: string; table_number?: string; role?: string; place_id?: string | null }) {
    const result = await sql`
      INSERT INTO users (name, password, table_number, role, place_id)
      VALUES (${data.name}, ${data.password || null}, ${data.table_number || null}, ${data.role || 'customer'}, ${data.place_id || null})
      RETURNING *
    `
    return result[0]
  },

  async updateUser(id: string, data: { name?: string; password?: string | null; role?: string; assigned_tables?: string[]; table_number?: string }) {
    if (data.name !== undefined) {
      await sql`UPDATE users SET name = ${data.name}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.password !== undefined) {
      await sql`UPDATE users SET password = ${data.password}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.role !== undefined) {
      await sql`UPDATE users SET role = ${data.role}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.assigned_tables !== undefined) {
      await sql`UPDATE users SET assigned_tables = ${data.assigned_tables}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.table_number !== undefined) {
      await sql`UPDATE users SET table_number = ${data.table_number}, updated_at = NOW() WHERE id = ${id}`
    }
    const result = await sql`SELECT * FROM users WHERE id = ${id}`
    return result[0]
  },

  async deleteUser(id: string) {
    await sql`DELETE FROM users WHERE id = ${id}`
  },

  // ─── Sessions ──────────────────────────────────────────
  async getActiveSession(date: string, placeId?: string | null) {
    if (placeId) {
      const result = await sql`SELECT * FROM sessions WHERE date = ${date} AND is_active = true AND place_id = ${placeId}`
      return result[0] || null
    }
    const result = await sql`SELECT * FROM sessions WHERE date = ${date} AND is_active = true AND place_id IS NULL`
    return result[0] || null
  },

  // Find any session for a date (active or ended) — used for readonly archive viewing
  async getSessionByDate(date: string, placeId?: string | null) {
    if (placeId) {
      const result = await sql`SELECT * FROM sessions WHERE date = ${date} AND place_id = ${placeId} ORDER BY created_at DESC LIMIT 1`
      return result[0] || null
    }
    const result = await sql`SELECT * FROM sessions WHERE date = ${date} AND place_id IS NULL ORDER BY created_at DESC LIMIT 1`
    return result[0] || null
  },

  // Return ALL sessions for a date ordered oldest-first (used for multi-session selector)
  async getAllSessionsByDate(date: string, placeId?: string | null) {
    if (placeId) {
      return await sql`SELECT * FROM sessions WHERE date = ${date} AND place_id = ${placeId} ORDER BY created_at ASC`
    }
    return await sql`SELECT * FROM sessions WHERE date = ${date} AND place_id IS NULL ORDER BY created_at ASC`
  },

  async createSession(date: string, placeId?: string | null) {
    const result = await sql`
      INSERT INTO sessions (date, is_active, place_id)
      VALUES (${date}, true, ${placeId || null})
      RETURNING *
    `
    return result[0]
  },

  // End only the current active session for a specific date (preserves historical sessions)
  async endTodaySession(date: string, placeId?: string | null) {
    if (placeId) {
      await sql`UPDATE sessions SET is_active = false, ended_at = NOW() WHERE date = ${date} AND is_active = true AND place_id = ${placeId}`
    } else {
      await sql`UPDATE sessions SET is_active = false, ended_at = NOW() WHERE date = ${date} AND is_active = true AND place_id IS NULL`
    }
  },

  async endAllActiveSessions(placeId?: string | null) {
    if (placeId) {
      await sql`UPDATE sessions SET is_active = false, ended_at = NOW() WHERE is_active = true AND place_id = ${placeId}`
    } else {
      await sql`UPDATE sessions SET is_active = false, ended_at = NOW() WHERE is_active = true`
    }
  },

  async deleteSession(sessionId: string) {
    // Delete all orders for this session first
    await sql`DELETE FROM orders WHERE session_id = ${sessionId}`
    // Then delete the session
    await sql`DELETE FROM sessions WHERE id = ${sessionId}`
  },

  // ─── Orders ────────────────────────────────────────────
  async getOrdersBySession(sessionId: string) {
    // Ensure customer_name and table_number columns exist
    try {
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT`
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number TEXT`
    } catch {}
    
    return await sql`
      SELECT 
        o.*,
        json_build_object(
          'id', d.id,
          'name', d.name,
          'price', d.price,
          'image_url', d.image_url,
          'category', d.category
        ) as drink,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'table_number', u.table_number,
          'role', u.role
        ) as user
      FROM orders o
      LEFT JOIN drinks d ON o.drink_id = d.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.session_id = ${sessionId}
      ORDER BY o.created_at DESC
    `
  },

  async createOrder(data: { user_id: string; session_id: string; drink_id: string; quantity: number; sugar_level?: string; notes?: string; total_price?: number; customer_name?: string; table_number?: string; customer_phone?: string; employee_id?: string | null }) {
    const result = await sql`
      INSERT INTO orders (user_id, session_id, drink_id, quantity, sugar_level, notes, total_price, customer_name, table_number, customer_phone, employee_id)
      VALUES (${data.user_id}, ${data.session_id}, ${data.drink_id}, ${data.quantity}, ${data.sugar_level || 'normal'}, ${data.notes || null}, ${data.total_price || 0}, ${data.customer_name || null}, ${data.table_number || null}, ${data.customer_phone || null}, ${data.employee_id || null})
      RETURNING *
    `
    return result[0]
  },

  async updateOrderStatus(id: string, status: string) {
    const result = await sql`
      UPDATE orders SET status = ${status}, updated_at = NOW() WHERE id = ${id}
      RETURNING *
    `
    return result[0]
  },

  async updateOrderRating(id: string, rating: number, comment?: string) {
    const result = await sql`
      UPDATE orders SET rating = ${rating}, rating_comment = ${comment || null}, updated_at = NOW() WHERE id = ${id}
      RETURNING *
    `
    return result[0]
  },

  async deleteOrder(id: string) {
    await sql`DELETE FROM orders WHERE id = ${id}`
  },

  async deleteAllOrders(placeId?: string | null) {
    if (placeId) {
      await sql`DELETE FROM orders WHERE session_id IN (SELECT id FROM sessions WHERE place_id = ${placeId})`
    } else {
      await sql`DELETE FROM orders`
    }
  },

  // ─── Messages ──────────────────────────────────────────
  async getMessages(limit = 5, placeId?: string | null) {
    if (placeId) {
      return await sql`SELECT * FROM admin_messages WHERE place_id = ${placeId} ORDER BY created_at DESC LIMIT ${limit}`
    }
    return await sql`SELECT * FROM admin_messages ORDER BY created_at DESC LIMIT ${limit}`
  },

  async createMessage(data: { title?: string; message: string; user_id?: string; place_id?: string | null }) {
    const result = await sql`
      INSERT INTO admin_messages (title, message, user_id, is_from_admin, place_id)
      VALUES (${data.title || null}, ${data.message}, ${data.user_id || null}, true, ${data.place_id || null})
      RETURNING *
    `
    return result[0]
  },

  async deleteMessage(id: string) {
    await sql`DELETE FROM admin_messages WHERE id = ${id}`
  },

  async deleteAllMessages(placeId?: string | null) {
    if (placeId) {
      await sql`DELETE FROM admin_messages WHERE place_id = ${placeId}`
    } else {
      await sql`DELETE FROM admin_messages`
    }
  },

  // ─── Staff Users ─────────────────────────────────────��─
  async getStaffUsers() {
    try {
      await sql`ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'cashier'`
    } catch {}
    return await sql`SELECT * FROM staff_users ORDER BY created_at DESC`
  },

  async getStaffByUsername(username: string) {
    const result = await sql`SELECT * FROM staff_users WHERE username = ${username}`
    return result[0] || null
  },

  async createStaffUser(data: { username: string; password: string; name: string; place_id?: string | null; role?: string }) {
    try {
      await sql`ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'cashier'`
    } catch {}
    const result = await sql`
      INSERT INTO staff_users (username, password, name, is_active, place_id, role)
      VALUES (${data.username}, ${data.password}, ${data.name}, true, ${data.place_id || null}, ${data.role || 'cashier'})
      RETURNING *
    `
    return result[0]
  },

  async updateStaffUser(id: string, data: { is_active?: boolean }) {
    if (data.is_active !== undefined) {
      await sql`UPDATE staff_users SET is_active = ${data.is_active} WHERE id = ${id}`
    }
    const result = await sql`SELECT * FROM staff_users WHERE id = ${id}`
    return result[0]
  },

  async deleteStaffUser(id: string) {
    await sql`DELETE FROM staff_users WHERE id = ${id}`
  },

  // ─── Clients ───────────────────────────────────────────
  async setupClientsTable() {
    await sql`
      CREATE TABLE IF NOT EXISTS clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        phone TEXT,
        place_name TEXT,
        subscription TEXT DEFAULT 'monthly',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
  },

  async getClients() {
    return await sql`SELECT * FROM clients ORDER BY created_at DESC`
  },

  async createClient(data: { name: string; phone?: string; place_name?: string; subscription?: string; notes?: string }) {
    const result = await sql`
      INSERT INTO clients (name, phone, place_name, subscription, notes)
      VALUES (${data.name}, ${data.phone || null}, ${data.place_name || null}, ${data.subscription || 'monthly'}, ${data.notes || null})
      RETURNING *
    `
    return result[0]
  },

  async updateClient(id: string, data: { name?: string; phone?: string; place_name?: string; subscription?: string; notes?: string }) {
    const result = await sql`
      UPDATE clients SET
        name = COALESCE(${data.name ?? null}, name),
        phone = COALESCE(${data.phone ?? null}, phone),
        place_name = COALESCE(${data.place_name ?? null}, place_name),
        subscription = COALESCE(${data.subscription ?? null}, subscription),
        notes = COALESCE(${data.notes ?? null}, notes)
      WHERE id = ${id}
      RETURNING *
    `
    return result[0]
  },

  async deleteClient(id: string) {
    await sql`DELETE FROM clients WHERE id = ${id}`
  },

  // ─── Settings ──────────────────────────────────────────
  async getSetting(key: string) {
    const result = await sql`SELECT value FROM app_settings WHERE key = ${key}`
    return result[0]?.value || null
  },

  async setSetting(key: string, value: string) {
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
    `
  },

  // ─── Dev Notifications ─────────────────────────────────
  async setupDevNotifications() {
    await sql`
      CREATE TABLE IF NOT EXISTS dev_notifications (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        place_id TEXT,
        place_name TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
  },

  async getDevNotifications(limit: number = 30) {
    return await sql`SELECT * FROM dev_notifications ORDER BY created_at DESC LIMIT ${limit}`
  },

  async getUnreadDevNotificationsCount() {
    const result = await sql`SELECT COUNT(*) as count FROM dev_notifications WHERE is_read = false`
    return parseInt(result[0]?.count || '0', 10)
  },

  async createDevNotification(data: { place_id: string; place_name: string; action: string; details?: string }) {
    const result = await sql`
      INSERT INTO dev_notifications (place_id, place_name, action, details)
      VALUES (${data.place_id}, ${data.place_name}, ${data.action}, ${data.details || null})
      RETURNING *
    `
    return result[0]
  },

  async markDevNotificationsRead() {
    await sql`UPDATE dev_notifications SET is_read = true WHERE is_read = false`
  },

  async deleteDevNotification(id: string) {
    await sql`DELETE FROM dev_notifications WHERE id = ${id}`
  },

  async clearDevNotifications() {
    await sql`DELETE FROM dev_notifications`
  },

  // ─── Reservations ──────────────────────────────────────
  async setupReservations() {
    await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS reservations_enabled BOOLEAN DEFAULT false`.catch(() => {})
    await sql`
      CREATE TABLE IF NOT EXISTS reservations (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        place_id UUID NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        party_size INTEGER NOT NULL DEFAULT 2,
        reserved_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        table_number TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS table_number TEXT`.catch(() => {})
  },

  async getReservations(placeId: string, status?: string) {
    if (status) {
      return await sql`SELECT * FROM reservations WHERE place_id = ${placeId} AND status = ${status} ORDER BY reserved_at ASC`
    }
    return await sql`SELECT * FROM reservations WHERE place_id = ${placeId} ORDER BY reserved_at ASC`
  },

  async createReservation(data: { place_id: string; customer_name: string; customer_phone?: string; party_size: number; reserved_at: string; notes?: string }) {
    const result = await sql`
      INSERT INTO reservations (place_id, customer_name, customer_phone, party_size, reserved_at, notes, status)
      VALUES (${data.place_id}, ${data.customer_name}, ${data.customer_phone || null}, ${data.party_size}, ${data.reserved_at}, ${data.notes || null}, 'pending')
      RETURNING *
    `
    return result[0]
  },

  async updateReservationStatus(id: string, status: string, tableNumber?: string | null) {
    if (tableNumber !== undefined) {
      const result = await sql`
        UPDATE reservations SET status = ${status}, table_number = ${tableNumber || null} WHERE id = ${id} RETURNING *
      `
      return result[0]
    }
    const result = await sql`
      UPDATE reservations SET status = ${status} WHERE id = ${id} RETURNING *
    `
    return result[0]
  },

  async deleteReservation(id: string) {
    await sql`DELETE FROM reservations WHERE id = ${id}`
  },

  // ─── Company Employees ─────────────────────────────────
  async setupCompanyEmployees() {
    await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS place_type TEXT DEFAULT 'cafe'`.catch(() => {})
    await sql`
      CREATE TABLE IF NOT EXISTS company_employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(place_id, email)
      )
    `.catch(() => {})
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES company_employees(id) ON DELETE SET NULL`.catch(() => {})
  },

  async getCompanyEmployees(placeId: string) {
    await this.setupCompanyEmployees()
    return await sql`SELECT * FROM company_employees WHERE place_id = ${placeId} ORDER BY created_at ASC`
  },

  async getCompanyEmployeeByEmail(placeId: string, email: string) {
    await this.setupCompanyEmployees()
    const result = await sql`SELECT * FROM company_employees WHERE place_id = ${placeId} AND email = ${email} AND is_active = true LIMIT 1`
    return result[0] || null
  },

  async createCompanyEmployee(data: { place_id: string; name: string; email: string; password: string }) {
    await this.setupCompanyEmployees()
    const result = await sql`
      INSERT INTO company_employees (place_id, name, email, password)
      VALUES (${data.place_id}, ${data.name}, ${data.email}, ${data.password})
      RETURNING *
    `
    return result[0]
  },

  async updateCompanyEmployee(id: string, data: { name?: string; email?: string; password?: string; is_active?: boolean }) {
    const result = await sql`
      UPDATE company_employees
      SET name = COALESCE(${data.name ?? null}, name),
          email = COALESCE(${data.email ?? null}, email),
          password = COALESCE(${data.password ?? null}, password),
          is_active = COALESCE(${data.is_active ?? null}, is_active),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    return result[0]
  },

  async deleteCompanyEmployee(id: string) {
    await sql`DELETE FROM company_employees WHERE id = ${id}`
  },

  async getEmployeeMonthlyReport(placeId: string, month: string) {
    await this.setupCompanyEmployees()
    return await sql`
      SELECT
        ce.id AS employee_id,
        ce.name AS employee_name,
        ce.email AS employee_email,
        TO_CHAR(o.created_at, 'YYYY-MM') AS month,
        COUNT(DISTINCT o.id) AS total_orders,
        COALESCE(SUM(o.quantity), 0) AS total_drinks,
        COALESCE(SUM(o.total_price), 0) AS total_amount
      FROM company_employees ce
      LEFT JOIN orders o ON o.employee_id = ce.id AND TO_CHAR(o.created_at, 'YYYY-MM') = ${month}
      WHERE ce.place_id = ${placeId} AND ce.is_active = true
      GROUP BY ce.id, ce.name, ce.email, TO_CHAR(o.created_at, 'YYYY-MM')
      ORDER BY ce.name
    `
  },

  async getEmployeeDrinksBreakdown(employeeId: string, month: string) {
    return await sql`
      SELECT
        d.name AS drink_name,
        SUM(o.quantity) AS quantity,
        SUM(o.total_price) AS total
      FROM orders o
      JOIN drinks d ON o.drink_id = d.id
      WHERE o.employee_id = ${employeeId} AND TO_CHAR(o.created_at, 'YYYY-MM') = ${month}
      GROUP BY d.name
      ORDER BY quantity DESC
    `
  }
}
