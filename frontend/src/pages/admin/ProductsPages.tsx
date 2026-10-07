import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, Package, Plus, Star, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ActiveBadge, Card, DataTable, ImageListEditor, PageHeader, SearchInput, useConfirm } from '@/components/admin/Common'
import { OptionsEditor, PasteSpecsButton, regenerateVariants, RowsEditor, VariantsTable } from '@/components/admin/ProductEditors'
import { RichTextEditor } from '@/components/admin/RichTextEditor'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Badge, PageLoader } from '@/components/ui/Feedback'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Form'
import { Pagination } from '@/components/ui/Misc'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useSettings } from '@/hooks/useStore'
import { errorMessage, http } from '@/lib/api'
import type { AdminProduct, AdminProductListItem, Lookups, ProductForm } from '@/lib/adminTypes'
import { formatDate, money } from '@/lib/format'
import type { Paged } from '@/lib/types'
import { cn, img } from '@/lib/utils'

export function useLookups() {
  return useQuery({ queryKey: ['admin', 'lookups'], queryFn: () => http.get<Lookups>('/admin/lookups'), staleTime: 60_000 })
}

// ---------------------------------------------------------------- list

export function ProductsPage() {
  useDocumentMeta({ title: 'Products', noIndex: true })
  const navigate = useNavigate()
  const client = useQueryClient()
  const settings = useSettings()
  const { data: lookups } = useLookups()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<number[]>([])
  const [confirm, confirmDialog] = useConfirm()
  const get = (k: string) => params.get(k) ?? ''
  const page = Number(params.get('page') ?? 1)
  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
    setSelected([])
  }

  const query = { q: get('q'), categoryId: get('category'), brandId: get('brand'), status: get('status'), stock: get('stock'), sort: get('sort'), page, pageSize: 20 }
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'products', query],
    queryFn: () => http.get<Paged<AdminProductListItem>>('/admin/products', query),
    placeholderData: keepPreviousData,
  })

  const bulk = useMutation({
    mutationFn: (action: string) => http.post<{ affected: number }>('/admin/products/bulk', { ids: selected, action }),
    onSuccess: (r, action) => {
      toast.success(`${r.affected} product(s) ${action === 'delete' ? 'deleted' : 'updated'}`)
      setSelected([])
      client.invalidateQueries({ queryKey: ['admin', 'products'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const low = settings?.checkout.lowStockThreshold ?? 5
  const allSelected = !!data?.items.length && data.items.every((p) => selected.includes(p.id))

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Products"
        description={data ? `${data.totalCount} products in your catalog` : 'Manage your catalog'}
        actions={
          <ButtonLink to="/admin/products/new">
            <Plus className="size-4" /> Add product
          </ButtonLink>
        }
      />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <SearchInput value={get('q')} onChange={(v) => set({ q: v })} placeholder="Search name or SKU..." className="w-full sm:w-64" />
          <Select value={get('category')} onChange={(e) => set({ category: e.target.value })} className="w-auto max-w-56">
            <option value="">All categories</option>
            {lookups?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.path}
              </option>
            ))}
          </Select>
          <Select value={get('brand')} onChange={(e) => set({ brand: e.target.value })} className="w-auto">
            <option value="">All brands</option>
            {lookups?.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select value={get('status')} onChange={(e) => set({ status: e.target.value })} className="w-auto">
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="draft">Hidden</option>
          </Select>
          <Select value={get('stock')} onChange={(e) => set({ stock: e.target.value })} className="w-auto">
            <option value="">Any stock</option>
            <option value="in">In stock</option>
            <option value="low">Low stock (≤{low})</option>
            <option value="out">Out of stock</option>
          </Select>
          <Select value={get('sort')} onChange={(e) => set({ sort: e.target.value })} className="w-auto">
            <option value="">Newest</option>
            <option value="updated">Recently updated</option>
            <option value="name">Name</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
            <option value="stock">Stock ↑</option>
            <option value="sold">Best selling</option>
          </Select>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-brand-softer px-4 py-2.5 text-sm">
            <span className="font-semibold text-slate-900">{selected.length} selected</span>
            <Button size="xs" variant="outline" onClick={() => bulk.mutate('activate')}>
              Activate
            </Button>
            <Button size="xs" variant="outline" onClick={() => bulk.mutate('deactivate')}>
              Hide
            </Button>
            <Button size="xs" variant="outline" onClick={() => bulk.mutate('feature')}>
              Feature
            </Button>
            <Button size="xs" variant="outline" onClick={() => bulk.mutate('unfeature')}>
              Unfeature
            </Button>
            <Button
              size="xs"
              variant="danger"
              onClick={async () => {
                if (await confirm({ title: `Delete ${selected.length} product(s)?`, message: 'This permanently removes the products and their reviews. Past orders keep their item details.', confirmLabel: 'Delete', danger: true }))
                  bulk.mutate('delete')
              }}
            >
              Delete
            </Button>
          </div>
        )}

        <DataTable
          className={cn(isFetching && 'opacity-70')}
          rows={data?.items}
          loading={isLoading}
          rowKey={(p) => p.id}
          empty={
            <span>
              No products found. <Link to="/admin/products/new" className="font-semibold text-brand">Add your first product</Link>
            </span>
          }
          columns={[
            {
              header: <input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? (data?.items.map((p) => p.id) ?? []) : [])} aria-label="Select all" className="size-4 accent-[var(--brand)]" />,
              cell: (p) => <input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))} aria-label={`Select ${p.name}`} className="size-4 accent-[var(--brand)]" />,
              className: 'w-10',
              headerClass: 'w-10',
            },
            {
              header: 'Product',
              cell: (p) => (
                <Link to={`/admin/products/${p.id}`} className="flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                    {p.imageUrl ? <img src={img(p.imageUrl, 96)} alt="" className="size-10 object-contain" /> : <Package className="size-5 text-slate-300" />}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 font-medium text-slate-900 hover:text-brand">
                      {p.isFeatured && <Star className="mr-1 inline size-3.5 fill-amber-400 text-amber-400" />}
                      {p.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {[p.sku, p.variantCount > 1 && `${p.variantCount} variants`, p.brandName].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              ),
            },
            { header: 'Category', cell: (p) => <span className="text-slate-600">{p.categoryName}</span> },
            {
              header: 'Price',
              cell: (p) =>
                p.hidePrice ? (
                  <Badge tone="brand">Call for price</Badge>
                ) : (
                  <div className="whitespace-nowrap">
                    <span className="font-semibold text-slate-900">{money(p.price)}</span>
                    {p.compareAtPrice && <span className="ml-1.5 text-xs text-slate-400 line-through">{money(p.compareAtPrice)}</span>}
                  </div>
                ),
            },
            {
              header: 'Stock',
              cell: (p) =>
                !p.trackInventory ? (
                  <span className="text-slate-400">Not tracked</span>
                ) : p.isPreOrder ? (
                  <Badge tone="amber">Pre-order</Badge>
                ) : (
                  <span className={cn('font-semibold', p.stockQuantity <= 0 ? 'text-rose-600' : p.stockQuantity <= low ? 'text-amber-600' : 'text-slate-700')}>
                    {p.stockQuantity <= 0 ? 'Out of stock' : p.stockQuantity}
                  </span>
                ),
            },
            { header: 'Sold', cell: (p) => p.soldCount },
            { header: 'Status', cell: (p) => <ActiveBadge active={p.isActive} /> },
            { header: 'Updated', cell: (p) => <span className="text-xs whitespace-nowrap text-slate-500">{formatDate(p.updatedAt)}</span> },
            {
              header: '',
              cell: (p) => (
                <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="View in store" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="size-4" />
                </a>
              ),
            },
          ]}
          onRowClick={(p) => navigate(`/admin/products/${p.id}`)}
        />
        {data && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              Page {data.page} of {Math.max(1, data.totalPages)}
            </span>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => set({ page: String(p) })} />
          </div>
        )}
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- editor

