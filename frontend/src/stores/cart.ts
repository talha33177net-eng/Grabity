import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { QuoteLine } from '@/lib/types'

export interface CartItem {
  variantId: number
  productId: number
  slug: string
  name: string
  variantTitle?: string | null
  image?: string | null
  price: number
  compareAtPrice?: number | null
  quantity: number
  maxQuantity?: number | null
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  couponCode: string
  add: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void
  setQuantity: (variantId: number, quantity: number) => void
  remove: (variantId: number) => void
  clear: () => void
  open: () => void
  close: () => void
  setCoupon: (code: string) => void
  /** Refresh names, prices and stock limits from a server quote. */
  syncFromQuote: (lines: QuoteLine[]) => void
}

const MAX_QTY = 99

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      couponCode: '',
      add: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId)
          const limit = item.maxQuantity ?? MAX_QTY
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId ? { ...i, ...item, quantity: Math.min(i.quantity + quantity, limit) } : i,
              ),
            }
          }
          return { items: [...state.items, { ...item, quantity: Math.min(quantity, limit) }] }
        }),
      setQuantity: (variantId, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(Math.max(quantity, 0), i.maxQuantity ?? MAX_QTY) } : i))
            .filter((i) => i.quantity > 0),
        })),
      remove: (variantId) => set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [], couponCode: '' }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      setCoupon: (couponCode) => set({ couponCode }),
      syncFromQuote: (lines) =>
        set((state) => {
          let changed = false
          const items = state.items.map((item) => {
            const line = lines.find((l) => l.variantId === item.variantId)
            if (!line || !line.available) return item
            const next: CartItem = {
              ...item,
              name: line.productName,
              slug: line.productSlug || item.slug,
              variantTitle: line.variantTitle,
              image: line.imageUrl ?? item.image,
              price: line.unitPrice,
              compareAtPrice: line.compareAtPrice,
              maxQuantity: line.maxQuantity,
              quantity: line.maxQuantity != null ? Math.min(item.quantity, Math.max(line.maxQuantity, 1)) : item.quantity,
            }
            if (JSON.stringify(next) !== JSON.stringify(item)) changed = true
            return next
          })
          return changed ? { items } : state
        }),
    }),
    {
      name: 'grabity-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items, couponCode: state.couponCode }),
    },
  ),
)

export const cartCount = (items: CartItem[]) => items.reduce((sum, item) => sum + item.quantity, 0)
export const cartSubtotal = (items: CartItem[]) => items.reduce((sum, item) => sum + item.price * item.quantity, 0)
