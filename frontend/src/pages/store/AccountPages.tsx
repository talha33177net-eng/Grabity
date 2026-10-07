import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, LayoutDashboard, LogOut, MessageSquareText, Package, Settings } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { OrderView } from '@/components/store/OrderView'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Badge, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { Pagination, Stars } from '@/components/ui/Misc'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { meKey, useLogout, useMe } from '@/hooks/useStore'
import { errorMessage, http } from '@/lib/api'
import { formatDate, money, orderStatusLabel, orderStatusTone } from '@/lib/format'
import type { AccountSummary, MyReview, OrderDetail, OrderSummary, Paged, User } from '@/lib/types'
import { cn, img, initials } from '@/lib/utils'

export function AccountLayout() {
  const { data: user, isLoading } = useMe()
  const location = useLocation()
  const logout = useLogout()
  const navigate = useNavigate()

  if (isLoading) return <PageLoader />
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />

  const links = [
    { to: '/account', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/account/orders', label: 'My orders', icon: Package },
    { to: '/account/reviews', label: 'My reviews', icon: MessageSquareText },
    { to: '/account/settings', label: 'Account settings', icon: Settings },
  ]

  return (
    <div className="container-x pt-4 sm:pt-6">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-3xl border border-slate-200/80 bg-white p-3 lg:sticky lg:top-24">
          <div className="flex items-center gap-3 p-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{initials(user.fullName)}</span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{user.fullName}</p>
              <p className="truncate text-xs text-slate-500">{user.phone ?? user.email}</p>
            </div>
          </div>
          <nav className="scrollbar-none mt-1 flex gap-1 overflow-x-auto lg:flex-col">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn('flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand-soft text-brand' : 'text-slate-600 hover:bg-slate-50')
                }
              >
                <Icon className="size-4.5" /> {label}
              </NavLink>
            ))}
            <button
              onClick={() =>
                logout.mutate(undefined, {
                  onSuccess: () => {
                    toast.success('You have been signed out.')
                    navigate('/')
                  },
                })
              }
              className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="size-4.5" /> Sign out
            </button>
          </nav>
        </aside>
        <div className="min-w-0">
          <Outlet context={user} />
        </div>
      </div>
    </div>
  )
}

export function AccountOverviewPage() {
  const { data: user } = useMe()
  useDocumentMeta({ title: 'My account', noIndex: true })
  const { data: summary } = useQuery({ queryKey: ['account', 'summary'], queryFn: () => http.get<AccountSummary>('/account/summary') })
  const { data: orders } = useQuery({ queryKey: ['account', 'orders', 1], queryFn: () => http.get<Paged<OrderSummary>>('/account/orders', { page: 1, pageSize: 5 }) })
  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-deep p-6 text-white sm:p-8">
        <p className="text-sm font-medium opacity-80">My account</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Welcome back, {user.fullName.split(' ')[0]}!</h1>
        <p className="mt-1 text-sm opacity-80">Track orders, manage your details and review products you've bought.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total orders" value={summary?.totalOrders ?? '–'} />
        <Stat label="Active orders" value={summary?.activeOrders ?? '–'} />
        <Stat label="Total spent" value={summary ? money(summary.totalSpent) : '–'} />
        <Stat label="Reviews" value={summary?.reviewCount ?? '–'} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent orders</h2>
            <Link to="/account/orders" className="text-sm font-semibold text-brand hover:underline">
              View all
            </Link>
          </div>
          {orders && orders.items.length === 0 ? (
            <EmptyState icon={<Package className="size-6" />} title="No orders yet" description="When you place an order it will show up here." action={<ButtonLink to="/">Start shopping</ButtonLink>} className="py-8" />
          ) : (
            <OrderList orders={orders?.items ?? []} />
          )}
        </section>
        <section className="h-fit rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Account info</h2>
            <Link to="/account/settings" className="text-sm font-semibold text-brand hover:underline">
              Edit
            </Link>
          </div>
          <dl className="space-y-3 text-sm">
            <Info label="Name" value={user.fullName} />
            <Info label="Phone" value={user.phone} />
            <Info label="Email" value={user.email} />
            <Info label="Address" value={user.address} />
          </dl>
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value || <span className="font-normal text-slate-400">Not set</span>}</dd>
    </div>
  )
}

