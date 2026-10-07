import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CircleDollarSign, Clock, MessageSquareText, Package, ShoppingCart, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, DataTable, OrderStatusBadge, PageHeader, PaymentStatusBadge, StatCard } from '@/components/admin/Common'
import { ButtonLink } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Feedback'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useMe } from '@/hooks/useStore'
import { http } from '@/lib/api'
import type { Dashboard } from '@/lib/adminTypes'
import { compactNumber, money, orderStatusTone, timeAgo } from '@/lib/format'
import type { OrderStatus } from '@/lib/types'
import { cn, img } from '@/lib/utils'

const statusColors: Record<string, string> = {
  amber: 'bg-amber-400',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
  green: 'bg-emerald-500',
  red: 'bg-rose-500',
  orange: 'bg-orange-500',
}

export default function DashboardPage() {
  useDocumentMeta({ title: 'Dashboard', noIndex: true })
  const { data: user } = useMe()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => http.get<Dashboard>('/admin/dashboard'), refetchInterval: 60_000 })
  if (isLoading || !data) return <PageLoader />

  const change = data.revenueLastMonth > 0 ? ((data.revenueThisMonth - data.revenueLastMonth) / data.revenueLastMonth) * 100 : null
  const chart = data.sales.map((p) => ({ ...p, label: new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }))
  const breakdownTotal = Object.values(data.statusBreakdown).reduce((a, b) => a + b, 0)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${user?.fullName.split(' ')[0] ?? ''}`}
        description="Here's what's happening in your store today."
        actions={
          <>
            <ButtonLink to="/admin/orders/new" variant="outline">
              New manual order
            </ButtonLink>
            <ButtonLink to="/admin/products/new">Add product</ButtonLink>
          </>
        }
      />

      {(data.pendingOrders > 0 || data.pendingReviews > 0 || data.outOfStockCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {data.pendingOrders > 0 && (
            <Link to="/admin/orders?status=Pending" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 hover:bg-amber-100">
              <Clock className="size-4" /> {data.pendingOrders} order{data.pendingOrders === 1 ? '' : 's'} waiting for confirmation
            </Link>
          )}
          {data.pendingReviews > 0 && (
            <Link to="/admin/reviews" className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-900 hover:bg-blue-100">
              <MessageSquareText className="size-4" /> {data.pendingReviews} review{data.pendingReviews === 1 ? '' : 's'} to moderate
            </Link>
          )}
          {data.outOfStockCount > 0 && (
            <Link to="/admin/products?stock=out" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-900 hover:bg-rose-100">
              <AlertTriangle className="size-4" /> {data.outOfStockCount} variant{data.outOfStockCount === 1 ? '' : 's'} out of stock
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's sales" value={money(data.revenueToday)} icon={<CircleDollarSign className="size-5" />} hint={`${data.ordersToday} order${data.ordersToday === 1 ? '' : 's'} today`} />
        <StatCard
          label="This month"
          value={money(data.revenueThisMonth)}
          icon={<TrendingUp className="size-5" />}
          tone="green"
          hint={
            change === null ? (
              `${data.ordersThisMonth} orders`
            ) : (
              <span className={cn('inline-flex items-center gap-1 font-semibold', change >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                {change >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {Math.abs(change).toFixed(1)}% vs last month · {data.ordersThisMonth} orders
              </span>
            )
          }
        />
        <StatCard label="Pending orders" value={data.pendingOrders} icon={<ShoppingCart className="size-5" />} tone="amber" hint="Need a confirmation call" />
        <StatCard label="Customers" value={compactNumber(data.totalCustomers)} icon={<Users className="size-5" />} tone="blue" hint={`+${data.newCustomersThisMonth} this month`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card title="Sales — last 30 days" description="Revenue from orders that weren't cancelled or returned.">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => compactNumber(v)} width={48} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(value, name) => (name === 'revenue' ? [money(Number(value)), 'Revenue'] : [value, 'Orders'])}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--brand)" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Orders by status" description="Last 30 days">
          <div className="space-y-3">
            {Object.entries(data.statusBreakdown).map(([status, count]) => (
              <Link key={status} to={`/admin/orders?status=${status}`} className="block">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{status}</span>
                  <span className="text-slate-500">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={cn('h-full rounded-full', statusColors[orderStatusTone[status as OrderStatus]])} style={{ width: `${breakdownTotal ? (count / breakdownTotal) * 100 : 0}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Card title="Recent orders" actions={<Link to="/admin/orders" className="text-sm font-semibold text-brand hover:underline">View all</Link>} bodyClass="p-0">
          <DataTable
            rows={data.recentOrders}
            rowKey={(o) => o.id}
            onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
            columns={[
              { header: 'Order', cell: (o) => <span className="font-semibold text-slate-900">#{o.orderNumber}</span> },
              {
                header: 'Customer',
                cell: (o) => (
                  <div>
                    <p className="font-medium text-slate-900">{o.customerName}</p>
                    <p className="text-xs text-slate-500">{o.phone}</p>
                  </div>
                ),
              },
              { header: 'Total', cell: (o) => <span className="font-semibold">{money(o.total)}</span> },
              { header: 'Payment', cell: (o) => <PaymentStatusBadge status={o.paymentStatus} /> },
              { header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
              { header: 'Placed', cell: (o) => <span className="text-xs whitespace-nowrap text-slate-500">{timeAgo(o.createdAt)}</span> },
            ]}
            empty="No orders yet."
          />
        </Card>

        <div className="space-y-6">
          <Card title="Top products" description="By revenue, last 30 days">
            <ul className="space-y-3">
              {data.topProducts.length === 0 && <li className="text-sm text-slate-500">No sales yet.</li>}
              {data.topProducts.map((p, i) => (
                <li key={`${p.productId}-${i}`} className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                    {p.imageUrl ? <img src={img(p.imageUrl, 80)} alt="" className="size-8 object-contain" /> : <Package className="size-4 text-slate-400" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.quantity} sold</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{money(p.revenue)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Low stock" description={`${data.lowStockCount} low · ${data.outOfStockCount} out of stock`} actions={<Link to="/admin/products?sort=stock" className="text-sm font-semibold text-brand hover:underline">Manage</Link>}>
            <ul className="space-y-2.5">
              {data.lowStock.length === 0 && <li className="text-sm text-slate-500">All products are well stocked.</li>}
              {data.lowStock.map((item) => (
                <li key={item.variantId}>
                  <Link to={`/admin/products/${item.productId}`} className="flex items-center gap-3 rounded-lg hover:bg-slate-50">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">{item.imageUrl && <img src={img(item.imageUrl, 72)} alt="" className="size-7 object-contain" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{item.productName}</p>
                      {item.variantTitle && <p className="truncate text-xs text-slate-500">{item.variantTitle}</p>}
                    </div>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', item.stock <= 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700')}>
                      {item.stock <= 0 ? 'Out' : `${item.stock} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
