export interface Product {
    id: number
    sku: string
    name: string
    price: number
    stock: number
    is_active: boolean
    last_movement_at: string | null
}

export interface StockMovement {
    id: number
    type: 'in' | 'out'
    qty: number
    note: string | null
    created_at: string
}

export interface SalesOrder {
    id: number
    customer: string
    status: 'CREATED' | 'CANCELLED'
    total: number
    created_at: string
    items?: {
        sku: string
        qty: number
        unit_price: number
    }[]
}
