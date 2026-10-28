import { useState, useMemo, useEffect } from 'react'
import type { Product, SalesOrder } from '../types/api'
import { api } from '../api/client'
import { formatRupiah } from '../utils/format'
import { FiX, FiPlus, FiTrash2, FiAlertCircle, FiCheckCircle } from 'react-icons/fi'

interface OrderLineItem {
    sku: string
    qty: number
}

interface CreateOrderModalProps {
    isOpen: boolean
    products: Product[]
    onClose: () => void
    onSuccess: (message: string) => void
}

export function CreateOrderModal({ isOpen, products, onClose, onSuccess }: CreateOrderModalProps) {
    const [customer, setCustomer] = useState('')
    const [items, setItems] = useState<OrderLineItem[]>([{ sku: '', qty: 1 }])
    const [loading, setLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [createdOrder, setCreatedOrder] = useState<SalesOrder | null>(null)
    const [cancelling, setCancelling] = useState(false)

    const activeProducts = useMemo(() => products.filter(p => p.is_active && p.stock > 0), [products])

    useEffect(() => {
        if (isOpen) {
            setCustomer('')
            const firstAvailable = products.find(p => p.is_active && p.stock > 0)?.sku || ''
            setItems([{ sku: firstAvailable, qty: 1 }])
            setErrorMessage(null)
            setCreatedOrder(null)
        }
    }, [isOpen])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    if (!isOpen) return null

    const orderTotal = items.reduce((sum, item) => {
        const prod = products.find(p => p.sku === item.sku)
        return sum + (prod ? prod.price * (item.qty || 0) : 0)
    }, 0)

    const handleAddItem = () => {
        const usedSkus = new Set(items.map(i => i.sku))
        const available = activeProducts.find(p => !usedSkus.has(p.sku))
        setItems([...items, { sku: available ? available.sku : '', qty: 1 }])
    }

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return
        setItems(items.filter((_, i) => i !== index))
    }

    const handleItemChange = (index: number, field: 'sku' | 'qty', value: any) => {
        const next = [...items]
        if (field === 'qty') {
        next[index].qty = Math.max(1, parseInt(value) || 0)
        } else {
        next[index].sku = value
        }
        setItems(next)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!customer.trim()) {
        setErrorMessage('Customer name is required.')
        return
        }

        const skus = items.map(i => i.sku)
        if (new Set(skus).size !== skus.length) {
        setErrorMessage('Duplicate product selected. Please combine quantities into a single item.')
        return
        }

        setLoading(true)
        setErrorMessage(null)

        try {
        const order = await api.createOrder({
            customer: customer.trim(),
            items: items.map(i => ({ sku: i.sku, qty: Number(i.qty) })),
        })
        setCreatedOrder(order)
        onSuccess(`Order #${order.id} for "${order.customer}" created successfully`)
        } catch (err: any) {
        if (err?.code === 'INSUFFICIENT_STOCK') {
            setErrorMessage(
            `Insufficient stock for SKU "${err.sku}". Only ${err.available ?? 0} available.`
            )
        } else {
            setErrorMessage(err?.message || 'Failed to create sales order.')
        }
        } finally {
        setLoading(false)
        }
    }

    const handleCancelOrder = async () => {
        if (!createdOrder) return
        if (!confirm('Are you sure you want to cancel this order and restore product stock?')) return

        setCancelling(true)
        try {
        await api.cancelOrder(createdOrder.id)
        setCreatedOrder({ ...createdOrder, status: 'CANCELLED' })
        onSuccess(`Order #${createdOrder.id} cancelled and inventory restored`)
        } catch (err: any) {
        alert(err?.message || 'Failed to cancel order.')
        } finally {
        setCancelling(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
        <div
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 overflow-hidden relative flex flex-col max-h-[90vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-order-title"
        >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
                <h2 id="modal-order-title" className="text-lg font-bold text-slate-900">
                {createdOrder ? 'Order Confirmed' : 'Create Sales Order'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                {createdOrder ? `Order #${createdOrder.id}` : 'Create a new customer order and allocate inventory'}
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

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 px-1">
            {createdOrder ? (
                /* Order Success & Details View */
                <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                    <FiCheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                    <h3 className="text-sm font-semibold text-emerald-900">
                        Order Placed Successfully
                    </h3>
                    <p className="text-xs text-emerald-700 mt-0.5">
                        Inventory has been decremented. Status: <span className="font-bold">{createdOrder.status}</span>
                    </p>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <span className="font-semibold text-slate-900">{createdOrder.customer}</span>
                    </div>
                    <div className="flex justify-between">
                    <span className="text-slate-500">Total Amount:</span>
                    <span className="font-bold text-slate-900 text-sm">{formatRupiah(createdOrder.total)}</span>
                    </div>
                    <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span
                        className={`inline-flex px-2 py-0.5 rounded font-semibold text-[11px] ${
                        createdOrder.status === 'CREATED'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                    >
                        {createdOrder.status}
                    </span>
                    </div>
                </div>

                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Purchased Items
                    </p>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                    {createdOrder.items?.map((item, idx) => (
                        <div key={idx} className="p-3 bg-white flex items-center justify-between">
                        <div>
                            <span className="font-mono font-semibold text-slate-900">{item.sku}</span>
                            <span className="text-slate-400 ml-2">× {item.qty} units</span>
                        </div>
                        <span className="font-semibold text-slate-800">
                            {formatRupiah(item.unit_price * item.qty)}
                        </span>
                        </div>
                    ))}
                    </div>
                </div>

                {createdOrder.status === 'CREATED' && (
                    <div className="pt-2">
                    <button
                        type="button"
                        onClick={handleCancelOrder}
                        disabled={cancelling}
                        className="w-full py-2.5 px-4 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
                    >
                        {cancelling ? 'Cancelling...' : 'Cancel Order (Restore Inventory)'}
                    </button>
                    </div>
                )}
                </div>
            ) : (
                /* Order Creation Form */
                <form onSubmit={handleSubmit} id="order-form" className="space-y-4 p-0.5">
                {errorMessage && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-700">
                    <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errorMessage}</span>
                    </div>
                )}

                <div>
                    <label htmlFor="customer" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Customer Name
                    </label>
                    <input
                    id="customer"
                    type="text"
                    placeholder="e.g. PT Maju Jaya"
                    value={customer}
                    onChange={e => setCustomer(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Order Items
                    </label>
                    <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={items.length >= activeProducts.length}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                    >
                        <FiPlus className="w-3.5 h-3.5" />
                        Add Item
                    </button>
                    </div>

                    <div className="space-y-2">
                    {items.map((item, index) => {
                        const selectedProd = products.find(p => p.sku === item.sku)
                        return (
                        <div
                            key={index}
                            className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                        >
                            <div className="flex-1 min-w-0">
                            <select
                                value={item.sku}
                                onChange={e => handleItemChange(index, 'sku', e.target.value)}
                                required
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="" disabled>
                                Select Product...
                                </option>
                                {activeProducts.map(prod => (
                                <option key={prod.id} value={prod.sku}>
                                    {prod.sku} — {prod.name} ({prod.stock} in stock)
                                </option>
                                ))}
                            </select>
                            </div>

                            <div className="w-20">
                            <input
                                type="number"
                                min={1}
                                max={selectedProd ? selectedProd.stock : 9999}
                                value={item.qty}
                                onChange={e => handleItemChange(index, 'qty', e.target.value)}
                                required
                                placeholder="Qty"
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                            />
                            </div>

                            <div className="w-28 text-right text-xs font-semibold text-slate-700">
                            {selectedProd ? formatRupiah(selectedProd.price * item.qty) : '-'}
                            </div>

                            <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            disabled={items.length <= 1}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white disabled:opacity-30"
                            aria-label="Remove item"
                            >
                            <FiTrash2 className="w-4 h-4" />
                            </button>
                        </div>
                        )
                    })}
                    </div>
                </div>

                {/* Total Calculation */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-600">Calculated Total:</span>
                    <span className="font-bold text-slate-900 text-base">{formatRupiah(orderTotal)}</span>
                </div>
                </form>
            )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            {createdOrder ? (
                <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700"
                >
                Done
                </button>
            ) : (
                <>
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
                    form="order-form"
                    disabled={loading || items.length === 0 || !items[0].sku}
                    className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {loading ? 'Submitting Order...' : 'Submit Order'}
                </button>
                </>
            )}
            </div>
        </div>
        </div>
    )
}
