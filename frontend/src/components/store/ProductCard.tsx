import { ArrowRight, ShoppingBag } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Skeleton } from '@/components/ui/Feedback'
import { Price, Stars } from '@/components/ui/Misc'
import { useAddToCart } from '@/hooks/useAddToCart'
import type { ProductCard as Product } from '@/lib/types'
import { cn, discountPercent, img } from '@/lib/utils'

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const addToCart = useAddToCart()
  const navigate = useNavigate()
  const off = product.hidePrice ? 0 : discountPercent(product.price, product.compareAtPrice)
  const soldOut = !product.inStock
  const canQuickAdd = !!product.quickAddVariantId && !soldOut && !product.hidePrice
  const url = `/product/${product.slug}`

  const onAdd = () => {
    if (!canQuickAdd) return navigate(url)
    addToCart({
      variantId: product.quickAddVariantId!,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.imageUrl,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
    })
  }

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-2xl bg-white p-2.5 ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_45px_-22px_var(--color-brand-ring)] hover:ring-brand-muted sm:p-3',
        className,
      )}
    >
      <Link to={url} className="relative block aspect-square overflow-hidden rounded-xl bg-linear-to-br from-slate-50 via-white to-brand-softer">
        {product.imageUrl && (
          <img
            src={img(product.imageUrl, 400)}
            alt={product.name}
            loading="lazy"
            className={cn('size-full object-contain p-3 transition duration-500 group-hover:scale-[1.07]', soldOut && 'opacity-60 grayscale-[30%]')}
          />
        )}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {off > 0 && <span className="rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm shadow-rose-500/30">-{off}%</span>}
          {product.isPreOrder && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm shadow-amber-500/30">Pre-order</span>}
        </div>
        {product.badge && !product.isPreOrder && (
          <span className="absolute top-2 right-2 max-w-[60%] truncate rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 backdrop-blur">
            {product.badge}
          </span>
        )}
        {soldOut && (
          <span className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white">Sold out</span>
        )}
      </Link>

      <div className="flex flex-1 flex-col px-0.5 pt-3">
        {product.brandName && <p className="truncate text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{product.brandName}</p>}
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm leading-5 font-medium text-slate-800">
          <Link to={url} className="transition hover:text-brand-deep">
            {product.name}
          </Link>
        </h3>
        {product.ratingCount > 0 && (
          <div className="mt-1 flex items-center gap-1">
            <Stars value={product.ratingAverage} size="xs" />
            <span className="text-[11px] text-slate-500">({product.ratingCount})</span>
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Price price={product.price} compareAtPrice={product.compareAtPrice} hidePrice={product.hidePrice} size="md" className="flex-col gap-0" />
          <button
            onClick={onAdd}
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full transition duration-300',
              canQuickAdd
                ? 'bg-brand-soft text-brand-deep group-hover:bg-brand group-hover:text-white group-hover:shadow-md group-hover:shadow-brand-ring hover:bg-brand-hover'
                : 'bg-slate-100 text-slate-500 group-hover:bg-slate-900 group-hover:text-white',
            )}
            aria-label={canQuickAdd ? `Add ${product.name} to cart` : `View ${product.name}`}
            title={canQuickAdd ? 'Add to cart' : 'Choose options'}
          >
            {canQuickAdd ? <ShoppingBag className="size-4" /> : <ArrowRight className="size-4" />}
          </button>
        </div>
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200/70">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="mt-3 h-3 w-1/3" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-2/3" />
      <Skeleton className="mt-3 h-5 w-1/2" />
    </div>
  )
}

export const productGridClass = 'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
