export interface Place {
  id: string
  name: string
  code: string
  description: string | null
  is_active: boolean
  logo_url: string | null
  table_count: number | null
  service_charge: number | null
  tax_rate: number | null
  reservations_enabled: boolean | null
  order_tracking_enabled: boolean | null
  created_at: string
  updated_at: string
}

export interface Reservation {
  id: string
  place_id: string
  customer_name: string
  customer_phone: string | null
  party_size: number
  reserved_at: string
  status: 'pending' | 'confirmed' | 'cancelled'
  notes: string | null
  table_number: string | null
  created_at: string
}

export interface Drink {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  image_url: string | null
  available: boolean
  sort_order: number
  place_id: string | null
  created_at: string
  updated_at: string
}

export interface Inventory {
  id: string
  drink_id: string
  quantity: number
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  name: string
  phone: string | null
  table_number: string | null
  device_id: string | null
  password: string | null
  role: 'customer' | 'order_receiver' | 'admin' | 'cashier'
  assigned_tables: string[] | null
  place_id: string | null
  created_at: string
  updated_at: string
}

export interface AppSettings {
  id: string
  key: string
  value: string | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  user_id: string | null
  date: string
  is_active: boolean
  place_id: string | null
  created_at: string
  ended_at: string | null
}

export interface Order {
  id: string
  user_id: string
  session_id: string | null
  drink_id: string
  quantity: number
  sugar_level: string
  notes: string | null
  status: string
  total_price: number
  customer_name?: string | null
  table_number?: string | null
  customer_phone?: string | null
  rating?: number | null
  rating_comment?: string | null
  created_at: string
  updated_at: string
}

export interface OrderWithDetails extends Order {
  drink: Drink
  user: User
}

export interface AdminMessage {
  id: string
  user_id: string | null
  title: string | null
  message: string
  is_from_admin: boolean
  is_read: boolean
  place_id: string | null
  created_at: string
}
