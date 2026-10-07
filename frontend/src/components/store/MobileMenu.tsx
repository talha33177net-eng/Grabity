import { ChevronDown, LayoutDashboard, LogIn, LogOut, Newspaper, Package, Percent, Star, Tag, Truck, UserPlus, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Drawer } from '@/components/ui/Overlay'
import { DynamicIcon, WhatsAppIcon } from '@/components/ui/Icons'
import { useIsStaff, useLogout, useMe, useSettings } from '@/hooks/useStore'
import type { MenuCategory } from '@/lib/types'
import { cn, initials } from '@/lib/utils'
import { Logo } from './Logo'

export function MobileMenu({ open, onClose, menu }: { open: boolean; onClose: () => void; menu: MenuCategory[] }) {
  const { data: user } = useMe()
  const isStaff = useIsStaff(user)
  const logout = useLogout()
  const settings = useSettings()
  const [expanded, setExpanded] = useState<number | null>(null)

  const link = 'flex items-center gap-3 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50'

  return (
    <Drawer open={open} onClose={onClose} side="left" title={<Logo className="pointer-events-none" />} widthClass="max-w-sm">
      <div className="border-b border-slate-100 p-4">
        {user ? (
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand">{initials(user.fullName)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">{user.fullName}</p>
              <button
                className="mt-0.5 flex items-center gap-1 text-sm font-medium text-rose-600"
                onClick={() => {
                  logout.mutate()
                  onClose()
                }}
              >
                <LogOut className="size-3.5" /> Log out
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Link to="/login" onClick={onClose} className="flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white">
              <LogIn className="size-4" /> Sign in
            </Link>
            <Link to="/register" onClick={onClose} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-800">
              <UserPlus className="size-4" /> Register
            </Link>
          </div>
        )}
      </div>

      <div className="py-2">
        {isStaff && (
          <Link to="/admin" onClick={onClose} className={link}>
            <LayoutDashboard className="size-5 text-brand" /> Admin panel
          </Link>
        )}
        <Link to="/track-order" onClick={onClose} className={link}>
          <Truck className="size-5 text-slate-500" /> Track order
        </Link>
        <Link to="/offers" onClick={onClose} className={link}>
          <Percent className="size-5 text-rose-500" /> Offers & deals
        </Link>
      </div>

      <p className="px-5 pt-2 pb-1 text-xs font-semibold tracking-wider text-slate-400 uppercase">Categories</p>
      <ul className="pb-2">
        {menu.map((category) => (
          <li key={category.id} className="border-b border-slate-50">
            <div className="flex items-center">
              <Link to={`/category/${category.slug}`} onClick={onClose} className="flex flex-1 items-center gap-3 px-5 py-3 text-sm font-medium text-slate-800">
                <DynamicIcon name={category.icon} className="size-5 text-slate-500" />
                {category.name}
              </Link>
              {category.children.length > 0 && (
                <button
                  className="px-5 py-3 text-slate-500"
                  onClick={() => setExpanded(expanded === category.id ? null : category.id)}
                  aria-label={`Show ${category.name} subcategories`}
                  aria-expanded={expanded === category.id}
                >
                  <ChevronDown className={cn('size-4.5 transition', expanded === category.id && 'rotate-180')} />
                </button>
              )}
            </div>
            {expanded === category.id && (
              <ul className="bg-slate-50 py-1">
                {category.children.map((child) => (
                  <li key={child.id}>
                    <Link to={`/category/${child.slug}`} onClick={onClose} className="block py-2.5 pr-5 pl-13 text-sm text-slate-600 hover:text-brand">
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <div className="border-t border-slate-100 py-2">
        {user && (
          <>
            <Link to="/account/orders" onClick={onClose} className={link}>
              <Package className="size-5 text-slate-500" /> My orders
            </Link>
            <Link to="/account" onClick={onClose} className={link}>
              <UserRound className="size-5 text-slate-500" /> My account
            </Link>
          </>
        )}
        <Link to="/brands" onClick={onClose} className={link}>
          <Tag className="size-5 text-slate-500" /> All brands
        </Link>
        <Link to="/reviews" onClick={onClose} className={link}>
          <Star className="size-5 text-slate-500" /> Customer reviews
        </Link>
        <Link to="/blog" onClick={onClose} className={link}>
          <Newspaper className="size-5 text-slate-500" /> Blog
        </Link>
        {settings?.contact.whatsAppNumber && (
          <a href={`https://wa.me/${settings.contact.whatsAppNumber}`} target="_blank" rel="noreferrer" className={link}>
            <WhatsAppIcon className="size-5 text-emerald-600" /> Chat on WhatsApp
          </a>
        )}
      </div>
    </Drawer>
  )
}
