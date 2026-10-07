import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileText,
  FolderTree,
  Images,
  LayoutGrid,
  MessageSquareText,
  Newspaper,
  Package,
  Pencil,
  Plus,
  Rows3,
  Tag,
  TicketPercent,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ActiveBadge, Card, DataTable, ImageUpload, PageHeader, SearchInput, useConfirm } from '@/components/admin/Common'
import { RichTextEditor } from '@/components/admin/RichTextEditor'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { Field, Input, Select, Switch } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Overlay'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { errorMessage, http } from '@/lib/api'
import type { AdminBanner, AdminCoupon, AdminHomeSection, HomeSectionConfig, HomeSectionTab } from '@/lib/adminTypes'
import { formatDate, money } from '@/lib/format'
import type { BannerPlacement, DiscountType, HomeSectionType, ProductSource, SearchSuggestion } from '@/lib/types'
import { cn, img } from '@/lib/utils'
import { useLookups } from './ProductsPages'

/** datetime-local <-> ISO helpers (inputs work in local time). */
const toLocalInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null)

// ---------------------------------------------------------------- coupons

type CouponForm = Omit<AdminCoupon, 'id' | 'usedCount' | 'createdAt'>
const emptyCoupon: CouponForm = { code: '', description: '', type: 'Percentage', value: 10, minOrderAmount: null, maxDiscountAmount: null, startsAt: null, expiresAt: null, usageLimit: null, usageLimitPerCustomer: null, isActive: true }

function couponState(c: AdminCoupon): { label: string; tone: 'green' | 'slate' | 'amber' | 'red' } {
  const now = Date.now()
  if (!c.isActive) return { label: 'Inactive', tone: 'slate' }
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: 'Scheduled', tone: 'amber' }
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return { label: 'Expired', tone: 'red' }
  if (c.usageLimit && c.usedCount >= c.usageLimit) return { label: 'Used up', tone: 'red' }
  return { label: 'Active', tone: 'green' }
}

