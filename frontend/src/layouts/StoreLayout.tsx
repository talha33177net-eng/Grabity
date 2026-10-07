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
