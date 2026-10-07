import type { OrderSource, OrderStatus, PaymentStatus } from './types'

let currencySymbol = '৳'

export function setCurrencySymbol(symbol: string) {
  currencySymbol = symbol || '৳'
}

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** ৳1,350 — no decimals unless the amount has them. */
export function money(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return `${currencySymbol}0`
  return `${currencySymbol}${numberFormat.format(amount)}`
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {}),
  }).format(date)
}

export function timeAgo(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatDate(date)
}

/** yyyy-MM-dd in local time, for date inputs and API date filters. */
export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const orderStatusLabel: Record<OrderStatus, string> = {
  Pending: 'Pending',
  Confirmed: 'Confirmed',
  Processing: 'Processing',
  Shipped: 'Shipped',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
  Returned: 'Returned',
}

export const orderStatusTone: Record<OrderStatus, 'slate' | 'amber' | 'blue' | 'violet' | 'cyan' | 'green' | 'red' | 'orange'> = {
  Pending: 'amber',
  Confirmed: 'blue',
  Processing: 'violet',
  Shipped: 'cyan',
  Delivered: 'green',
  Cancelled: 'red',
  Returned: 'orange',
}

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  Unpaid: 'Unpaid',
  Verifying: 'Verifying payment',
  PartiallyPaid: 'Partially paid',
  Paid: 'Paid',
  Refunded: 'Refunded',
}

export const paymentStatusTone: Record<PaymentStatus, 'slate' | 'amber' | 'blue' | 'green' | 'red'> = {
  Unpaid: 'slate',
  Verifying: 'amber',
  PartiallyPaid: 'blue',
  Paid: 'green',
  Refunded: 'red',
}

export const orderSourceLabel: Record<OrderSource, string> = {
  Website: 'Website',
  Phone: 'Phone call',
  Facebook: 'Facebook',
  WhatsApp: 'WhatsApp',
  Instagram: 'Instagram',
  Store: 'In store',
  Other: 'Other',
}
