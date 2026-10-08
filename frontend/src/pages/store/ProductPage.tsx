import { useQuery } from '@tanstack/react-query'
import { Banknote, Check, Phone, RotateCcw, ShieldCheck, ShoppingBag, Truck, Zap } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ProductReviews } from '@/components/store/ProductReviews'
import { Breadcrumbs, categoryCrumbs, ProductRail, RichContent, SectionHeader } from '@/components/store/Sections'
import { Button } from '@/components/ui/Button'
import { Badge, PageLoader } from '@/components/ui/Feedback'
import { MessengerIcon, WhatsAppIcon } from '@/components/ui/Icons'
import { Price, QuantityStepper, Stars } from '@/components/ui/Misc'
import { useAddToCart } from '@/hooks/useAddToCart'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useSettings } from '@/hooks/useStore'
import { track } from '@/lib/analytics'
import { ApiError, http } from '@/lib/api'
import { money } from '@/lib/format'
import { galleryImageWidth, initialImageIndex, productQuery, shownCardImage } from '@/lib/prefetch'
import type { ProductCard, ProductDetail, Variant } from '@/lib/types'
import { cn, img, isCssColor, stripHtml } from '@/lib/utils'
import { useRecentlyViewed } from '@/stores/recent'
import { NotFoundPage } from './NotFoundPage'

const optionValue = (variant: Variant, index: number) => [variant.option1, variant.option2, variant.option3][index] ?? null

export default function ProductPage() {
  const { slug = '' } = useParams()
  const { data: product, error, isLoading } = useQuery(productQuery(slug))

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage title="Product not found" description="This product may have been removed or is no longer available." />
  if (isLoading || !product) return <PageLoader />
  return <ProductView key={product.id} product={product} />
}

