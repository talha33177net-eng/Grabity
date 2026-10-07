import { ChevronLeft, ChevronRight, House } from 'lucide-react'
import { useRef, useState, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { Breadcrumb, ProductCard as Product } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ProductCard } from './ProductCard'

export function SectionHeader({ title, subtitle, viewAllUrl, action, className }: { title: ReactNode; subtitle?: ReactNode; viewAllUrl?: string | null; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
          <span aria-hidden className="h-6 w-1.5 shrink-0 rounded-full bg-linear-to-b from-brand-light to-brand sm:h-7" />
          {title}
        </h2>
        {subtitle && <p className="mt-1.5 pl-[1.125rem] text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {viewAllUrl && (
          <Link
            to={viewAllUrl}
            className="group flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-deep shadow-sm ring-1 ring-brand-muted transition duration-300 hover:bg-brand hover:text-white hover:shadow-md hover:shadow-brand-ring hover:ring-brand"
          >
            View all <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </div>
  )
}

const railItemClass = 'w-[46%] xs:w-[44%] sm:w-[31%] md:w-[24%] lg:w-[19%] xl:w-[16%]'

/** Horizontally scrolling product row with arrow buttons on desktop. */
export function ProductRail({ products, className, itemClassName = railItemClass }: { products: Product[]; className?: string; itemClassName?: string }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  const update = () => {
    const el = scroller.current
    if (!el) return
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
  }
  useEffect(update, [products])

  const scroll = (direction: 1 | -1) => {
    const el = scroller.current
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <div className={cn('group/rail relative', className)}>
      {/* Vertical padding leaves room for the cards' hover lift and shadow inside the scroller. */}
      <div ref={scroller} onScroll={update} className="scrollbar-none -mx-4 -my-5 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto scroll-smooth px-4 py-5 sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0">
        {products.map((product) => (
          <div key={product.id} className={cn('shrink-0 snap-start', itemClassName)}>
            <ProductCard product={product} className="h-full" />
          </div>
        ))}
      </div>
      {!edges.start && <RailArrow side="left" onClick={() => scroll(-1)} />}
      {!edges.end && <RailArrow side="right" onClick={() => scroll(1)} />}
    </div>
  )
}

function RailArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute top-1/3 z-10 hidden size-11 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg ring-1 ring-slate-200 backdrop-blur transition duration-300 hover:bg-brand hover:text-white hover:shadow-brand-ring hover:ring-brand lg:flex',
        side === 'left' ? '-left-5' : '-right-5',
      )}
      aria-label={side === 'left' ? 'Scroll left' : 'Scroll right'}
    >
      <Icon className="size-5" />
    </button>
  )
}

export function Breadcrumbs({ items, current, className }: { items: { name: string; to: string }[]; current?: string; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex min-w-0 items-center gap-1.5 overflow-x-auto text-sm whitespace-nowrap text-slate-500 scrollbar-none', className)}>
      <Link to="/" className="flex items-center gap-1 hover:text-brand">
        <House className="size-3.5" /> Home
      </Link>
      {items.map((item) => (
        <span key={item.to} className="flex items-center gap-1.5">
          <ChevronRight className="size-3.5 text-slate-300" />
          <Link to={item.to} className="hover:text-brand">
            {item.name}
          </Link>
        </span>
      ))}
      {current && (
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="size-3.5 shrink-0 text-slate-300" />
          <span className="truncate font-medium text-slate-800">{current}</span>
        </span>
      )}
    </nav>
  )
}

export const categoryCrumbs = (crumbs: Breadcrumb[]) => crumbs.map((c) => ({ name: c.name, to: `/category/${c.slug}` }))

/** Renders sanitized HTML coming from the admin editor. */
export function RichContent({ html, className }: { html?: string | null; className?: string }) {
  if (!html) return null
  return <div className={cn('rich-content', className)} dangerouslySetInnerHTML={{ __html: html }} />
}
