import {
  Activity,
  BadgePercent,
  BatteryCharging,
  Cable,
  Camera,
  Clock,
  CreditCard,
  Fan,
  Gamepad2,
  Gift,
  Headphones,
  House,
  Keyboard,
  Laptop,
  Monitor,
  Mouse,
  Package,
  PlugZap,
  RotateCcw,
  Router,
  Scissors,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Speaker,
  Store,
  Tablet,
  Tag,
  Truck,
  Tv,
  Usb,
  Watch,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { SVGProps } from 'react'

/** Icons admins can pick for categories and feature highlights. Keys are stored in the database. */
export const iconMap: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  monitor: Monitor,
  tv: Tv,
  headphones: Headphones,
  speaker: Speaker,
  watch: Watch,
  activity: Activity,
  'battery-charging': BatteryCharging,
  'plug-zap': PlugZap,
  cable: Cable,
  zap: Zap,
  keyboard: Keyboard,
  mouse: Mouse,
  usb: Usb,
  house: House,
  sparkles: Sparkles,
  scissors: Scissors,
  fan: Fan,
  router: Router,
  shield: Shield,
  'shield-check': ShieldCheck,
  camera: Camera,
  'gamepad-2': Gamepad2,
  tag: Tag,
  gift: Gift,
  truck: Truck,
  'badge-percent': BadgePercent,
  wrench: Wrench,
  'credit-card': CreditCard,
  'rotate-ccw': RotateCcw,
  clock: Clock,
  store: Store,
  package: Package,
}

export const iconOptions = Object.keys(iconMap)

export function DynamicIcon({ name, className, fallback = Package }: { name?: string | null; className?: string; fallback?: LucideIcon }) {
  const Icon = (name && iconMap[name]) || fallback
  return <Icon className={className} />
}

type IconProps = SVGProps<SVGSVGElement>

// Simplified social glyphs (lucide no longer ships brand icons).
export const FacebookIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21h3z" />
  </svg>
)
export const InstagramIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" {...props}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
  </svg>
)
export const YouTubeIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z" />
  </svg>
)
export const TikTokIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M16.7 3h-3.2v12.3a2.8 2.8 0 1 1-2.8-2.8c.3 0 .6 0 .9.1V9.3a6 6 0 1 0 5.1 6V9.1a7.6 7.6 0 0 0 4.3 1.3V7.2a4.4 4.4 0 0 1-4.3-4.2z" />
  </svg>
)
export const LinkedInIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M6.9 8.8H3.8V20h3.1V8.8zM5.4 3.8a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM20.2 13.6c0-3-1.6-4.9-4.2-4.9-1.4 0-2.4.8-2.8 1.5V8.8H10V20h3.1v-5.9c0-1.6.7-2.6 2-2.6 1.2 0 1.9.9 1.9 2.6V20h3.2v-6.4z" />
  </svg>
)
export const XIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M17.8 3h3l-6.6 7.6L22 21h-6.1l-4.8-6.3L5.6 21h-3l7.1-8.1L2.2 3h6.2l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
  </svg>
)
export const WhatsAppIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.8l5.1-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3a8 8 0 1 1 6.9 3.8zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.3z" />
  </svg>
)
export const MessengerIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12 2.5C6.6 2.5 2.5 6.5 2.5 11.7c0 2.7 1.1 5.1 3 6.7v3.1l2.9-1.6c1.1.3 2.3.5 3.6.5 5.4 0 9.5-4 9.5-9.2S17.4 2.5 12 2.5zm1 12.3-2.4-2.6-4.7 2.6 5.2-5.5 2.5 2.6 4.6-2.6-5.2 5.5z" />
  </svg>
)