export function CouponsPage() {
  useDocumentMeta({ title: 'Coupons', noIndex: true })
  const client = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const [editing, setEditing] = useState<{ id?: number; form: CouponForm } | null>(null)
  const { data: coupons, isLoading } = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => http.get<AdminCoupon[]>('/admin/coupons') })
  const save = useMutation({
    mutationFn: () => (editing?.id ? http.put(`/admin/coupons/${editing.id}`, editing.form) : http.post('/admin/coupons', editing!.form)),
    onSuccess: () => {
      toast.success('Coupon saved')
      setEditing(null)
      client.invalidateQueries({ queryKey: ['admin', 'coupons'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => http.delete(`/admin/coupons/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const form = editing?.form
  const set = (patch: Partial<CouponForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e))
  const describe = (c: CouponForm) =>
    c.type === 'Percentage' ? `${c.value}% off${c.maxDiscountAmount ? ` (max ${money(c.maxDiscountAmount)})` : ''}` : c.type === 'FixedAmount' ? `${money(c.value)} off` : 'Free delivery'

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Coupons"
        description="Discount codes customers can enter at checkout."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing({ form: { ...emptyCoupon } })}>
            Create coupon
          </Button>
        }
      />
      <Card bodyClass="p-0">
        <DataTable
          rows={coupons}
          loading={isLoading}
          rowKey={(c) => c.id}
          empty={<EmptyState icon={<TicketPercent className="size-6" />} title="No coupons yet" description="Create a code like WELCOME10 to reward new customers." />}
          columns={[
            {
              header: 'Code',
              cell: (c) => (
                <div>
                  <p className="font-mono font-bold text-slate-900">{c.code}</p>
                  {c.description && <p className="text-xs text-slate-500">{c.description}</p>}
                </div>
              ),
            },
            { header: 'Discount', cell: (c) => describe(c) },
            { header: 'Min. order', cell: (c) => (c.minOrderAmount ? money(c.minOrderAmount) : '—') },
            { header: 'Used', cell: (c) => `${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ''}` },
            {
              header: 'Valid',
              cell: (c) => (
                <span className="text-xs text-slate-500">
                  {c.startsAt ? formatDate(c.startsAt) : 'Now'} → {c.expiresAt ? formatDate(c.expiresAt) : 'No end'}
                </span>
              ),
            },
            {
              header: 'Status',
              cell: (c) => {
                const s = couponState(c)
                return (
                  <Badge tone={s.tone} dot>
                    {s.label}
                  </Badge>
                )
              },
            },
            {
              header: '',
              cell: (c) => (
                <div className="flex justify-end gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditing({ id: c.id, form: { ...c } })} aria-label="Edit coupon">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-rose-600"
                    aria-label="Delete coupon"
                    onClick={async () => {
                      if (await confirm({ title: `Delete ${c.code}?`, confirmLabel: 'Delete', danger: true })) remove.mutate(c.id)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing?.id ? 'Edit coupon' : 'Create coupon'}
        footer={
          <Button loading={save.isPending} onClick={() => save.mutate()} disabled={!form?.code.trim()}>
            Save coupon
          </Button>
        }
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" required hint="Letters and numbers, e.g. EID500">
              <Input value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, '') })} className="font-mono uppercase" />
            </Field>
            <Field label="Discount type">
              <Select value={form.type} onChange={(e) => set({ type: e.target.value as DiscountType })}>
                <option value="Percentage">Percentage off</option>
                <option value="FixedAmount">Fixed amount off</option>
                <option value="FreeShipping">Free delivery</option>
              </Select>
            </Field>
            {form.type !== 'FreeShipping' && (
              <Field label={form.type === 'Percentage' ? 'Percent off' : 'Amount off (৳)'} required>
                <Input type="number" min={0} value={form.value} onChange={(e) => set({ value: Number(e.target.value) })} />
              </Field>
            )}
            {form.type === 'Percentage' && (
              <Field label="Maximum discount (৳)" hint="Optional cap">
                <Input type="number" min={0} value={form.maxDiscountAmount ?? ''} onChange={(e) => set({ maxDiscountAmount: e.target.value ? Number(e.target.value) : null })} />
              </Field>
            )}
            <Field label="Minimum order (৳)">
              <Input type="number" min={0} value={form.minOrderAmount ?? ''} onChange={(e) => set({ minOrderAmount: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Input value={form.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Internal note or customer-facing summary" />
            </Field>
            <Field label="Starts">
              <Input type="datetime-local" value={toLocalInput(form.startsAt)} onChange={(e) => set({ startsAt: fromLocalInput(e.target.value) })} />
            </Field>
            <Field label="Expires">
              <Input type="datetime-local" value={toLocalInput(form.expiresAt)} onChange={(e) => set({ expiresAt: fromLocalInput(e.target.value) })} />
            </Field>
            <Field label="Total uses allowed" hint="Empty = unlimited">
              <Input type="number" min={1} value={form.usageLimit ?? ''} onChange={(e) => set({ usageLimit: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Uses per customer" hint="Counted by phone number">
              <Input type="number" min={1} value={form.usageLimitPerCustomer ?? ''} onChange={(e) => set({ usageLimitPerCustomer: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Switch checked={form.isActive} onChange={(v) => set({ isActive: v })} label="Active" className="sm:col-span-2" />
          </div>
        )}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------- banners

const placements: { value: BannerPlacement; label: string; hint: string; aspect: string }[] = [
  { value: 'HeroSlider', label: 'Hero slider', hint: 'Large rotating slides at the top of the homepage. Recommended 1280 × 600 px.', aspect: 'aspect-[2.13/1]' },
  { value: 'HeroSide', label: 'Side banners', hint: 'Two promo tiles beside the slider. Recommended 640 × 290 px.', aspect: 'aspect-[2.2/1]' },
  { value: 'Popup', label: 'Popup', hint: 'Shown once per visit when the homepage opens. Recommended 800 × 800 px.', aspect: 'aspect-square' },
]

type BannerForm = Omit<AdminBanner, 'id'>

export function BannersPage() {
  useDocumentMeta({ title: 'Banners', noIndex: true })
  const client = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const [placement, setPlacement] = useState<BannerPlacement>('HeroSlider')
  const [editing, setEditing] = useState<{ id?: number; form: BannerForm } | null>(null)
  const { data: banners, isLoading } = useQuery({ queryKey: ['admin', 'banners'], queryFn: () => http.get<AdminBanner[]>('/admin/banners') })
  const save = useMutation({
    mutationFn: () => (editing?.id ? http.put(`/admin/banners/${editing.id}`, editing.form) : http.post('/admin/banners', editing!.form)),
    onSuccess: () => {
      toast.success('Banner saved')
      setEditing(null)
      client.invalidateQueries({ queryKey: ['admin', 'banners'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => http.delete(`/admin/banners/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'banners'] }),
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (isLoading || !banners) return <PageLoader />
  const meta = placements.find((p) => p.value === placement)!
  const list = banners.filter((b) => b.placement === placement)
  const form = editing?.form
  const set = (patch: Partial<BannerForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e))
  const formMeta = placements.find((p) => p.value === form?.placement) ?? meta

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Banners & popup"
        description="Promotional images on the homepage."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing({ form: { title: '', imageUrl: '', mobileImageUrl: null, linkUrl: '', placement, sortOrder: list.length + 1, isActive: true, startsAt: null, endsAt: null } })}>
            Add banner
          </Button>
        }
      />
      <div className="mb-4 flex rounded-xl border border-slate-200 bg-white p-1 sm:w-fit">
        {placements.map((p) => (
          <button key={p.value} onClick={() => setPlacement(p.value)} className={cn('flex-1 rounded-lg px-4 py-2 text-sm font-medium', placement === p.value ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100')}>
            {p.label} <span className="opacity-70">({banners.filter((b) => b.placement === p.value).length})</span>
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm text-slate-500">{meta.hint}</p>
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Images className="size-6" />} title="No banners here yet" />
        </Card>
      ) : (
        <div className={cn('grid gap-4', placement === 'Popup' ? 'sm:grid-cols-3 lg:grid-cols-4' : 'md:grid-cols-2')}>
          {list.map((banner) => (
            <div key={banner.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <img src={img(banner.imageUrl, 640)} alt="" className={cn('w-full bg-slate-100 object-cover', meta.aspect)} />
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{banner.title || 'Untitled'}</p>
                  <p className="truncate text-xs text-slate-500">{banner.linkUrl || 'No link'} · Order {banner.sortOrder}</p>
                  {(banner.startsAt || banner.endsAt) && (
                    <p className="text-xs text-slate-500">
                      {banner.startsAt ? formatDate(banner.startsAt) : 'Now'} → {banner.endsAt ? formatDate(banner.endsAt) : 'No end'}
                    </p>
                  )}
                </div>
                <ActiveBadge active={banner.isActive} />
              </div>
              <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing({ id: banner.id, form: { ...banner } })}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-rose-600"
                  aria-label="Delete banner"
                  onClick={async () => {
                    if (await confirm({ title: 'Delete this banner?', confirmLabel: 'Delete', danger: true })) remove.mutate(banner.id)
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="xl"
        title={editing?.id ? 'Edit banner' : 'Add banner'}
        footer={
          <Button loading={save.isPending} disabled={!form?.imageUrl} onClick={() => save.mutate()}>
            Save banner
          </Button>
        }
      >
        {form && (
          <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <Field label="Banner image" required hint={formMeta.hint}>
                <ImageUpload value={form.imageUrl} onChange={(url) => set({ imageUrl: url ?? '' })} folder="banners" aspect={formMeta.aspect} label="Upload banner" />
              </Field>
              {form.placement === 'HeroSlider' && (
                <Field label="Mobile image (optional)" hint="A taller image for phones, e.g. 800 × 600 px.">
                  <ImageUpload value={form.mobileImageUrl} onChange={(url) => set({ mobileImageUrl: url })} folder="banners" aspect="aspect-[4/3]" className="max-w-xs" />
                </Field>
              )}
            </div>
            <div className="space-y-4">
              <Field label="Placement">
                <Select value={form.placement} onChange={(e) => set({ placement: e.target.value as BannerPlacement })}>
                  {placements.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Title" hint="Used as the image description for accessibility and SEO.">
                <Input value={form.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field label="Link" hint="e.g. /category/earbuds or /product/airpods-pro">
                <Input value={form.linkUrl ?? ''} onChange={(e) => set({ linkUrl: e.target.value })} />
              </Field>
              <Field label="Sort order">
                <Input type="number" value={form.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
              </Field>
              <Field label="Show from">
                <Input type="datetime-local" value={toLocalInput(form.startsAt)} onChange={(e) => set({ startsAt: fromLocalInput(e.target.value) })} />
              </Field>
              <Field label="Show until">
                <Input type="datetime-local" value={toLocalInput(form.endsAt)} onChange={(e) => set({ endsAt: fromLocalInput(e.target.value) })} />
              </Field>
              <Switch checked={form.isActive} onChange={(v) => set({ isActive: v })} label="Active" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------- homepage sections

const sectionTypes: { type: HomeSectionType; label: string; description: string; icon: LucideIcon }[] = [
  { type: 'Products', label: 'Product row', description: 'A row of products: new arrivals, a category, best sellers...', icon: Package },
  { type: 'ProductTabs', label: 'Tabbed products', description: 'Several product lists switchable with tabs.', icon: Rows3 },
  { type: 'Categories', label: 'Category tiles', description: 'Featured or hand-picked categories.', icon: FolderTree },
  { type: 'Brands', label: 'Brand logos', description: 'Your featured brands.', icon: Tag },
  { type: 'Reviews', label: 'Customer reviews', description: 'Reviews marked as featured.', icon: MessageSquareText },
  { type: 'Blog', label: 'Blog posts', description: 'Latest posts from your blog.', icon: Newspaper },
  { type: 'Banners', label: 'Banner images', description: 'One to three promotional images.', icon: LayoutGrid },
  { type: 'RichText', label: 'Text block', description: 'Free text, e.g. an SEO paragraph about your store.', icon: FileText },
]

const sources: { value: ProductSource; label: string }[] = [
  { value: 'Newest', label: 'Newest products' },
  { value: 'Featured', label: 'Featured products' },
  { value: 'BestSelling', label: 'Best selling' },
  { value: 'OnSale', label: 'On sale (discounted)' },
  { value: 'TopRated', label: 'Top rated' },
  { value: 'Category', label: 'From a category' },
  { value: 'Brand', label: 'From a brand' },
  { value: 'Manual', label: 'Hand-picked products' },
]

const emptyConfig: HomeSectionConfig = { source: 'Newest', categoryId: null, brandId: null, productIds: [], limit: 12, tabs: [], categoryIds: [], images: [], html: '', viewAllUrl: '' }

interface SectionForm {
  title: string
  subtitle?: string | null
  type: HomeSectionType
  config: HomeSectionConfig
  isActive: boolean
}

export function HomeSectionsPage() {
  useDocumentMeta({ title: 'Homepage', noIndex: true })
  const client = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<{ id?: number; form: SectionForm } | null>(null)
  const { data: lookups } = useLookups()
  const { data: sections, isLoading } = useQuery({ queryKey: ['admin', 'home-sections'], queryFn: () => http.get<AdminHomeSection[]>('/admin/home-sections') })
  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'home-sections'] })

  const save = useMutation({
    mutationFn: (payload: { id?: number; form: SectionForm }) => (payload.id ? http.put(`/admin/home-sections/${payload.id}`, payload.form) : http.post('/admin/home-sections', payload.form)),
    onSuccess: () => {
      toast.success('Section saved')
      setEditing(null)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const reorder = useMutation({ mutationFn: (ids: number[]) => http.put('/admin/home-sections/reorder', { ids }), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) })
  const remove = useMutation({ mutationFn: (id: number) => http.delete(`/admin/home-sections/${id}`), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) })

  if (isLoading || !sections) return <PageLoader />
  const move = (index: number, dir: -1 | 1) => {
    const ids = sections.map((s) => s.id)
    const target = index + dir
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
    client.setQueryData(['admin', 'home-sections'], ids.map((id) => sections.find((s) => s.id === id)!))
    reorder.mutate(ids)
  }
  const summary = (s: AdminHomeSection) => {
    const c = s.config
    const cat = (id?: number | null) => lookups?.categories.find((x) => x.id === id)?.name
    const brand = (id?: number | null) => lookups?.brands.find((x) => x.id === id)?.name
    switch (s.type) {
      case 'Products':
        return [sources.find((x) => x.value === c.source)?.label, cat(c.categoryId), brand(c.brandId), c.source === 'Manual' ? `${c.productIds.length} products` : `up to ${c.limit}`].filter(Boolean).join(' · ')
      case 'ProductTabs':
        return c.tabs.map((t) => t.title).join(' · ')
      case 'Categories':
        return c.categoryIds.length ? `${c.categoryIds.length} hand-picked categories` : 'Featured categories'
      case 'Banners':
        return `${c.images.length} image(s)`
      default:
        return sectionTypes.find((t) => t.type === s.type)?.description
    }
  }

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Homepage"
        description="Build your homepage from sections. The hero slider and side banners are managed under Banners."
        actions={
          <>
            <a href="/" target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <ExternalLink className="size-4" /> Preview
            </a>
            <Button leftIcon={<Plus className="size-4" />} onClick={() => setPicking(true)}>
              Add section
            </Button>
          </>
        }
      />
      <div className="space-y-3">
        {sections.map((section, index) => {
          const meta = sectionTypes.find((t) => t.type === section.type)!
          return (
            <div key={section.id} className={cn('flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs', !section.isActive && 'opacity-60')}>
              <div className="flex flex-col">
                <button onClick={() => move(index, -1)} disabled={index === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up">
                  <ArrowUp className="size-4" />
                </button>
                <button onClick={() => move(index, 1)} disabled={index === sections.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down">
                  <ArrowDown className="size-4" />
                </button>
              </div>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <meta.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{section.title}</p>
                <p className="truncate text-sm text-slate-500">
                  <span className="font-medium text-slate-600">{meta.label}</span> · {summary(section)}
                </p>
              </div>
              <Switch checked={section.isActive} onChange={(v) => save.mutate({ id: section.id, form: { ...section, isActive: v } })} />
              <Button size="sm" variant="outline" onClick={() => setEditing({ id: section.id, form: { ...section, config: { ...emptyConfig, ...section.config } } })}>
                Edit
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-slate-400 hover:text-rose-600"
                aria-label="Delete section"
                onClick={async () => {
                  if (await confirm({ title: `Delete “${section.title}”?`, confirmLabel: 'Delete', danger: true })) remove.mutate(section.id)
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )
        })}
      </div>

      <Modal open={picking} onClose={() => setPicking(false)} title="Add a section" size="lg">
        <div className="grid gap-3 sm:grid-cols-2">
          {sectionTypes.map((t) => (
            <button
              key={t.type}
              onClick={() => {
                setPicking(false)
                setEditing({ form: { title: t.label, subtitle: '', type: t.type, isActive: true, config: { ...emptyConfig, tabs: t.type === 'ProductTabs' ? [{ title: 'New arrivals', source: 'Newest', productIds: [], limit: 12 }] : [] } } })
              }}
              className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-brand hover:bg-brand-softer"
            >
              <t.icon className="mt-0.5 size-5 shrink-0 text-brand" />
              <span>
                <span className="block font-semibold text-slate-900">{t.label}</span>
                <span className="text-sm text-slate-500">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      {editing && <SectionEditor initial={editing.form} saving={save.isPending} onClose={() => setEditing(null)} onSave={(form) => save.mutate({ id: editing.id, form })} />}
    </div>
  )
}

function SectionEditor({ initial, saving, onClose, onSave }: { initial: SectionForm; saving: boolean; onClose: () => void; onSave: (form: SectionForm) => void }) {
  const [form, setForm] = useState(initial)
  const { data: lookups } = useLookups()
  const config = form.config
  const setConfig = (patch: Partial<HomeSectionConfig>) => setForm((f) => ({ ...f, config: { ...f.config, ...patch } }))
  const meta = sectionTypes.find((t) => t.type === form.type)!

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`${meta.label} section`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!form.title.trim()} onClick={() => onSave(form)}>
            Save section
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="Subtitle">
            <Input value={form.subtitle ?? ''} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
          </Field>
        </div>

        {form.type === 'Products' && (
          <ProductQueryEditor
            value={{ source: config.source, categoryId: config.categoryId, brandId: config.brandId, productIds: config.productIds, limit: config.limit }}
            onChange={(q) => setConfig(q)}
          />
        )}

        {form.type === 'ProductTabs' && (
          <div className="space-y-3">
            {config.tabs.map((tab, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Input value={tab.title} onChange={(e) => setConfig({ tabs: config.tabs.map((t, j) => (j === i ? { ...t, title: e.target.value } : t)) })} placeholder="Tab title" className="max-w-xs font-semibold" />
                  <Button size="icon-sm" variant="ghost" onClick={() => setConfig({ tabs: config.tabs.filter((_, j) => j !== i) })} aria-label="Remove tab" className="text-slate-400 hover:text-rose-600">
                    <X className="size-4" />
                  </Button>
                </div>
                <ProductQueryEditor value={tab} onChange={(q) => setConfig({ tabs: config.tabs.map((t, j) => (j === i ? { ...t, ...q } : t)) })} />
              </div>
            ))}
            <Button size="sm" variant="outline" leftIcon={<Plus className="size-4" />} onClick={() => setConfig({ tabs: [...config.tabs, { title: 'New tab', source: 'Newest', productIds: [], limit: 12 }] })}>
              Add tab
            </Button>
          </div>
        )}

        {form.type === 'Categories' && (
          <Field label="Categories" hint="Leave all unchecked to show categories marked “Featured on home”.">
            <div className="grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
              {lookups?.categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--brand)]"
                    checked={config.categoryIds.includes(c.id)}
                    onChange={(e) => setConfig({ categoryIds: e.target.checked ? [...config.categoryIds, c.id] : config.categoryIds.filter((x) => x !== c.id) })}
                  />
                  {c.path}
                </label>
              ))}
            </div>
          </Field>
        )}

        {(form.type === 'Categories' || form.type === 'Brands' || form.type === 'Reviews' || form.type === 'Blog') && (
          <Field label="Maximum items">
            <Input type="number" min={1} max={48} value={config.limit} onChange={(e) => setConfig({ limit: Number(e.target.value) })} className="w-32" />
          </Field>
        )}

        {form.type === 'Banners' && (
          <div className="space-y-3">
            {config.images.map((image, i) => (
              <div key={i} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[220px_1fr_auto]">
                <ImageUpload value={image.imageUrl} onChange={(url) => setConfig({ images: config.images.map((x, j) => (j === i ? { ...x, imageUrl: url ?? '' } : x)) })} folder="banners" aspect="aspect-[3/1]" />
                <div className="space-y-2">
                  <Input value={image.linkUrl ?? ''} onChange={(e) => setConfig({ images: config.images.map((x, j) => (j === i ? { ...x, linkUrl: e.target.value } : x)) })} placeholder="Link, e.g. /offers" />
                  <Input value={image.alt ?? ''} onChange={(e) => setConfig({ images: config.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)) })} placeholder="Image description" />
                </div>
                <Button size="icon-sm" variant="ghost" onClick={() => setConfig({ images: config.images.filter((_, j) => j !== i) })} aria-label="Remove image" className="text-slate-400 hover:text-rose-600">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {config.images.length < 3 && (
              <Button size="sm" variant="outline" leftIcon={<Plus className="size-4" />} onClick={() => setConfig({ images: [...config.images, { imageUrl: '', linkUrl: '', alt: '' }] })}>
                Add image
              </Button>
            )}
          </div>
        )}

        {form.type === 'RichText' && (
          <Field label="Content">
            <RichTextEditor value={config.html} onChange={(html) => setConfig({ html })} folder="pages" />
          </Field>
        )}

        {(form.type === 'Products' || form.type === 'ProductTabs' || form.type === 'Categories') && (
          <Field label="“View all” link (optional)" hint="Leave empty to link automatically.">
            <Input value={config.viewAllUrl ?? ''} onChange={(e) => setConfig({ viewAllUrl: e.target.value })} placeholder="/category/earbuds" />
          </Field>
        )}

        <Switch checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Show on homepage" />
      </div>
    </Modal>
  )
}

type ProductQuery = Pick<HomeSectionTab, 'source' | 'categoryId' | 'brandId' | 'productIds' | 'limit'>

function ProductQueryEditor({ value, onChange }: { value: ProductQuery; onChange: (q: ProductQuery) => void }) {
  const { data: lookups } = useLookups()
  const set = (patch: Partial<ProductQuery>) => onChange({ ...value, ...patch })
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Show" className="sm:col-span-2">
          <Select value={value.source} onChange={(e) => set({ source: e.target.value as ProductSource })}>
            {sources.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        {value.source !== 'Manual' && (
          <Field label="Max products">
            <Input type="number" min={1} max={48} value={value.limit} onChange={(e) => set({ limit: Number(e.target.value) })} />
          </Field>
        )}
      </div>
      {value.source !== 'Manual' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={value.source === 'Category' ? 'Category' : 'Limit to category (optional)'}>
            <Select value={value.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Any category</option>
              {lookups?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.path}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={value.source === 'Brand' ? 'Brand' : 'Limit to brand (optional)'}>
            <Select value={value.brandId ?? ''} onChange={(e) => set({ brandId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Any brand</option>
              {lookups?.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      {value.source === 'Manual' && <ManualProducts ids={value.productIds} onChange={(productIds) => set({ productIds })} />}
    </div>
  )
}

function ManualProducts({ ids, onChange }: { ids: number[]; onChange: (ids: number[]) => void }) {
  const [term, setTerm] = useState('')
  const debounced = useDebounce(term, 250)
  const { data: chosen = [] } = useQuery({
    queryKey: ['admin', 'products-by-ids', ids],
    queryFn: () => http.get<{ id: number; name: string; imageUrl?: string | null; price: number; isActive: boolean }[]>('/admin/products/by-ids', { ids: ids.join(',') }),
    enabled: ids.length > 0,
  })
  const { data: results = [] } = useQuery({ queryKey: ['suggest', debounced], queryFn: () => http.get<SearchSuggestion[]>('/search/suggest', { q: debounced }), enabled: debounced.length >= 2 })
  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchInput value={term} onChange={setTerm} placeholder="Search products to add..." />
        {results.length > 0 && debounced.length >= 2 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  disabled={ids.includes(r.id)}
                  onClick={() => {
                    onChange([...ids, r.id])
                    setTerm('')
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40"
                >
                  {r.imageUrl && <img src={img(r.imageUrl, 64)} alt="" className="size-8 object-contain" />}
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {ids.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No products chosen yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {ids.map((id, i) => {
            const p = chosen.find((c) => c.id === id)
            return (
              <li key={id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-5 text-slate-400">{i + 1}</span>
                {p?.imageUrl && <img src={img(p.imageUrl, 64)} alt="" className="size-8 object-contain" />}
                <span className="min-w-0 flex-1 truncate">{p?.name ?? `Product #${id}`}</span>
                <button onClick={() => i > 0 && onChange(ids.map((x, j) => (j === i - 1 ? id : j === i ? ids[i - 1]! : x)))} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Move up">
                  <ArrowUp className="size-3.5" />
                </button>
                <button onClick={() => onChange(ids.filter((x) => x !== id))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove">
                  <X className="size-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

