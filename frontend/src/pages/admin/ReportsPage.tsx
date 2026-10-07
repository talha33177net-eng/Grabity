import { useQuery } from '@tanstack/react-query'
import { Ban, CircleDollarSign, Package, Receipt, ShoppingCart, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, PageHeader, StatCard } from '@/components/admin/Common'
import { PageLoader } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Form'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { http } from '@/lib/api'
import type { SalesReport } from '@/lib/adminTypes'
import { compactNumber, isoDate, money, orderSourceLabel } from '@/lib/format'
import type { OrderSource } from '@/lib/types'
import { cn, img } from '@/lib/utils'

const presets = [
  { label: 'Last 7 days', range: () => [addDays(new Date(), -6), new Date()] },
  { label: 'Last 30 days', range: () => [addDays(new Date(), -29), new Date()] },
  { label: 'This month', range: () => [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()] },
  {
    label: 'Last month',
    range: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)]
    },
  },
  { label: 'Last 90 days', range: () => [addDays(new Date(), -89), new Date()] },
] as const

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export default function ReportsPage() {
  useDocumentMeta({ title: 'Reports', noIndex: true })
  const [from, setFrom] = useState(isoDate(addDays(new Date(), -29)))
  const [to, setTo] = useState(isoDate(new Date()))
  const { data, isLoading, isFetching } = useQuery({ queryKey: ['admin', 'report', from, to], queryFn: () => http.get<SalesReport>('/admin/reports/sales', { from, to }) })

  return (
    <div>
      <PageHeader
        title="Sales report"
        description="Orders that were cancelled or returned are excluded from revenue."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  const [a, b] = p.range()
                  setFrom(isoDate(a))
                  setTo(isoDate(b))
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand"
              >
                {p.label}
              </button>
            ))}
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To" />
          </div>
        }
      />
      {isLoading || !data ? (
        <PageLoader />
      ) : (
        <div className={cn('space-y-6 transition-opacity', isFetching && 'opacity-60')}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Revenue" value={money(data.revenue)} icon={<CircleDollarSign className="size-5" />} hint={`Delivery charges ${money(data.shippingCharges)}`} />
            <StatCard label="Orders" value={data.orders} icon={<ShoppingCart className="size-5" />} tone="blue" hint={`${data.itemsSold} items sold`} />
            <StatCard label="Average order" value={money(data.averageOrderValue)} icon={<Receipt className="size-5" />} tone="amber" hint={`Discounts given ${money(data.discounts)}`} />
            <StatCard
              label="Gross profit"
              value={data.grossProfit != null ? money(data.grossProfit) : '—'}
              icon={<TrendingUp className="size-5" />}
              tone="green"
              hint={data.grossProfit != null ? 'Based on product cost prices' : 'Add cost prices to products to see profit'}
            />
          </div>

          <Card title="Daily revenue" actions={<span className="flex items-center gap-1.5 text-sm text-slate-500"><Ban className="size-4" /> {data.cancelledOrders} cancelled</span>}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily.map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => compactNumber(v)} width={48} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(value, name) => (name === 'revenue' ? [money(Number(value)), 'Revenue'] : [value, 'Orders'])} />
                  <Bar dataKey="revenue" fill="var(--brand)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Top products">
              <ul className="space-y-3">
                {data.topProducts.length === 0 && <li className="text-sm text-slate-500">No sales in this period.</li>}
                {data.topProducts.map((p, i) => (
                  <li key={`${p.productId}-${i}`} className="flex items-center gap-3">
                    <span className="w-5 text-sm font-semibold text-slate-400">{i + 1}</span>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">{p.imageUrl ? <img src={img(p.imageUrl, 80)} alt="" className="size-8 object-contain" /> : <Package className="size-4 text-slate-300" />}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{p.name}</span>
                    <span className="text-xs text-slate-500">{p.quantity} sold</span>
                    <span className="w-24 text-right text-sm font-semibold">{money(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <div className="space-y-6">
              <Breakdown title="By category" rows={data.byCategory} />
              <Breakdown title="By payment method" rows={data.byPaymentMethod} />
              <Breakdown title="By order source" rows={data.bySource.map((r) => ({ ...r, name: orderSourceLabel[r.name as OrderSource] ?? r.name }))} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Breakdown({ title, rows }: { title: string; rows: { name: string; value: number; count: number }[] }) {
  const total = rows.reduce((s, r) => s + r.value, 0)
  return (
    <Card title={title}>
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-slate-500">No data.</p>}
        {rows.map((r) => (
          <div key={r.name}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium text-slate-700">{r.name}</span>
              <span className="text-slate-500">
                {money(r.value)} · {r.count}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${total ? (r.value / total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
