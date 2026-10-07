import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { ArrowRight, ChevronLeft, ChevronRight, Quote } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { DynamicIcon } from '@/components/ui/Icons'
import { Stars } from '@/components/ui/Misc'
import { formatDate } from '@/lib/format'
import type { Banner, BlogCard, Brand, CategoryCard, ReviewCard } from '@/lib/types'
import { cn, img, initials } from '@/lib/utils'

function BannerLink({ banner, className, children }: { banner: Banner; className?: string; children: ReactNode }) {
  return banner.linkUrl ? (
    <Link to={banner.linkUrl} className={className} aria-label={banner.title ?? 'Promotion'}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  )
}

export function HeroSlider({ slides }: { slides: Banner[] }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5500, stopOnInteraction: false, stopOnMouseEnter: true })])
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!embla) return
    const onSelect = () => setSelected(embla.selectedScrollSnap())
    embla.on('select', onSelect)
    onSelect()
    return () => {
      embla.off('select', onSelect)
    }
  }, [embla])

  const prev = useCallback(() => embla?.scrollPrev(), [embla])
  const next = useCallback(() => embla?.scrollNext(), [embla])

  if (slides.length === 0) return null
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-slate-200 shadow-[0_28px_60px_-30px_var(--color-brand-ring)] sm:rounded-3xl">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {slides.map((slide, index) => (
            <BannerLink key={slide.id} banner={slide} className="relative block min-w-0 flex-[0_0_100%]">
              <picture>
                {slide.mobileImageUrl && <source media="(max-width: 640px)" srcSet={img(slide.mobileImageUrl, 800)} />}
                <img
                  src={img(slide.imageUrl, 1280)}
                  alt={slide.title ?? ''}
                  className="aspect-[2.13/1] w-full object-cover"
                  loading={index === 0 ? 'eager' : 'lazy'}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                />
              </picture>
            </BannerLink>
          ))}
        </div>
      </div>
      {slides.length > 1 && (
        <>
          <SlideArrow side="left" onClick={prev} />
          <SlideArrow side="right" onClick={next} />
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-950/20 px-2.5 py-1.5 backdrop-blur-sm sm:bottom-4">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => embla?.scrollTo(i)}
                className={cn('h-1.5 rounded-full transition-all duration-300', i === selected ? 'w-6 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/90')}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === selected}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SlideArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/75 text-slate-800 opacity-0 shadow-lg ring-1 ring-white/60 backdrop-blur transition duration-300 group-hover:translate-x-0 group-hover:opacity-100 hover:bg-white focus-visible:translate-x-0 focus-visible:opacity-100 sm:flex',
        side === 'left' ? 'left-4 -translate-x-2' : 'right-4 translate-x-2',
      )}
      aria-label={side === 'left' ? 'Previous slide' : 'Next slide'}
    >
      <Icon className="size-5" />
    </button>
  )
}

export function SideBanners({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1 lg:grid-rows-2">
      {banners.map((banner) => (
        <BannerLink
          key={banner.id}
          banner={banner}
          className="group block overflow-hidden rounded-2xl bg-slate-200 shadow-[0_18px_40px_-26px_var(--color-brand-ring)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_var(--color-brand-ring)] sm:rounded-3xl"
        >
          <img src={img(banner.imageUrl, 640)} alt={banner.title ?? ''} className="aspect-[2.2/1] size-full object-cover transition duration-500 group-hover:scale-[1.04] lg:aspect-auto" loading="eager" />
        </BannerLink>
      ))}
    </div>
  )
}

