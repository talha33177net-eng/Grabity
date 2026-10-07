import { toast } from 'sonner'
import { track } from '@/lib/analytics'
import { useCart, type CartItem } from '@/stores/cart'

/** Adds an item to the cart, opens the cart drawer and reports the event to analytics. */
export function useAddToCart() {
  const add = useCart((s) => s.add)
  const open = useCart((s) => s.open)

  return (item: Omit<CartItem, 'quantity'>, quantity = 1, options: { openDrawer?: boolean } = {}) => {
    add(item, quantity)
    track('AddToCart', { value: item.price * quantity, contentName: item.name, contentIds: [item.productId] })
    if (options.openDrawer !== false) open()
    else toast.success(`${item.name} added to cart`)
  }
}
