import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { useSettings } from '@/hooks/useStore'
import type { StoreSettings } from '@/lib/types'
import { cn, img, logoHeights, srcSet } from '@/lib/utils'

// MediaStorage.cs makes these widths when the logo is uploaded.
const logoWidths = [240, 480, 960] as const

/**
 * Store logo: the uploaded logo at the heights set in the admin (plus the store name when switched on),
 * otherwise the Grabity mark with the store name.
 */
export function Logo({
  className,
  light,
  height,
  general: draft,
}: {
  className?: string
  light?: boolean
  /** One height in px for every screen size, instead of the phone/desktop heights from the settings. */
  height?: number
  /** Settings to show instead of the saved ones (the admin preview). */
  general?: StoreSettings['general']
}) {
  const settings = useSettings()
  const general = draft ?? settings?.general
  const name = general?.storeName ?? 'Grabity'
  const logoUrl = general?.logoUrl
  const sizes = logoHeights(general)
  const desktop = height ?? sizes.desktop
  const mobile = height ?? sizes.mobile
  const nameClass = cn('text-xl font-extrabold tracking-tight sm:text-2xl', light ? 'text-white' : 'text-slate-900')

  return (
    <Link
      to="/"
      className={cn('flex shrink-0 items-center gap-2', className)}
      aria-label={`${name} home`}
      style={{ '--logo-h': `${mobile}px`, '--logo-h-sm': `${desktop}px` } as CSSProperties}
    >
      {logoUrl ? (
        <>
          <img
            src={img(logoUrl, 480)}
            srcSet={srcSet(logoUrl, logoWidths)}
            // The width depends on the logo's shape; allowing for up to 4:1 keeps wide logos sharp.
            sizes={`(min-width: 640px) ${desktop * 4}px, ${mobile * 4}px`}
            alt={name}
            className="h-(--logo-h) w-auto max-w-[55vw] object-contain sm:h-(--logo-h-sm) sm:max-w-none"
          />
          {general?.showNameWithLogo && <span className={nameClass}>{name}</span>}
        </>
      ) : (
        <>
          <LogoMark className="size-9 sm:size-10" />
          <span className={nameClass}>{name}</span>
        </>
      )}
    </Link>
  )
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" className="fill-brand" />
      <rect width="64" height="64" rx="16" fill="url(#logo-shine)" />
      <defs>
        <linearGradient id="logo-shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
      </defs>
      <path d="M44 22.5A15 15 0 1 0 47 34H33" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47.5" cy="16.5" r="4.5" fill="#fbbf24" />
    </svg>
  )
}
