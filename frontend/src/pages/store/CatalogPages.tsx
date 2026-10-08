import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { BrandTiles } from '@/components/store/HomeBlocks'
import { ProductListing } from '@/components/store/ProductListing'
import { Breadcrumbs, categoryCrumbs, RichContent } from '@/components/store/Sections'
import { DynamicIcon } from '@/components/ui/Icons'
import { PageLoader, Skeleton } from '@/components/ui/Feedback'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { ApiError, embeddedResponse, http } from '@/lib/api'
import type { Brand, CategoryGroup, CategoryPage as Category } from '@/lib/types'
import { bannerFallbackWidth, bannerWidths, img, srcSet, wideSizes } from '@/lib/utils'
import { NotFoundPage } from './NotFoundPage'

function PageTitle({ title, description, count }: { title: string; description?: string | null; count?: number }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {title}
        {count !== undefined && <span className="ml-2 text-base font-medium text-slate-400">({count})</span>}
      </h1>
      {description && <p className="mt-1.5 max-w-3xl text-sm text-slate-500 sm:text-base">{description}</p>}
    </div>
  )
}

/** Placeholder for a page heading whose data is still loading; the product listing below loads at the same time. */
function HeadingSkeleton() {
  return (
    <div className="mb-6">
      <Skeleton className="mb-4 h-4 w-40" />
      <Skeleton className="h-8 w-60" />
    </div>
  )
}

