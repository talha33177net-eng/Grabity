import { House, LayoutGrid, ShoppingBag, UserRound, Percent } from 'lucide-react'
import { NavLink } from 'react-router'
import { useMe } from '@/hooks/useStore'
import { cn } from '@/lib/utils'
import { cartCount, useCart } from '@/stores/cart'

/** App-style bottom navigation for phones. Hidden on large screens and on pages with their own sticky bar. */
export function MobileBottomNav() {
  const { data: user } = useMe()
  const count = useCart((s) => cartCount(s.items))
  const openCart = useCart((s) => s.open)

  const item = ({ isActive }: { isActive: boolean }) =>
    cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand' : 'text-slate-500')

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="flex">
        <NavLink to="/" end className={item}>
          <House className="size-5.5" /> Home
        </NavLink>
        <NavLink to="/categories" className={item}>
          <LayoutGrid className="size-5.5" /> Categories
        </NavLink>
        <button onClick={openCart} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500">
          <span className="relative">
            <ShoppingBag className="size-5.5" />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-2.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {count}
              </span>
            )}
          </span>
          Cart
        </button>
        <NavLink to="/offers" className={item}>
          <Percent className="size-5.5" /> Offers
        </NavLink>
        <NavLink to={user ? '/account' : '/login'} className={item}>
          <UserRound className="size-5.5" /> {user ? 'Account' : 'Sign in'}
        </NavLink>
      </div>
    </nav>
  )
}
