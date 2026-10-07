import { useQuery } from '@tanstack/react-query'
import { LoaderCircle, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useDebounce } from '@/hooks/useDebounce'
import { http } from '@/lib/api'
import { money } from '@/lib/format'
import type { SearchSuggestion } from '@/lib/types'
import { cn, img } from '@/lib/utils'

interface SearchBoxProps {
  className?: string
  autoFocus?: boolean
  onNavigate?: () => void
}

export function SearchBox({ className, autoFocus, onNavigate }: SearchBoxProps) {
  const [params] = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const debounced = useDebounce(term.trim(), 220)
  const navigate = useNavigate()
  const boxRef = useRef<HTMLDivElement>(null)

  const { data = [], isFetching } = useQuery({
    queryKey: ['suggest', debounced],
    queryFn: ({ signal }) => http.get<SearchSuggestion[]>('/search/suggest', { q: debounced }, signal),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  })

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => setActive(-1), [debounced])

  const go = (path: string) => {
    setOpen(false)
    onNavigate?.()
    navigate(path)
  }

  const submit = () => {
    if (active >= 0 && data[active]) return go(`/product/${data[active].slug}`)
    if (term.trim()) go(`/search?q=${encodeURIComponent(term.trim())}`)
  }

  const showPanel = open && debounced.length >= 2

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex h-11 items-center rounded-full border border-slate-200 bg-slate-100/80 pr-1.5 pl-4 transition focus-within:border-brand focus-within:bg-white focus-within:ring-3 focus-within:ring-brand-ring"
      >
        <Search className="size-4.5 shrink-0 text-slate-400" />
        <input
          type="search"
          value={term}
          autoFocus={autoFocus}
          onChange={(e) => {
            setTerm(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, data.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, -1))
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder="Search for phones, earbuds, chargers..."
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
          aria-label="Search products"
          autoComplete="off"
        />
        {term && (
          <button type="button" onClick={() => setTerm('')} className="rounded-full p-1.5 text-slate-400 hover:text-slate-700" aria-label="Clear search">
            <X className="size-4" />
          </button>
        )}
        <button type="submit" className="ml-1 flex h-8 items-center rounded-full bg-linear-to-r from-brand to-brand-hover px-4 text-sm font-semibold text-white shadow-sm shadow-brand-ring transition hover:brightness-110">
          Search
        </button>
      </form>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-pop-in">
          {isFetching && data.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" /> Searching...
            </div>
          ) : data.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-500">No products match “{debounced}”.</div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1.5">
              {data.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(`/product/${item.slug}`)}
                    className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', index === active ? 'bg-brand-softer' : 'hover:bg-slate-50')}
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50">
                      {item.imageUrl && <img src={img(item.imageUrl, 96)} alt="" className="size-10 object-contain" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-medium text-slate-900">{item.name}</span>
                      <span className="mt-0.5 flex items-baseline gap-2 text-sm">
                        {item.hidePrice ? (
                          <span className="font-semibold text-brand">Call for price</span>
                        ) : (
                          <>
                            <span className="font-semibold text-brand">{money(item.price)}</span>
                            {item.compareAtPrice && item.compareAtPrice > item.price && (
                              <span className="text-xs text-slate-400 line-through">{money(item.compareAtPrice)}</span>
                            )}
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => go(`/search?q=${encodeURIComponent(debounced)}`)}
            className="block w-full border-t border-slate-100 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-brand hover:bg-brand-softer"
          >
            View all results for “{debounced}”
          </button>
        </div>
      )}
    </div>
  )
}
