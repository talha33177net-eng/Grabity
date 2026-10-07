import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Phone, Plus, Printer, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Card, DataTable, OrderStatusBadge, PageHeader, PaymentStatusBadge, SearchInput, useConfirm } from '@/components/admin/Common'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Badge, PageLoader } from '@/components/ui/Feedback'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Form'
import { WhatsAppIcon } from '@/components/ui/Icons'
import { Pagination, QuantityStepper } from '@/components/ui/Misc'
import { Modal } from '@/components/ui/Overlay'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useMe, useSettings } from '@/hooks/useStore'
import { errorMessage, http } from '@/lib/api'
import type { AdminOrder, AdminOrderListItem, EmailMessageDetail, EmailMessageItem } from '@/lib/adminTypes'
import { emailKinds, emailWhen } from '@/lib/emails'
import { EmailFrame, EmailStatusBadge } from './EmailPages'
import { formatDate, money, orderSourceLabel, orderStatusLabel, paymentStatusLabel } from '@/lib/format'
import type { CheckoutOptions, OrderSource, OrderStatus, Paged, PaymentStatus, ProductDetail, Quote, SearchSuggestion } from '@/lib/types'
import { cn, img } from '@/lib/utils'

const statuses: OrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned']
const paymentStatuses: PaymentStatus[] = ['Unpaid', 'Verifying', 'PartiallyPaid', 'Paid', 'Refunded']
const sources: OrderSource[] = ['Website', 'Phone', 'Facebook', 'WhatsApp', 'Instagram', 'Store', 'Other']

// ---------------------------------------------------------------- list

export function OrdersPage() {
  useDocumentMeta({ title: 'Orders', noIndex: true })
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const q = params.get('q') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const payment = params.get('payment') ?? ''
  const source = params.get('source') ?? ''
  const page = Number(params.get('page') ?? 1)

  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'orders', status, q, from, to, payment, source, page],
    queryFn: () =>
      http.get<{ orders: Paged<AdminOrderListItem>; statusCounts: Record<string, number> }>('/admin/orders', {
        status,
        q,
        from,
        to,
        paymentStatus: payment,
        source,
        page,
        pageSize: 20,
      }),
    placeholderData: keepPreviousData,
  })

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Confirm, ship and track every order in one place."
        actions={
          <ButtonLink to="/admin/orders/new">
            <Plus className="size-4" /> New order
          </ButtonLink>
        }
      />

      <div className="scrollbar-none mb-4 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {['', ...statuses].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => set({ status: s })}
            className={cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition', status === s ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100')}
          >
            {s ? orderStatusLabel[s as OrderStatus] : 'All'}
            <span className={cn('rounded-full px-1.5 text-xs font-semibold', status === s ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>{data?.statusCounts[s || 'All'] ?? 0}</span>
          </button>
        ))}
      </div>

      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Order #, name, phone, TrxID..." className="w-full sm:w-72" />
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Input type="date" value={from} onChange={(e) => set({ from: e.target.value })} className="h-10 w-40" aria-label="From date" />
            to
            <Input type="date" value={to} onChange={(e) => set({ to: e.target.value })} className="h-10 w-40" aria-label="To date" />
          </div>
          <Select value={payment} onChange={(e) => set({ payment: e.target.value })} className="w-auto">
            <option value="">All payments</option>
            {paymentStatuses.map((p) => (
              <option key={p} value={p}>
                {paymentStatusLabel[p]}
              </option>
            ))}
          </Select>
          <Select value={source} onChange={(e) => set({ source: e.target.value })} className="w-auto">
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {orderSourceLabel[s]}
              </option>
            ))}
          </Select>
        </div>
        <DataTable
          className={cn(isFetching && 'opacity-70')}
          rows={data?.orders.items}
          loading={isLoading}
          rowKey={(o) => o.id}
          onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
          empty="No orders match these filters."
          columns={[
            {
              header: 'Order',
              cell: (o) => (
                <div>
                  <p className="font-semibold text-slate-900">#{o.orderNumber}</p>
                  {o.source !== 'Website' && <p className="text-xs text-slate-500">{orderSourceLabel[o.source]}</p>}
                </div>
              ),
            },
            { header: 'Date', cell: (o) => <span className="text-xs whitespace-nowrap text-slate-500">{formatDate(o.createdAt, true)}</span> },
            {
              header: 'Customer',
              cell: (o) => (
                <div>
                  <p className="font-medium text-slate-900">{o.customerName}</p>
                  <p className="text-xs text-slate-500">{o.phone}</p>
                </div>
              ),
            },
            { header: 'Items', cell: (o) => o.itemCount },
            { header: 'Total', cell: (o) => <span className="font-semibold whitespace-nowrap text-slate-900">{money(o.total)}</span> },
            {
              header: 'Payment',
              cell: (o) => (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">{o.paymentMethodName}</p>
                  <PaymentStatusBadge status={o.paymentStatus} />
                </div>
              ),
            },
            { header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
          ]}
        />
        {data && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{data.orders.totalCount} orders</span>
            <Pagination page={data.orders.page} totalPages={data.orders.totalPages} onChange={(p) => set({ page: String(p) })} />
          </div>
        )}
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- detail

