import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { PackageSearch, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'
import { Checkbox, Select } from '@/components/ui/Form'
import { Pagination } from '@/components/ui/Misc'
import { Drawer } from '@/components/ui/Overlay'
import { embeddedResponse, http } from '@/lib/api'
import { money } from '@/lib/format'
import type { CategoryCard, ProductFacets, ProductList } from '@/lib/types'
import { cn, img } from '@/lib/utils'
import { ProductCard, ProductCardSkeleton, productGridClass } from './ProductCard'

export interface ListingScope {
  category?: string
  brand?: string
  q?: string
  onSale?: boolean
  featured?: boolean
}

const sorts = [
  { value: '', label: 'Newest first' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'name', label: 'Name A–Z' },
]

interface ProductListingProps {
  scope: ListingScope
  showBrandFilter?: boolean
  subcategories?: CategoryCard[]
  emptyMessage?: ReactNode
}

export function ProductListing({ scope, showBrandFilter = true, subcategories = [], emptyMessage }: ProductListingProps) {
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const page = Number(params.get('page') ?? 1) || 1
  const selectedBrands = useMemo(() => (params.get('brands') ?? '').split(',').filter(Boolean), [params])
  const min = params.get('min') ? Number(params.get('min')) : undefined
  const max = params.get('max') ? Number(params.get('max')) : undefined
  const inStock = params.get('stock') === '1'
  const sort = params.get('sort') ?? ''

  // SpaRenderer.cs embeds the unfiltered first page of category and brand listings, asked for exactly like this.
  const request = {
    category: scope.category,
    brand: scope.brand,
    q: scope.q,
    onSale: scope.onSale,
    featured: scope.featured,
    brands: selectedBrands.join(','),
    minPrice: min,
    maxPrice: max,
    inStock,
    sort,
    page,
    pageSize: 24,
    facets: true,
  }
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products', scope, selectedBrands, min, max, inStock, sort, page],
    queryFn: () => http.get<ProductList>('/products', request),
    initialData: () => embeddedResponse<ProductList>('/products', request),
    placeholderData: keepPreviousData,
  })

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next, { preventScrollReset: !('page' in changes) })
    if ('page' in changes) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleBrand = (slug: string) => {
    const next = selectedBrands.includes(slug) ? selectedBrands.filter((b) => b !== slug) : [...selectedBrands, slug]
    update({ brands: next.join(',') })
  }

  const facets = data?.facets
  const products = data?.products
  const hasFilters = selectedBrands.length > 0 || min !== undefined || max !== undefined || inStock
  const clearAll = () => update({ brands: null, min: null, max: null, stock: null })

  const filterPanel = (
    <FilterPanel
      facets={facets}
      showBrandFilter={showBrandFilter}
      selectedBrands={selectedBrands}
      onToggleBrand={toggleBrand}
      min={min}
      max={max}
      onPrice={(lo, hi) => update({ min: lo?.toString() ?? null, max: hi?.toString() ?? null })}
      inStock={inStock}
      onInStock={(v) => update({ stock: v ? '1' : null })}
      subcategories={subcategories}
    />
  )

  return (
    <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4">{filterPanel}</div>
      </aside>

      <div className="min-w-0">
        {showBrandFilter && facets && facets.brands.length > 1 && (
          <div className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
            {facets.brands.map((brand) => (
              <button
                key={brand.slug}
                onClick={() => toggleBrand(brand.slug)}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
                  selectedBrands.includes(brand.slug) ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-700',
                )}
              >
                {brand.name}
              </button>
            ))}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 sm:px-4">
          <p className="text-sm text-slate-500">
            {products ? (
              <>
                <span className="font-semibold text-slate-900">{products.totalCount}</span> product{products.totalCount === 1 ? '' : 's'}
              </>
            ) : (
              'Loading products...'
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="lg:hidden" leftIcon={<SlidersHorizontal className="size-4" />} onClick={() => setFiltersOpen(true)}>
              Filters
            </Button>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              <span className="hidden sm:inline">Sort by</span>
              <Select value={sort} onChange={(e) => update({ sort: e.target.value })} className="h-9 w-auto min-w-40 py-0">
                {sorts.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>

        {hasFilters && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {selectedBrands.map((slug) => (
              <FilterChip key={slug} onRemove={() => toggleBrand(slug)}>
                {facets?.brands.find((b) => b.slug === slug)?.name ?? slug}
              </FilterChip>
            ))}
            {(min !== undefined || max !== undefined) && (
              <FilterChip onRemove={() => update({ min: null, max: null })}>
                {money(min ?? facets?.minPrice ?? 0)} – {money(max ?? facets?.maxPrice ?? 0)}
              </FilterChip>
            )}
            {inStock && <FilterChip onRemove={() => update({ stock: null })}>In stock</FilterChip>}
            <button onClick={clearAll} className="text-sm font-semibold text-brand hover:underline">
              Clear all
            </button>
          </div>
        )}

        {isLoading ? (
          <div className={productGridClass.replace('xl:grid-cols-5', 'xl:grid-cols-4')}>
            {Array.from({ length: 8 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products && products.items.length > 0 ? (
          <>
            <div className={cn(productGridClass.replace('xl:grid-cols-5', 'xl:grid-cols-4'), 'transition-opacity', isFetching && 'opacity-60')}>
              {products.items.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index < 4} />
              ))}
            </div>
            <Pagination className="mt-8" page={products.page} totalPages={products.totalPages} onChange={(p) => update({ page: String(p) })} />
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white">
            <EmptyState
              icon={<PackageSearch className="size-6" />}
              title="No products found"
              description={emptyMessage ?? (hasFilters ? 'Try removing some filters to see more products.' : 'Please check back soon — new products are added regularly.')}
              action={hasFilters ? <Button onClick={clearAll}>Clear filters</Button> : undefined}
            />
          </div>
        )}
      </div>

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} side="left" title="Filters" widthClass="max-w-xs" footer={<Button className="w-full" onClick={() => setFiltersOpen(false)}>Show {products?.totalCount ?? ''} products</Button>}>
        <div className="space-y-4 p-4">{filterPanel}</div>
      </Drawer>
    </div>
  )
}

function FilterChip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pr-1.5 pl-3 text-sm font-medium text-brand">
      {children}
      <button onClick={onRemove} className="rounded-full p-0.5 hover:bg-brand-muted" aria-label="Remove filter">
        <X className="size-3.5" />
      </button>
    </span>
  )
}

