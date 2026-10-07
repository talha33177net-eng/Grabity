import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronDown, Lock, ShoppingBag, Tag, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { FreeShippingProgress } from '@/components/store/CartDrawer'
import { Breadcrumbs } from '@/components/store/Sections'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { Field, Input, RadioCard, Textarea } from '@/components/ui/Form'
import { WhatsAppIcon } from '@/components/ui/Icons'
import { QuantityStepper } from '@/components/ui/Misc'
import { useCartQuote } from '@/hooks/useCartQuote'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useMe, useSettings } from '@/hooks/useStore'
import { track } from '@/lib/analytics'
import { ApiError, errorMessage, http } from '@/lib/api'
import { money } from '@/lib/format'
import type { CheckoutOptions, PlaceOrderResponse } from '@/lib/types'
import { cn, img } from '@/lib/utils'
import { useCart } from '@/stores/cart'

const bdPhone = /^(?:\+?88)?01[3-9]\d{8}$/
const schema = z.object({
  customerName: z.string().trim().min(2, 'Please enter your full name'),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => bdPhone.test(v), 'Enter a valid mobile number, e.g. 01712345678'),
  email: z.union([z.literal(''), z.email('Enter a valid email address')]).optional(),
  address: z.string().trim().max(500).optional(),
  note: z.string().max(1000).optional(),
  transactionId: z.string().trim().max(100).optional(),
  paymentSenderNumber: z.string().trim().max(20).optional(),
})
type FormValues = z.input<typeof schema>

