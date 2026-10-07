import { ShoppingBag, Trash2, Truck } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'
import { QuantityStepper } from '@/components/ui/Misc'
import { Drawer } from '@/components/ui/Overlay'
import { useCartQuote } from '@/hooks/useCartQuote'
import { money } from '@/lib/format'
import { img } from '@/lib/utils'
import { cartSubtotal, useCart } from '@/stores/cart'

export function CartDrawer() {
  const { items, isOpen, close, setQuantity, remove } = useCart()
  const navigate = useNavigate()
  const { data: quote } = useCartQuote({ enabled: isOpen })
  const subtotal = quote?.subtotal ?? cartSubtotal(items)

  return (
    <Drawer
      open={isOpen}
      onClose={close}
      title={
        <span className="flex items-center gap-2">
          Your cart <span className="text-sm font-medium text-slate-400">({items.reduce((s, i) => s + i.quantity, 0)})</span>
        </span>
      }
      footer={
        items.length > 0 && (
          <div className="space-y-3">
            <FreeShippingProgress threshold={quote?.freeShippingThreshold ?? 0} remaining={quote?.amountToFreeShipping ?? 0} />
            <div className="flex items-center justify-between text-base">
              <span className="font-medium text-slate-600">Subtotal</span>
              <span className="text-lg font-bold text-slate-900">{money(subtotal)}</span>
            </div>
            <p className="text-xs text-slate-500">Delivery charge and coupons are applied at checkout.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  close()
                  navigate('/cart')
                }}
              >
                View cart
              </Button>
              <Button
                disabled={quote ? !quote.canCheckout && quote.lines.some((l) => !l.available) : false}
                onClick={() => {
                  close()
                  navigate('/checkout')
                }}
              >
                Checkout
              </Button>
            </div>
          </div>
        )
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="size-6" />}
          title="Your cart is empty"
          description="Browse our latest gadgets and add your favourites to the cart."
          action={
            <Button
              onClick={() => {
                close()
                navigate('/')
              }}
            >
              Start shopping
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            const line = quote?.lines.find((l) => l.variantId === item.variantId)
            return (
              <li key={item.variantId} className="flex gap-3 px-5 py-4">
                <Link to={`/product/${item.slug}`} onClick={close} className="flex size-20 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
                  {item.image && <img src={img(item.image, 160)} alt="" className="size-16 object-contain" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${item.slug}`} onClick={close} className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-brand">
                    {item.name}
                  </Link>
                  {item.variantTitle && <p className="mt-0.5 text-xs text-slate-500">{item.variantTitle}</p>}
                  {line?.message && <p className={line.available ? 'mt-1 text-xs font-medium text-amber-600' : 'mt-1 text-xs font-medium text-rose-600'}>{line.message}</p>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <QuantityStepper size="sm" value={item.quantity} max={item.maxQuantity} onChange={(q) => setQuantity(item.variantId, q)} />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{money(item.price * item.quantity)}</span>
                      <button onClick={() => remove(item.variantId)} className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${item.name}`}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Drawer>
  )
}

export function FreeShippingProgress({ threshold, remaining }: { threshold: number; remaining: number }) {
  if (!threshold) return null
  const progress = Math.min(100, ((threshold - remaining) / threshold) * 100)
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
        <Truck className="size-4 shrink-0" />
        {remaining > 0 ? (
          <span>
            Spend <strong>{money(remaining)}</strong> more for free delivery
          </span>
        ) : (
          <span>You've unlocked free delivery!</span>
        )}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100">
        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
