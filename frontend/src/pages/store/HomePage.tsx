import { ArrowRight } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { BlogCardView, BrandMarquee, CategoryTiles, FeatureStrip, HeroSlider, ReviewCardView, SideBanners } from '@/components/store/HomeBlocks'
import { ProductCardSkeleton } from '@/components/store/ProductCard'
import { ProductRail, RichContent, SectionHeader } from '@/components/store/Sections'
import { Skeleton } from '@/components/ui/Feedback'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useHome, useSettings } from '@/hooks/useStore'
import type { HomeSection } from '@/lib/types'
import { cn, heroSizes, img, wideSizes } from '@/lib/utils'

/** Sections rendered with the hero on a fresh visit; the rest follow right after the first paint. */
const FIRST_PAINT_SECTIONS = 2
let deferBelowFold = typeof performance !== 'undefined' && (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'navigate'

/**
 * The full homepage is a few thousand elements, which takes a phone a second or more to lay out. On a fresh
 * visit the top of the page is shown first and the sections further down are added straight after. Only the
 * first homepage render on a fresh visit does this: reloads, Back and later visits render everything at once
 * so the scroll position can be restored.
 */
function useBelowFoldReady(contentLoaded: boolean) {
  const [ready, setReady] = useState(!deferBelowFold)
  useEffect(() => {
    deferBelowFold = false
  }, [])
  useEffect(() => {
    if (ready || !contentLoaded) return
    // requestAnimationFrame runs just before the next paint; the timeout then lands just after it.
    let timer: number | undefined
    const frame = requestAnimationFrame(() => (timer = window.setTimeout(() => setReady(true))))
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [ready, contentLoaded])
  return ready
}

export default function HomePage() {
  const settings = useSettings()
  const { data: home, isLoading } = useHome()
  useDocumentMeta({ title: settings?.seo.metaTitle ?? settings?.general.storeName, rawTitle: true })
  const belowFoldReady = useBelowFoldReady(!!home)

  // Category and brand rows get a showcase panel; alternating its style keeps a rhythm down the page.
  let showcases = 0
  const sections = (home?.sections ?? [])
    .map((section) => ({ section, showcase: isShowcase(section) ? showcases++ : null }))
    .slice(0, belowFoldReady ? undefined : FIRST_PAINT_SECTIONS)

  return (
    <div className="space-y-14 pb-4 sm:space-y-20">
      <section className="relative isolate">
        <HeroBackdrop />
        <div className="container-x space-y-4 pt-4 sm:space-y-5 sm:pt-7">
          {isLoading || !home ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="aspect-[2.13/1] rounded-3xl lg:col-span-2" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                <Skeleton className="rounded-3xl" />
                <Skeleton className="rounded-3xl" />
              </div>
            </div>
          ) : (
            <div className={cn('grid gap-3 sm:gap-4', home.sideBanners.length > 0 && 'lg:grid-cols-3')}>
              <div className="lg:col-span-2">
                <HeroSlider slides={home.heroSlides} sizes={home.sideBanners.length > 0 ? heroSizes : wideSizes} />
              </div>
              <SideBanners banners={home.sideBanners} />
            </div>
          )}
          {settings && <FeatureStrip features={settings.features} />}
        </div>
      </section>

      {isLoading && (
        <Block>
          <Skeleton className="mb-6 h-8 w-56" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </Block>
      )}

      {sections.map(({ section, showcase }) => (
        <HomeSectionView key={section.id} section={section} showcase={showcase} />
      ))}
    </div>
  )
}

const isShowcase = (section: HomeSection) =>
  section.type === 'Products' && !!section.products?.length && /^\/(category|brand)\//.test(section.viewAllUrl ?? '')

/** Soft sky wash behind the hero that fades into the page. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-b from-brand-soft via-brand-softer to-transparent" />
      <div className="absolute -top-48 left-[-10%] size-[36rem] rounded-full bg-brand-glow blur-3xl" />
      <div className="absolute -top-32 right-[-8%] size-[30rem] rounded-full bg-brand-glow blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(var(--color-brand-ring)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_70%)] [background-size:22px_22px] opacity-40" />
    </div>
  )
}

/** A homepage section inside the page container that fades up as it scrolls into view. */
function Block({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('reveal container-x', className)}>{children}</section>
}

function HomeSectionView({ section, showcase }: { section: HomeSection; showcase: number | null }) {
  switch (section.type) {
    case 'Categories':
      return (
        <Block>
          <SectionHeader title={section.title} subtitle={section.subtitle} viewAllUrl={section.viewAllUrl} />
          <CategoryTiles categories={section.categories ?? []} />
        </Block>
      )
    case 'Products':
      return showcase !== null ? (
        <ShowcaseRow section={section} bold={showcase % 2 === 0} />
      ) : (
        <Block>
          <SectionHeader title={section.title} subtitle={section.subtitle} viewAllUrl={section.viewAllUrl} />
          <ProductRail products={section.products ?? []} />
        </Block>
      )
    case 'ProductTabs':
      return <TabbedProducts section={section} />
    case 'Brands':
      return (
        <Block>
          <SectionHeader title={section.title} subtitle={section.subtitle} viewAllUrl={section.viewAllUrl} />
          <BrandMarquee brands={section.brands ?? []} />
        </Block>
      )
    case 'Reviews':
      return <ReviewsBand section={section} />
    case 'Blog':
      return (
        <Block>
          <SectionHeader title={section.title} subtitle={section.subtitle} viewAllUrl={section.viewAllUrl} />
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {(section.posts ?? []).map((post) => (
              <BlogCardView key={post.id} post={post} />
            ))}
          </div>
        </Block>
      )
    case 'Banners': {
      const images = section.images ?? []
      const frame =
        'group block overflow-hidden rounded-2xl shadow-[0_18px_40px_-26px_rgb(15_23_42/0.4)] ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_50px_-24px_rgb(15_23_42/0.45)] sm:rounded-3xl'
      return (
        <Block className={cn('grid gap-3 sm:gap-4', images.length > 1 && 'md:grid-cols-2', images.length > 2 && 'lg:grid-cols-3')}>
          {images.map((image, i) => {
            const picture = <img src={img(image.imageUrl, 960)} alt={image.alt ?? ''} className="w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
            return image.linkUrl ? (
              <Link key={i} to={image.linkUrl} className={frame}>
                {picture}
              </Link>
            ) : (
              <div key={i} className={frame}>
                {picture}
              </div>
            )
          })}
        </Block>
      )
    }
    case 'RichText':
      return (
        <Block>
          <div className="relative isolate overflow-hidden rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 sm:p-10 lg:p-12">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-light via-brand to-brand-deep" />
            <div aria-hidden className="absolute -top-28 -right-28 -z-10 size-80 rounded-full bg-brand-glow blur-3xl" />
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{section.title}</h2>
            <RichContent html={section.html} className="mt-3 max-w-5xl prose-p:text-slate-600" />
          </div>
        </Block>
      )
    default:
      return null
  }
}

/** Category or brand row: on desktop a coloured panel introduces the collection next to its products. */
function ShowcaseRow({ section, bold }: { section: HomeSection; bold: boolean }) {
  const products = section.products ?? []
  const cover = products.find((p) => p.imageUrl)?.imageUrl
  return (
    <Block>
      <SectionHeader title={section.title} subtitle={section.subtitle} viewAllUrl={section.viewAllUrl} className="lg:hidden" />
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <Link
          to={section.viewAllUrl!}
          className={cn(
            'group relative isolate hidden flex-col overflow-hidden rounded-3xl p-7 lg:flex',
            bold
              ? 'bg-linear-to-br from-brand-deep via-brand-hover to-brand text-white shadow-[0_24px_50px_-28px_var(--color-brand-ring)]'
              : 'bg-linear-to-br from-brand-soft via-white to-brand-softer text-slate-900 ring-1 ring-brand-muted',
          )}
        >
          <span aria-hidden className={cn('absolute -top-16 -right-16 -z-10 size-48 rounded-full', bold ? 'bg-white/10' : 'bg-brand-glow')} />
          <span aria-hidden className={cn('absolute -bottom-24 -left-16 -z-10 size-60 rounded-full', bold ? 'bg-white/10' : 'bg-brand-glow')} />
          <span className={cn('text-xs font-semibold tracking-[0.18em] uppercase', bold ? 'text-white/75' : 'text-brand-deep')}>Collection</span>
          <h2 className="mt-2 text-2xl leading-tight font-bold tracking-tight">{section.title}</h2>
          {section.subtitle && <p className={cn('mt-2 text-sm leading-relaxed', bold ? 'text-white/80' : 'text-slate-600')}>{section.subtitle}</p>}
          <span
            className={cn(
              'mt-5 inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-all duration-300 group-hover:gap-2.5',
              bold ? 'bg-white text-brand-deep' : 'bg-brand text-white shadow-brand-ring',
            )}
          >
            Shop all <ArrowRight className="size-4" />
          </span>
          {cover && (
            <div className="pointer-events-none absolute -right-6 -bottom-6 w-44 motion-safe:animate-float xl:w-48">
              <img src={img(cover, 400)} alt="" className="w-full -rotate-12 drop-shadow-2xl transition duration-500 group-hover:scale-105 group-hover:-rotate-6" loading="lazy" />
            </div>
          )}
        </Link>
        <ProductRail
          products={products}
          itemClassName="w-[46%] xs:w-[44%] sm:w-[31%] md:w-[24%] lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)] 2xl:w-[calc((100%-4rem)/5)]"
        />
      </div>
    </Block>
  )
}

function TabbedProducts({ section }: { section: HomeSection }) {
  const tabs = section.tabs ?? []
  const [active, setActive] = useState(0)
  const tab = tabs[Math.min(active, tabs.length - 1)]
  if (!tab) return null
  const activeTab = 'bg-linear-to-r from-brand to-brand-hover text-white shadow-md shadow-brand-ring'
  return (
    <Block>
      <SectionHeader
        title={section.title}
        subtitle={section.subtitle}
        viewAllUrl={tab.viewAllUrl ?? section.viewAllUrl}
        action={
          <div className="hidden rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200/80 sm:flex">
            {tabs.map((t, i) => (
              <button
                key={t.title}
                onClick={() => setActive(i)}
                className={cn('rounded-full px-4 py-1.5 text-sm font-semibold transition duration-300', i === active ? activeTab : 'text-slate-600 hover:text-slate-900')}
              >
                {t.title}
              </button>
            ))}
          </div>
        }
      />
      <div className="scrollbar-none -mx-4 -mt-2 mb-4 flex gap-2 overflow-x-auto px-4 py-1 sm:hidden">
        {tabs.map((t, i) => (
          <button
            key={t.title}
            onClick={() => setActive(i)}
            className={cn('shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition', i === active ? activeTab : 'bg-white text-slate-600 ring-1 ring-slate-200')}
          >
            {t.title}
          </button>
        ))}
      </div>
      <ProductRail key={tab.title} products={tab.products} />
    </Block>
  )
}

/** Full-width tinted band so customer reviews stand out from the product rows. */
function ReviewsBand({ section }: { section: HomeSection }) {
  const reviews = section.reviews ?? []
  if (reviews.length === 0) return null
  return (
    <section className="reveal relative isolate py-14 sm:py-20">
      {/* Gradients fade out at the band's edges, so it blends into the page without a seam. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-transparent via-brand-soft to-transparent" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_40%,var(--color-brand-glow),transparent)]" />
      <div className="container-x">
        <SectionHeader title={section.title} subtitle={section.subtitle} viewAllUrl={section.viewAllUrl} />
        <div className="scrollbar-none -mx-4 -my-5 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 py-5 sm:mx-0 sm:scroll-px-0 sm:px-0">
          {reviews.map((review) => (
            <div key={review.id} className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]">
              <ReviewCardView review={review} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
