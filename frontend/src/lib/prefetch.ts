import { embeddedResponse, http } from './api'
import { queryClient } from './queryClient'
import type { ProductDetail } from './types'
import { img } from './utils'

// Image widths, kept in step with SpaRenderer.cs (which preloads them) and MediaStorage.cs (which makes them at upload).
export const cardImageWidth = 400
export const galleryImageWidth = 960

export const productQuery = (slug: string) => ({
  queryKey: ['product', slug],
  queryFn: () => http.get<ProductDetail>(`/products/${slug}`),
  initialData: () => embeddedResponse<ProductDetail>(`/products/${slug}`),
})

/** The image the product page opens on: the first in-stock variant's image when it has one. */
export function initialImageIndex(product: ProductDetail): number {
  const variant = product.variants.find((v) => v.inStock) ?? product.variants[0]
  const index = variant?.imageUrl ? product.images.findIndex((image) => image.url === variant.imageUrl) : -1
  return Math.max(index, 0)
}

/**
 * Loads a product page's code, data and main photo ahead of the click, so the page opens with everything
 * ready. Uses the default staleTime, so lingering on a card again shortly after doesn't refetch.
 */
export function prefetchProduct(slug: string) {
  void import('@/pages/store/ProductPage')
  queryClient
    .fetchQuery(productQuery(slug))
    .then((product) => {
      const image = product.images[initialImageIndex(product)]
      if (image) preloadImage(img(image.url, galleryImageWidth)!)
    })
    .catch(() => undefined)
}

// Holds the Image objects until they finish so the downloads aren't dropped with them.
const preloading = new Set<HTMLImageElement>()

function preloadImage(url: string) {
  const image = new Image()
  preloading.add(image)
  image.onload = image.onerror = () => preloading.delete(image)
  image.src = url
}

/** Card-sized photos already shown on this visit, which the product page can show while its larger photo loads. */
const shownCardImages = new Set<string>()

export function rememberCardImage(url: string) {
  shownCardImages.add(url)
}

export function shownCardImage(url: string): string | undefined {
  const card = img(url, cardImageWidth)
  return card && shownCardImages.has(card) ? card : undefined
}
