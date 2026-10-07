import { Link } from 'react-router'
import { useSettings } from '@/hooks/useStore'
import { cn } from '@/lib/utils'

/** Store logo: the uploaded logo if set, otherwise the Grabity mark with the store name. */
export function Logo({ className, light }: { className?: string; light?: boolean }) {
  const settings = useSettings()
  const name = settings?.general.storeName ?? 'Grabity'
  const logoUrl = settings?.general.logoUrl

  return (
    <Link to="/" className={cn('flex shrink-0 items-center gap-2', className)} aria-label={`${name} home`}>
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="h-9 w-auto max-w-[180px] object-contain sm:h-10" />
      ) : (
        <>
          <LogoMark className="size-9 sm:size-10" />
          <span className={cn('text-xl font-extrabold tracking-tight sm:text-2xl', light ? 'text-white' : 'text-slate-900')}>{name}</span>
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
