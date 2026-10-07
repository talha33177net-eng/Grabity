import { ChevronLeft, ChevronRight, Minus, Plus, Star } from 'lucide-react'
import { useState } from 'react'
import { money } from '@/lib/format'
import { cn, discountPercent } from '@/lib/utils'

export function Stars({ value, size = 'sm', className }: { value: number; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const px = { xs: 'size-3', sm: 'size-3.5', md: 'size-4.5', lg: 'size-6' }[size]
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)))
        return (
          <span key={i} className={cn('relative', px)}>
            <Star className={cn('absolute inset-0 text-slate-300', px)} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn('text-amber-400', px)} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        )
      })}
    </span>
  )
}

export function StarInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hover, setHover] = useState(0)
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']
  return (
    <div className="flex items-center gap-3">
      <div className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onMouseEnter={() => setHover(i)} onClick={() => onChange(i)} className="p-0.5" aria-label={`${i} star${i > 1 ? 's' : ''}`}>
            <Star className={cn('size-7 transition', (hover || value) >= i ? 'text-amber-400' : 'text-slate-300')} fill="currentColor" strokeWidth={0} />
          </button>
        ))}
      </div>
      <span className="text-sm font-medium text-slate-600">{labels[hover || value]}</span>
    </div>
  )
}

export function QuantityStepper({
  value,
  onChange,
  max,
  min = 1,
  size = 'md',
  className,
}: {
  value: number
  onChange: (value: number) => void
  max?: number | null
  min?: number
  size?: 'sm' | 'md'
  className?: string
}) {
  const upper = max ?? 99
  const btn = size === 'sm' ? 'size-7' : 'size-10'
  return (
    <div className={cn('inline-flex items-center rounded-lg border border-slate-300 bg-white', className)}>
      <button type="button" className={cn(btn, 'flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30')} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Decrease quantity">
        <Minus className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={upper}
        onChange={(e) => {
          const next = Number.parseInt(e.target.value, 10)
          if (!Number.isNaN(next)) onChange(Math.min(Math.max(next, min), upper))
        }}
        className={cn('w-10 [appearance:textfield] bg-transparent text-center font-semibold text-slate-900 outline-none [&::-webkit-inner-spin-button]:appearance-none', size === 'sm' ? 'text-sm' : 'text-base')}
        aria-label="Quantity"
      />
      <button type="button" className={cn(btn, 'flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30')} disabled={value >= upper} onClick={() => onChange(value + 1)} aria-label="Increase quantity">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export function Price({
  price,
  compareAtPrice,
  hidePrice,
  size = 'md',
  className,
  showSaving,
}: {
  price: number
  compareAtPrice?: number | null
  hidePrice?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showSaving?: boolean
}) {
  if (hidePrice) return <span className={cn('font-semibold text-brand', size === 'xl' ? 'text-2xl' : 'text-sm', className)}>Call for price</span>
  const main = { sm: 'text-sm', md: 'text-base', lg: 'text-xl', xl: 'text-3xl' }[size]
  const strike = { sm: 'text-xs', md: 'text-xs', lg: 'text-sm', xl: 'text-base' }[size]
  const pct = discountPercent(price, compareAtPrice)
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span className={cn('font-bold tracking-tight text-slate-900', main)}>{money(price)}</span>
      {pct > 0 && <span className={cn('text-slate-400 line-through', strike)}>{money(compareAtPrice)}</span>}
      {showSaving && pct > 0 && (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 ring-inset">
          Save {money(compareAtPrice! - price)} ({pct}%)
        </span>
      )}
    </span>
  )
}

export function Pagination({ page, totalPages, onChange, className }: { page: number; totalPages: number; onChange: (page: number) => void; className?: string }) {
  if (totalPages <= 1) return null
  const pages: (number | '…')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i)
    else if (pages[pages.length - 1] !== '…') pages.push('…')
  }
  const cell = 'flex size-9 items-center justify-center rounded-lg text-sm font-medium transition'
  return (
    <nav className={cn('flex items-center justify-center gap-1', className)} aria-label="Pagination">
      <button className={cn(cell, 'text-slate-600 hover:bg-slate-100 disabled:opacity-40')} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(cell, p === page ? 'bg-brand text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100')}
          >
            {p}
          </button>
        ),
      )}
      <button className={cn(cell, 'text-slate-600 hover:bg-slate-100 disabled:opacity-40')} disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight className="size-4" />
      </button>
    </nav>
  )
}
