import type { Product, StockMovement, SalesOrder, ApiError } from '../types/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const rawError = json?.error
    const error: ApiError =
      typeof rawError === 'string'
        ? { code: 'BAD_REQUEST', message: rawError }
        : {
            code: rawError?.code || 'UNKNOWN_ERROR',
            message: rawError?.message || res.statusText || 'Request failed',
            sku: rawError?.sku,
            available: rawError?.available,
          }
    throw error
  }

  return (json?.data !== undefined ? json.data : json) as T
}

export const api = {
  getProducts: () => request<Product[]>('/api/products?limit=1000'),
  getMovements: (productId: number) =>
    request<StockMovement[]>(`/api/products/${productId}/movements`),
  adjustStock: (productId: number, data: { type: 'in' | 'out'; qty: number; note?: string }) =>
    request<{ stock: number }>(`/api/products/${productId}/stock`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createOrder: (data: { customer: string; items: { sku: string; qty: number }[] }) =>
    request<SalesOrder>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getOrder: (orderId: number) => request<SalesOrder>(`/api/orders/${orderId}`),
  cancelOrder: (orderId: number) =>
    request<{ message: string }>(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
    }),
}
