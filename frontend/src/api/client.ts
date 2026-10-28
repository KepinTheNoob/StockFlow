import type { Product, StockMovement, SalesOrder } from '../types/api'

async function post<T>(url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw json.error || { code: 'UNKNOWN_ERROR', message: res.statusText }
    }
    return json as T
}

export const api = {
    getProducts: () =>
        fetch('/api/products')
          .then(r => r.json())
          .then(res => (res.data ? (res.data as Product[]) : (res as Product[]))),

    getMovements: (id: number) =>
        fetch(`/api/products/${id}/movements`)
          .then(r => r.json())
          .then(res => (res.data ? (res.data as StockMovement[]) : (res as StockMovement[]))),

    adjustStock: (id: number, data: { movement_type: 'in' | 'out'; qty: number; note?: string }) =>
        post<{ stock: number }>(`/api/products/${id}/stock`, data),

    createOrder: (data: { customer: string; items: { sku: string; qty: number }[] }) =>
        post<SalesOrder>('/api/orders', data),

    getOrder: (id: number) =>
        fetch(`/api/orders/${id}`).then(r => r.json() as Promise<SalesOrder>),

    cancelOrder: (id: number) => post<SalesOrder>(`/api/orders/${id}/cancel`),
}