export function FeatureStrip({ features }: { features: { icon: string; title: string; subtitle?: string | null }[] }) {
  if (features.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {/* Phones stack the icon above the text so titles and subtitles get the full card width. */}
      {features.map((feature) => (
        <div
          key={feature.title}
          className="group flex flex-col items-start gap-2.5 rounded-2xl bg-white/85 p-3.5 shadow-sm ring-1 ring-slate-200/70 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-glow sm:flex-row sm:items-center sm:gap-3 sm:p-5"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand-light to-brand text-white shadow-md shadow-brand-ring transition duration-300 group-hover:scale-105 sm:size-12 sm:rounded-xl">
            <DynamicIcon name={feature.icon} className="size-4.5 sm:size-5.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-snug font-semibold text-slate-900">{feature.title}</p>
            {feature.subtitle && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 sm:line-clamp-1">{feature.subtitle}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Round category bubbles; on phones they scroll sideways in two rows. */
export function CategoryTiles({ categories }: { categories: CategoryCard[] }) {
  return (
    <div className="scrollbar-none -mx-4 grid auto-cols-[21%] grid-flow-col grid-rows-2 gap-x-2 gap-y-4 overflow-x-auto px-4 pt-1 pb-2 xs:auto-cols-[19%] sm:mx-0 sm:grid-flow-row sm:grid-cols-6 sm:grid-rows-none sm:gap-x-4 sm:gap-y-7 sm:overflow-visible sm:p-0 md:grid-cols-7 lg:grid-cols-8">
      {categories.map((category) => (
        <Link key={category.id} to={`/category/${category.slug}`} className="group flex flex-col items-center gap-2.5 text-center">
          <span className="block aspect-square w-full max-w-28 rounded-full bg-white p-1.5 shadow-sm ring-1 ring-slate-200/80 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-brand-glow group-hover:ring-2 group-hover:ring-brand-light">
            <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-brand-softer">
              {category.imageUrl ? (
                <img src={img(category.imageUrl, 240)} alt="" className="size-full object-cover transition duration-500 group-hover:scale-110" loading="lazy" />
              ) : (
                <DynamicIcon name={category.icon} className="size-8 text-brand" />
              )}
            </span>
          </span>
          <span className="line-clamp-2 text-xs leading-tight font-medium text-slate-700 transition group-hover:text-brand-deep sm:text-sm">{category.name}</span>
        </Link>
      ))}
    </div>
  )
}

export function BrandTiles({ brands, className }: { brands: Brand[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7', className)}>
      {brands.map((brand) => (
        <BrandLogo key={brand.id} brand={brand} className="aspect-[2/1]" />
      ))}
    </div>
  )
}

function BrandLogo({ brand, className, hidden }: { brand: Brand; className?: string; hidden?: boolean }) {
  return (
    <Link
      to={`/brand/${brand.slug}`}
      title={brand.name}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={cn(
        'group/brand flex items-center justify-center rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-glow hover:ring-brand-muted',
        className,
      )}
    >
      {brand.logoUrl ? (
        <img src={img(brand.logoUrl, 240)} alt={brand.name} className="max-h-full max-w-full object-contain opacity-70 grayscale transition duration-300 group-hover/brand:opacity-100 group-hover/brand:grayscale-0" loading="lazy" />
      ) : (
        <span className="text-base font-bold text-slate-700">{brand.name}</span>
      )}
    </Link>
  )
}

/** Endless, slowly scrolling strip of brand logos that pauses on hover. Shows a plain wrap for reduced motion. */
export function BrandMarquee({ brands }: { brands: Brand[] }) {
  if (brands.length === 0) return null
  return (
    <div className="group/marquee -mx-4 overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)] sm:mx-0 motion-reduce:[mask-image:none]">
      <div
        className="flex w-max animate-marquee group-hover/marquee:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-3"
        style={{ animationDuration: `${Math.max(brands.length * 3.5, 25)}s` }}
      >
        {[0, 1].map((copy) =>
          brands.map((brand) => (
            <BrandLogo key={`${copy}-${brand.id}`} brand={brand} hidden={copy === 1} className={cn('mr-3 h-20 w-36 shrink-0 sm:mr-4 sm:h-24 sm:w-44', copy === 1 && 'motion-reduce:hidden')} />
          )),
        )}
      </div>
    </div>
  )
}

export function ReviewCardView({ review, className }: { review: ReviewCard; className?: string }) {
  return (
    <figure className={cn('relative flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-glow', className)}>
      <Quote className="absolute top-5 right-5 size-10 fill-brand-soft text-brand-soft" aria-hidden />
      <Stars value={review.rating} />
      <blockquote className="mt-4 line-clamp-5 flex-1 text-[15px] leading-relaxed text-slate-700">“{review.comment}”</blockquote>
      <Link to={`/product/${review.productSlug}`} className="mt-5 flex items-center gap-2.5 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-100 transition hover:bg-brand-softer hover:ring-brand-muted">
        {review.productImage && <img src={img(review.productImage, 96)} alt="" className="size-10 rounded-lg bg-white object-contain" loading="lazy" />}
        <span className="line-clamp-1 text-xs font-medium text-slate-700">{review.productName}</span>
      </Link>
      <figcaption className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-light to-brand text-xs font-bold text-white shadow-md shadow-brand-ring">
          {initials(review.customerName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">{review.customerName}</span>
          <span className="block text-xs text-slate-500">{formatDate(review.createdAt)}</span>
        </span>
      </figcaption>
    </figure>
  )
}

export function BlogCardView({ post }: { post: BlogCard }) {
  return (
    <Link to={`/blog/${post.slug}`} className="group flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-glow">
      <div className="relative aspect-[1.9/1] overflow-hidden bg-slate-100">
        {post.coverImageUrl && <img src={img(post.coverImageUrl, 640)} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />}
        {post.publishedAt && (
          <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">{formatDate(post.publishedAt)}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="line-clamp-2 text-lg leading-snug font-semibold text-slate-900 transition group-hover:text-brand-deep">{post.title}</h3>
        {post.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500">{post.excerpt}</p>}
        <span className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold text-brand-deep">
          Read article <ArrowRight className="size-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  )
}
