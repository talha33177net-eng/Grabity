import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProductCard } from '@/lib/types'

interface RecentState {
  products: ProductCard[]
  push: (product: ProductCard) => void
}

/** Recently viewed products, kept in localStorage for the "Recently viewed" strip. */
export const useRecentlyViewed = create<RecentState>()(
  persist(
    (set) => ({
      products: [],
      push: (product) =>
        set((state) => ({ products: [product, ...state.products.filter((p) => p.id !== product.id)].slice(0, 12) })),
    }),
    { name: 'grabity-recent' },
  ),
)
