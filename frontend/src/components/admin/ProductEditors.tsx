import { ArrowDown, ArrowUp, ClipboardPaste, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Overlay'
import type { VariantInput } from '@/lib/adminTypes'
import type { ProductOption } from '@/lib/types'
import { cn, img } from '@/lib/utils'

/** Text field that turns Enter/comma-separated entries into removable chips. */
export function TagInput({ values, onChange, placeholder }: { values: string[]; onChange: (values: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState('')
  const commit = () => {
    const parts = text
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const next = [...values]
    for (const part of parts) if (!next.some((v) => v.toLowerCase() === part.toLowerCase())) next.push(part)
    onChange(next)
    setText('')
  }
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-brand focus-within:ring-3 focus-within:ring-brand-ring">
      {values.map((value) => (
        <span key={value} className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pr-1 pl-2 text-sm text-slate-700">
          {value}
          <button type="button" onClick={() => onChange(values.filter((v) => v !== value))} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label={`Remove ${value}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Backspace' && !text && values.length) {
            onChange(values.slice(0, -1))
          }
        }}
        onBlur={commit}
        placeholder={values.length ? '' : placeholder}
        className="h-7 min-w-28 flex-1 bg-transparent px-1 text-sm outline-none"
      />
    </div>
  )
}

const optionValueAt = (v: VariantInput, i: number) => [v.option1, v.option2, v.option3][i] ?? null

export function variantTitle(v: VariantInput) {
  return [v.option1, v.option2, v.option3].filter(Boolean).join(' / ')
}

/** Rebuilds the variant list for the given options, keeping prices/stock of combinations that still exist. */
export function regenerateVariants(options: ProductOption[], current: VariantInput[]): VariantInput[] {
  const usable = options.filter((o) => o.name.trim() && o.values.length > 0)
  const base = current[0] ?? { price: 0, stockQuantity: 0, isActive: true }
  if (usable.length === 0) return [{ ...base, option1: null, option2: null, option3: null }]

  let combos: string[][] = [[]]
  for (const option of usable) combos = combos.flatMap((combo) => option.values.map((value) => [...combo, value]))

  return combos.map((combo) => {
    const existing = current.find((v) => combo.every((value, i) => (optionValueAt(v, i) ?? '').toLowerCase() === value.toLowerCase()))
    return {
      ...(existing ?? { price: base.price, compareAtPrice: base.compareAtPrice, costPrice: base.costPrice, stockQuantity: 0, isActive: true }),
      option1: combo[0] ?? null,
      option2: combo[1] ?? null,
      option3: combo[2] ?? null,
    }
  })
}

export function OptionsEditor({ options, onChange }: { options: ProductOption[]; onChange: (options: ProductOption[]) => void }) {
  const update = (index: number, patch: Partial<ProductOption>) => onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  const suggestions = ['Color', 'Storage', 'Warranty', 'Size', 'Region', 'Pack']
  return (
    <div className="space-y-3">
      {options.map((option, index) => (
        <div key={index} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[180px_1fr_auto]">
          <Input value={option.name} onChange={(e) => update(index, { name: e.target.value })} placeholder="Option name, e.g. Color" list="option-names" />
          <TagInput values={option.values} onChange={(values) => update(index, { values })} placeholder="Type a value and press Enter (e.g. Black)" />
          <Button variant="ghost" size="icon" onClick={() => onChange(options.filter((_, i) => i !== index))} aria-label="Remove option" className="text-slate-500 hover:text-rose-600">
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <datalist id="option-names">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {options.length < 3 && (
        <Button variant="outline" size="sm" leftIcon={<Plus className="size-4" />} onClick={() => onChange([...options, { name: suggestions.find((s) => !options.some((o) => o.name === s)) ?? '', values: [] }])}>
          Add option
        </Button>
      )}
    </div>
  )
}

export function VariantsTable({ variants, images, onChange }: { variants: VariantInput[]; images: { url: string }[]; onChange: (variants: VariantInput[]) => void }) {
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkStock, setBulkStock] = useState('')
  const update = (index: number, patch: Partial<VariantInput>) => onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  const num = (value: string) => (value === '' ? null : Number(value))
  const cell = 'h-9 w-full rounded-md border border-slate-300 px-2 text-sm outline-none focus:border-brand'

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Apply to all:</span>
        <input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} type="number" placeholder="Price" className="h-8 w-28 rounded-md border border-slate-300 px-2 outline-none focus:border-brand" />
        <Button size="xs" variant="secondary" disabled={!bulkPrice} onClick={() => onChange(variants.map((v) => ({ ...v, price: Number(bulkPrice) })))}>
          Set price
        </Button>
        <input value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} type="number" placeholder="Stock" className="h-8 w-24 rounded-md border border-slate-300 px-2 outline-none focus:border-brand" />
        <Button size="xs" variant="secondary" disabled={!bulkStock} onClick={() => onChange(variants.map((v) => ({ ...v, stockQuantity: Number(bulkStock) })))}>
          Set stock
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2.5">Variant</th>
              <th className="px-2 py-2.5">Price ৳</th>
              <th className="px-2 py-2.5">Compare at</th>
              <th className="px-2 py-2.5">Cost</th>
              <th className="px-2 py-2.5">Stock</th>
              <th className="px-2 py-2.5">SKU</th>
              <th className="px-2 py-2.5">Image</th>
              <th className="px-2 py-2.5 text-center">On</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {variants.map((v, i) => (
              <tr key={`${variantTitle(v)}-${i}`} className={cn(!v.isActive && 'bg-slate-50 opacity-60')}>
                <td className="px-3 py-2 font-medium whitespace-nowrap text-slate-900">{variantTitle(v) || 'Default'}</td>
                <td className="px-2 py-2">
                  <input type="number" min={0} value={v.price} onChange={(e) => update(i, { price: Number(e.target.value) })} className={cell} />
                </td>
                <td className="px-2 py-2">
                  <input type="number" min={0} value={v.compareAtPrice ?? ''} onChange={(e) => update(i, { compareAtPrice: num(e.target.value) })} className={cell} />
                </td>
                <td className="px-2 py-2">
                  <input type="number" min={0} value={v.costPrice ?? ''} onChange={(e) => update(i, { costPrice: num(e.target.value) })} className={cell} />
                </td>
                <td className="px-2 py-2">
                  <input type="number" min={0} value={v.stockQuantity} onChange={(e) => update(i, { stockQuantity: Number(e.target.value) })} className={cn(cell, v.stockQuantity <= 0 && 'border-rose-300 bg-rose-50')} />
                </td>
                <td className="px-2 py-2">
                  <input value={v.sku ?? ''} onChange={(e) => update(i, { sku: e.target.value })} className={cell} />
                </td>
                <td className="px-2 py-2">
                  <select value={v.imageUrl ?? ''} onChange={(e) => update(i, { imageUrl: e.target.value || null })} className={cn(cell, 'w-28')}>
                    <option value="">Main</option>
                    {images.map((image, n) => (
                      <option key={image.url + n} value={image.url}>
                        Image {n + 1}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 text-center">
                  <input type="checkbox" checked={v.isActive} onChange={(e) => update(i, { isActive: e.target.checked })} className="size-4 accent-[var(--brand)]" aria-label="Variant available" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {variants.some((v) => v.imageUrl) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {variants
            .filter((v) => v.imageUrl)
            .map((v, i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-lg bg-slate-50 py-1 pr-2 pl-1 text-xs text-slate-600">
                <img src={img(v.imageUrl, 48)} alt="" className="size-6 rounded object-contain" />
                {variantTitle(v)}
              </span>
            ))}
        </div>
      )}
    </div>
  )
}

/** Editable list of rows with up/down/remove controls. */
export function RowsEditor<T>({
  rows,
  onChange,
  empty,
  render,
  create,
  addLabel,
}: {
  rows: T[]
  onChange: (rows: T[]) => void
  empty: string
  render: (row: T, update: (patch: Partial<T>) => void) => React.ReactNode
  create: () => T
  addLabel: string
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return
    const next = [...rows]
    const [row] = next.splice(from, 1)
    next.splice(to, 0, row!)
    onChange(next)
  }
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">{empty}</p>}
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">{render(row, (patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))))}</div>
          <div className="flex shrink-0 flex-col">
            <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label="Move up">
              <ArrowUp className="size-3.5" />
            </button>
            <button type="button" onClick={() => move(i, i + 1)} disabled={i === rows.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label="Move down">
              <ArrowDown className="size-3.5" />
            </button>
          </div>
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="mt-1.5 rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove row">
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <Button variant="outline" size="sm" leftIcon={<Plus className="size-4" />} onClick={() => onChange([...rows, create()])}>
        {addLabel}
      </Button>
    </div>
  )
}

/** Paste "Name: Value" lines to quickly fill the specification table. */
export function PasteSpecsButton({ onPaste }: { onPaste: (rows: { name: string; value: string }[]) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const parse = () => {
    const rows = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^([^:\t|]+)[:\t|]\s*(.+)$/)
        return match ? { name: match[1]!.trim(), value: match[2]!.trim() } : null
      })
      .filter((r): r is { name: string; value: string } => !!r)
    onPaste(rows)
    setText('')
    setOpen(false)
  }
  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<ClipboardPaste className="size-4" />} onClick={() => setOpen(true)}>
        Paste list
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Paste specifications"
        description="One per line, as “Name: Value” (tabs from a spreadsheet work too)."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={parse} disabled={!text.trim()}>
              Add rows
            </Button>
          </>
        }
      >
        <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Display: 6.7 inch AMOLED\nBattery: 5000mAh\nWarranty: 1 Year'} className="font-mono text-xs" />
      </Modal>
    </>
  )
}
