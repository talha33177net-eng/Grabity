import { useEffect } from 'react'
import { useSettings } from './useStore'

interface Meta {
  title?: string | null
  description?: string | null
  image?: string | null
  /** Use the title exactly as given (no " | Store" suffix). */
  rawTitle?: boolean
  noIndex?: boolean
}

function setTag(selector: string, attribute: 'name' | 'property', key: string, content: string | null | undefined) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!content) {
    element?.remove()
    return
  }
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

/**
 * Keeps the document title and social/SEO meta tags in sync with the current page.
 * The server pre-renders the same tags for crawlers; this updates them during client-side navigation.
 */
export function useDocumentMeta({ title, description, image, rawTitle, noIndex }: Meta) {
  const settings = useSettings()
  const storeName = settings?.general.storeName ?? 'Grabity'
  const fallbackTitle = settings?.seo.metaTitle ?? storeName
  const fallbackDescription = settings?.seo.metaDescription

  useEffect(() => {
    const fullTitle = title ? (rawTitle ? title : `${title} | ${storeName}`) : fallbackTitle
    document.title = fullTitle
    const desc = description ?? fallbackDescription
    const absoluteImage = image ? new URL(image, window.location.origin).href : undefined
    setTag('meta[name="description"]', 'name', 'description', desc)
    setTag('meta[property="og:title"]', 'property', 'og:title', fullTitle)
    setTag('meta[property="og:description"]', 'property', 'og:description', desc)
    setTag('meta[property="og:url"]', 'property', 'og:url', window.location.href)
    if (absoluteImage) setTag('meta[property="og:image"]', 'property', 'og:image', absoluteImage)
    setTag('meta[name="robots"]', 'name', 'robots', noIndex ? 'noindex' : null)
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical) canonical.href = window.location.origin + window.location.pathname
  }, [title, description, image, rawTitle, noIndex, storeName, fallbackTitle, fallbackDescription])
}
