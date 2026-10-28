import { useState, useEffect } from 'react'
import type { Product } from '../types/api'
import { api } from '../api/client'
import { FiX, FiAlertCircle } from 'react-icons/fi'

interface AdjustStockModalProps {
    product: Product | null
    onClose: () => void
    onSuccess: () => void
}

export function AdjustStockModal({ product, onClose, onSuccess }: AdjustStockModalProps) {
    const [movementType, setMovementType] = useState<'in' | 'out'>('in')
    const [qty, setQty] = useState<number>(1)
    const [note, setNote] = useState('')
    const [loading, setLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        if (product) {
        setMovementType('in')
        setQty(1)
        setNote('')
        setErrorMessage(null)
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (qty <= 0) {
        setErrorMessage('Quantity must be greater than 0.')
        return
        }

        setLoading(true)
        setErrorMessage(null)

        try {
        await api.adjustStock(product.id, {
            type: movementType,
            qty: Number(qty),
            note: note.trim() || undefined,
        })

        onSuccess()
        onClose()
        } catch (err: any) {
        if (err?.code === 'INSUFFICIENT_STOCK') {
            setErrorMessage(
            `Insufficient stock: only ${err.available ?? 0} available for ${product.sku}.`
            )
        } else {
            setErrorMessage(err?.message || 'Failed to adjust stock.')
        }
        } finally {
        setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
        <div
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 overflow-hidden relative"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
                <h2 id="modal-title" className="text-lg font-bold text-slate-900">
                Adjust Stock
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{product.sku} - {product.name}</p>
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

            {/* Current stock status */}
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Current Available Stock:</span>
            <span className="font-bold text-slate-900 text-sm">{product.stock} units</span>
            </div>

            {/* Error message */}
            {errorMessage && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-700">
                <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
            </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => setMovementType('in')}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    movementType === 'in'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    + Stock In (Add)
                </button>
                <button
                    type="button"
                    onClick={() => setMovementType('out')}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    movementType === 'out'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 ring-1 ring-rose-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    - Stock Out (Remove)
                </button>
                </div>
            </div>

            <div>
                <label htmlFor="qty" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Quantity
                </label>
                <input
                id="qty"
                type="number"
                min={1}
                value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 0))}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            <div>
                <label htmlFor="note" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Note (Optional)
                </label>
                <input
                id="note"
                type="text"
                placeholder="e.g. Restock shipment, damaged unit..."
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
                <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                Cancel
                </button>
                <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                {loading ? 'Submitting...' : 'Confirm Adjustment'}
                </button>
            </div>
            </form>
        </div>
        </div>
    )
}
