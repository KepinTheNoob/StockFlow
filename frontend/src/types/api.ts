export interface Product {
  id: number
  sku: string
  name: string
  price: number
  stock: number
  is_active: boolean
  created_at: string
  last_movement_at: string | null
}

export interface StockMovement {
  id: number
  product_id: number
  type: 'in' | 'out'
  qty: number
  note: string | null
  created_at: string
}

export interface OrderItem {
  id: number
  order_id: number
  sku: string
  qty: number
  unit_price: number
}

export interface SalesOrder {
  id: number
  customer: string
  status: 'CREATED' | 'CANCELLED'
  total: number
  created_at: string
  cancelled_at: string | null
  items: OrderItem[]
}

export interface ApiError {
  code: string
  message: string
  sku?: string
  available?: number
}
