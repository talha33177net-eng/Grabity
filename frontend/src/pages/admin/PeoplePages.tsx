import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Check, Download, MessageSquareReply, Plus, Star, Trash2, UserCog, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ActiveBadge, Card, DataTable, OrderStatusBadge, PageHeader, SearchInput, StatCard, useConfirm } from '@/components/admin/Common'
import { Button } from '@/components/ui/Button'
import { Badge, PageLoader } from '@/components/ui/Feedback'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Pagination, StarInput, Stars } from '@/components/ui/Misc'
import { Modal } from '@/components/ui/Overlay'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useMe } from '@/hooks/useStore'
import { errorMessage, http } from '@/lib/api'
import type { AdminCustomer, AdminCustomerListItem, AdminReview, Staff } from '@/lib/adminTypes'
import { formatDate, money, timeAgo } from '@/lib/format'
import type { Paged, SearchSuggestion } from '@/lib/types'
import { cn, img, initials } from '@/lib/utils'

// ---------------------------------------------------------------- customers

export function CustomersPage() {
  useDocumentMeta({ title: 'Customers', noIndex: true })
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'customers', q, status, page],
    queryFn: () => http.get<Paged<AdminCustomerListItem>>('/admin/customers', { q, status, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  })
  return (
    <div>
      <PageHeader title="Customers" description="Registered customer accounts. Guest orders are listed under Orders." />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v)
              setPage(1)
            }}
            placeholder="Name, phone or email..."
            className="w-full sm:w-72"
          />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="w-auto"
          >
            <option value="">All customers</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </Select>
        </div>
        <DataTable
          rows={data?.items}
          loading={isLoading}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/admin/customers/${c.id}`)}
          empty="No customers yet."
          columns={[
            {
              header: 'Customer',
              cell: (c) => (
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{initials(c.fullName)}</span>
                  <div>
                    <p className="font-medium text-slate-900">{c.fullName}</p>
                    <p className="text-xs text-slate-500">{c.email ?? '—'}</p>
                  </div>
                </div>
              ),
            },
            { header: 'Phone', cell: (c) => c.phone ?? '—' },
            { header: 'Orders', cell: (c) => c.orderCount },
            { header: 'Spent', cell: (c) => <span className="font-semibold">{money(c.totalSpent)}</span> },
            { header: 'Joined', cell: (c) => <span className="text-xs text-slate-500">{formatDate(c.createdAt)}</span> },
            { header: 'Last login', cell: (c) => <span className="text-xs text-slate-500">{c.lastLoginAt ? timeAgo(c.lastLoginAt) : '—'}</span> },
            { header: 'Status', cell: (c) => <ActiveBadge active={c.isActive} off="Blocked" /> },
          ]}
        />
        {data && (
          <div className="flex justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{data.totalCount} customers</span>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  )
}

export function CustomerDetailPage() {
  const { id } = useParams()
  const client = useQueryClient()
  const { data: me } = useMe()
  const [confirm, confirmDialog] = useConfirm()
  const [resetOpen, setResetOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const { data: customer, isLoading } = useQuery({ queryKey: ['admin', 'customer', id], queryFn: () => http.get<AdminCustomer>(`/admin/customers/${id}`) })
  useDocumentMeta({ title: customer?.fullName ?? 'Customer', noIndex: true })

  const toggle = useMutation({
    mutationFn: (isActive: boolean) => http.put(`/admin/customers/${id}/status`, { isActive }),
    onSuccess: () => {
      toast.success('Customer updated')
      client.invalidateQueries({ queryKey: ['admin', 'customer', id] })
      client.invalidateQueries({ queryKey: ['admin', 'customers'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const reset = useMutation({
    mutationFn: () => http.post(`/admin/customers/${id}/reset-password`, { newPassword }),
    onSuccess: () => {
      toast.success('Password reset. Share the new password with the customer.')
      setResetOpen(false)
      setNewPassword('')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (isLoading || !customer) return <PageLoader />
  const history = customer.phoneHistory

  return (
    <div>
      {confirmDialog}
      <PageHeader
        back="/admin/customers"
        title={
          <span className="flex items-center gap-3">
            {customer.fullName} <ActiveBadge active={customer.isActive} off="Blocked" />
          </span>
        }
        description={`Customer since ${formatDate(customer.createdAt)}`}
        actions={
          <>
            {me?.roles.includes('Admin') && (
              <Button variant="outline" onClick={() => setResetOpen(true)}>
                Reset password
              </Button>
            )}
            <Button
              variant={customer.isActive ? 'danger' : 'success'}
              onClick={async () => {
                if (!customer.isActive || (await confirm({ title: `Block ${customer.fullName}?`, message: 'They will be signed out and unable to log in.', confirmLabel: 'Block', danger: true })))
                  toggle.mutate(!customer.isActive)
              }}
            >
              {customer.isActive ? 'Block customer' : 'Unblock'}
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Orders" value={customer.orderCount} icon={<Check className="size-5" />} />
        <StatCard label="Total spent" value={money(customer.totalSpent)} icon={<Star className="size-5" />} tone="green" />
        <StatCard label="Delivery success" value={history?.successRate != null ? `${history.successRate}%` : '—'} icon={<BadgeCheck className="size-5" />} tone={history?.successRate != null && history.successRate < 60 ? 'red' : 'blue'} hint={history ? `${history.delivered} delivered · ${history.cancelled} cancelled · ${history.returned} returned` : undefined} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card title="Orders" bodyClass="p-0">
          <DataTable
            rows={customer.recentOrders}
            rowKey={(o) => o.orderNumber}
            empty="No orders yet."
            columns={[
              { header: 'Order', cell: (o) => <span className="font-semibold text-slate-900">#{o.orderNumber}</span> },
              { header: 'Date', cell: (o) => <span className="text-xs text-slate-500">{formatDate(o.createdAt)}</span> },
              { header: 'Items', cell: (o) => `${o.firstItemName}${o.itemCount > 1 ? ` + ${o.itemCount - 1}` : ''}` },
              { header: 'Total', cell: (o) => money(o.total) },
              { header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
            ]}
          />
        </Card>
        <Card title="Contact">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Phone</dt>
              <dd className="font-medium">{customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Email</dt>
              <dd className="font-medium">{customer.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Address</dt>
              <dd className="font-medium">{customer.address ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Last login</dt>
              <dd className="font-medium">{customer.lastLoginAt ? formatDate(customer.lastLoginAt, true) : 'Never'}</dd>
            </div>
          </dl>
        </Card>
      </div>
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset password"
        size="sm"
        footer={
          <Button loading={reset.isPending} disabled={newPassword.length < 6} onClick={() => reset.mutate()}>
            Set password
          </Button>
        }
      >
        <Field label="New password" hint="At least 6 characters.">
          <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------- reviews

export function ReviewsAdminPage() {
  useDocumentMeta({ title: 'Reviews', noIndex: true })
  const client = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const [status, setStatus] = useState('pending')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [replying, setReplying] = useState<AdminReview | null>(null)
  const [reply, setReply] = useState('')
  const [creating, setCreating] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reviews', status, q, page],
    queryFn: () => http.get<Paged<AdminReview>>('/admin/reviews', { status, q, page, pageSize: 15 }),
    placeholderData: keepPreviousData,
  })
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    client.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
  }
  const update = useMutation({
    mutationFn: (r: { id: number; isApproved: boolean; isFeatured: boolean; adminReply?: string | null }) => http.put(`/admin/reviews/${r.id}`, r),
    onSuccess: () => {
      toast.success('Review updated')
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => http.delete(`/admin/reviews/${id}`),
    onSuccess: () => {
      toast.success('Review deleted')
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Reviews"
        description="Approve reviews before they appear on product pages. Featured reviews show on the homepage."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Add review
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {[
            ['pending', 'Pending'],
            ['approved', 'Approved'],
            ['featured', 'Featured'],
            ['', 'All'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setStatus(value!)
                setPage(1)
              }}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', status === value ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100')}
            >
              {label}
            </button>
          ))}
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search reviews..." className="w-full sm:w-64" />
      </div>

      {isLoading ? (
        <PageLoader />
      ) : data && data.items.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-500">No reviews here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {data?.items.map((review) => (
            <div key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
              <div className="flex flex-wrap items-start gap-4">
                <Link to={`/admin/products/${review.productId}`} className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-slate-50">
                  {review.productImage && <img src={img(review.productImage, 112)} alt="" className="size-11 object-contain" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={review.rating} />
                    <span className="text-sm font-semibold text-slate-900">{review.customerName}</span>
                    {review.isVerifiedPurchase && <Badge tone="green">Verified</Badge>}
                    {!review.isApproved && <Badge tone="amber">Pending</Badge>}
                    {review.isFeatured && <Badge tone="brand">Featured</Badge>}
                    <span className="text-xs text-slate-400">{timeAgo(review.createdAt)}</span>
                  </div>
                  <Link to={`/admin/products/${review.productId}`} className="mt-0.5 block text-xs text-slate-500 hover:text-brand">
                    {review.productName}
                  </Link>
                  {review.title && <p className="mt-2 text-sm font-semibold text-slate-900">{review.title}</p>}
                  <p className="mt-1.5 text-sm text-slate-700">{review.comment}</p>
                  {review.adminReply && <p className="mt-2 rounded-xl bg-brand-softer p-3 text-sm text-slate-700">Your reply: {review.adminReply}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {review.isApproved ? (
                    <Button size="sm" variant="outline" leftIcon={<X className="size-4" />} onClick={() => update.mutate({ id: review.id, isApproved: false, isFeatured: false, adminReply: review.adminReply })}>
                      Unpublish
                    </Button>
                  ) : (
                    <Button size="sm" variant="success" leftIcon={<Check className="size-4" />} onClick={() => update.mutate({ id: review.id, isApproved: true, isFeatured: review.isFeatured, adminReply: review.adminReply })}>
                      Approve
                    </Button>
                  )}
                  <Button size="sm" variant="outline" leftIcon={<Star className={cn('size-4', review.isFeatured && 'fill-amber-400 text-amber-400')} />} onClick={() => update.mutate({ id: review.id, isApproved: true, isFeatured: !review.isFeatured, adminReply: review.adminReply })}>
                    {review.isFeatured ? 'Unfeature' : 'Feature'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<MessageSquareReply className="size-4" />}
                    onClick={() => {
                      setReplying(review)
                      setReply(review.adminReply ?? '')
                    }}
                  >
                    Reply
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-rose-600"
                    aria-label="Delete review"
                    onClick={async () => {
                      if (await confirm({ title: 'Delete this review?', confirmLabel: 'Delete', danger: true })) remove.mutate(review.id)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {data && <Pagination className="pt-2" page={data.page} totalPages={data.totalPages} onChange={setPage} />}
        </div>
      )}

      <Modal
        open={!!replying}
        onClose={() => setReplying(null)}
        title="Reply to review"
        description="Your reply is shown publicly under the review."
        footer={
          <Button
            loading={update.isPending}
            onClick={() => {
              if (!replying) return
              update.mutate({ id: replying.id, isApproved: true, isFeatured: replying.isFeatured, adminReply: reply }, { onSuccess: () => setReplying(null) })
            }}
          >
            Save reply
          </Button>
        }
      >
        <p className="mb-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">“{replying?.comment}”</p>
        <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Thank you for your feedback..." />
      </Modal>

      <CreateReviewModal open={creating} onClose={() => setCreating(false)} onCreated={refresh} />
    </div>
  )
}

function CreateReviewModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [product, setProduct] = useState<SearchSuggestion | null>(null)
  const [term, setTerm] = useState('')
  const debounced = useDebounce(term, 250)
  const [form, setForm] = useState({ customerName: '', rating: 5, comment: '', isFeatured: false, isVerifiedPurchase: true })
  const { data: results = [] } = useQuery({ queryKey: ['suggest', debounced], queryFn: () => http.get<SearchSuggestion[]>('/search/suggest', { q: debounced }), enabled: debounced.length >= 2 })
  const create = useMutation({
    mutationFn: () => http.post('/admin/reviews', { ...form, productId: product!.id, isApproved: true }),
    onSuccess: () => {
      toast.success('Review added')
      onCreated()
      onClose()
      setProduct(null)
      setForm({ customerName: '', rating: 5, comment: '', isFeatured: false, isVerifiedPurchase: true })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a customer review"
      description="Record genuine feedback you received by phone, Facebook or in store."
      footer={
        <Button loading={create.isPending} disabled={!product || !form.customerName || !form.comment} onClick={() => create.mutate()}>
          Add review
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Product" required>
          {product ? (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-sm">
              {product.name}
              <Button size="xs" variant="ghost" onClick={() => setProduct(null)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search product..." />
              {results.length > 0 && term.length >= 2 && (
                <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          setProduct(r)
                          setTerm('')
                        }}
                      >
                        {r.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Field>
        <Field label="Customer name" required>
          <Input value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} />
        </Field>
        <Field label="Rating">
          <StarInput value={form.rating} onChange={(rating) => setForm((f) => ({ ...f, rating }))} />
        </Field>
        <Field label="Review" required>
          <Textarea rows={4} value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
        </Field>
        <div className="flex flex-wrap gap-5">
          <Checkbox label="Verified purchase" checked={form.isVerifiedPurchase} onChange={(e) => setForm((f) => ({ ...f, isVerifiedPurchase: e.target.checked }))} />
          <Checkbox label="Feature on homepage" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} />
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- staff

type StaffForm = { fullName: string; email: string; phone: string; role: 'Admin' | 'Manager'; password: string; isActive: boolean }

export function StaffPage() {
  useDocumentMeta({ title: 'Staff', noIndex: true })
  const client = useQueryClient()
  const { data: me } = useMe()
  const [confirm, confirmDialog] = useConfirm()
  const [editing, setEditing] = useState<{ id?: number; form: StaffForm } | null>(null)
  const { data: staff, isLoading } = useQuery({ queryKey: ['admin', 'staff'], queryFn: () => http.get<Staff[]>('/admin/staff') })
  const save = useMutation({
    mutationFn: () => {
      const body = { ...editing!.form, password: editing!.form.password || null, phone: editing!.form.phone || null }
      return editing?.id ? http.put(`/admin/staff/${editing.id}`, body) : http.post('/admin/staff', body)
    },
    onSuccess: () => {
      toast.success('Staff member saved')
      setEditing(null)
      client.invalidateQueries({ queryKey: ['admin', 'staff'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => http.delete(`/admin/staff/${id}`),
    onSuccess: () => {
      toast.success('Staff member removed')
      client.invalidateQueries({ queryKey: ['admin', 'staff'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const form = editing?.form
  const set = (patch: Partial<StaffForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e))

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Staff"
        description="Admins can do everything. Managers can run day-to-day operations but can't change store settings or staff."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing({ form: { fullName: '', email: '', phone: '', role: 'Manager', password: '', isActive: true } })}>
            Add staff
          </Button>
        }
      />
      <Card bodyClass="p-0">
        <DataTable
          rows={staff}
          loading={isLoading}
          rowKey={(s) => s.id}
          columns={[
            {
              header: 'Name',
              cell: (s) => (
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(s.fullName)}</span>
                  <div>
                    <p className="font-medium text-slate-900">
                      {s.fullName} {s.id === me?.id && <span className="text-xs text-slate-400">(you)</span>}
                    </p>
                    <p className="text-xs text-slate-500">{s.email}</p>
                  </div>
                </div>
              ),
            },
            { header: 'Role', cell: (s) => <Badge tone={s.role === 'Admin' ? 'brand' : 'blue'}>{s.role}</Badge> },
            { header: 'Phone', cell: (s) => s.phone ?? '—' },
            { header: 'Last login', cell: (s) => <span className="text-xs text-slate-500">{s.lastLoginAt ? timeAgo(s.lastLoginAt) : 'Never'}</span> },
            { header: 'Status', cell: (s) => <ActiveBadge active={s.isActive} off="Disabled" /> },
            {
              header: '',
              cell: (s) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing({ id: s.id, form: { fullName: s.fullName, email: s.email ?? '', phone: s.phone ?? '', role: s.role, password: '', isActive: s.isActive } })}>
                    Edit
                  </Button>
                  {s.id !== me?.id && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-rose-600"
                      aria-label="Remove staff member"
                      onClick={async () => {
                        if (await confirm({ title: `Remove ${s.fullName}?`, message: 'Their account will be deleted.', confirmLabel: 'Remove', danger: true })) remove.mutate(s.id)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit staff member' : 'Add staff member'}
        footer={
          <Button loading={save.isPending} onClick={() => save.mutate()} leftIcon={<UserCog className="size-4" />}>
            Save
          </Button>
        }
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required className="sm:col-span-2">
              <Input value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} />
            </Field>
            <Field label="Email (used to sign in)" required>
              <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="Role">
              <Select value={form.role} onChange={(e) => set({ role: e.target.value as StaffForm['role'] })}>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </Select>
            </Field>
            <Field label={editing?.id ? 'New password (optional)' : 'Password'} required={!editing?.id}>
              <Input type="text" value={form.password} onChange={(e) => set({ password: e.target.value })} placeholder={editing?.id ? 'Leave empty to keep' : 'At least 6 characters'} />
            </Field>
            <Checkbox label="Account active" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="sm:col-span-2" />
          </div>
        )}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------- newsletter

export function NewsletterPage() {
  useDocumentMeta({ title: 'Subscribers', noIndex: true })
  const client = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'newsletter', q, page],
    queryFn: () => http.get<Paged<{ id: number; email: string; createdAt: string }>>('/admin/newsletter', { q, page, pageSize: 50 }),
    placeholderData: keepPreviousData,
  })
  const remove = useMutation({
    mutationFn: (id: number) => http.delete(`/admin/newsletter/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'newsletter'] }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <div>
      <PageHeader
        title="Newsletter subscribers"
        description="Emails collected from the footer sign-up form."
        actions={
          <a href="/api/admin/newsletter/export" className="flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            <Download className="size-4" /> Export CSV
          </a>
        }
      />
      <Card bodyClass="p-0">
        <div className="border-b border-slate-100 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Search email..." className="w-full sm:w-72" />
        </div>
        <DataTable
          rows={data?.items}
          loading={isLoading}
          rowKey={(s) => s.id}
          empty="No subscribers yet."
          columns={[
            { header: 'Email', cell: (s) => <span className="font-medium text-slate-900">{s.email}</span> },
            { header: 'Subscribed', cell: (s) => <span className="text-slate-500">{formatDate(s.createdAt, true)}</span> },
            {
              header: '',
              cell: (s) => (
                <Button size="icon-sm" variant="ghost" className="text-slate-400 hover:text-rose-600" onClick={() => remove.mutate(s.id)} aria-label="Remove subscriber">
                  <Trash2 className="size-4" />
                </Button>
              ),
              className: 'text-right',
            },
          ]}
        />
        {data && (
          <div className="flex justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{data.totalCount} subscribers</span>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  )
}
