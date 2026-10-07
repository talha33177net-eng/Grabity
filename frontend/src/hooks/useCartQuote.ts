import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { http } from '@/lib/api'
import type { Quote } from '@/lib/types'
import { useCart } from '@/stores/cart'

interface QuoteOptions {
  couponCode?: string
  shippingMethodId?: number | null
  paymentMethodCode?: string | null
  phone?: string
  enabled?: boolean
}

/** Prices the current cart on the server and keeps the local cart in sync with current prices and stock. */
export function useCartQuote({ couponCode, shippingMethodId, paymentMethodCode, phone, enabled = true }: QuoteOptions = {}) {
  const items = useCart((s) => s.items)
  const syncFromQuote = useCart((s) => s.syncFromQuote)
  const payload = items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }))

  const query = useQuery({
    queryKey: ['quote', payload, couponCode ?? '', shippingMethodId ?? null, paymentMethodCode ?? null, phone ?? ''],
    queryFn: () =>
      http.post<Quote>('/checkout/quote', {
        items: payload,
        couponCode: couponCode || null,
        shippingMethodId: shippingMethodId ?? null,
        paymentMethodCode: paymentMethodCode ?? null,
        phone: phone || null,
      }),
    enabled: enabled && payload.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })

  useEffect(() => {
    if (query.data) syncFromQuote(query.data.lines)
  }, [query.data, syncFromQuote])

  return query
}
