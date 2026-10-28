import { useState, useMemo, useEffect } from 'react'
import type { Product } from '../types/api'
import { formatRupiah, formatTimeAgo } from '../utils/format'
import { FiSearch, FiRefreshCw, FiAlertTriangle, FiChevronLeft, FiChevronRight } from 'react-icons/fi'

interface ProductTableProps {
  products: Product[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onAdjustStock: (product: Product) => void
  onViewMovements: (product: Product) => void
}

export function ProductTable({
  products,
  loading,
  error,
  onRetry,
  onAdjustStock,
  onViewMovements,
}: ProductTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && p.is_active) ||
        (statusFilter === 'inactive' && !p.is_active)

      const matchesLowStock = !lowStockOnly || p.stock <= 10

      return matchesSearch && matchesStatus && matchesLowStock
    })
  }, [products, search, statusFilter, lowStockOnly])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, lowStockOnly])

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, currentPage, pageSize])

  return (
    <div className="space-y-4">
      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by SKU or product name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50 text-xs font-medium">
            {(['all', 'active', 'inactive'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-md capitalize transition-colors ${
                  statusFilter === tab
                    ? 'bg-white text-indigo-600 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              lowStockOnly
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FiAlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Stock ≤ 10
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <FiRefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
            <p className="text-sm">Loading inventory data...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-rose-600 mb-3">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700"
            >
              Retry
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-sm font-medium text-slate-700">No products found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search terms or active filters.</p>
            {(search || statusFilter !== 'all' || lowStockOnly) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                  setLowStockOnly(false)
                }}
                className="mt-4 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">SKU</th>
                    <th scope="col" className="px-6 py-3.5">Product Name</th>
                    <th scope="col" className="px-6 py-3.5">Price</th>
                    <th scope="col" className="px-6 py-3.5">Stock</th>
                    <th scope="col" className="px-6 py-3.5">Status</th>
                    <th scope="col" className="px-6 py-3.5">Last Movement</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedProducts.map(product => {
                    const isLowStock = product.stock <= 10
                    return (
                      <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-900">
                          {product.sku}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {formatRupiah(product.price)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              isLowStock
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {product.stock} {isLowStock ? '(Low)' : ''}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              product.is_active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {formatTimeAgo(product.last_movement_at)}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => onAdjustStock(product)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            Adjust Stock
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => onViewMovements(product)}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                          >
                            Movements
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
              <span>
                Showing{' '}
                <span className="font-semibold text-slate-900">
                  {filteredProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-900">
                  {Math.min(currentPage * pageSize, filteredProducts.length)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-slate-900">{filteredProducts.length}</span> products
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 font-medium text-slate-700"
                >
                  <FiChevronLeft className="w-4 h-4" />
                  Prev
                </button>

                <span className="px-2 font-medium text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 font-medium text-slate-700"
                >
                  Next
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
