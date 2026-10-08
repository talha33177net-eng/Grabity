import { clsx, type ClassValue } from 'clsx'
import type { CSSProperties } from 'react'
import { twMerge } from 'tailwind-merge'
import type { StoreSettings } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Image URL for uploaded media at a given display width. SVG/GIF and external images are returned as-is. */
export function img(url: string | null | undefined, width?: number): string | undefined {
  if (!url) return undefined
  if (!width || !isResizable(url)) return url
  return `${url}?w=${width}`
}

/** `srcset` offering the given widths of an uploaded image; undefined when the image has no resized copies. */
export function srcSet(url: string | null | undefined, widths: readonly number[]): string | undefined {
  if (!url || !isResizable(url)) return undefined
  return widths.map((width) => `${url}?w=${width} ${width}w`).join(', ')
}

function isResizable(url: string) {
  return url.startsWith('/uploads/') && !/\.(svg|gif)$/i.test(url)
}

// Banner sizes. SpaRenderer.cs preloads the first banner with these same values, and MediaStorage.cs
// makes these widths at upload time, so keep all three in step.
export const bannerWidths = [640, 960, 1200, 1600] as const
export const mobileBannerWidths = [640, 960, 1200] as const
export const bannerFallbackWidth = 1200
/** Hero slider next to the side banners: two thirds of the 1440px container on desktop. */
export const heroSizes = '(min-width: 1440px) 920px, (min-width: 1024px) 64vw, 100vw'
/** Full container width. */
export const wideSizes = '(min-width: 1440px) 1380px, 100vw'

/** Header logo heights in px, within the same ranges the API saves. */
export function logoHeights(general: StoreSettings['general'] | undefined) {
  return { desktop: clamp(general?.logoHeight ?? 48, 24, 96), mobile: clamp(general?.logoHeightMobile ?? 36, 20, 64) }
}

/**
 * CSS variables with the header row heights, grown to fit a tall logo. The store layout sets them so the header
 * and things that stick under it (product page tabs) agree.
 */
export function headerHeightVars(general: StoreSettings['general'] | undefined): CSSProperties {
  const { desktop, mobile } = logoHeights(general)
  return { '--header-h': `${Math.max(64, mobile + 20)}px`, '--header-h-sm': `${Math.max(72, desktop + 24)}px` } as CSSProperties
}

export function discountPercent(price: number, compareAt?: number | null): number {
  if (!compareAt || compareAt <= price) return 0
  return Math.round(((compareAt - price) / compareAt) * 100)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

/** True when a string is a CSS color name the browser understands (used for color swatches). */
export function isCssColor(value: string): boolean {
  if (typeof CSS === 'undefined' || !CSS.supports) return false
  const candidate = value.trim().toLowerCase().replace(/\s+/g, '')
  return /^[a-z]+$/.test(candidate) && CSS.supports('color', candidate)
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent ?? '').replace(/\s+/g, ' ').trim()
}
