import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderTree, Pencil, Plus, Star, Tag, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ActiveBadge, Card, ImageUpload, PageHeader, useConfirm } from '@/components/admin/Common'
import { RichTextEditor } from '@/components/admin/RichTextEditor'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Form'
import { DynamicIcon, iconOptions } from '@/components/ui/Icons'
import { Modal } from '@/components/ui/Overlay'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { errorMessage, http } from '@/lib/api'
import type { AdminBrand, AdminCategory } from '@/lib/adminTypes'
import { cn, img } from '@/lib/utils'

// ---------------------------------------------------------------- categories

type CategoryForm = Omit<AdminCategory, 'id' | 'productCount'>

const emptyCategory: CategoryForm = {
  name: '',
  slug: '',
  parentId: null,
  description: '',
  imageUrl: null,
  bannerUrl: null,
  icon: '',
  sortOrder: 0,
  isActive: true,
  showInMenu: true,
  isFeatured: false,
  metaTitle: '',
  metaDescription: '',
  seoContent: '',
}

export function CategoriesPage() {
  useDocumentMeta({ title: 'Categories', noIndex: true })
  const client = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const [editing, setEditing] = useState<{ id?: number; form: CategoryForm } | null>(null)
  const { data: categories, isLoading } = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => http.get<AdminCategory[]>('/admin/categories') })

  const refresh = () => {
    client.invalidateQueries({ queryKey: ['admin', 'categories'] })
    client.invalidateQueries({ queryKey: ['admin', 'lookups'] })
  }
  const save = useMutation({
    mutationFn: () => (editing?.id ? http.put(`/admin/categories/${editing.id}`, editing.form) : http.post('/admin/categories', editing!.form)),
    onSuccess: () => {
      toast.success('Category saved')
      setEditing(null)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => http.delete(`/admin/categories/${id}`),
    onSuccess: () => {
      toast.success('Category deleted')
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (isLoading || !categories) return <PageLoader />
  const roots = categories.filter((c) => !c.parentId)
  const childrenOf = (id: number) => categories.filter((c) => c.parentId === id)

  const row = (category: AdminCategory, depth: number) => (
    <div key={category.id}>
      <div className={cn('flex items-center gap-3 px-4 py-3 hover:bg-slate-50', depth > 0 && 'bg-slate-50/40')} style={{ paddingLeft: 16 + depth * 32 }}>
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
          {category.imageUrl ? <img src={img(category.imageUrl, 88)} alt="" className="size-full object-cover" /> : <DynamicIcon name={category.icon} className="size-5 text-slate-400" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
            {category.name}
            {category.isFeatured && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
            {!category.showInMenu && <Badge>Not in menu</Badge>}
          </p>
          <p className="text-xs text-slate-500">
            /category/{category.slug} · {category.productCount} product{category.productCount === 1 ? '' : 's'}
          </p>
        </div>
        <ActiveBadge active={category.isActive} />
        <Button size="icon-sm" variant="ghost" onClick={() => setEditing({ id: category.id, form: { ...category } })} aria-label={`Edit ${category.name}`}>
          <Pencil className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-slate-400 hover:text-rose-600"
          aria-label={`Delete ${category.name}`}
          onClick={async () => {
            if (await confirm({ title: `Delete “${category.name}”?`, message: 'Categories with products or subcategories cannot be deleted.', confirmLabel: 'Delete', danger: true })) remove.mutate(category.id)
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      {childrenOf(category.id).map((child) => row(child, depth + 1))}
    </div>
  )

  const form = editing?.form
  const set = (patch: Partial<CategoryForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e))

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Categories"
        description="Organize products into categories and subcategories. The top-level categories form your store menu."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing({ form: { ...emptyCategory, sortOrder: categories.length } })}>
            Add category
          </Button>
        }
      />
      <Card bodyClass="p-0">
        {categories.length === 0 ? (
          <EmptyState icon={<FolderTree className="size-6" />} title="No categories yet" description="Create your first category to start adding products." />
        ) : (
          <div className="divide-y divide-slate-100">{roots.map((r) => row(r, 0))}</div>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="xl"
        title={editing?.id ? 'Edit category' : 'New category'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()} disabled={!form?.name.trim()}>
              Save category
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid gap-6 md:grid-cols-[1fr_240px]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" required>
                  <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
                </Field>
                <Field label="Parent category">
                  <Select value={form.parentId ?? ''} onChange={(e) => set({ parentId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">None (top level)</option>
                    {categories
                      .filter((c) => c.id !== editing?.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.parentId ? `— ${c.name}` : c.name}
                        </option>
                      ))}
                  </Select>
                </Field>
              </div>
              <Field label="Description">
                <Textarea rows={2} value={form.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
              </Field>
              <Field label="Icon" hint="Used in the menu and category pages.">
                <div className="flex flex-wrap gap-1.5">
                  {iconOptions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => set({ icon: name })}
                      className={cn('flex size-9 items-center justify-center rounded-lg border', form.icon === name ? 'border-brand bg-brand-soft text-brand' : 'border-slate-200 text-slate-500 hover:border-slate-400')}
                    >
                      <DynamicIcon name={name} className="size-4.5" />
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Switch checked={form.isActive} onChange={(v) => set({ isActive: v })} label="Active" />
                <Switch checked={form.showInMenu} onChange={(v) => set({ showInMenu: v })} label="Show in menu" />
                <Switch checked={form.isFeatured} onChange={(v) => set({ isFeatured: v })} label="Featured on home" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="URL slug">
                  <Input value={form.slug ?? ''} onChange={(e) => set({ slug: e.target.value })} placeholder="Auto from name" />
                </Field>
                <Field label="Sort order">
                  <Input type="number" value={form.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
                </Field>
                <Field label="Meta title">
                  <Input value={form.metaTitle ?? ''} onChange={(e) => set({ metaTitle: e.target.value })} />
                </Field>
                <Field label="Meta description">
                  <Input value={form.metaDescription ?? ''} onChange={(e) => set({ metaDescription: e.target.value })} />
                </Field>
              </div>
              <Field label="SEO text" hint="Shown below the products on the category page.">
                <RichTextEditor value={form.seoContent} onChange={(html) => set({ seoContent: html })} folder="categories" minHeight="min-h-[120px]" />
              </Field>
            </div>
            <div className="space-y-4">
              <Field label="Thumbnail" hint="Square image for category tiles.">
                <ImageUpload value={form.imageUrl} onChange={(url) => set({ imageUrl: url })} folder="categories" />
              </Field>
              <Field label="Banner" hint="Wide image at the top of the category page (4:1).">
                <ImageUpload value={form.bannerUrl} onChange={(url) => set({ bannerUrl: url })} folder="categories" aspect="aspect-[4/1.4]" label="Upload banner" />
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------- brands

type BrandForm = Omit<AdminBrand, 'id' | 'productCount'>
const emptyBrand: BrandForm = { name: '', slug: '', logoUrl: null, description: '', isActive: true, isFeatured: true, sortOrder: 0, metaTitle: '', metaDescription: '' }

export function BrandsPage() {
  useDocumentMeta({ title: 'Brands', noIndex: true })
  const client = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const [editing, setEditing] = useState<{ id?: number; form: BrandForm } | null>(null)
  const { data: brands, isLoading } = useQuery({ queryKey: ['admin', 'brands'], queryFn: () => http.get<AdminBrand[]>('/admin/brands') })

  const refresh = () => {
    client.invalidateQueries({ queryKey: ['admin', 'brands'] })
    client.invalidateQueries({ queryKey: ['admin', 'lookups'] })
  }
  const save = useMutation({
    mutationFn: () => (editing?.id ? http.put(`/admin/brands/${editing.id}`, editing.form) : http.post('/admin/brands', editing!.form)),
    onSuccess: () => {
      toast.success('Brand saved')
      setEditing(null)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => http.delete(`/admin/brands/${id}`),
    onSuccess: () => {
      toast.success('Brand deleted')
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (isLoading || !brands) return <PageLoader />
  const form = editing?.form
  const set = (patch: Partial<BrandForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e))

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Brands"
        description="Featured brands appear in the “Shop by brands” section."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing({ form: { ...emptyBrand, sortOrder: brands.length } })}>
            Add brand
          </Button>
        }
      />
      {brands.length === 0 ? (
        <Card>
          <EmptyState icon={<Tag className="size-6" />} title="No brands yet" />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {brands.map((brand) => (
            <div key={brand.id} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex h-20 items-center justify-center rounded-xl bg-slate-50 p-3">
                {brand.logoUrl ? <img src={img(brand.logoUrl, 240)} alt={brand.name} className="max-h-full max-w-full object-contain" /> : <span className="text-lg font-bold text-slate-400">{brand.name}</span>}
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                    {brand.name} {brand.isFeatured && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
                  </p>
                  <p className="text-xs text-slate-500">{brand.productCount} products</p>
                </div>
                <ActiveBadge active={brand.isActive} />
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing({ id: brand.id, form: { ...brand } })}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-rose-600"
                  aria-label={`Delete ${brand.name}`}
                  onClick={async () => {
                    if (await confirm({ title: `Delete ${brand.name}?`, message: 'Products of this brand are kept, but lose their brand.', confirmLabel: 'Delete', danger: true })) remove.mutate(brand.id)
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
        size="lg"
        title={editing?.id ? 'Edit brand' : 'New brand'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()} disabled={!form?.name.trim()}>
              Save brand
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
            <div className="space-y-4">
              <Field label="Name" required>
                <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <Field label="Description">
                <Textarea rows={3} value={form.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="URL slug">
                  <Input value={form.slug ?? ''} onChange={(e) => set({ slug: e.target.value })} placeholder="Auto from name" />
                </Field>
                <Field label="Sort order">
                  <Input type="number" value={form.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Switch checked={form.isActive} onChange={(v) => set({ isActive: v })} label="Active" />
                <Switch checked={form.isFeatured} onChange={(v) => set({ isFeatured: v })} label="Featured on home" />
              </div>
              <Field label="Meta title">
                <Input value={form.metaTitle ?? ''} onChange={(e) => set({ metaTitle: e.target.value })} />
              </Field>
              <Field label="Meta description">
                <Textarea rows={2} value={form.metaDescription ?? ''} onChange={(e) => set({ metaDescription: e.target.value })} />
              </Field>
            </div>
            <Field label="Logo" hint="PNG with transparent background works best.">
              <ImageUpload value={form.logoUrl} onChange={(url) => set({ logoUrl: url })} folder="brands" aspect="aspect-[2/1]" label="Upload logo" />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
