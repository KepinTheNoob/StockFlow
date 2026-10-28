import { useEffect, useState } from 'react'
import type { Product, StockMovement } from '../types/api'
import { api } from '../api/client'
import { formatTimeAgo } from '../utils/format'
import { FiX, FiRefreshCw } from 'react-icons/fi'

interface MovementsModalProps {
    product: Product | null
    onClose: () => void
}

export function MovementsModal({ product, onClose }: MovementsModalProps) {
    const [movements, setMovements] = useState<StockMovement[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadMovements = async (productId: number) => {
        setLoading(true)
        setError(null)
        try {
        const data = await api.getMovements(productId)
        setMovements(data || [])
        } catch (err: any) {
        setError(err?.message || 'Failed to load stock movements.')
        } finally {
        setLoading(false)
        }
    }

    useEffect(() => {
        if (product) {
        loadMovements(product.id)
        } else {
        setMovements([])
        }
    }, [product])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    if (!product) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
        <div
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 overflow-hidden relative flex flex-col max-h-[85vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-movements-title"
        >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
                <h2 id="modal-movements-title" className="text-lg font-bold text-slate-900">
                Movement History
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                {product.sku} — {product.name}
                </p>
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
                <FiX className="w-5 h-5" />
            </button>
            </div>

            {/* Product Stock Summary */}
            <div className="my-3 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">Current On-Hand Stock:</span>
            <span className="font-bold text-slate-900 text-sm">{product.stock} units</span>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
            {loading ? (
                <div className="py-12 text-center text-slate-500">
                <FiRefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                <p className="text-xs">Loading movement history...</p>
                </div>
            ) : error ? (
                <div className="py-8 text-center">
                <p className="text-xs text-rose-600 mb-2">{error}</p>
                <button
                    type="button"
                    onClick={() => loadMovements(product.id)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700"
                >
                    Retry
                </button>
                </div>
            ) : movements.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                <p className="text-xs">No movements recorded yet for this product.</p>
                </div>
            ) : (
                <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 uppercase text-[10px] text-slate-400 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Note</th>
                    <th className="py-2.5 px-3 text-right">Date</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {movements.map(m => {
                    const isIn = m.type === 'in'
                    return (
                        <tr key={m.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3">
                            <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                isIn
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                            >
                            {isIn ? '+ IN' : '- OUT'}
                            </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                            {m.qty}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                            {m.note || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">
                            {formatTimeAgo(m.created_at)}
                        </td>
                        </tr>
                    )
                    })}
                </tbody>
                </table>
            )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
                Close
            </button>
            </div>
        </div>
        </div>
    )
}
