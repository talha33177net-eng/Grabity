import type { EmailKind, EmailMessageItem } from '@/lib/adminTypes'
import { formatDate } from '@/lib/format'

export const emailKinds: Record<EmailKind, { label: string; description: string }> = {
  OrderPlaced: { label: 'Order received', description: 'Right after checkout, with the full order summary.' },
  OrderConfirmed: { label: 'Order confirmed', description: 'When you confirm the order.' },
  OrderShipped: { label: 'Order shipped', description: 'When it leaves the store, with the courier and tracking code.' },
  OrderDelivered: { label: 'Order delivered', description: 'When it is delivered, with links to review the products.' },
  OrderCancelled: { label: 'Order cancelled', description: 'When the order is cancelled, including your note.' },
  OrderReturned: { label: 'Return received', description: 'When the order is marked returned.' },
  PaymentReceived: { label: 'Payment received', description: 'When you verify a bKash/Nagad/bank payment or an advance.' },
  PaymentRefunded: { label: 'Refund processed', description: 'When the payment is marked refunded.' },
  Welcome: { label: 'Welcome', description: 'When a customer creates an account (with an email).' },
  PasswordReset: { label: 'Password reset link', description: 'Sent when someone uses “Forgot password?”. Always on.' },
  PasswordChanged: { label: 'Password changed', description: 'Security notice after a password change or reset.' },
  NewsletterWelcome: { label: 'Newsletter welcome', description: 'When someone subscribes, with an unsubscribe link.' },
  StaffWelcome: { label: 'Staff invitation', description: 'When you add a staff member, with the sign-in link.' },
  StaffNewOrder: { label: 'New order', description: 'Every website order, with payment and delivery history checks.' },
  StaffLowStock: { label: 'Low stock', description: 'When an order takes a product to your low-stock level or sells it out.' },
  StaffNewReview: { label: 'New review', description: 'When a review is waiting for approval.' },
  Test: { label: 'Test email', description: '' },
}

/** One line under a log entry: when it went out, when it will, or why it didn't. */
export function emailWhen(email: EmailMessageItem): string {
  if (email.status === 'Sent' && email.sentAt) return `Sent ${formatDate(email.sentAt, true)}`
  if (email.status === 'Pending') return `${email.attempts > 0 ? 'Next try' : 'Sends'} ${formatDate(email.nextAttemptAt, true)}`
  return email.lastError ?? formatDate(email.createdAt, true)
}