const nextSteps: Record<OrderStatus, { status: OrderStatus; label: string; variant?: 'primary' | 'danger' | 'outline' | 'success' }[]> = {
  Pending: [
    { status: 'Confirmed', label: 'Confirm order' },
    { status: 'Cancelled', label: 'Cancel', variant: 'danger' },
  ],
  Confirmed: [
    { status: 'Processing', label: 'Mark as packed' },
    { status: 'Cancelled', label: 'Cancel', variant: 'danger' },
  ],
  Processing: [
    { status: 'Shipped', label: 'Mark as shipped' },
    { status: 'Cancelled', label: 'Cancel', variant: 'danger' },
  ],
  Shipped: [
    { status: 'Delivered', label: 'Mark as delivered', variant: 'success' },
    { status: 'Returned', label: 'Returned', variant: 'outline' },
  ],
  Delivered: [{ status: 'Returned', label: 'Mark as returned', variant: 'outline' }],
  Cancelled: [{ status: 'Pending', label: 'Reopen order', variant: 'outline' }],
  Returned: [],
}

export function OrderDetailPage() {
  const { id } = useParams()
  const client = useQueryClient()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const [confirm, confirmDialog] = useConfirm()
  const [note, setNote] = useState('')
  const [statusChoice, setStatusChoice] = useState<OrderStatus | ''>('')
  const [editOpen, setEditOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const { data: order, isLoading } = useQuery({ queryKey: ['admin', 'order', id], queryFn: () => http.get<AdminOrder>(`/admin/orders/${id}`) })
  useDocumentMeta({ title: order ? `Order #${order.orderNumber}` : 'Order', noIndex: true })

  const onSaved = (updated: AdminOrder) => {
    client.setQueryData(['admin', 'order', id], updated)
    client.invalidateQueries({ queryKey: ['admin', 'order-emails', updated.id] })
    client.invalidateQueries({ queryKey: ['admin', 'orders'] })
    client.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
  }

  const updateStatus = useMutation({
    mutationFn: (status: OrderStatus) => http.put<AdminOrder>(`/admin/orders/${id}/status`, { status, note }),
    onSuccess: (updated) => {
      onSaved(updated)
      setNote('')
      setStatusChoice('')
      toast.success(`Order marked as ${orderStatusLabel[updated.status].toLowerCase()}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: () => http.delete(`/admin/orders/${id}`),
    onSuccess: () => {
      toast.success('Order deleted')
      client.invalidateQueries({ queryKey: ['admin', 'orders'] })
      navigate('/admin/orders')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (isLoading || !order) return <PageLoader />

  const changeStatus = async (status: OrderStatus) => {
    if (status === 'Cancelled' || status === 'Returned') {
      const ok = await confirm({
        title: `${status === 'Cancelled' ? 'Cancel' : 'Return'} order #${order.orderNumber}?`,
        message: 'Stock for these items will be added back to inventory.',
        confirmLabel: status === 'Cancelled' ? 'Cancel order' : 'Mark returned',
        danger: true,
      })
      if (!ok) return
    }
    updateStatus.mutate(status)
  }

  const due = Math.max(0, order.total - order.paidAmount)
  const history = order.customerHistory
  const risk = history.successRate == null ? null : history.successRate >= 80 ? 'green' : history.successRate >= 50 ? 'amber' : 'red'
  const waNumber = `88${order.phone}`

  return (
    <div>
      {confirmDialog}
      <PageHeader
        back="/admin/orders"
        title={
          <span className="flex flex-wrap items-center gap-3">
            Order #{order.orderNumber} <OrderStatusBadge status={order.status} /> <PaymentStatusBadge status={order.paymentStatus} />
          </span>
        }
        description={`Placed ${formatDate(order.createdAt, true)} · ${orderSourceLabel[order.source]}`}
        actions={
          <>
            <a href={`tel:${order.phone}`} className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Phone className="size-4" /> Call
            </a>
            <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
              <WhatsAppIcon className="size-4" /> WhatsApp
            </a>
            <a href={`/admin/orders/${order.id}/invoice`} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800">
              <Printer className="size-4" /> Invoice
            </a>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Items" bodyClass="p-0">
            <ul className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-slate-50">
                    {item.imageUrl && <img src={img(item.imageUrl, 112)} alt="" className="size-11 object-contain" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    {item.productId ? (
                      <Link to={`/admin/products/${item.productId}`} className="font-medium text-slate-900 hover:text-brand">
                        {item.productName}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-900">{item.productName}</p>
                    )}
                    <p className="text-xs text-slate-500">
                      {[item.variantTitle, item.sku && `SKU ${item.sku}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <p className="text-sm whitespace-nowrap text-slate-600">
                    {money(item.unitPrice)} × {item.quantity}
                  </p>
                  <p className="w-24 text-right font-semibold whitespace-nowrap text-slate-900">{money(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-sm">
              <Row label="Subtotal" value={money(order.subtotal)} />
              {order.discountAmount > 0 && <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`−${money(order.discountAmount)}`} />}
              <Row label={`Delivery · ${order.shippingMethodName}`} value={order.shippingCost ? money(order.shippingCost) : 'Free'} />
              {order.paymentFee > 0 && <Row label={`${order.paymentMethodName} fee`} value={money(order.paymentFee)} />}
              <Row label="Total" value={money(order.total)} strong />
              <Row label="Paid" value={money(order.paidAmount)} />
              {due > 0 && <Row label="Amount due" value={money(due)} strong className="text-rose-600" />}
            </dl>
          </Card>

          <Card title="Update status" description="Customers can follow these updates on the order tracking page.">
            {nextSteps[order.status].length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {nextSteps[order.status].map((step) => (
                  <Button key={step.status} variant={step.variant ?? 'primary'} loading={updateStatus.isPending && updateStatus.variables === step.status} onClick={() => changeStatus(step.status)}>
                    {step.label}
                  </Button>
                ))}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
              <Select value={statusChoice} onChange={(e) => setStatusChoice(e.target.value as OrderStatus)}>
                <option value="">Set any status...</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {orderStatusLabel[s]}
                  </option>
                ))}
              </Select>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the timeline (optional), e.g. sent with Pathao" />
              <Button variant="dark" disabled={!statusChoice && !note} loading={updateStatus.isPending} onClick={() => changeStatus((statusChoice || order.status) as OrderStatus)}>
                {statusChoice ? 'Update' : 'Add note'}
              </Button>
            </div>
          </Card>

          <Card title="Timeline">
            <ol className="relative space-y-5 border-l-2 border-slate-100 pl-6">
              {order.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className={cn('absolute top-1 -left-[31px] size-3.5 rounded-full border-2 border-white ring-2', i === 0 ? 'bg-brand ring-brand-muted' : 'bg-slate-300 ring-slate-100')} />
                  <p className="text-sm font-semibold text-slate-900">{orderStatusLabel[h.status]}</p>
                  {h.note && <p className="text-sm text-slate-600">{h.note}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatDate(h.createdAt, true)}
                    {h.changedBy && ` · ${h.changedBy}`}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer" actions={<Button size="xs" variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>}>
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                {order.customerName}
                {order.userId ? (
                  <Link to={`/admin/customers/${order.userId}`} title="Registered customer" className="text-brand">
                    <UserRound className="size-4" />
                  </Link>
                ) : (
                  <Badge>Guest</Badge>
                )}
              </p>
              <a href={`tel:${order.phone}`} className="block text-slate-600 hover:text-brand">
                {order.phone}
              </a>
              {order.email && <p className="text-slate-600">{order.email}</p>}
              <p className="pt-2 text-slate-700">{order.address}</p>
            </div>
            {order.customerNote && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">“{order.customerNote}”</p>}
          </Card>

          <Card title="Delivery history" description="Other orders from this phone number">
            {history.totalOrders === 0 ? (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <ShieldCheck className="size-4.5 text-slate-400" /> First order from this number.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="Delivered" value={history.delivered} tone="text-emerald-600" />
                  <MiniStat label="Cancelled" value={history.cancelled} tone="text-rose-600" />
                  <MiniStat label="Returned" value={history.returned} tone="text-orange-600" />
                </div>
                {history.successRate != null && (
                  <div className={cn('mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium', risk === 'green' ? 'bg-emerald-50 text-emerald-800' : risk === 'amber' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800')}>
                    {risk === 'red' ? <AlertTriangle className="size-4" /> : <ShieldCheck className="size-4" />}
                    {history.successRate}% delivery success rate
                  </div>
                )}
                {history.active > 0 && <p className="mt-2 text-xs text-slate-500">{history.active} other order(s) still in progress.</p>}
              </>
            )}
          </Card>

          <Card title="Payment" actions={<Button size="xs" variant="outline" onClick={() => setPaymentOpen(true)}>Update</Button>}>
            <dl className="space-y-2 text-sm">
              <Row label="Method" value={order.paymentMethodName} />
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <PaymentStatusBadge status={order.paymentStatus} />
                </dd>
              </div>
              {order.transactionId && <Row label="Transaction ID" value={order.transactionId} mono />}
              {order.paymentSenderNumber && <Row label="Sender" value={order.paymentSenderNumber} />}
              <Row label="Paid" value={money(order.paidAmount)} />
            </dl>
            {order.paymentStatus === 'Verifying' && (
              <Button
                className="mt-4 w-full"
                variant="success"
                onClick={() =>
                  http
                    .put<AdminOrder>(`/admin/orders/${order.id}/payment`, { paymentStatus: 'Paid' })
                    .then((o) => {
                      onSaved(o)
                      toast.success('Payment verified')
                    })
                    .catch((e) => toast.error(errorMessage(e)))
                }
              >
                Mark payment as verified
              </Button>
            )}
          </Card>

          <Card title="Shipping">
            <dl className="space-y-2 text-sm">
              <Row label="Method" value={order.shippingMethodName} />
              <Row label="Courier" value={order.courierName ?? '—'} />
              <Row label="Tracking code" value={order.trackingCode ?? '—'} mono />
            </dl>
            {order.adminNote && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Internal note: {order.adminNote}</p>}
          </Card>

          <OrderEmailsCard order={order} />

          {me?.roles.includes('Admin') && order.status === 'Cancelled' && (
            <Button
              variant="ghost"
              className="w-full text-rose-600 hover:bg-rose-50"
              leftIcon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await confirm({ title: 'Delete this order permanently?', message: 'This cannot be undone. Use it only for test or spam orders.', confirmLabel: 'Delete', danger: true })) remove.mutate()
              }}
            >
              Delete order
            </Button>
          )}
        </div>
      </div>

      <EditOrderModal order={order} open={editOpen} onClose={() => setEditOpen(false)} onSaved={onSaved} />
      <PaymentModal order={order} open={paymentOpen} onClose={() => setPaymentOpen(false)} onSaved={onSaved} />
    </div>
  )
}

/** Emails sent (or scheduled) for this order, so staff can tell whether the customer was notified. */
function OrderEmailsCard({ order }: { order: AdminOrder }) {
  const client = useQueryClient()
  const [preview, setPreview] = useState<EmailMessageItem | null>(null)
  const isAdmin = !!useMe().data?.roles.includes('Admin')
  const key = ['admin', 'order-emails', order.id]
  const { data: emails } = useQuery({
    queryKey: key,
    queryFn: () => http.get<EmailMessageItem[]>(`/admin/orders/${order.id}/emails`),
    // Status emails go out after a short delay; keep the list current while one is waiting.
    refetchInterval: (query) => (query.state.data?.some((m) => m.status === 'Pending' || m.status === 'Sending') ? 10_000 : false),
  })
  const { data: detail } = useQuery({
    queryKey: ['admin', 'email', 'message', preview?.id],
    queryFn: () => http.get<EmailMessageDetail>(`/admin/email/messages/${preview!.id}`),
    enabled: !!preview && isAdmin,
  })
  const act = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'resend' | 'send-now' }) => http.post<EmailMessageItem[]>(`/admin/orders/${order.id}/emails/${id}/${action}`),
    onSuccess: (list, { action }) => {
      client.setQueryData(key, list)
      toast.success(action === 'resend' ? 'Email queued' : 'Sending now')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <Card title="Emails">
      {!emails?.length ? (
        <p className="text-sm text-slate-500">
          {order.email ? 'No emails for this order yet.' : 'No email address on this order, so the customer only gets updates by phone. Add one with “Edit” to send order emails.'}
        </p>
      ) : (
        <ul className="-my-2 divide-y divide-slate-100">
          {emails.map((m) => (
            <li key={m.id} className="py-2.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <button type="button" className="min-w-0 text-left font-medium text-slate-900 hover:text-brand" onClick={() => setPreview(m)}>
                  {emailKinds[m.kind].label}
                  <span className="block truncate text-xs font-normal text-slate-500">{m.toAddress}</span>
                </button>
                <EmailStatusBadge email={m} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{emailWhen(m)}</p>
              {m.status === 'Pending' ? (
                <button type="button" className="mt-1 text-xs font-semibold text-brand hover:underline" onClick={() => act.mutate({ id: m.id, action: 'send-now' })}>
                  Send now
                </button>
              ) : (
                (m.status === 'Failed' || m.status === 'Sent') && (
                  <button type="button" className="mt-1 text-xs font-semibold text-brand hover:underline" onClick={() => act.mutate({ id: m.id, action: 'resend' })}>
                    {m.status === 'Sent' ? 'Send again' : 'Try again'}
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!preview} onClose={() => setPreview(null)} size="2xl" title={preview?.subject ?? (preview ? emailKinds[preview.kind].label : '')} description={preview && `To ${preview.toAddress} · ${emailWhen(preview)}`}>
        {!isAdmin ? (
          <p className="text-sm text-slate-600">Only admins can open email contents.</p>
        ) : detail?.html ? (
          <EmailFrame html={detail.html} />
        ) : (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{detail ? (detail.text ?? 'This email is written just before it is sent.') : 'Loading...'}</p>
        )}
      </Modal>
    </Card>
  )
}

function Row({ label, value, strong, mono, className }: { label: string; value: string; strong?: boolean; mono?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn('text-right text-slate-900', strong && 'text-base font-bold', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-slate-50 py-2">
      <p className={cn('text-lg font-bold', tone)}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function EditOrderModal({ order, open, onClose, onSaved }: { order: AdminOrder; open: boolean; onClose: () => void; onSaved: (o: AdminOrder) => void }) {
  const [form, setForm] = useState({ customerName: '', phone: '', email: '', address: '', adminNote: '', courierName: '', trackingCode: '' })
  useEffect(() => {
    if (open)
      setForm({
        customerName: order.customerName,
        phone: order.phone,
        email: order.email ?? '',
        address: order.address,
        adminNote: order.adminNote ?? '',
        courierName: order.courierName ?? '',
        trackingCode: order.trackingCode ?? '',
      })
  }, [open, order])
  const save = useMutation({
    mutationFn: () => http.put<AdminOrder>(`/admin/orders/${order.id}`, { ...form, email: form.email || null }),
    onSuccess: (o) => {
      onSaved(o)
      toast.success('Order updated')
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })) })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit order details"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name">
          <Input {...field('customerName')} />
        </Field>
        <Field label="Phone">
          <Input {...field('phone')} />
        </Field>
        <Field label="Email" className="sm:col-span-2">
          <Input {...field('email')} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea rows={2} {...field('address')} />
        </Field>
        <Field label="Courier" hint="e.g. Pathao, Steadfast, RedX">
          <Input {...field('courierName')} />
        </Field>
        <Field label="Tracking code">
          <Input {...field('trackingCode')} />
        </Field>
        <Field label="Internal note" hint="Only visible to staff" className="sm:col-span-2">
          <Textarea rows={2} {...field('adminNote')} />
        </Field>
      </div>
    </Modal>
  )
}

function PaymentModal({ order, open, onClose, onSaved }: { order: AdminOrder; open: boolean; onClose: () => void; onSaved: (o: AdminOrder) => void }) {
  const [paymentStatus, setStatus] = useState<PaymentStatus>(order.paymentStatus)
  const [paidAmount, setPaid] = useState(String(order.paidAmount))
  const [transactionId, setTrx] = useState(order.transactionId ?? '')
  useEffect(() => {
    if (open) {
      setStatus(order.paymentStatus)
      setPaid(String(order.paidAmount))
      setTrx(order.transactionId ?? '')
    }
  }, [open, order])
  const save = useMutation({
    mutationFn: () => http.put<AdminOrder>(`/admin/orders/${order.id}/payment`, { paymentStatus, paidAmount: paidAmount === '' ? null : Number(paidAmount), transactionId }),
    onSuccess: (o) => {
      onSaved(o)
      toast.success('Payment updated')
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update payment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Payment status">
          <Select
            value={paymentStatus}
            onChange={(e) => {
              const next = e.target.value as PaymentStatus
              setStatus(next)
              if (next === 'Paid') setPaid(String(order.total))
              if (next === 'Unpaid' || next === 'Refunded') setPaid('0')
            }}
          >
            {paymentStatuses.map((p) => (
              <option key={p} value={p}>
                {paymentStatusLabel[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount received" hint={`Order total ${money(order.total)}`}>
          <Input type="number" min={0} value={paidAmount} onChange={(e) => setPaid(e.target.value)} />
        </Field>
        <Field label="Transaction ID">
          <Input value={transactionId} onChange={(e) => setTrx(e.target.value)} className="font-mono" />
        </Field>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- manual order

interface DraftLine {
  variantId: number
  name: string
  variantTitle?: string | null
  image?: string | null
  price: number
  quantity: number
}

export function OrderCreatePage() {
  useDocumentMeta({ title: 'New order', noIndex: true })
  const navigate = useNavigate()
  const client = useQueryClient()
  const { data: options } = useQuery({ queryKey: ['checkout-options'], queryFn: () => http.get<CheckoutOptions>('/checkout/options') })
  const [customer, setCustomer] = useState({ customerName: '', phone: '', email: '', address: '', note: '' })
  const [lines, setLines] = useState<DraftLine[]>([])
  const [shippingMethodId, setShipping] = useState<number | null>(null)
  const [paymentMethodCode, setPayment] = useState('cod')
  const [couponCode, setCoupon] = useState('')
  const [transactionId, setTrx] = useState('')
  const [source, setSource] = useState<OrderSource>('Phone')
  const [confirmNow, setConfirmNow] = useState(true)

  useEffect(() => {
    if (options && shippingMethodId === null) setShipping(options.shippingMethods[0]?.id ?? null)
  }, [options, shippingMethodId])

  const items = lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }))
  const debouncedCoupon = useDebounce(couponCode, 500)
  const { data: quote } = useQuery({
    queryKey: ['admin-quote', items, shippingMethodId, paymentMethodCode, debouncedCoupon, customer.phone],
    queryFn: () => http.post<Quote>('/checkout/quote', { items, shippingMethodId, paymentMethodCode, couponCode: debouncedCoupon || null, phone: customer.phone }),
    enabled: items.length > 0,
    placeholderData: keepPreviousData,
  })

  const create = useMutation({
    mutationFn: () =>
      http.post<AdminOrder>('/admin/orders', {
        ...customer,
        email: customer.email || null,
        items,
        shippingMethodId,
        paymentMethodCode,
        couponCode: couponCode || null,
        transactionId: transactionId || null,
        source,
        confirm: confirmNow,
      }),
    onSuccess: (order) => {
      toast.success(`Order #${order.orderNumber} created`)
      client.invalidateQueries({ queryKey: ['admin'] })
      navigate(`/admin/orders/${order.id}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const addProduct = async (suggestion: SearchSuggestion) => {
    try {
      const product = await http.get<ProductDetail>(`/products/${suggestion.slug}`)
      const variant = product.variants.find((v) => v.inStock) ?? product.variants[0]
      if (!variant) return toast.error('This product has no variants.')
      if (product.variants.length > 1) {
        setPicker({ product })
        return
      }
      pushLine(product, variant.id)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  const [picker, setPicker] = useState<{ product: ProductDetail } | null>(null)
  const pushLine = (product: ProductDetail, variantId: number) => {
    const variant = product.variants.find((v) => v.id === variantId)!
    setLines((current) =>
      current.some((l) => l.variantId === variantId)
        ? current.map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + 1 } : l))
        : [...current, { variantId, name: product.name, variantTitle: variant.title, image: variant.imageUrl ?? product.images[0]?.url, price: variant.price, quantity: 1 }],
    )
    setPicker(null)
  }

  const payment = options?.paymentMethods.find((p) => p.code === paymentMethodCode)
  const set = (key: keyof typeof customer) => (e: { target: { value: string } }) => setCustomer((c) => ({ ...c, [key]: e.target.value }))

  return (
    <div>
      <PageHeader back="/admin/orders" title="New manual order" description="Record an order received by phone, Facebook, WhatsApp or in store." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Products">
            <ProductPicker onPick={addProduct} />
            {lines.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {lines.map((line) => {
                  const q = quote?.lines.find((l) => l.variantId === line.variantId)
                  return (
                    <li key={line.variantId} className="flex items-center gap-3 p-3">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-slate-50">{line.image && <img src={img(line.image, 96)} alt="" className="size-10 object-contain" />}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{line.name}</p>
                        <p className="text-xs text-slate-500">
                          {line.variantTitle && `${line.variantTitle} · `}
                          {money(q?.unitPrice ?? line.price)}
                        </p>
                        {q?.message && <p className={cn('text-xs font-medium', q.available ? 'text-amber-600' : 'text-rose-600')}>{q.message}</p>}
                      </div>
                      <QuantityStepper size="sm" value={line.quantity} min={0} onChange={(n) => setLines((c) => (n <= 0 ? c.filter((l) => l.variantId !== line.variantId) : c.map((l) => (l.variantId === line.variantId ? { ...l, quantity: n } : l))))} />
                      <span className="w-24 text-right text-sm font-semibold">{money((q?.unitPrice ?? line.price) * line.quantity)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title="Customer">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <Input value={customer.customerName} onChange={set('customerName')} />
              </Field>
              <Field label="Phone" required>
                <Input value={customer.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" />
              </Field>
              <Field label="Email" className="sm:col-span-2">
                <Input value={customer.email} onChange={set('email')} />
              </Field>
              <Field label="Delivery address" className="sm:col-span-2">
                <Textarea rows={2} value={customer.address} onChange={set('address')} />
              </Field>
              <Field label="Customer note" className="sm:col-span-2">
                <Input value={customer.note} onChange={set('note')} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Order details">
            <div className="space-y-4">
              <Field label="Order source">
                <Select value={source} onChange={(e) => setSource(e.target.value as OrderSource)}>
                  {sources.map((s) => (
                    <option key={s} value={s}>
                      {orderSourceLabel[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Delivery">
                <Select value={shippingMethodId ?? ''} onChange={(e) => setShipping(Number(e.target.value))}>
                  {options?.shippingMethods.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.cost ? money(s.cost) : 'Free'}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment">
                <Select value={paymentMethodCode} onChange={(e) => setPayment(e.target.value)}>
                  {options?.paymentMethods.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {payment?.requiresTransactionId && (
                <Field label="Transaction ID" required>
                  <Input value={transactionId} onChange={(e) => setTrx(e.target.value)} className="font-mono" />
                </Field>
              )}
              <Field label="Coupon code">
                <Input value={couponCode} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
                {quote?.couponMessage && couponCode && <p className={cn('mt-1 text-xs', quote.couponApplied ? 'text-emerald-600' : 'text-rose-600')}>{quote.couponMessage}</p>}
              </Field>
              <Checkbox label="Mark as confirmed" description="Skip the pending step for orders you've already confirmed." checked={confirmNow} onChange={(e) => setConfirmNow(e.target.checked)} />
            </div>
          </Card>
          <Card title="Total">
            <dl className="space-y-2 text-sm">
              <Row label="Subtotal" value={money(quote?.subtotal ?? 0)} />
              {(quote?.discount ?? 0) > 0 && <Row label="Discount" value={`−${money(quote!.discount)}`} />}
              <Row label="Delivery" value={money(quote?.shippingCost ?? 0)} />
              {(quote?.paymentFee ?? 0) > 0 && <Row label="Payment fee" value={money(quote!.paymentFee)} />}
              <Row label="Total" value={money(quote?.total ?? 0)} strong />
            </dl>
            <Button className="mt-4 w-full" size="lg" disabled={lines.length === 0 || !customer.customerName || !customer.phone} loading={create.isPending} onClick={() => create.mutate()}>
              Create order
            </Button>
          </Card>
        </div>
      </div>

      <Modal open={!!picker} onClose={() => setPicker(null)} title={picker?.product.name} description="Choose a variant">
        <ul className="space-y-2">
          {picker?.product.variants.map((v) => (
            <li key={v.id}>
              <button disabled={!v.inStock && !picker.product.isPreOrder} onClick={() => pushLine(picker.product, v.id)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-sm hover:border-brand disabled:opacity-50">
                <span className="font-medium">{v.title}</span>
                <span className="text-slate-500">
                  {money(v.price)} · {v.inStock ? `${v.availableQuantity ?? '∞'} in stock` : 'Out of stock'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}

function ProductPicker({ onPick }: { onPick: (s: SearchSuggestion) => void }) {
  const [term, setTerm] = useState('')
  const debounced = useDebounce(term.trim(), 250)
  const { data = [] } = useQuery({
    queryKey: ['suggest', debounced],
    queryFn: () => http.get<SearchSuggestion[]>('/search/suggest', { q: debounced }),
    enabled: debounced.length >= 2,
  })
  return (
    <div className="relative">
      <SearchInput value={term} onChange={setTerm} placeholder="Search products to add..." />
      {debounced.length >= 2 && data.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {data.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => {
                  onPick(s)
                  setTerm('')
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">{s.imageUrl && <img src={img(s.imageUrl, 80)} alt="" className="size-8 object-contain" />}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                <span className="text-sm text-slate-500">{s.hidePrice ? 'Call' : money(s.price)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- invoice

export function InvoicePage() {
  const { id } = useParams()
  const settings = useSettings()
  const { data: order, isLoading } = useQuery({ queryKey: ['admin', 'order', id], queryFn: () => http.get<AdminOrder>(`/admin/orders/${id}`) })
  useDocumentMeta({ title: order ? `Invoice #${order.orderNumber}` : 'Invoice', noIndex: true })
  if (isLoading || !order) return <PageLoader />
  const due = Math.max(0, order.total - order.paidAmount)

  return (
    <div className="min-h-dvh bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end gap-2 px-4">
        <ButtonLink to={`/admin/orders/${order.id}`} variant="outline">
          Back to order
        </ButtonLink>
        <Button onClick={() => window.print()} leftIcon={<Printer className="size-4" />}>
          Print
        </Button>
      </div>
      <div className="mx-auto max-w-3xl bg-white p-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <p className="text-2xl font-extrabold text-brand">{settings?.general.storeName ?? 'Grabity'}</p>
            <div className="mt-2 space-y-0.5 text-xs text-slate-500">
              {settings?.contact.address && <p>{settings.contact.address}</p>}
              {settings?.contact.phone && <p>{settings.contact.phone}</p>}
              {settings?.contact.email && <p>{settings.contact.email}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-light tracking-widest text-slate-400 uppercase">Invoice</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Order #{order.orderNumber}</p>
            <p className="text-xs text-slate-500">{formatDate(order.createdAt, true)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 py-6 text-sm">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Bill to</p>
            <p className="mt-1 font-semibold text-slate-900">{order.customerName}</p>
            <p className="text-slate-600">{order.phone}</p>
            {order.email && <p className="text-slate-600">{order.email}</p>}
            <p className="mt-1 text-slate-600">{order.address}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Details</p>
            <p className="mt-1 text-slate-600">Payment: {order.paymentMethodName}</p>
            <p className="text-slate-600">Status: {paymentStatusLabel[order.paymentStatus]}</p>
            <p className="text-slate-600">Delivery: {order.shippingMethodName}</p>
            {order.trackingCode && (
              <p className="text-slate-600">
                {order.courierName}: {order.trackingCode}
              </p>
            )}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-2.5">
                  <p className="font-medium text-slate-900">{item.productName}</p>
                  {item.variantTitle && <p className="text-xs text-slate-500">{item.variantTitle}</p>}
                </td>
                <td className="py-2.5 text-right">{money(item.unitPrice)}</td>
                <td className="py-2.5 text-right">{item.quantity}</td>
                <td className="py-2.5 text-right font-medium">{money(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-64 space-y-1.5 text-sm">
          <Row label="Subtotal" value={money(order.subtotal)} />
          {order.discountAmount > 0 && <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`−${money(order.discountAmount)}`} />}
          <Row label="Delivery" value={order.shippingCost > 0 ? money(order.shippingCost) : 'Free'} />
          {order.paymentFee > 0 && <Row label="Payment fee" value={money(order.paymentFee)} />}
          <div className="border-t border-slate-200 pt-1.5">
            <Row label="Total" value={money(order.total)} strong />
          </div>
          <Row label="Paid" value={money(order.paidAmount)} />
          <Row label="Due" value={money(due)} strong />
        </div>
        <p className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          Thank you for shopping with {settings?.general.storeName ?? 'us'}! For support call {settings?.contact.phone ?? 'us'}.
        </p>
      </div>
    </div>
  )
}
