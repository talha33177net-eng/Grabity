import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  ExternalLink,
  FileText,
  FolderTree,
  Image,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  Newspaper,
  Package,
  Send,
  Settings,
  ShoppingCart,
  Tag,
  TicketPercent,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { LogoMark } from '@/components/store/Logo'
import { Button } from '@/components/ui/Button'
import { EmptyState, PageLoader } from '@/components/ui/Feedback'
import { useIsStaff, useLogout, useMe, useSettings } from '@/hooks/useStore'
import { http } from '@/lib/api'
import type { AdminCounts } from '@/lib/adminTypes'
import { cn, initials } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  adminOnly?: boolean
  badge?: 'orders' | 'reviews'
}

const nav: { title?: string; items: NavItem[] }[] = [
  { items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    title: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: ShoppingCart, badge: 'orders' },
      { to: '/admin/customers', label: 'Customers', icon: Users },
      { to: '/admin/reviews', label: 'Reviews', icon: MessageSquareText, badge: 'reviews' },
      { to: '/admin/coupons', label: 'Coupons', icon: TicketPercent },
      { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { to: '/admin/products', label: 'Products', icon: Package },
      { to: '/admin/categories', label: 'Categories', icon: FolderTree },
      { to: '/admin/brands', label: 'Brands', icon: Tag },
    ],
  },
  {
    title: 'Storefront',
    items: [
      { to: '/admin/home-sections', label: 'Homepage', icon: LayoutTemplate },
      { to: '/admin/banners', label: 'Banners & popup', icon: Image },
      { to: '/admin/blog', label: 'Blog', icon: Newspaper },
      { to: '/admin/pages', label: 'Pages', icon: FileText },
    ],
  },
  {
    title: 'Settings',
    items: [
      { to: '/admin/settings', label: 'Store settings', icon: Settings },
      { to: '/admin/shipping', label: 'Delivery', icon: Truck },
      { to: '/admin/payments', label: 'Payments', icon: Wallet },
      { to: '/admin/email', label: 'Email', icon: Send, adminOnly: true },
      { to: '/admin/staff', label: 'Staff', icon: UserCog, adminOnly: true },
      { to: '/admin/newsletter', label: 'Subscribers', icon: Mail },
    ],
  },
]

/** Guards admin pages that render outside the admin layout (e.g. the printable invoice). */
export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useMe()
  const isStaff = useIsStaff(user)
  const location = useLocation()
  if (isLoading) return <PageLoader />
  if (!isStaff) return <Navigate to={`/admin/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  return <>{children}</>
}

export function AdminLayout() {
  const { data: user, isLoading } = useMe()
  const isStaff = useIsStaff(user)
  const settings = useSettings()
  const logout = useLogout()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const isAdmin = !!user?.roles.includes('Admin')

  // Nested under the dashboard key, so anything that refreshes the dashboard refreshes the badges too.
  const { data: counts } = useQuery({
    queryKey: ['admin', 'dashboard', 'counts'],
    queryFn: () => http.get<AdminCounts>('/admin/dashboard/counts'),
    enabled: isStaff,
    refetchInterval: 60_000,
  })

  useEffect(() => setOpen(false), [location.pathname])

  if (isLoading) return <PageLoader />
  if (!user) return <Navigate to={`/admin/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  if (!isStaff) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <EmptyState
          title="Admin access required"
          description="You're signed in with a customer account. Sign in with a staff account to open the admin panel."
          action={
            <div className="flex gap-2">
              <Button onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/admin/login') })}>Switch account</Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                Back to store
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const badges = { orders: counts?.pendingOrders ?? 0, reviews: counts?.pendingReviews ?? 0 }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-2.5 px-5 py-5">
        <LogoMark className="size-9" />
        <div>
          <p className="leading-tight font-bold text-white">{settings?.general.storeName ?? 'Grabity'}</p>
          <p className="text-xs text-slate-400">Admin panel</p>
        </div>
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 [scrollbar-color:var(--color-slate-700)_transparent] [scrollbar-width:thin]">
        {nav.map((group, i) => (
          <div key={i}>
            {group.title && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{group.title}</p>}
            <ul className="space-y-0.5">
              {group.items
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                          isActive ? 'bg-brand text-white shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      <item.icon className="size-4.5 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && badges[item.badge] > 0 && (
                        <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] leading-none font-bold text-slate-900">{badges[item.badge]}</span>
                      )}
                    </NavLink>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  )

  return (
    <div className="min-h-dvh bg-slate-100/70">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-slate-950 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-slide-in-left bg-slate-950">
            <button onClick={() => setOpen(false)} className="absolute top-5 right-3 rounded-lg p-1.5 text-slate-400 hover:text-white" aria-label="Close menu">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setOpen(true)} className="-ml-1.5 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            <Menu className="size-5.5" />
          </button>
          <div className="flex-1" />
          <a href="/" target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:flex">
            <ExternalLink className="size-4" /> View store
          </a>
          <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{initials(user.fullName)}</span>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold text-slate-900">{user.fullName}</p>
              <p className="text-xs text-slate-500">{user.roles.find((r) => r !== 'Customer')}</p>
            </div>
            <button
              onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/admin/login') })}
              className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4.5" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <ScrollRestoration />
    </div>
  )
}
