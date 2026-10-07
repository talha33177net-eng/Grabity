import { useMutation } from '@tanstack/react-query'
import { CircleCheck, Copy, PackageSearch } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { OrderView } from '@/components/store/OrderView'
import { Breadcrumbs } from '@/components/store/Sections'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { Field, Input } from '@/components/ui/Form'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { errorMessage, http } from '@/lib/api'
import { money } from '@/lib/format'
import type { OrderDetail, PlaceOrderResponse } from '@/lib/types'

export function OrderSuccessPage() {
  const { orderNumber } = useParams()
  const location = useLocation()
  const state = location.state as { order?: PlaceOrderResponse; phone?: string } | null
  const order = state?.order
  useDocumentMeta({ title: 'Order placed', noIndex: true })

  const copy = () => {
    navigator.clipboard?.writeText(String(orderNumber))
    toast.success('Order number copied')
  }

  return (
    <div className="container-x py-8 sm:py-12">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200/80 bg-white p-6 text-center sm:p-10">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
          <CircleCheck className="size-9" />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-slate-900 sm:text-3xl">Thank you for your order!</h1>
        <p className="mt-2 text-slate-600">{order?.message ?? "We've received your order and will call you shortly to confirm it."}</p>

        <div className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 text-left sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Order number</p>
            <button onClick={copy} className="mt-0.5 flex items-center gap-2 text-xl font-bold text-slate-900">
              #{orderNumber} <Copy className="size-4 text-slate-400" />
            </button>
          </div>
          {order && (
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Total · {order.paymentMethodName}</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">{money(order.total)}</p>
            </div>
          )}
        </div>

        {order && order.paymentType !== 'CashOnDelivery' && (order.transactionId || order.paymentInstructions) && (
          <Alert variant="info" className="mt-4 text-left" title={`${order.paymentMethodName} payment`}>
            {order.transactionId ? (
              <>
                We received your Transaction ID <strong className="font-semibold break-all">{order.transactionId}</strong>. We'll verify the payment and confirm your order.
              </>
            ) : (
              order.paymentInstructions
            )}
          </Alert>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <ButtonLink to={`/track-order?order=${orderNumber}${state?.phone ? `&contact=${encodeURIComponent(state.phone)}` : ''}`} size="lg">
            Track your order
          </ButtonLink>
          <ButtonLink to="/" variant="outline" size="lg">
            Continue shopping
          </ButtonLink>
        </div>
        <p className="mt-6 text-xs text-slate-500">Save your order number. You'll need it with your phone number to track the order.</p>
      </div>
    </div>
  )
}

export function TrackOrderPage() {
  const [params] = useSearchParams()
  const [orderNumber, setOrderNumber] = useState(params.get('order') ?? '')
  const [contact, setContact] = useState(params.get('contact') ?? '')
  useDocumentMeta({ title: 'Track your order' })

  const track = useMutation({
    mutationFn: () => http.post<OrderDetail>('/checkout/track', { orderNumber: Number(orderNumber.replace(/\D/g, '')), contact: contact.trim() }),
    onError: (e) => toast.error(errorMessage(e)),
  })

  // Coming from the order confirmation page: show the order straight away.
  const autoTracked = useRef(false)
  useEffect(() => {
    if (!autoTracked.current && params.get('order') && params.get('contact')) {
      autoTracked.current = true
      track.mutate()
    }
  }, [params, track])

  return (
    <div className="container-x pt-4 sm:pt-6">
      <Breadcrumbs items={[]} current="Track order" className="mb-4" />
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-8 max-w-xl rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <PackageSearch className="size-5.5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Track your order</h1>
              <p className="text-sm text-slate-500">Enter your order number and the phone number or email used at checkout.</p>
            </div>
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              track.mutate()
            }}
          >
            <Field label="Order number" htmlFor="order" required>
              <Input id="order" inputMode="numeric" placeholder="e.g. 100024" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
            </Field>
            <Field label="Phone number or email" htmlFor="contact" required>
              <Input id="contact" placeholder="01XXXXXXXXX or you@example.com" value={contact} onChange={(e) => setContact(e.target.value)} required />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={track.isPending}>
              Show order
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">
            Have an account?{' '}
            <Link to="/account/orders" className="font-semibold text-brand hover:underline">
              See all your orders
            </Link>
          </p>
        </div>
        {track.data && <OrderView order={track.data} />}
      </div>
    </div>
  )
}