const emptyProduct: ProductForm = {
  name: '',
  slug: '',
  sku: '',
  categoryId: 0,
  brandId: null,
  shortDescription: '',
  description: '',
  warrantyInfo: '',
  badge: '',
  videoUrl: '',
  tags: '',
  trackInventory: true,
  isPreOrder: false,
  hidePrice: false,
  isActive: true,
  isFeatured: false,
  sortOrder: 0,
  options: [],
  specifications: [],
  faqs: [],
  images: [],
  variants: [{ price: 0, compareAtPrice: null, costPrice: null, stockQuantity: 0, isActive: true }],
  metaTitle: '',
  metaDescription: '',
}

export function ProductEditPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const client = useQueryClient()
  const { data: lookups } = useLookups()
  const [confirm, confirmDialog] = useConfirm()
  const [form, setForm] = useState<ProductForm>(emptyProduct)
  const [hasVariants, setHasVariants] = useState(false)
  const [dirty, setDirty] = useState(false)

  const { data: product, isLoading } = useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: () => http.get<AdminProduct>(`/admin/products/${id}`),
    enabled: !isNew,
  })
  useDocumentMeta({ title: isNew ? 'New product' : (product?.name ?? 'Product'), noIndex: true })

  useEffect(() => {
    if (product) {
      setForm({ ...product })
      setHasVariants(product.options.length > 0)
      setDirty(false)
    }
  }, [product])

  const update = (patch: Partial<ProductForm>) => {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
  }

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, options: hasVariants ? form.options : [], variants: hasVariants ? form.variants : form.variants.slice(0, 1) }
      return isNew ? http.post<AdminProduct>('/admin/products', body) : http.put<AdminProduct>(`/admin/products/${id}`, body)
    },
    onSuccess: (saved) => {
      toast.success(isNew ? 'Product created' : 'Product saved')
      setDirty(false)
      client.invalidateQueries({ queryKey: ['admin', 'products'] })
      client.setQueryData(['admin', 'product', String(saved.id)], saved)
      if (isNew) navigate(`/admin/products/${saved.id}`, { replace: true })
      else setForm({ ...saved })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const duplicate = useMutation({
    mutationFn: () => http.post<{ id: number }>(`/admin/products/${id}/duplicate`),
    onSuccess: (r) => {
      toast.success('Copy created (hidden until you activate it)')
      navigate(`/admin/products/${r.id}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: () => http.delete(`/admin/products/${id}`),
    onSuccess: () => {
      toast.success('Product deleted')
      client.invalidateQueries({ queryKey: ['admin', 'products'] })
      navigate('/admin/products')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (!isNew && (isLoading || !product)) return <PageLoader />

  const base = form.variants[0] ?? emptyProduct.variants[0]!
  const setBase = (patch: Partial<typeof base>) => update({ variants: [{ ...base, ...patch }, ...form.variants.slice(1)] })
  const num = (value: string) => (value === '' ? null : Number(value))

  return (
    <div>
      {confirmDialog}
      <PageHeader
        back="/admin/products"
        title={isNew ? 'Add product' : form.name || 'Edit product'}
        description={!isNew && product ? `Created ${formatDate(product.createdAt)} · ${product.soldCount} sold · ${product.viewCount} views` : 'Fill in the details below and save.'}
        actions={
          <>
            {!isNew && product && (
              <>
                <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <ExternalLink className="size-4" /> View
                </a>
                <Button variant="outline" leftIcon={<Copy className="size-4" />} loading={duplicate.isPending} onClick={() => duplicate.mutate()}>
                  Duplicate
                </Button>
              </>
            )}
            <Button loading={save.isPending} onClick={() => save.mutate()} disabled={!form.name.trim()}>
              {isNew ? 'Create product' : dirty ? 'Save changes' : 'Saved'}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Basic information">
            <div className="space-y-4">
              <Field label="Product name" required>
                <Input value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Samsung Galaxy S25 Ultra 5G" />
              </Field>
              <Field label="Key highlights" hint="Shown next to the price. A short bullet list works best.">
                <RichTextEditor compact minHeight="min-h-[110px]" value={form.shortDescription} onChange={(html) => update({ shortDescription: html })} folder="products" />
              </Field>
              <Field label="Full description">
                <RichTextEditor value={form.description} onChange={(html) => update({ description: html })} folder="products" />
              </Field>
            </div>
          </Card>

          <Card title="Images">
            <ImageListEditor images={form.images} onChange={(images) => update({ images })} folder="products" />
          </Card>

          <Card title="Pricing & inventory" actions={<Switch checked={hasVariants} onChange={(v) => {
            setHasVariants(v)
            setDirty(true)
            if (v && form.options.length === 0) update({ options: [{ name: 'Color', values: [] }] })
            if (!v) update({ options: [], variants: [{ ...base, option1: null, option2: null, option3: null }] })
          }} label="Has variants" />}>
            {hasVariants ? (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Options</p>
                  <OptionsEditor options={form.options} onChange={(options) => update({ options, variants: regenerateVariants(options, form.variants) })} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Variants ({form.variants.length})</p>
                  <VariantsTable variants={form.variants} images={form.images} onChange={(variants) => update({ variants })} />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Price (৳)" required>
                  <Input type="number" min={0} value={base.price} onChange={(e) => setBase({ price: Number(e.target.value) })} />
                </Field>
                <Field label="Compare-at price" hint="Original price, shown crossed out">
                  <Input type="number" min={0} value={base.compareAtPrice ?? ''} onChange={(e) => setBase({ compareAtPrice: num(e.target.value) })} />
                </Field>
                <Field label="Cost price" hint="For profit reports. Not shown to customers.">
                  <Input type="number" min={0} value={base.costPrice ?? ''} onChange={(e) => setBase({ costPrice: num(e.target.value) })} />
                </Field>
                <Field label="Stock quantity">
                  <Input type="number" min={0} value={base.stockQuantity} onChange={(e) => setBase({ stockQuantity: Number(e.target.value) })} />
                </Field>
                <Field label="SKU / product code">
                  <Input value={base.sku ?? ''} onChange={(e) => setBase({ sku: e.target.value })} />
                </Field>
              </div>
            )}
            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-3">
              <Switch checked={form.trackInventory} onChange={(v) => update({ trackInventory: v })} label="Track stock" description="Stops orders when stock runs out." />
              <Switch checked={form.isPreOrder} onChange={(v) => update({ isPreOrder: v })} label="Allow pre-orders" description="Customers can order while out of stock." />
              <Switch checked={form.hidePrice} onChange={(v) => update({ hidePrice: v })} label="Call for price" description="Hide the price and disable online ordering." />
            </div>
          </Card>

          <Card title="Specifications" actions={<PasteSpecsButton onPaste={(rows) => update({ specifications: [...form.specifications, ...rows] })} />}>
            <RowsEditor
              rows={form.specifications}
              onChange={(specifications) => update({ specifications })}
              empty="No specifications yet. Add rows like “Battery: 5000mAh”."
              addLabel="Add specification"
              create={() => ({ name: '', value: '' })}
              render={(row, set) => (
                <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
                  <Input value={row.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name (e.g. Display)" />
                  <Input value={row.value} onChange={(e) => set({ value: e.target.value })} placeholder="Value" />
                </div>
              )}
            />
          </Card>

          <Card title="Frequently asked questions">
            <RowsEditor
              rows={form.faqs}
              onChange={(faqs) => update({ faqs })}
              empty="Answer common questions to reduce calls and improve SEO."
              addLabel="Add question"
              create={() => ({ question: '', answer: '' })}
              render={(row, set) => (
                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <Input value={row.question} onChange={(e) => set({ question: e.target.value })} placeholder="Question" />
                  <Textarea rows={2} value={row.answer} onChange={(e) => set({ answer: e.target.value })} placeholder="Answer" />
                </div>
              )}
            />
          </Card>

          <Card title="Search engine listing" description="Customize how this product appears on Google and social media.">
            <div className="space-y-4">
              <Field label="URL slug" hint={`grabity.com/product/${form.slug || 'auto-generated-from-name'}`}>
                <Input value={form.slug ?? ''} onChange={(e) => update({ slug: e.target.value })} placeholder="Leave empty to generate from the name" />
              </Field>
              <Field label="Meta title" hint={`${(form.metaTitle ?? '').length}/70 characters`}>
                <Input value={form.metaTitle ?? ''} onChange={(e) => update({ metaTitle: e.target.value })} placeholder={form.name ? `${form.name} Price in Bangladesh` : ''} />
              </Field>
              <Field label="Meta description" hint={`${(form.metaDescription ?? '').length}/160 characters`}>
                <Textarea rows={3} value={form.metaDescription ?? ''} onChange={(e) => update({ metaDescription: e.target.value })} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status">
            <div className="space-y-4">
              <Switch checked={form.isActive} onChange={(v) => update({ isActive: v })} label="Visible in store" description="Hidden products can't be seen or ordered." />
              <Switch checked={form.isFeatured} onChange={(v) => update({ isFeatured: v })} label="Featured" description="Show in “Featured” sections." />
              <Field label="Sort order" hint="Lower numbers appear first when sorting manually.">
                <Input type="number" value={form.sortOrder} onChange={(e) => update({ sortOrder: Number(e.target.value) })} />
              </Field>
            </div>
          </Card>

          <Card title="Organization">
            <div className="space-y-4">
              <Field label="Category" required>
                <Select value={form.categoryId || ''} onChange={(e) => update({ categoryId: Number(e.target.value) })}>
                  <option value="">Choose a category</option>
                  {lookups?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.path}
                      {!c.isActive && ' (hidden)'}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Brand">
                <Select value={form.brandId ?? ''} onChange={(e) => update({ brandId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">No brand</option>
                  {lookups?.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Badge" hint="Short label on product cards, e.g. “Official Warranty”.">
                <Input value={form.badge ?? ''} onChange={(e) => update({ badge: e.target.value })} maxLength={50} />
              </Field>
              <Field label="Search keywords" hint="Comma separated. Helps customers find this product.">
                <Input value={form.tags ?? ''} onChange={(e) => update({ tags: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card title="Extras">
            <div className="space-y-4">
              <Field label="Warranty">
                <Input value={form.warrantyInfo ?? ''} onChange={(e) => update({ warrantyInfo: e.target.value })} placeholder="e.g. 1 Year Official Warranty" />
              </Field>
              <Field label="YouTube video URL">
                <Input value={form.videoUrl ?? ''} onChange={(e) => update({ videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
              </Field>
            </div>
          </Card>

          {!isNew && (
            <Button
              variant="ghost"
              className="w-full text-rose-600 hover:bg-rose-50"
              leftIcon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await confirm({ title: 'Delete this product?', message: 'This also removes its reviews. Past orders keep their item details.', confirmLabel: 'Delete product', danger: true })) remove.mutate()
              }}
            >
              Delete product
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
