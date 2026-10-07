// Optional Google Analytics 4 and Facebook Pixel tracking, configured from the admin settings.
import type { StoreSettings } from './types'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: (...args: unknown[]) => void; push?: unknown }
    _fbq?: unknown
  }
}

let initialised = false

export function initAnalytics(settings: StoreSettings) {
  if (initialised) return
  initialised = true
  const { googleAnalyticsId, facebookPixelId } = settings.analytics

  if (googleAnalyticsId) {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAnalyticsId)}`
    document.head.appendChild(script)
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', googleAnalyticsId)
  }

  if (facebookPixelId) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args)
      else fbq.queue!.push(args)
    } as NonNullable<Window['fbq']>
    fbq.queue = []
    fbq.loaded = true
    fbq.version = '2.0'
    window.fbq = fbq
    window._fbq = fbq
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
    fbq('init', facebookPixelId)
    fbq('track', 'PageView')
  }
}

type EventName = 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase' | 'Search'

const gaNames: Record<EventName, string> = {
  ViewContent: 'view_item',
  AddToCart: 'add_to_cart',
  InitiateCheckout: 'begin_checkout',
  Purchase: 'purchase',
  Search: 'search',
}

export function track(event: EventName, data: { value?: number; currency?: string; contentName?: string; contentIds?: (string | number)[]; orderNumber?: number; query?: string } = {}) {
  const currency = data.currency ?? 'BDT'
  window.fbq?.('track', event, {
    value: data.value,
    currency,
    content_name: data.contentName,
    content_ids: data.contentIds,
    content_type: 'product',
    search_string: data.query,
  })
  window.gtag?.('event', gaNames[event], {
    value: data.value,
    currency,
    transaction_id: data.orderNumber,
    search_term: data.query,
    items: data.contentIds?.map((id) => ({ item_id: String(id), item_name: data.contentName })),
  })
}

export function trackPageView() {
  window.fbq?.('track', 'PageView')
  window.gtag?.('event', 'page_view', { page_location: window.location.href, page_title: document.title })
}
