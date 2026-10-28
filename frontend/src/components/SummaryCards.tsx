import { formatRupiah } from '../utils/format'

interface SummaryCardsProps {
    total: number
    active: number
    totalValue: number
    lowStock: number
}

export function SummaryCards({ total, active, totalValue, lowStock }: SummaryCardsProps) {
    return (
        <section aria-label="Inventory Overview" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Products</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{total}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Products</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{active}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Stock Value</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{formatRupiah(totalValue)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Low Stock Alert</p>
            <p className={`text-2xl font-bold mt-2 ${lowStock > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {lowStock}
            </p>
        </div>
        </section>
    )
}
