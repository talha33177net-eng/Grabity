import { useEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router'
import { CartDrawer } from '@/components/store/CartDrawer'
import { Footer } from '@/components/store/Footer'
import { PromoPopup, WhatsAppButton } from '@/components/store/Floating'
import { Header } from '@/components/store/Header'
import { MobileBottomNav } from '@/components/store/MobileBottomNav'
import { useBootstrap } from '@/hooks/useStore'
import { initAnalytics, trackPageView } from '@/lib/analytics'

export interface StoreRouteHandle {
  /** Page renders its own sticky bottom bar on mobile (e.g. product page). */
  ownBottomBar?: boolean
  hideWhatsApp?: boolean
}

/**
 * Once the first page has loaded and the browser is idle, fetches the code for the pages shoppers open next
 * (category listings and product pages), so tapping a link doesn't wait for it to download.
 */
function prefetchCommonPages() {
  const load = () => {
    void import('@/pages/store/CatalogPages')
    void import('@/pages/store/ProductPage')
  }
  // Safari has no requestIdleCallback.
  const whenIdle = () => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(load, { timeout: 4000 }) : window.setTimeout(load, 2000))
  if (document.readyState === 'complete') whenIdle()
  else window.addEventListener('load', whenIdle, { once: true })
  return () => window.removeEventListener('load', whenIdle)
}

export function StoreLayout() {
  const { data } = useBootstrap()
  const location = useLocation()
  const matches = useMatches()
  const handle = (matches[matches.length - 1]?.handle ?? {}) as StoreRouteHandle

  useEffect(() => {
    if (data?.settings) initAnalytics(data.settings)
  }, [data?.settings])

  useEffect(() => {
    trackPageView()
  }, [location.pathname])

  useEffect(prefetchCommonPages, [])

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {!handle.ownBottomBar && <MobileBottomNav />}
      {!handle.hideWhatsApp && <WhatsAppButton raised={handle.ownBottomBar} />}
      <CartDrawer />
      {location.pathname === '/' && <PromoPopup />}
      <ScrollRestoration />
    </div>
  )
}