export function CategoryPage() {
  const { slug = '' } = useParams()
  const { data: category, error } = useQuery({
    queryKey: ['category', slug],
    queryFn: () => http.get<Category>(`/categories/${slug}`),
    initialData: () => embeddedResponse<Category>(`/categories/${slug}`),
  })
  useDocumentMeta({ title: category?.metaTitle ?? category?.name, description: category?.metaDescription ?? category?.description, image: category?.bannerUrl ?? category?.imageUrl })

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage title="Category not found" />

  return (
    <div className="container-x pt-4 sm:pt-6">
      {category ? (
        <>
          {category.bannerUrl && (
            <img
              src={img(category.bannerUrl, bannerFallbackWidth)}
              srcSet={srcSet(category.bannerUrl, bannerWidths)}
              sizes={wideSizes}
              alt={category.name}
              className="mb-5 aspect-[4/1] w-full rounded-3xl object-cover"
              fetchPriority="high"
            />
          )}
          <Breadcrumbs items={categoryCrumbs(category.breadcrumbs.slice(0, -1))} current={category.name} className="mb-4" />
          <PageTitle title={category.name} description={category.description} />
          {category.children.length > 0 && (
            <div className="scrollbar-none -mx-4 mb-6 flex gap-3 overflow-x-auto px-4 lg:hidden">
              {category.children.map((child) => (
                <Link key={child.id} to={`/category/${child.slug}`} className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pr-4 pl-1.5 text-sm font-medium text-slate-700">
                  {child.imageUrl && <img src={img(child.imageUrl, 64)} alt="" className="size-7 rounded-full object-cover" />}
                  {child.name}
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <HeadingSkeleton />
      )}
      <ProductListing scope={{ category: slug }} subcategories={category?.children} />
      {category?.seoContent && (
        <section className="mt-12 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-10">
          <RichContent html={category.seoContent} />
        </section>
      )}
    </div>
  )
}

export function BrandPage() {
  const { slug = '' } = useParams()
  const { data: brand, error } = useQuery({
    queryKey: ['brand', slug],
    queryFn: () => http.get<Brand>(`/brands/${slug}`),
    initialData: () => embeddedResponse<Brand>(`/brands/${slug}`),
  })
  useDocumentMeta({ title: brand?.metaTitle ?? (brand ? `${brand.name} products` : undefined), description: brand?.metaDescription ?? brand?.description, image: brand?.logoUrl })

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage title="Brand not found" />

  return (
    <div className="container-x pt-4 sm:pt-6">
      {brand ? (
        <>
          <Breadcrumbs items={[{ name: 'Brands', to: '/brands' }]} current={brand.name} className="mb-4" />
          <div className="mb-6 flex items-center gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
            {brand.logoUrl && (
              <div className="flex h-16 w-32 shrink-0 items-center justify-center rounded-2xl bg-slate-50 p-3">
                <img src={img(brand.logoUrl, 240)} alt={brand.name} className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{brand.name}</h1>
              {brand.description && <p className="mt-1 text-sm text-slate-500">{brand.description}</p>}
            </div>
          </div>
        </>
      ) : (
        <HeadingSkeleton />
      )}
      <ProductListing scope={{ brand: slug }} showBrandFilter={false} />
    </div>
  )
}

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const featured = params.get('featured') === 'true'
  const title = q ? `Results for “${q}”` : featured ? 'Featured products' : 'All products'
  useDocumentMeta({ title: q ? `Search: ${q}` : title, noIndex: !!q })
  return (
    <div className="container-x pt-4 sm:pt-6">
      <Breadcrumbs items={[]} current="Search" className="mb-4" />
      <PageTitle title={title} />
      <ProductListing scope={{ q: q || undefined, featured: featured || undefined }} emptyMessage={q ? `We couldn't find anything for “${q}”. Try a different keyword.` : undefined} />
    </div>
  )
}

export function OffersPage() {
  useDocumentMeta({ title: 'Offers & deals', description: 'Grab the latest discounts on gadgets, mobiles and accessories.' })
  return (
    <div className="container-x pt-4 sm:pt-6">
      <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-rose-600 via-brand to-brand-deep p-6 text-white sm:p-10">
        <p className="text-sm font-semibold tracking-widest uppercase opacity-80">Limited time</p>
        <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">Hot deals & offers</h1>
        <p className="mt-2 max-w-xl text-sm opacity-90 sm:text-base">Discounted prices on authentic gadgets. Stock is limited, grab yours before they're gone.</p>
      </div>
      <ProductListing scope={{ onSale: true }} emptyMessage="There are no active offers right now. Check back soon!" />
    </div>
  )
}

export function CategoriesPage() {
  const { data: groups, isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => http.get<CategoryGroup[]>('/categories'), staleTime: 5 * 60_000 })
  useDocumentMeta({ title: 'All categories' })
  return (
    <div className="container-x pt-4 sm:pt-6">
      <Breadcrumbs items={[]} current="All categories" className="mb-4" />
      <PageTitle title="All categories" description="Browse our full range of gadgets and accessories." />
      {isLoading ? (
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {groups?.map((group) => (
            <section key={group.id} className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <DynamicIcon name={group.icon} className="size-5.5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{group.name}</h2>
                    <p className="text-xs text-slate-500">{group.children.length} collections</p>
                  </div>
                </div>
                <Link to={`/category/${group.slug}`} className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  View all <ChevronRight className="size-4" />
                </Link>
              </div>
              {group.children.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
                  {group.children.map((child) => (
                    <Link key={child.id} to={`/category/${child.slug}`} className="group text-center">
                      <span className="block aspect-square overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200/80 transition group-hover:ring-brand-muted">
                        {child.imageUrl && <img src={img(child.imageUrl, 240)} alt="" className="size-full object-cover transition group-hover:scale-105" loading="lazy" />}
                      </span>
                      <span className="mt-2 block text-xs font-medium text-slate-700 group-hover:text-brand sm:text-sm">{child.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export function BrandsPage() {
  const { data: brands, isLoading } = useQuery({ queryKey: ['brands'], queryFn: () => http.get<Brand[]>('/brands'), staleTime: 5 * 60_000 })
  useDocumentMeta({ title: 'All brands' })
  return (
    <div className="container-x pt-4 sm:pt-6">
      <Breadcrumbs items={[]} current="All brands" className="mb-4" />
      <PageTitle title="All brands" description="Shop authentic products from the world's leading tech brands." count={brands?.length} />
      {isLoading ? <PageLoader /> : <BrandTiles brands={brands ?? []} className="lg:grid-cols-6" />}
    </div>
  )
}