function OrderList({ orders }: { orders: OrderSummary[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {orders.map((order) => (
        <li key={order.orderNumber}>
          <Link to={`/account/orders/${order.orderNumber}`} className="flex items-center gap-3 py-3 hover:bg-slate-50/60 sm:gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-slate-50">
              {order.firstItemImage && <img src={img(order.firstItemImage, 112)} alt="" className="size-11 object-contain" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                #{order.orderNumber}
                <Badge tone={orderStatusTone[order.status]} dot>
                  {orderStatusLabel[order.status]}
                </Badge>
              </p>
              <p className="mt-0.5 truncate text-sm text-slate-600">
                {order.firstItemName}
                {order.itemCount > 1 && ` + ${order.itemCount - 1} more`}
              </p>
              <p className="text-xs text-slate-400">{formatDate(order.createdAt)}</p>
            </div>
            <span className="text-sm font-semibold text-slate-900">{money(order.total)}</span>
            <ChevronRight className="size-4 text-slate-400" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function AccountOrdersPage() {
  useDocumentMeta({ title: 'My orders', noIndex: true })
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({ queryKey: ['account', 'orders', page], queryFn: () => http.get<Paged<OrderSummary>>('/account/orders', { page, pageSize: 10 }) })
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
      <h1 className="mb-4 text-xl font-bold text-slate-900">My orders</h1>
      {isLoading ? (
        <PageLoader />
      ) : data && data.items.length > 0 ? (
        <>
          <OrderList orders={data.items} />
          <Pagination className="mt-4" page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      ) : (
        <EmptyState icon={<Package className="size-6" />} title="No orders yet" description="Orders you place while signed in will appear here." action={<ButtonLink to="/">Start shopping</ButtonLink>} />
      )}
    </section>
  )
}

export function AccountOrderPage() {
  const { orderNumber } = useParams()
  useDocumentMeta({ title: `Order #${orderNumber}`, noIndex: true })
  const { data, isLoading } = useQuery({ queryKey: ['account', 'order', orderNumber], queryFn: () => http.get<OrderDetail>(`/account/orders/${orderNumber}`) })
  if (isLoading || !data) return <PageLoader />
  return (
    <div>
      <Link to="/account/orders" className="mb-4 inline-block text-sm font-semibold text-brand hover:underline">
        ← All orders
      </Link>
      <OrderView order={data} />
    </div>
  )
}

export function AccountReviewsPage() {
  useDocumentMeta({ title: 'My reviews', noIndex: true })
  const { data, isLoading } = useQuery({ queryKey: ['account', 'reviews'], queryFn: () => http.get<MyReview[]>('/account/reviews') })
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
      <h1 className="mb-4 text-xl font-bold text-slate-900">My reviews</h1>
      {isLoading ? (
        <PageLoader />
      ) : data && data.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {data.map((review) => (
            <li key={review.id} className="flex gap-4 py-4">
              <Link to={`/product/${review.productSlug}`} className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-slate-50">
                {review.productImage && <img src={img(review.productImage, 128)} alt="" className="size-12 object-contain" />}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/product/${review.productSlug}`} className="text-sm font-semibold text-slate-900 hover:text-brand">
                    {review.productName}
                  </Link>
                  {!review.isApproved && <Badge tone="amber">Awaiting approval</Badge>}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Stars value={review.rating} size="xs" />
                  <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{review.comment}</p>
                {review.adminReply && <p className="mt-2 rounded-xl bg-brand-softer p-3 text-sm text-slate-700">Store reply: {review.adminReply}</p>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<MessageSquareText className="size-6" />} title="No reviews yet" description="After you receive an order, share your experience on the product page." />
      )}
    </section>
  )
}

export function AccountSettingsPage() {
  const { data: user } = useMe()
  useDocumentMeta({ title: 'Account settings', noIndex: true })
  if (!user) return null
  return (
    <div className="space-y-6">
      <ProfileForm user={user} />
      <PasswordForm />
    </div>
  )
}

function ProfileForm({ user }: { user: User }) {
  const client = useQueryClient()
  const [form, setForm] = useState({ fullName: user.fullName, phone: user.phone ?? '', email: user.email ?? '', address: user.address ?? '' })
  const save = useMutation({
    mutationFn: () => http.put<User>('/account/profile', { ...form, email: form.email || null }),
    onSuccess: (updated) => {
      client.setQueryData(meKey, updated)
      toast.success('Your details have been saved.')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
      <h1 className="text-xl font-bold text-slate-900">Personal details</h1>
      <p className="mt-1 mb-5 text-sm text-slate-500">Used to prefill your checkout.</p>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <Field label="Full name" htmlFor="pf-name" required>
          <Input id="pf-name" value={form.fullName} onChange={set('fullName')} required />
        </Field>
        <Field label="Mobile number" htmlFor="pf-phone" required>
          <Input id="pf-phone" type="tel" value={form.phone} onChange={set('phone')} required />
        </Field>
        <Field label="Email" htmlFor="pf-email" className="sm:col-span-2">
          <Input id="pf-email" type="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Delivery address" htmlFor="pf-address" className="sm:col-span-2">
          <Textarea id="pf-address" rows={2} value={form.address} onChange={set('address')} />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" loading={save.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </section>
  )
}

function PasswordForm() {
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const change = useMutation({
    mutationFn: () => http.post('/account/change-password', { currentPassword, newPassword }),
    onSuccess: () => {
      toast.success('Password updated.')
      setCurrent('')
      setNew('')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-bold text-slate-900">Change password</h2>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          change.mutate()
        }}
      >
        <Field label="Current password" htmlFor="cur-pass" required>
          <Input id="cur-pass" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
        </Field>
        <Field label="New password" htmlFor="new-pass" required hint="At least 6 characters.">
          <Input id="new-pass" type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(e) => setNew(e.target.value)} required />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" variant="dark" loading={change.isPending}>
            Update password
          </Button>
        </div>
      </form>
    </section>
  )
}
