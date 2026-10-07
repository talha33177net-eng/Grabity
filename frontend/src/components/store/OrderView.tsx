import { Check, CircleX, MapPin, Package, RotateCcw, Truck } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Feedback'
import { formatDate, money, orderStatusLabel, orderStatusTone, paymentStatusLabel, paymentStatusTone } from '@/lib/format'
import type { OrderDetail, OrderStatus } from '@/lib/types'
import { cn, img } from '@/lib/utils'

const steps: { status: OrderStatus; label: string }[] = [
  { status: 'Pending', label: 'Order placed' },
  { status: 'Confirmed', label: 'Confirmed' },
  { status: 'Processing', label: 'Packed' },
  { status: 'Shipped', label: 'On the way' },
  { status: 'Delivered', label: 'Delivered' },
]

export function OrderTimeline({ order }: { order: OrderDetail }) {
  if (order.status === 'Cancelled' || order.status === 'Returned') {
    const event = [...order.history].reverse().find((h) => h.status === order.status)
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
        {order.status === 'Cancelled' ? <CircleX className="mt-0.5 size-5 shrink-0" /> : <RotateCcw className="mt-0.5 size-5 shrink-0" />}
        <div>
          <p className="font-semibold">This order was {order.status.toLowerCase()}.</p>
          {event?.note && <p className="mt-0.5 text-sm opacity-90">{event.note}</p>}
          {event && <p className="mt-1 text-xs opacity-75">{formatDate(event.createdAt, true)}</p>}
        </div>
      </div>
    )
  }

  const currentIndex = steps.findIndex((s) => s.status === order.status)
  return (
    <ol className="grid grid-cols-5 gap-1">
      {steps.map((step, index) => {
        const done = index <= currentIndex
        const at = order.history.find((h) => h.status === step.status)?.createdAt
        return (
          <li key={step.status} className="relative flex flex-col items-center text-center">
            {index > 0 && <span className={cn('absolute top-4 right-1/2 -z-0 h-0.5 w-full', index <= currentIndex ? 'bg-brand' : 'bg-slate-200')} />}
            <span className={cn('relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold', done ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-400')}>
              {done ? <Check className="size-4" strokeWidth={3} /> : index + 1}
            </span>
            <span className={cn('mt-2 text-[11px] font-semibold sm:text-xs', done ? 'text-slate-900' : 'text-slate-400')}>{step.label}</span>
            {at && <span className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">{formatDate(at)}</span>}
          </li>
        )
      })}
    </ol>
  )
}

export function OrderView({ order }: { order: OrderDetail }) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Order</p>
            <p className="text-2xl font-bold text-slate-900">#{order.orderNumber}</p>
            <p className="mt-0.5 text-sm text-slate-500">Placed on {formatDate(order.createdAt, true)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={orderStatusTone[order.status]} dot>
              {orderStatusLabel[order.status]}
            </Badge>
            <Badge tone={paymentStatusTone[order.paymentStatus]}>{paymentStatusLabel[order.paymentStatus]}</Badge>
          </div>
        </div>
        <OrderTimeline order={order} />
        {order.trackingCode && (
          <p className="mt-6 flex items-center gap-2 rounded-xl bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            <Truck className="size-4.5 shrink-0" />
            Shipped with <strong>{order.courierName ?? 'courier'}</strong> — tracking code <strong className="font-mono">{order.trackingCode}</strong>
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Package className="size-4.5 text-brand" /> Items
          </h2>
          <ul className="divide-y divide-slate-100">
            {order.items.map((item, i) => (
              <li key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-slate-50">
                  {item.imageUrl && <img src={img(item.imageUrl, 128)} alt="" className="size-13 object-contain" />}
                </span>
                <div className="min-w-0 flex-1">
                  {item.productSlug ? (
                    <Link to={`/product/${item.productSlug}`} className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-brand">
                      {item.productName}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-slate-900">{item.productName}</p>
                  )}
                  {item.variantTitle && <p className="text-xs text-slate-500">{item.variantTitle}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    {money(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{money(item.lineTotal)}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
            <h2 className="mb-3 font-semibold text-slate-900">Summary</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Subtotal" value={money(order.subtotal)} />
              {order.discountAmount > 0 && <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`−${money(order.discountAmount)}`} className="text-emerald-600" />}
              <Row label={`Delivery (${order.shippingMethodName})`} value={order.shippingCost ? money(order.shippingCost) : 'Free'} />
              {order.paymentFee > 0 && <Row label="Payment fee" value={money(order.paymentFee)} />}
              <div className="border-t border-slate-100 pt-2">
                <Row label="Total" value={money(order.total)} className="text-base font-bold text-slate-900" />
              </div>
              <Row label="Payment" value={order.paymentMethodName} />
              {order.transactionId && <Row label="Transaction ID" value={order.transactionId} />}
            </dl>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
              <MapPin className="size-4.5 text-brand" /> Delivery details
            </h2>
            <p className="text-sm font-medium text-slate-900">{order.customerName}</p>
            <p className="text-sm text-slate-600">{order.phone}</p>
            {order.email && <p className="text-sm text-slate-600">{order.email}</p>}
            <p className="mt-2 text-sm text-slate-600">{order.address}</p>
            {order.customerNote && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Note: {order.customerNote}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 text-slate-600', className)}>
      <dt>{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
