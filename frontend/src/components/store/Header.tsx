import { ChevronDown, LayoutDashboard, Menu, ShoppingBag, Truck, UserRound } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { DynamicIcon } from '@/components/ui/Icons'
import { useBootstrap, useIsStaff, useMe } from '@/hooks/useStore'
import type { MenuCategory } from '@/lib/types'
import { cn, img } from '@/lib/utils'
import { cartCount, useCart } from '@/stores/cart'
import { Logo } from './Logo'
import { MobileMenu } from './MobileMenu'
import { SearchBox } from './SearchBox'

export function Header() {
  const { data } = useBootstrap()
  const { data: user } = useMe()
  const isStaff = useIsStaff(user)
  const items = useCart((s) => s.items)
  const openCart = useCart((s) => s.open)
  const [menuOpen, setMenuOpen] = useState(false)
  const count = cartCount(items)
  const announcement = data?.settings.general.announcementText

  return (
    <>
      {announcement && (
        <div className="bg-linear-to-r from-brand-deep via-brand-hover to-brand-deep text-white">
          <p className="container-x truncate py-1.5 text-center text-xs font-medium tracking-wide sm:text-[13px]">{announcement}</p>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="container-x flex h-(--header-h) items-center gap-3 sm:h-(--header-h-sm) lg:gap-8">
          <button className="-ml-2 rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu className="size-6" />
          </button>
          <Logo />
          <SearchBox className="hidden flex-1 md:block lg:max-w-2xl xl:max-w-3xl" />
          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            {isStaff && <HeaderAction to="/admin" icon={<LayoutDashboard className="size-5.5" />} label="Admin" className="hidden sm:flex" />}
            <HeaderAction to="/track-order" icon={<Truck className="size-5.5" />} label="Track" className="hidden sm:flex" />
            <HeaderAction
              to={user ? '/account' : '/login'}
              icon={<UserRound className="size-5.5" />}
              label={user ? user.fullName.split(' ')[0] : 'Account'}
              sub={user ? undefined : 'Sign in'}
              className="hidden sm:flex"
            />
            <button onClick={openCart} className="relative flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900" aria-label={`Cart, ${count} items`}>
              <span className="relative">
                <ShoppingBag className="size-5.5" />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </span>
              <span className="hidden text-xs font-medium sm:block">Cart</span>
            </button>
          </nav>
        </div>
        <div className="container-x pb-3 md:hidden">
          <SearchBox />
        </div>
      </header>

      <CategoryNav menu={data?.menu ?? []} />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} menu={data?.menu ?? []} />
    </>
  )
}

function HeaderAction({ to, icon, label, sub, className }: { to: string; icon: ReactNode; label: string; sub?: string; className?: string }) {
  return (
    <Link to={to} className={cn('flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900', className)}>
      {icon}
      <span className="max-w-20 truncate text-xs leading-none font-medium">{label}</span>
      {sub && <span className="text-[10px] leading-none text-slate-400">{sub}</span>}
    </Link>
  )
}

const navItemClass = 'flex items-center gap-1.5 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors'

/**
 * Desktop category bar. Categories come from the admin, so their number and names vary: the bar shows as many
 * as fit and tucks the rest into "More" instead of pushing the page wider than the screen.
 */
function CategoryNav({ menu }: { menu: MenuCategory[] }) {
  const slot = useRef<HTMLDivElement>(null)
  const ruler = useRef<HTMLDivElement>(null)
  const [fitting, setFitting] = useState(menu.length)

  useLayoutEffect(() => {
    const space = slot.current
    const row = ruler.current
    if (!space || !row) return
    const fit = () => {
      const width = (el: Element | null) => el?.getBoundingClientRect().width ?? 0
      const items = [...row.querySelectorAll('[data-nav-item]')].map(width)
      const available = space.clientWidth
      if (items.reduce((sum, w) => sum + w, 0) <= available) return setFitting(items.length)
      let used = width(row.querySelector('[data-nav-more]'))
      let count = 0
      while (count < items.length && used + items[count] <= available) used += items[count++]
      setFitting(count)
    }
    fit()
    // Re-fit when the window resizes and when web fonts finish loading (which changes the item widths).
    const observer = new ResizeObserver(fit)
    observer.observe(space)
    observer.observe(row)
    return () => observer.disconnect()
  }, [menu])

  const overflow = menu.slice(fitting)

  return (
    <div className="relative z-30 hidden border-b border-slate-200/80 bg-white lg:block">
      <nav className="container-x flex items-center gap-2">
        <div ref={slot} className="min-w-0 flex-1">
          {/* Invisible copy of every item, used only to measure what fits. */}
          <div aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
            <div ref={ruler} className="flex w-max">
              {menu.map((category) => (
                <span key={category.id} data-nav-item className={navItemClass}>
                  <NavItemLabel category={category} />
                </span>
              ))}
              <span data-nav-more className={navItemClass}>
                More <ChevronDown className="size-3.5" />
              </span>
            </div>
          </div>
          <ul className="flex items-center">
            {menu.slice(0, fitting).map((category) => (
              <CategoryNavItem key={category.id} category={category} />
            ))}
            {overflow.length > 0 && <MoreCategories categories={overflow} />}
          </ul>
        </div>
        <Link
          to="/offers"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-4 py-1.5 text-sm font-semibold text-white shadow-md shadow-rose-500/25 transition hover:-translate-y-px hover:shadow-lg hover:shadow-rose-500/30"
        >
          🔥 Offers
        </Link>
      </nav>
    </div>
  )
}

function NavItemLabel({ category }: { category: MenuCategory }) {
  return (
    <>
      <DynamicIcon name={category.icon} className="hidden size-4 text-brand xl:block" />
      {category.name}
      {category.children.length > 0 && <ChevronDown className="size-3.5 opacity-60 transition group-hover:rotate-180" />}
    </>
  )
}

function CategoryNavItem({ category }: { category: MenuCategory }) {
  return (
    <li className="group static">
      <NavLink to={`/category/${category.slug}`} className={({ isActive }) => cn(navItemClass, isActive ? 'text-brand-deep' : 'text-slate-700 hover:text-brand-deep')}>
        <NavItemLabel category={category} />
      </NavLink>
      {category.children.length > 0 && (
        <div className="invisible absolute inset-x-0 top-full border-t border-slate-100 bg-white opacity-0 shadow-xl transition duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
          <div className="container-x grid grid-cols-[220px_1fr] gap-8 py-6">
            <div className="rounded-2xl bg-brand-softer p-5">
              <span className="flex size-11 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
                <DynamicIcon name={category.icon} className="size-5.5" />
              </span>
              <p className="mt-3 text-base font-semibold text-slate-900">{category.name}</p>
              <Link to={`/category/${category.slug}`} className="mt-2 inline-block text-sm font-semibold text-brand-deep hover:underline">
                Shop all →
              </Link>
            </div>
            <ul className="grid grid-cols-3 gap-2 xl:grid-cols-4">
              {category.children.map((child) => (
                <li key={child.id}>
                  <Link to={`/category/${child.slug}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50">
                    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                      {child.imageUrl ? <img src={img(child.imageUrl, 96)} alt="" className="size-12 object-cover" loading="lazy" /> : <DynamicIcon name={child.icon} className="size-5 text-slate-500" />}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{child.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  )
}

/** Categories that didn't fit in the bar, with their subcategories. */
function MoreCategories({ categories }: { categories: MenuCategory[] }) {
  return (
    <li className="group/more relative">
      <button type="button" aria-haspopup="true" className={cn(navItemClass, 'text-slate-700 hover:text-brand-deep')}>
        More <ChevronDown className="size-3.5 opacity-60 transition group-hover/more:rotate-180" />
      </button>
      <div className="invisible absolute top-full right-0 w-80 translate-y-1 rounded-2xl bg-white p-2 opacity-0 shadow-xl ring-1 ring-slate-200/80 transition duration-150 group-focus-within/more:visible group-focus-within/more:translate-y-0 group-focus-within/more:opacity-100 group-hover/more:visible group-hover/more:translate-y-0 group-hover/more:opacity-100">
        {categories.map((category) => (
          <div key={category.id} className="rounded-xl p-2.5 transition hover:bg-slate-50">
            <Link to={`/category/${category.slug}`} className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 hover:text-brand-deep">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-deep">
                <DynamicIcon name={category.icon} className="size-4" />
              </span>
              {category.name}
            </Link>
            {category.children.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-[2.625rem] text-xs">
                {category.children.map((child) => (
                  <Link key={child.id} to={`/category/${child.slug}`} className="text-slate-500 hover:text-brand-deep">
                    {child.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </li>
  )
}