function ProductView({ product }: { product: ProductDetail }) {
  const settings = useSettings()
  const navigate = useNavigate()
  const addToCart = useAddToCart()
  const pushRecent = useRecentlyViewed((s) => s.push)
  const recent = useRecentlyViewed((s) => s.products)
  const hasOptions = product.options.length > 0

  const initial = product.variants.find((v) => v.inStock) ?? product.variants[0]
  const [selected, setSelected] = useState<(string | null)[]>(() => [0, 1, 2].map((i) => (initial ? optionValue(initial, i) : null)))
  const [quantity, setQuantity] = useState(1)

  const variant = useMemo(
    () => product.variants.find((v) => [0, 1, 2].every((i) => i >= product.options.length || optionValue(v, i) === selected[i])) ?? null,
    [product, selected],
  )
  // Start on the selected variant's image so the page doesn't load the first image and then switch.
  const [activeImage, setActiveImage] = useState(() => initialImageIndex(product))

  useEffect(() => {
    if (variant?.imageUrl) {
      const index = product.images.findIndex((i) => i.url === variant.imageUrl)
      if (index >= 0) setActiveImage(index)
    }
  }, [variant, product.images])

  useEffect(() => {
    setQuantity((q) => Math.min(q, variant?.availableQuantity ?? 99) || 1)
  }, [variant])

  const card: ProductCard = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: product.images[0]?.url,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    hidePrice: product.hidePrice,
    inStock: product.inStock,
    isPreOrder: product.isPreOrder,
    badge: product.badge,
    ratingAverage: product.reviews.average,
    ratingCount: product.reviews.count,
    brandName: product.brand?.name,
    quickAddVariantId: product.variants.length === 1 ? product.variants[0]!.id : null,
  }

  useEffect(() => {
    pushRecent(card)
    track('ViewContent', { value: product.price, contentName: product.name, contentIds: [product.id] })
    http.post(`/products/${product.slug}/view`).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  useDocumentMeta({
    title: product.metaTitle ?? product.name,
    description: product.metaDescription ?? (stripHtml(product.shortDescription ?? product.description).slice(0, 160) || null),
    image: product.images[0]?.url,
  })

  const { data: related = [] } = useQuery({
    queryKey: ['related', product.slug],
    queryFn: () => http.get<ProductCard[]>(`/products/${product.slug}/related`),
  })

  const price = variant?.price ?? product.price
  const compareAt = variant ? variant.compareAtPrice : product.compareAtPrice
  const available = !product.hidePrice && !!variant && (variant.inStock || product.isPreOrder)
  const lowStock = variant?.availableQuantity != null && variant.availableQuantity > 0 && variant.availableQuantity <= 5

  const selectValue = (index: number, value: string) => {
    const next = [...selected]
    next[index] = value
    const exact = product.variants.find((v) => [0, 1, 2].every((i) => i >= product.options.length || optionValue(v, i) === next[i]))
    if (exact) return setSelected(next)
    // Pick the closest real variant that has the chosen value.
    const fallback =
      product.variants.find((v) => optionValue(v, index) === value && v.inStock) ?? product.variants.find((v) => optionValue(v, index) === value)
    if (fallback) setSelected([0, 1, 2].map((i) => optionValue(fallback, i)))
  }

  const valueState = (index: number, value: string) => {
    const candidate = [...selected]
    candidate[index] = value
    const match = product.variants.find((v) => [0, 1, 2].every((i) => i >= product.options.length || optionValue(v, i) === candidate[i]))
    return { exists: !!match, inStock: !!match && (match.inStock || product.isPreOrder) }
  }

  const cartItem = () => ({
    variantId: variant!.id,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    variantTitle: variant!.title,
    image: variant!.imageUrl ?? product.images[0]?.url,
    price: variant!.price,
    compareAtPrice: variant!.compareAtPrice,
    maxQuantity: variant!.availableQuantity,
  })

  const onAdd = () => available && addToCart(cartItem(), quantity)
  const onBuyNow = () => {
    if (!available) return
    addToCart(cartItem(), quantity, { openDrawer: false })
    navigate('/checkout')
  }

  const productUrl = window.location.origin + `/product/${product.slug}`
  const orderMessage = `Hello, I want to order this product:\n${product.name}${variant?.title ? ` (${variant.title})` : ''}\n${productUrl}\nPrice: ${product.hidePrice ? 'Please share the price' : money(price)}\nQuantity: ${quantity}`
  const whatsapp = settings?.contact.whatsAppNumber
  const messenger = settings?.contact.messengerUsername
  const phone = settings?.contact.phone

  const sections = [
    { id: 'description', label: 'Description', show: !!product.description || !!product.videoUrl },
    { id: 'specifications', label: 'Specifications', show: product.specifications.length > 0 },
    { id: 'faq', label: 'FAQ', show: product.faqs.length > 0 },
    { id: 'reviews', label: `Reviews (${product.reviews.count})`, show: true },
  ].filter((s) => s.show)

  return (
    <div className="pt-4 sm:pt-6">
      <div className="container-x">
        <Breadcrumbs items={categoryCrumbs(product.breadcrumbs)} current={product.name} className="mb-4" />

        <div className="grid gap-6 rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 lg:p-8">
          <Gallery images={product.images} active={activeImage} onChange={setActiveImage} name={product.name} discount={compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {product.brand && (
                <Link to={`/brand/${product.brand.slug}`} className="text-sm font-semibold text-brand hover:underline">
                  {product.brand.name}
                </Link>
              )}
              {product.badge && <Badge tone="green">{product.badge}</Badge>}
              {product.isPreOrder && <Badge tone="amber">Pre-order</Badge>}
            </div>
            <h1 className="mt-2 text-2xl leading-tight font-bold tracking-tight text-slate-900 sm:text-3xl">{product.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              {product.reviews.count > 0 ? (
                <a href="#reviews" className="flex items-center gap-1.5 hover:text-brand">
                  <Stars value={product.reviews.average} />
                  {product.reviews.average.toFixed(1)} ({product.reviews.count} review{product.reviews.count === 1 ? '' : 's'})
                </a>
              ) : (
                <a href="#reviews" className="hover:text-brand">
                  No reviews yet
                </a>
              )}
              {(variant?.sku ?? product.sku) && <span>SKU: {variant?.sku ?? product.sku}</span>}
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <Price price={price} compareAtPrice={compareAt} hidePrice={product.hidePrice} size="xl" showSaving />
              <p className="mt-2 text-sm">
                {product.hidePrice ? (
                  <span className="text-slate-600">Contact us for the latest price and availability.</span>
                ) : !variant ? (
                  <span className="font-medium text-rose-600">This combination is not available.</span>
                ) : product.isPreOrder && !variant.inStock ? (
                  <span className="font-medium text-amber-600">Available for pre-order</span>
                ) : !variant.inStock ? (
                  <span className="font-medium text-rose-600">Out of stock</span>
                ) : lowStock ? (
                  <span className="font-medium text-amber-600">Hurry — only {variant.availableQuantity} left in stock</span>
                ) : (
                  <span className="flex items-center gap-1 font-medium text-emerald-600">
                    <Check className="size-4" /> In stock
                  </span>
                )}
              </p>
            </div>

            {product.shortDescription && (
              <div className="mt-5">
                <RichContent html={product.shortDescription} className="prose-sm prose-li:marker:text-brand" />
                {sections.some((s) => s.id === 'description') && (
                  <a href="#description" className="mt-1 inline-block text-sm font-semibold text-brand hover:underline">
                    View more info →
                  </a>
                )}
              </div>
            )}

            {hasOptions && (
              <div className="mt-5 space-y-4">
                {product.options.map((option, index) => (
                  <div key={option.name}>
                    <p className="mb-2 text-sm font-semibold text-slate-900">
                      {option.name}: <span className="font-normal text-slate-600">{selected[index]}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {option.values.map((value) => {
                        const state = valueState(index, value)
                        const isSelected = selected[index] === value
                        const swatch = isCssColor(value)
                        return (
                          <button
                            key={value}
                            onClick={() => selectValue(index, value)}
                            className={cn(
                              'relative flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition',
                              isSelected ? 'border-brand bg-brand-softer text-brand ring-2 ring-brand-ring' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400',
                              !state.inStock && 'text-slate-400',
                              !state.exists && 'border-dashed',
                            )}
                            title={!state.exists ? 'Not available with your other choices' : !state.inStock ? 'Out of stock' : undefined}
                          >
                            {swatch && <span className="size-4 rounded-full ring-1 ring-slate-300" style={{ background: value.replace(/\s+/g, '').toLowerCase() }} />}
                            <span className={cn(!state.inStock && 'line-through decoration-slate-400')}>{value}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!product.hidePrice ? (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <QuantityStepper value={quantity} onChange={setQuantity} max={variant?.availableQuantity} />
                <Button size="lg" variant="outline" className="min-w-36 flex-1 border-brand text-brand hover:bg-brand-softer sm:flex-none" disabled={!available} onClick={onAdd} leftIcon={<ShoppingBag className="size-5" />}>
                  Add to cart
                </Button>
                <Button size="lg" className="min-w-36 flex-1 sm:flex-none" disabled={!available} onClick={onBuyNow} leftIcon={<Zap className="size-5" />}>
                  {product.isPreOrder && !variant?.inStock ? 'Pre-order now' : 'Buy now'}
                </Button>
              </div>
            ) : (
              phone && (
                <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="mt-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-white hover:bg-brand-hover">
                  <Phone className="size-5" /> Call for price: {phone}
                </a>
              )
            )}

            {(whatsapp || messenger) && settings?.checkout.enableWhatsAppOrdering !== false && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {whatsapp && (
                  <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(orderMessage)}`} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25d366] text-sm font-semibold text-white hover:brightness-95">
                    <WhatsAppIcon className="size-5" /> Order on WhatsApp
                  </a>
                )}
                {messenger && (
                  <a href={`https://m.me/${messenger}?text=${encodeURIComponent(orderMessage)}`} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0866ff] text-sm font-semibold text-white hover:brightness-95">
                    <MessengerIcon className="size-5" /> Messenger
                  </a>
                )}
              </div>
            )}

            <ul className="mt-6 grid gap-2.5 rounded-2xl border border-slate-200/80 p-4 text-sm text-slate-600 sm:grid-cols-2">
              <Perk icon={<Truck className="size-4.5" />}>Fast delivery across Bangladesh</Perk>
              <Perk icon={<Banknote className="size-4.5" />}>Cash on delivery available</Perk>
              <Perk icon={<ShieldCheck className="size-4.5" />}>{product.warrantyInfo ?? '100% authentic product'}</Perk>
              <Perk icon={<RotateCcw className="size-4.5" />}>
                <Link to="/page/return-policy" className="hover:text-brand hover:underline">
                  Easy return policy
                </Link>
              </Perk>
            </ul>
          </div>
        </div>

        <div className="sticky top-16 z-20 -mx-4 mt-6 overflow-x-auto border-b border-slate-200 bg-slate-50/95 px-4 backdrop-blur scrollbar-none sm:top-[72px] sm:mx-0 sm:px-0">
          <nav className="flex gap-6">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="border-b-2 border-transparent py-3 text-sm font-semibold whitespace-nowrap text-slate-600 hover:border-brand hover:text-brand">
                {s.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-6 space-y-6">
          {sections.some((s) => s.id === 'description') && (
            <ContentCard id="description" title="Description">
              {product.videoUrl && <VideoEmbed url={product.videoUrl} />}
              <RichContent html={product.description} />
            </ContentCard>
          )}
          {product.specifications.length > 0 && (
            <ContentCard id="specifications" title="Specifications">
              <dl className="overflow-hidden rounded-2xl border border-slate-200">
                {product.specifications.map((spec, i) => (
                  <div key={i} className="grid grid-cols-[minmax(110px,32%)_1fr] text-sm even:bg-slate-50">
                    <dt className="border-r border-slate-200 px-4 py-3 font-medium text-slate-600">{spec.name}</dt>
                    <dd className="px-4 py-3 text-slate-900">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </ContentCard>
          )}
          {product.faqs.length > 0 && (
            <ContentCard id="faq" title="Frequently asked questions">
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {product.faqs.map((faq, i) => (
                  <details key={i} className="group p-4" open={i === 0}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-900">
                      {faq.question}
                      <span className="text-lg leading-none text-slate-400 transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </ContentCard>
          )}
          <ContentCard id="reviews" title="Ratings & reviews">
            <ProductReviews productId={product.id} summary={product.reviews} />
          </ContentCard>
        </div>

        {related.length > 0 && (
          <section className="mt-12">
            <SectionHeader title="You might also like" viewAllUrl={`/category/${product.category.slug}`} />
            <ProductRail products={related} />
          </section>
        )}
        {recent.filter((p) => p.id !== product.id).length > 0 && (
          <section className="mt-12">
            <SectionHeader title="Recently viewed" />
            <ProductRail products={recent.filter((p) => p.id !== product.id)} />
          </section>
        )}
      </div>

      {!product.hidePrice && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-lg leading-none font-bold text-slate-900">{money(price)}</p>
              {variant?.title && <p className="mt-1 truncate text-xs text-slate-500">{variant.title}</p>}
            </div>
            <Button variant="outline" className="border-brand text-brand" disabled={!available} onClick={onAdd} aria-label="Add to cart">
              <ShoppingBag className="size-5" />
            </Button>
            <Button disabled={!available} onClick={onBuyNow}>
              Buy now
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Gallery({ images, active, onChange, name, discount }: { images: { url: string; altText?: string | null }[]; active: number; onChange: (i: number) => void; name: string; discount: number }) {
  const current = images[active] ?? images[0]
  return (
    <div className="flex flex-col-reverse gap-3 lg:sticky lg:top-24 lg:flex-row lg:self-start">
      {images.length > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto lg:max-h-[520px] lg:flex-col lg:overflow-y-auto">
          {images.map((image, i) => (
            <button
              key={image.url + i}
              onClick={() => onChange(i)}
              className={cn('flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-slate-50 transition sm:size-20', i === active ? 'border-brand' : 'border-transparent hover:border-slate-300')}
              aria-label={`Show image ${i + 1}`}
            >
              <img src={img(image.url, 160)} alt="" className="size-full object-contain p-1.5" />
            </button>
          ))}
        </div>
      )}
      <div className="relative flex aspect-square flex-1 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/80">
        {current ? <GalleryImage url={current.url} alt={current.altText ?? name} /> : <ShoppingBag className="size-16 text-slate-300" />}
        {discount > 0 && <span className="absolute top-4 left-4 rounded-full bg-linear-to-r from-rose-500 to-orange-500 px-3 py-1 text-sm font-bold text-white shadow-md shadow-rose-500/30">-{discount}%</span>}
      </div>
    </div>
  )
}

/**
 * The large product photo. When the shopper arrived from a product card, the card's smaller copy is already
 * downloaded, so it is shown underneath until the large one has loaded instead of an empty box.
 */
function GalleryImage({ url, alt }: { url: string; alt: string }) {
  const src = img(url, galleryImageWidth)
  const [loaded, setLoaded] = useState<string>()
  const placeholder = loaded === src ? undefined : shownCardImage(url)
  return (
    <>
      {placeholder && <img src={placeholder} alt="" aria-hidden className="absolute inset-0 size-full object-contain p-6" />}
      <img src={src} alt={alt} fetchPriority="high" onLoad={() => setLoaded(src)} className="relative size-full object-contain p-6" />
    </>
  )
}

function Perk({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="text-brand">{icon}</span>
      <span>{children}</span>
    </li>
  )
}

function ContentCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-8">
      <h2 className="mb-5 text-lg font-bold text-slate-900 sm:text-xl">{title}</h2>
      {children}
    </section>
  )
}

function VideoEmbed({ url }: { url: string }) {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)
  if (!match) return null
  return (
    <div className="mb-6 aspect-video overflow-hidden rounded-2xl bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${match[1]}`}
        title="Product video"
        className="size-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  )
}
