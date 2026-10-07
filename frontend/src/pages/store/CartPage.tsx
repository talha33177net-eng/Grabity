import { ShoppingBag, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { FreeShippingProgress } from '@/components/store/CartDrawer'
import { Breadcrumbs } from '@/components/store/Sections'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Alert, EmptyState } from '@/components/ui/Feedback'
import { QuantityStepper } from '@/components/ui/Misc'
import { useCartQuote } from '@/hooks/useCartQuote'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { money } from '@/lib/format'
import { img } from '@/lib/utils'
import { cartSubtotal, useCart } from '@/stores/cart'

export default function CartPage() {
  const { items, setQuantity, remove, clear } = useCart()
  const { data: quote } = useCartQuote()
  const navigate = useNavigate()
  useDocumentMeta({ title: 'Shopping cart', noIndex: true })

  if (items.length === 0) {
    return (
      <div className="container-x py-10">
        <div className="rounded-3xl border border-slate-200/80 bg-white">
          <EmptyState icon={<ShoppingBag className="size-6" />} title="Your cart is empty" description="Looks like you haven't added anything yet." action={<ButtonLink to="/">Continue shopping</ButtonLink>} />
        </div>
      </div>
    )
  }

  const unavailable = quote?.lines.filter((l) => !l.available) ?? []
  return (
    <div className="container-x pt-4 sm:pt-6">
      <Breadcrumbs items={[]} current="Cart" className="mb-4" />
      <h1 className="mb-6 text-2xl font-bold text-slate-900 sm:text-3xl">Shopping cart</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-3xl border border-slate-200/80 bg-white">
          {unavailable.length > 0 && (
            <Alert variant="warning" className="m-4 mb-0" title="Some items need your attention">
              Remove unavailable items to continue to checkout.
            </Alert>
          )}
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const line = quote?.lines.find((l) => l.variantId === item.variantId)
              return (
                <li key={item.variantId} className="flex gap-4 p-4 sm:p-5">
                  <Link to={`/product/${item.slug}`} className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-slate-50 sm:size-24">
                    {item.image && <img src={img(item.image, 192)} alt="" className="size-16 object-contain sm:size-20" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/product/${item.slug}`} className="line-clamp-2 font-medium text-slate-900 hover:text-brand">
                          {item.name}
                        </Link>
                        {item.variantTitle && <p className="mt-0.5 text-sm text-slate-500">{item.variantTitle}</p>}
                        <p className="mt-1 text-sm text-slate-600">{money(item.price)} each</p>
                        {line?.message && <p className={line.available ? 'mt-1 text-sm font-medium text-amber-600' : 'mt-1 text-sm font-medium text-rose-600'}>{line.message}</p>}
                      </div>
                      <p className="shrink-0 font-semibold text-slate-900">{money(item.price * item.quantity)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <QuantityStepper size="sm" value={item.quantity} max={item.maxQuantity} onChange={(q) => setQuantity(item.variantId, q)} />
                      <button onClick={() => remove(item.variantId)} className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rose-600">
                        <Trash2 className="size-4" /> Remove
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="flex justify-between border-t border-slate-100 p-4">
            <ButtonLink to="/" variant="ghost" size="sm">
              ← Continue shopping
            </ButtonLink>
            <Button variant="ghost" size="sm" className="text-rose-600" onClick={clear}>
              Clear cart
            </Button>
          </div>
        </div>

        <aside className="h-fit space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold text-slate-900">Order summary</h2>
          <FreeShippingProgress threshold={quote?.freeShippingThreshold ?? 0} remaining={quote?.amountToFreeShipping ?? 0} />
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal ({quote?.itemCount ?? items.length} items)</span>
            <span className="font-semibold text-slate-900">{money(quote?.subtotal ?? cartSubtotal(items))}</span>
          </div>
          <p className="text-xs text-slate-500">Delivery charge, payment fees and coupons are calculated at checkout.</p>
          <Button size="lg" className="w-full" disabled={unavailable.length > 0} onClick={() => navigate('/checkout')}>
            Proceed to checkout
          </Button>
        </aside>
      </div>
    </div>
  )
}
