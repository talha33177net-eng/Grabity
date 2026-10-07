import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

let openOverlays = 0

/** Locks body scroll while any overlay is open and closes on Escape. */
function useOverlay(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    openOverlays++
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      openOverlays--
      if (openOverlays === 0) document.body.style.overflow = ''
    }
  }, [open])
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  hideClose?: boolean
}

const modalSizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', '2xl': 'max-w-6xl' }

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className, hideClose }: ModalProps) {
  useOverlay(open, onClose)
  const titleId = useId()
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-pop-in flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl',
          modalSizes[size],
          className,
        )}
      >
        {(title || !hideClose) && (
          <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', !title && 'absolute top-0 right-0 z-10')}>
            {title && (
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                  {title}
                </h2>
                {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
              </div>
            )}
            {!hideClose && (
              <button onClick={onClose} className="-m-1.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Close">
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

interface DrawerProps {
  open: boolean
  onClose: () => void
  side?: 'left' | 'right'
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  widthClass?: string
}

export function Drawer({ open, onClose, side = 'right', title, children, footer, className, widthClass = 'max-w-md' }: DrawerProps) {
  useOverlay(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/45" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute inset-y-0 flex w-[88vw] flex-col bg-white shadow-2xl',
          widthClass,
          side === 'right' ? 'right-0 animate-slide-in-right' : 'left-0 animate-slide-in-left',
          className,
        )}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0 text-lg font-semibold text-slate-900">{title}</div>
            <button onClick={onClose} className="-mr-1.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-slate-100 bg-white p-4">{footer}</div>}
      </aside>
    </div>,
    document.body,
  )
}
