import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { WhatsAppIcon } from '@/components/ui/Icons'
import { Modal } from '@/components/ui/Overlay'
import { useHome, useSettings } from '@/hooks/useStore'
import { cn, img } from '@/lib/utils'

/** Floating WhatsApp chat button with a small greeting bubble. */
export function WhatsAppButton({ raised }: { raised?: boolean }) {
  const settings = useSettings()
  const [bubble, setBubble] = useState(() => {
    try {
      return sessionStorage.getItem('wa-bubble') !== 'closed'
    } catch {
      return true
    }
  })
  const number = settings?.contact.whatsAppNumber
  if (!number) return null
  const text = encodeURIComponent(`Hi ${settings.general.storeName}, I need some help.\n\nSent from: ${window.location.href}`)

  return (
    <div className={cn('fixed right-4 z-40 flex items-center gap-2 transition-all lg:right-6 lg:bottom-6', raised ? 'bottom-36' : 'bottom-20')}>
      {bubble && (
        <div className="relative hidden rounded-xl bg-white py-2 pr-8 pl-3 text-sm font-medium text-slate-700 shadow-lg ring-1 ring-slate-200 sm:block">
          Need help? Chat with us
          <button
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
            onClick={() => {
              setBubble(false)
              try {
                sessionStorage.setItem('wa-bubble', 'closed')
              } catch {
                /* storage unavailable */
              }
            }}
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <a
        href={`https://wa.me/${number}?text=${text}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="flex size-13 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg shadow-emerald-600/30 transition hover:scale-105"
      >
        <WhatsAppIcon className="size-7" />
      </a>
    </div>
  )
}

/** Shows the admin-configured popup banner once per browser session. */
export function PromoPopup() {
  const { data: home } = useHome()
  const popup = home?.popup
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!popup) return
    let seen = false
    try {
      seen = sessionStorage.getItem('promo-seen') === String(popup.id)
    } catch {
      /* storage unavailable */
    }
    if (seen) return
    // Open once the image has downloaded too, so the popup appears complete instead of growing as it arrives.
    let waited = false
    let loaded = false
    const show = () => waited && loaded && setOpen(true)
    const image = new Image()
    image.onload = image.onerror = () => {
      loaded = true
      show()
    }
    image.src = img(popup.imageUrl, 800)!
    const timer = window.setTimeout(() => {
      waited = true
      show()
    }, 1200)
    return () => {
      window.clearTimeout(timer)
      image.onload = image.onerror = null
    }
  }, [popup])

  if (!popup) return null
  const close = () => {
    setOpen(false)
    try {
      sessionStorage.setItem('promo-seen', String(popup.id))
    } catch {
      /* storage unavailable */
    }
  }

  const image = <img src={img(popup.imageUrl, 800)} alt={popup.title ?? 'Promotion'} className="block w-full" />
  return (
    <Modal open={open} onClose={close} size="md" className="bg-transparent shadow-none sm:max-w-md" hideClose>
      <div className="relative -mx-5 -my-4 overflow-hidden rounded-2xl">
        <button onClick={close} className="absolute top-3 right-3 z-10 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60" aria-label="Close promotion">
          <X className="size-5" />
        </button>
        {popup.linkUrl ? (
          <Link to={popup.linkUrl} onClick={close}>
            {image}
          </Link>
        ) : (
          image
        )}
      </div>
    </Modal>
  )
}
