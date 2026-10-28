import { useEffect, useState, useMemo } from 'react'
import { api } from './api/client'
import type { Product } from './types/api'
import { SummaryCards } from './components/SummaryCards'
import { ProductTable } from './components/ProductTable'
import { FiRefreshCw, FiPlus, FiBox } from 'react-icons/fi'
import { AdjustStockModal } from './components/AdjustStockModal'
import { MovementsModal } from './components/MovementsModal'
import { CreateOrderModal } from './components/CreateOrderModal'

export default function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null)
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)

  const loadProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getProducts()
      setProducts(data || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to backend API.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const metrics = useMemo(() => {
    const total = products.length
    const active = products.filter(p => p.is_active).length
    const totalValue = products
      .filter(p => p.is_active)
      .reduce((sum, p) => sum + p.price * p.stock, 0)
    const lowStock = products.filter(p => p.is_active && p.stock <= 10).length

    return { total, active, totalValue, lowStock }
  }, [products])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <FiBox className="w-7 h-7 text-indigo-600" aria-hidden="true" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">StockFlow</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">Inventory & Sales Management</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadProducts}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setIsOrderModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <FiPlus className="w-4 h-4" />
              Create Order
            </button>
          </div>
        </header>

        <SummaryCards
          total={metrics.total}
          active={metrics.active}
          totalValue={metrics.totalValue}
          lowStock={metrics.lowStock}
        />

        <ProductTable
          products={products}
          loading={loading}
          error={error}
          onRetry={loadProducts}
          onAdjustStock={(product) => setSelectedProductForStock(product)}
          onViewMovements={(product) => setSelectedProductForHistory(product)}
        />

        <AdjustStockModal
          product={selectedProductForStock}
          onClose={() => setSelectedProductForStock(null)}
          onSuccess={loadProducts}
        />

        <MovementsModal
          product={selectedProductForHistory}
          onClose={() => setSelectedProductForHistory(null)}
        />

        <CreateOrderModal
          isOpen={isOrderModalOpen}
          products={products}
          onClose={() => setIsOrderModalOpen(false)}
          onSuccess={loadProducts}
        />
      </div>
    </div>
  )
}
