import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Image URL for uploaded media at a given display width. SVG/GIF and external images are returned as-is. */
export function img(url: string | null | undefined, width?: number): string | undefined {
  if (!url) return undefined
  if (!width || !url.startsWith('/uploads/') || /\.(svg|gif)$/i.test(url)) return url
  return `${url}?w=${width}`
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