interface FilterPanelProps {
  facets?: ProductFacets | null
  showBrandFilter: boolean
  selectedBrands: string[]
  onToggleBrand: (slug: string) => void
  min?: number
  max?: number
  onPrice: (min?: number, max?: number) => void
  inStock: boolean
  onInStock: (value: boolean) => void
  subcategories: CategoryCard[]
}

function FilterPanel({ facets, showBrandFilter, selectedBrands, onToggleBrand, min, max, onPrice, inStock, onInStock, subcategories }: FilterPanelProps) {
  const [brandQuery, setBrandQuery] = useState('')
  const brands = (facets?.brands ?? []).filter((b) => b.name.toLowerCase().includes(brandQuery.toLowerCase()))

  return (
    <>
      {subcategories.length > 0 && (
        <FilterBox title="Categories">
          <ul className="-mx-2 space-y-0.5">
            {subcategories.map((c) => (
              <li key={c.id}>
                <Link to={`/category/${c.slug}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand">
                  {c.imageUrl && <img src={img(c.imageUrl, 64)} alt="" className="size-7 rounded-md object-cover" />}
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </FilterBox>
      )}

      {facets && facets.maxPrice > facets.minPrice && (
        <FilterBox title="Price range">
          <PriceRange key={`${facets.minPrice}-${facets.maxPrice}-${min}-${max}`} floor={facets.minPrice} ceiling={facets.maxPrice} min={min} max={max} onApply={onPrice} />
        </FilterBox>
      )}

      <FilterBox title="Availability">
        <Checkbox label="In stock only" checked={inStock} onChange={(e) => onInStock(e.target.checked)} />
      </FilterBox>

      {showBrandFilter && facets && facets.brands.length > 0 && (
        <FilterBox title="Brands">
          {facets.brands.length > 8 && (
            <input
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              placeholder="Search brands"
              className="mb-3 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand"
            />
          )}
          <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
            {brands.map((brand) => (
              <Checkbox
                key={brand.slug}
                checked={selectedBrands.includes(brand.slug)}
                onChange={() => onToggleBrand(brand.slug)}
                label={
                  <span className="flex w-full items-center justify-between gap-2 font-normal">
                    {brand.name}
                    <span className="text-xs text-slate-400">{brand.count}</span>
                  </span>
                }
                className="[&>span:last-child]:flex-1"
              />
            ))}
          </div>
        </FilterBox>
      )}
    </>
  )
}

function FilterBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  )
}

function PriceRange({ floor, ceiling, min, max, onApply }: { floor: number; ceiling: number; min?: number; max?: number; onApply: (min?: number, max?: number) => void }) {
  const [lo, setLo] = useState(min ?? floor)
  const [hi, setHi] = useState(max ?? ceiling)
  useEffect(() => {
    setLo(min ?? floor)
    setHi(max ?? ceiling)
  }, [min, max, floor, ceiling])

  const step = Math.max(1, Math.round((ceiling - floor) / 200))
  const pct = (v: number) => ((v - floor) / (ceiling - floor)) * 100
  const apply = () => onApply(lo > floor ? lo : undefined, hi < ceiling ? hi : undefined)
  const thumb =
    'pointer-events-none absolute inset-x-0 top-1/2 h-1.5 w-full -translate-y-1/2 appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow'

  return (
    <div>
      <div className="relative mx-1 h-5">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input type="range" min={floor} max={ceiling} step={step} value={lo} onChange={(e) => setLo(Math.min(Number(e.target.value), hi - step))} onMouseUp={apply} onTouchEnd={apply} className={thumb} aria-label="Minimum price" />
        <input type="range" min={floor} max={ceiling} step={step} value={hi} onChange={(e) => setHi(Math.max(Number(e.target.value), lo + step))} onMouseUp={apply} onTouchEnd={apply} className={thumb} aria-label="Maximum price" />
      </div>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
      >
        <input type="number" value={lo} min={floor} max={hi} onChange={(e) => setLo(Number(e.target.value))} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-brand" aria-label="Minimum price" />
        <span className="text-slate-400">–</span>
        <input type="number" value={hi} min={lo} max={ceiling} onChange={(e) => setHi(Number(e.target.value))} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-brand" aria-label="Maximum price" />
        <Button type="submit" size="sm" variant="soft">
          Go
        </Button>
      </form>
    </div>
  )
}
