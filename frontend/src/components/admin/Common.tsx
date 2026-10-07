import { ArrowLeft, ChevronDown, ChevronUp, ImagePlus, LoaderCircle, Search, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge, Skeleton } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Overlay'
import { useDebounce } from '@/hooks/useDebounce'
import { errorMessage, http } from '@/lib/api'
import { orderStatusLabel, orderStatusTone, paymentStatusLabel, paymentStatusTone } from '@/lib/format'
import type { OrderStatus, PaymentStatus } from '@/lib/types'
import { cn, img } from '@/lib/utils'

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link to={back} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
            <ArrowLeft className="size-4" /> Back
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, description, actions, children, className, bodyClass }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn('rounded-2xl border border-slate-200 bg-white shadow-xs', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('p-5', bodyClass)}>{children}</div>
    </section>
  )
}

export function StatCard({ label, value, icon, hint, tone = 'brand' }: { label: string; value: ReactNode; icon: ReactNode; hint?: ReactNode; tone?: 'brand' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = {
    brand: 'bg-brand-soft text-brand',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-rose-50 text-rose-600',
    blue: 'bg-blue-50 text-blue-600',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tones[tone])}>{icon}</span>
      </div>
      {hint && <div className="mt-2 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

export interface Column<T> {
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
  headerClass?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  onRowClick,
  className,
}: {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string | number
  loading?: boolean
  empty?: ReactNode
  onRowClick?: (row: T) => void
  className?: string
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {columns.map((col, i) => (
              <th key={i} className={cn('px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap text-slate-500 uppercase', col.headerClass)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading && !rows?.length
            ? Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-36" />
                    </td>
                  ))}
                </tr>
              ))
            : rows?.map((row) => (
                <tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-slate-50')}>
                  {columns.map((col, j) => (
                    <td key={j} className={cn('px-4 py-3 align-middle text-slate-700', col.className)}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows && rows.length === 0 && <div className="px-4 py-12 text-center text-sm text-slate-500">{empty ?? 'Nothing here yet.'}</div>}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search...', className }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  const [text, setText] = useState(value)
  const debounced = useDebounce(text, 300)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => setText(value), [value])
  useEffect(() => {
    if (debounced !== value) onChangeRef.current(debounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-8 pl-9 text-sm outline-none focus:border-brand focus:ring-3 focus:ring-brand-ring"
      />
      {text && (
        <button onClick={() => setText('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Clear">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={orderStatusTone[status]} dot>
      {orderStatusLabel[status]}
    </Badge>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={paymentStatusTone[status]}>{paymentStatusLabel[status]}</Badge>
}

export function ActiveBadge({ active, on = 'Active', off = 'Hidden' }: { active: boolean; on?: string; off?: string }) {
  return (
    <Badge tone={active ? 'green' : 'slate'} dot>
      {active ? on : off}
    </Badge>
  )
}

/** Promise-based confirmation dialog: `if (await confirm({...})) { ... }` */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean; resolve: (ok: boolean) => void } | null>(null)
  const confirm = (options: { title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean }) =>
    new Promise<boolean>((resolve) => setState({ ...options, resolve }))
  const close = (ok: boolean) => {
    state?.resolve(ok)
    setState(null)
  }
  const dialog = (
    <Modal
      open={!!state}
      onClose={() => close(false)}
      size="sm"
      title={state?.title}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {state?.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-600">{state?.message}</div>
    </Modal>
  )
  return [confirm, dialog] as const
}

async function uploadFile(file: File, folder: string) {
  try {
    return (await http.upload(file, folder)).url
  } catch (error) {
    toast.error(`${file.name}: ${errorMessage(error)}`)
    return null
  }
}

/** Single image field with upload, preview and remove. */
export function ImageUpload({ value, onChange, folder, aspect = 'aspect-square', className, label = 'Upload image' }: { value?: string | null; onChange: (url: string | null) => void; folder: string; aspect?: string; className?: string; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (file?: File) => {
    if (!file) return
    setBusy(true)
    const url = await uploadFile(file, folder)
    setBusy(false)
    if (url) onChange(url)
  }
  return (
    <div className={className}>
      <div
        className={cn('@container group relative flex items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-brand', aspect)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          pick(e.dataTransfer.files[0])
        }}
      >
        {value ? (
          <>
            <img src={img(value, 480)} alt="" className="size-full object-contain p-2" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/50 opacity-0 transition group-hover:opacity-100">
              <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
                Replace
              </Button>
              <Button size="sm" variant="danger" onClick={() => onChange(null)}>
                Remove
              </Button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex size-full flex-col items-center justify-center gap-1 p-2 text-sm text-slate-500">
            {busy ? <LoaderCircle className="size-5 shrink-0 animate-spin text-brand" /> : <ImagePlus className="size-5 shrink-0 text-slate-400" />}
            <span className="font-medium">{busy ? 'Uploading...' : label}</span>
            {/* Only when the box is wide enough; small boxes (e.g. favicon) just show the label. */}
            <span className="hidden text-center text-xs text-slate-400 @min-[11rem]:block">JPG, PNG, WebP · max 10 MB</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? undefined)} />
    </div>
  )
}

/** Ordered list of images (first one is the main image). */
export function ImageListEditor({ images, onChange, folder }: { images: { url: string; altText?: string | null }[]; onChange: (images: { url: string; altText?: string | null }[]) => void; folder: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(files.length)
    const uploaded: { url: string }[] = []
    for (const file of Array.from(files)) {
      const url = await uploadFile(file, folder)
      if (url) uploaded.push({ url })
      setBusy((n) => n - 1)
    }
    onChange([...images, ...uploaded])
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return
    const next = [...images]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item!)
    onChange(next)
  }
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {images.map((image, i) => (
          <div key={image.url + i} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img src={img(image.url, 240)} alt="" className="aspect-square w-full object-contain p-2" />
            {i === 0 && <span className="absolute top-1.5 left-1.5 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">MAIN</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-white/90 p-1 opacity-0 transition group-hover:opacity-100">
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="Move left">
                <ChevronUp className="size-4 -rotate-90" />
              </button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="Move right">
                <ChevronDown className="size-4 -rotate-90" />
              </button>
              <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} className="rounded p-1 text-rose-600 hover:bg-rose-50" aria-label="Remove image">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            addFiles(e.dataTransfer.files)
          }}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-brand hover:text-brand"
        >
          {busy > 0 ? <LoaderCircle className="size-5 animate-spin" /> : <Upload className="size-5" />}
          <span className="text-xs font-medium">{busy > 0 ? `Uploading ${busy}...` : 'Add images'}</span>
        </button>
      </div>
      <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => addFiles(e.target.files)} />
      <p className="mt-2 text-xs text-slate-500">The first image is the main product image. Drag files here or click to upload. Use square images (e.g. 1000×1000) on a white background for best results.</p>
    </div>
  )
}