export default function CheckoutPage() {
  useDocumentMeta({ title: 'Checkout', noIndex: true })
  const { items, couponCode, setCoupon, setQuantity, clear } = useCart()
  const { data: user, isLoading: userLoading } = useMe()
  const settings = useSettings()
  const navigate = useNavigate()
  const { data: options } = useQuery({ queryKey: ['checkout-options'], queryFn: () => http.get<CheckoutOptions>('/checkout/options'), staleTime: 60_000 })

  const [shippingId, setShippingId] = useState<number | null>(null)
  const [paymentCode, setPaymentCode] = useState<string | null>(null)
  const [couponInput, setCouponInput] = useState(couponCode)
  const [showNote, setShowNote] = useState(false)

  useEffect(() => {
    if (!options) return
    setShippingId((current) => current ?? options.shippingMethods[0]?.id ?? null)
    setPaymentCode((current) => current ?? options.paymentMethods[0]?.code ?? null)
  }, [options])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { customerName: '', phone: '', email: '', address: '', note: '', transactionId: '', paymentSenderNumber: '' },
  })
  const { register, handleSubmit, reset, formState, watch } = form

  useEffect(() => {
    if (user) {
      reset((values) => ({
        ...values,
        customerName: values.customerName || user.fullName,
        phone: values.phone || user.phone || '',
        email: values.email || user.email || '',
        address: values.address || user.address || '',
      }))
    }
  }, [user, reset])

  const phone = watch('phone')
  const { data: quote, isFetching: quoting } = useCartQuote({ couponCode, shippingMethodId: shippingId, paymentMethodCode: paymentCode, phone })
  const shipping = options?.shippingMethods.find((s) => s.id === shippingId)
  const payment = options?.paymentMethods.find((p) => p.code === paymentCode)

  useEffect(() => {
    if (items.length > 0) track('InitiateCheckout', { value: quote?.total, contentIds: items.map((i) => i.productId) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const placeOrder = useMutation({
    mutationFn: (values: z.output<typeof schema>) =>
      http.post<PlaceOrderResponse>('/checkout/orders', {
        ...values,
        email: values.email || null,
        shippingMethodId: shippingId,
        paymentMethodCode: paymentCode,
        couponCode: quote?.couponApplied ? couponCode : null,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      }),
    onSuccess: (order, values) => {
      track('Purchase', { value: order.total, orderNumber: order.orderNumber, contentIds: items.map((i) => i.productId) })
      clear()
      navigate(`/order/success/${order.orderNumber}`, { state: { order, phone: values.phone }, replace: true })
    },
    onError: (error) => {
      toast.error(errorMessage(error))
      if (error instanceof ApiError && error.status === 409) window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  })

  const whatsAppMessage = useMemo(() => {
    const lines = items.map((i) => `• ${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ''} × ${i.quantity} — ${money(i.price * i.quantity)}`)
    return `Hello, I want to place an order:\n${lines.join('\n')}\nTotal: ${money(quote?.total ?? 0)}`
  }, [items, quote?.total])

  if (items.length === 0 && !placeOrder.isSuccess) {
    return (
      <div className="container-x py-10">
        <div className="rounded-3xl border border-slate-200/80 bg-white">
          <EmptyState icon={<ShoppingBag className="size-6" />} title="Your cart is empty" description="Add some products before checking out." action={<ButtonLink to="/">Start shopping</ButtonLink>} />
        </div>
      </div>
    )
  }
  if (!options || userLoading) return <PageLoader />

  if (!options.allowGuestCheckout && !user) {
    return (
      <div className="container-x py-10">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">Sign in to check out</h1>
          <p className="mt-2 text-sm text-slate-500">Please sign in or create an account to place your order.</p>
          <div className="mt-5 flex justify-center gap-2">
            <ButtonLink to="/login?redirect=/checkout">Sign in</ButtonLink>
            <ButtonLink to="/register?redirect=/checkout" variant="outline">
              Create account
            </ButtonLink>
          </div>
        </div>
      </div>
    )
  }

  const onSubmit = handleSubmit((values) => {
    const parsed = schema.parse(values)
    if (!shipping) return toast.error('Please choose a delivery option.')
    if (!payment) return toast.error('Please choose a payment method.')
    if (!shipping.isPickup && !parsed.address?.trim()) {
      form.setError('address', { message: 'Please enter your full delivery address' })
      return
    }
    if (payment.requiresTransactionId && !parsed.transactionId?.trim()) {
      form.setError('transactionId', { message: `Enter your ${payment.name} transaction ID` })
      return
    }
    placeOrder.mutate(parsed)
  })

  const applyCoupon = () => setCoupon(couponInput.trim().toUpperCase())
  const unavailable = quote?.lines.some((l) => !l.available)
  const freeDeliveryUnlocked = !!quote && quote.freeShippingThreshold > 0 && quote.subtotal >= quote.freeShippingThreshold

  return (
    <div className="container-x pt-4 sm:pt-6">
      <Breadcrumbs items={[{ name: 'Cart', to: '/cart' }]} current="Checkout" className="mb-4" />
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
        Checkout <Lock className="size-5 text-slate-400" />
      </h1>

      {!user && (
        <p className="mb-5 rounded-2xl bg-brand-softer px-4 py-3 text-sm text-slate-700">
          Have an account?{' '}
          <Link to="/login?redirect=/checkout" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>{' '}
          for faster checkout and order history. Or simply continue as a guest.
        </p>
      )}

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_400px]" noValidate>
        <div className="space-y-6">
          <Card step={1} title="Your details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="customerName" required error={formState.errors.customerName?.message}>
                <Input id="customerName" autoComplete="name" placeholder="e.g. Rahim Uddin" {...register('customerName')} aria-invalid={!!formState.errors.customerName} />
              </Field>
              <Field label="Mobile number" htmlFor="phone" required error={formState.errors.phone?.message} hint="We'll call this number to confirm your order.">
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" {...register('phone')} aria-invalid={!!formState.errors.phone} />
              </Field>
              <Field label="Email (optional)" htmlFor="email" error={formState.errors.email?.message} className="sm:col-span-2">
                <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} aria-invalid={!!formState.errors.email} />
              </Field>
            </div>
          </Card>

          <Card step={2} title="Delivery">
            <div className="grid gap-3 sm:grid-cols-2">
              {options.shippingMethods.map((method) => (
                <RadioCard
                  key={method.id}
                  name="shipping"
                  checked={shippingId === method.id}
                  onSelect={() => setShippingId(method.id)}
                  title={method.name}
                  aside={
                    method.cost === 0 ? (
                      'Free'
                    ) : freeDeliveryUnlocked && method.freeShippingEligible ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs font-normal text-slate-400 line-through">{money(method.cost)}</span>
                        <span className="text-emerald-600">Free</span>
                      </span>
                    ) : (
                      money(method.cost)
                    )
                  }
                  description={[method.estimatedDelivery && `Delivery in ${method.estimatedDelivery}`, method.description].filter(Boolean).join(' · ')}
                />
              ))}
            </div>
            {!shipping?.isPickup && (
              <Field label="Full delivery address" htmlFor="address" required error={formState.errors.address?.message} className="mt-4">
                <Textarea id="address" rows={3} autoComplete="street-address" placeholder="House, road, area, thana, district" {...register('address')} aria-invalid={!!formState.errors.address} />
              </Field>
            )}
            <button type="button" onClick={() => setShowNote((v) => !v)} className="mt-4 flex items-center gap-1 text-sm font-semibold text-brand">
              <ChevronDown className={cn('size-4 transition', showNote && 'rotate-180')} /> Add an order note (optional)
            </button>
            {showNote && <Textarea className="mt-2" rows={2} placeholder="Delivery instructions, preferred time, etc." {...register('note')} />}
          </Card>

          <Card step={3} title="Payment">
            <div className="space-y-3">
              {options.paymentMethods.map((method) => (
                <RadioCard
                  key={method.code}
                  name="payment"
                  checked={paymentCode === method.code}
                  onSelect={() => setPaymentCode(method.code)}
                  title={method.name}
                  aside={method.feePercent > 0 ? <span className="text-xs font-medium text-slate-500">+{method.feePercent}% fee</span> : undefined}
                  description={method.type === 'CashOnDelivery' && !method.instructions ? 'Pay with cash when you receive your order.' : undefined}
                >
                  {method.instructions && <p className="text-sm leading-relaxed text-slate-600">{method.instructions}</p>}
                  {method.accountNumber && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      {method.name} number: <strong className="font-mono text-slate-900">{method.accountNumber}</strong>
                    </p>
                  )}
                  {method.requiresTransactionId && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Transaction ID" htmlFor="trx" required error={formState.errors.transactionId?.message}>
                        <Input id="trx" placeholder="e.g. 9BG7XK2L1M" {...register('transactionId')} className="font-mono uppercase" />
                      </Field>
                      <Field label="Sender number" htmlFor="sender">
                        <Input id="sender" type="tel" placeholder="01XXXXXXXXX" {...register('paymentSenderNumber')} />
                      </Field>
                    </div>
                  )}
                </RadioCard>
              ))}
            </div>
          </Card>
        </div>

        {/* Phones: keep the total and the order button within reach while filling in the form. */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-lg leading-tight font-bold text-slate-900">{money(quote?.total ?? 0)}</p>
            </div>
            <Button type="submit" size="lg" className="flex-1" loading={placeOrder.isPending} disabled={!quote || unavailable || !quote.canCheckout}>
              Place order
            </Button>
          </div>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Order summary</h2>
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto pr-1">
              {items.map((item) => {
                const line = quote?.lines.find((l) => l.variantId === item.variantId)
                return (
                  <li key={item.variantId} className="flex gap-3 py-3 first:pt-0">
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-slate-50">
                      {item.image && <img src={img(item.image, 112)} alt="" className="size-11 object-contain" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-slate-900">{item.name}</p>
                      {item.variantTitle && <p className="text-xs text-slate-500">{item.variantTitle}</p>}
                      {line?.message && <p className={cn('text-xs font-medium', line.available ? 'text-amber-600' : 'text-rose-600')}>{line.message}</p>}
                      <div className="mt-1.5 flex items-center justify-between">
                        <QuantityStepper size="sm" value={item.quantity} max={item.maxQuantity} min={0} onChange={(q) => setQuantity(item.variantId, q)} />
                        <span className="text-sm font-semibold text-slate-900">{money(item.price * item.quantity)}</span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="mt-4 border-t border-slate-100 pt-4">
              {quote?.couponApplied ? (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <span className="flex items-center gap-2 font-semibold">
                    <Tag className="size-4" /> {quote.couponCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCoupon('')
                      setCouponInput('')
                    }}
                    className="rounded p-1 hover:bg-emerald-100"
                    aria-label="Remove coupon"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        applyCoupon()
                      }
                    }}
                    placeholder="Coupon code"
                    className="uppercase"
                  />
                  <Button variant="secondary" onClick={applyCoupon} disabled={!couponInput.trim()}>
                    Apply
                  </Button>
                </div>
              )}
              {quote?.couponMessage && <p className={cn('mt-1.5 text-xs font-medium', quote.couponApplied ? 'text-emerald-600' : 'text-rose-600')}>{quote.couponMessage}</p>}
            </div>

            <dl className={cn('mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm transition-opacity', quoting && 'opacity-60')}>
              <SummaryRow label="Subtotal" value={money(quote?.subtotal ?? 0)} />
              {(quote?.discount ?? 0) > 0 && <SummaryRow label="Discount" value={`−${money(quote!.discount)}`} className="text-emerald-600" />}
              <SummaryRow label="Delivery" value={quote?.shippingCost ? money(quote.shippingCost) : shipping ? 'Free' : '—'} />
              {(quote?.paymentFee ?? 0) > 0 && <SummaryRow label={`${payment?.name} fee`} value={money(quote!.paymentFee)} />}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <dt className="font-semibold text-slate-900">Total</dt>
                <dd className="text-xl font-bold text-slate-900">{money(quote?.total ?? 0)}</dd>
              </div>
            </dl>

            {quote && <FreeShippingProgress threshold={quote.freeShippingApplied || shipping?.isPickup ? 0 : quote.freeShippingThreshold} remaining={quote.amountToFreeShipping} />}

            {quote && quote.issues.length > 0 && !quote.canCheckout && (
              <Alert variant="warning" className="mt-4">
                {quote.issues[0]}
              </Alert>
            )}

            <Button type="submit" size="lg" className="mt-4 w-full" loading={placeOrder.isPending} disabled={!quote || unavailable || !quote.canCheckout}>
              Place order · {money(quote?.total ?? 0)}
            </Button>
            {settings?.contact.whatsAppNumber && settings.checkout.enableWhatsAppOrdering && (
              <a
                href={`https://wa.me/${settings.contact.whatsAppNumber}?text=${encodeURIComponent(whatsAppMessage)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <WhatsAppIcon className="size-5" /> Order via WhatsApp instead
              </a>
            )}
            <p className="mt-3 text-center text-xs text-slate-500">
              By placing your order you agree to our{' '}
              <Link to="/page/terms-of-service" className="underline">
                terms
              </Link>{' '}
              and{' '}
              <Link to="/page/return-policy" className="underline">
                return policy
              </Link>
              .
            </p>
          </div>
        </aside>
      </form>
    </div>
  )
}

function Card({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold text-slate-900">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function SummaryRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex justify-between text-slate-600', className)}>
      <dt>{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
