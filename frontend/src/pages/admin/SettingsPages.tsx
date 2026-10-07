import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, Truck, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ActiveBadge, Card, DataTable, ImageUpload, PageHeader, useConfirm } from '@/components/admin/Common'
import { Button } from '@/components/ui/Button'
import { Alert, Badge, PageLoader } from '@/components/ui/Feedback'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Form'
import { DynamicIcon, iconOptions } from '@/components/ui/Icons'
import { Modal } from '@/components/ui/Overlay'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { bootstrapKey, useMe } from '@/hooks/useStore'
import { errorMessage, http } from '@/lib/api'
import type { AdminPaymentMethod, AdminShippingMethod } from '@/lib/adminTypes'
import { money } from '@/lib/format'
import type { PaymentMethodType, StoreSettings } from '@/lib/types'
import { cn } from '@/lib/utils'

const tabs = ['General', 'Contact', 'Social', 'Checkout', 'Highlights', 'SEO', 'Footer', 'Analytics'] as const
type Tab = (typeof tabs)[number]

export function SettingsPage() {
  useDocumentMeta({ title: 'Store settings', noIndex: true })
  const client = useQueryClient()
  const { data: me } = useMe()
  const isAdmin = !!me?.roles.includes('Admin')
  const [tab, setTab] = useState<Tab>('General')
  const [form, setForm] = useState<StoreSettings | null>(null)
  const { data } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => http.get<StoreSettings>('/admin/settings') })
  useEffect(() => {
    if (data) setForm(structuredClone(data))
  }, [data])

  const save = useMutation({
    mutationFn: () => http.put<StoreSettings>('/admin/settings', form),
    onSuccess: (saved) => {
      toast.success('Settings saved')
      client.setQueryData(['admin', 'settings'], saved)
      client.invalidateQueries({ queryKey: bootstrapKey })
      client.invalidateQueries({ queryKey: ['home'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (!form) return <PageLoader />
  const set = <K extends keyof StoreSettings>(section: K, patch: Partial<StoreSettings[K]>) =>
    setForm((f) => (f ? { ...f, [section]: { ...(f[section] as object), ...patch } } : f))

  return (
    <div>
      <PageHeader
        title="Store settings"
        description="Your store name, contact details, checkout rules and more."
        actions={
          <Button loading={save.isPending} disabled={!isAdmin} onClick={() => save.mutate()}>
            Save settings
          </Button>
        }
      />
      {!isAdmin && <Alert variant="warning" className="mb-4">Only admins can change store settings.</Alert>}
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="scrollbar-none flex gap-1 overflow-x-auto lg:flex-col">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn('shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium', tab === t ? 'bg-white text-brand shadow-xs ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/60')}>
              {t}
            </button>
          ))}
        </nav>
        <Card>
          {tab === 'General' && (
            <div className="grid gap-5 md:grid-cols-[1fr_220px]">
              <div className="space-y-4">
                <Field label="Store name" required>
                  <Input value={form.general.storeName} onChange={(e) => set('general', { storeName: e.target.value })} />
                </Field>
                <Field label="Tagline">
                  <Input value={form.general.tagline ?? ''} onChange={(e) => set('general', { tagline: e.target.value })} />
                </Field>
                <Field label="Announcement bar" hint="Thin bar above the header. Leave empty to hide.">
                  <Input value={form.general.announcementText ?? ''} onChange={(e) => set('general', { announcementText: e.target.value })} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Brand color" hint="Buttons, links and highlights.">
                    <div className="flex gap-2">
                      <input type="color" value={form.general.primaryColor} onChange={(e) => set('general', { primaryColor: e.target.value })} className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" />
                      <Input value={form.general.primaryColor} onChange={(e) => set('general', { primaryColor: e.target.value })} className="font-mono" />
                    </div>
                  </Field>
                  <Field label="Currency symbol">
                    <Input value={form.general.currencySymbol} onChange={(e) => set('general', { currencySymbol: e.target.value })} />
                  </Field>
                </div>
                <Switch checked={form.general.reviewsRequireApproval} onChange={(v) => set('general', { reviewsRequireApproval: v })} label="Approve reviews before publishing" description="Recommended to avoid spam." />
              </div>
              <div className="space-y-4">
                <Field label="Logo" hint="Wide logo, transparent PNG. Height ~80px.">
                  <ImageUpload value={form.general.logoUrl} onChange={(url) => set('general', { logoUrl: url })} folder="settings" aspect="aspect-[5/2]" label="Upload logo" />
                </Field>
                <Field label="Favicon" hint="Square, at least 64×64.">
                  <ImageUpload value={form.general.faviconUrl} onChange={(url) => set('general', { faviconUrl: url })} folder="settings" className="w-24" label="Upload" />
                </Field>
              </div>
            </div>
          )}

          {tab === 'Contact' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <Input value={form.contact.phone ?? ''} onChange={(e) => set('contact', { phone: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input value={form.contact.email ?? ''} onChange={(e) => set('contact', { email: e.target.value })} />
              </Field>
              <Field label="WhatsApp number" hint="International format without +, e.g. 8801712345678">
                <Input value={form.contact.whatsAppNumber ?? ''} onChange={(e) => set('contact', { whatsAppNumber: e.target.value })} />
              </Field>
              <Field label="Facebook page username" hint="For Messenger links (m.me/username)">
                <Input value={form.contact.messengerUsername ?? ''} onChange={(e) => set('contact', { messengerUsername: e.target.value })} />
              </Field>
              <Field label="Store address" className="sm:col-span-2">
                <Textarea rows={2} value={form.contact.address ?? ''} onChange={(e) => set('contact', { address: e.target.value })} />
              </Field>
              <Field label="Google Maps link">
                <Input value={form.contact.mapUrl ?? ''} onChange={(e) => set('contact', { mapUrl: e.target.value })} />
              </Field>
              <Field label="Business hours">
                <Input value={form.contact.businessHours ?? ''} onChange={(e) => set('contact', { businessHours: e.target.value })} />
              </Field>
            </div>
          )}

          {tab === 'Social' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {(['facebook', 'instagram', 'youTube', 'tikTok', 'linkedIn', 'x'] as const).map((key) => (
                <Field key={key} label={{ facebook: 'Facebook', instagram: 'Instagram', youTube: 'YouTube', tikTok: 'TikTok', linkedIn: 'LinkedIn', x: 'X (Twitter)' }[key]}>
                  <Input value={form.social[key] ?? ''} onChange={(e) => set('social', { [key]: e.target.value })} placeholder="https://" />
                </Field>
              ))}
            </div>
          )}

          {tab === 'Checkout' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Free delivery from (৳)" hint="0 turns free delivery off.">
                  <Input type="number" min={0} value={form.checkout.freeShippingThreshold} onChange={(e) => set('checkout', { freeShippingThreshold: Number(e.target.value) })} />
                </Field>
                <Field label="Minimum order (৳)">
                  <Input type="number" min={0} value={form.checkout.minimumOrderAmount} onChange={(e) => set('checkout', { minimumOrderAmount: Number(e.target.value) })} />
                </Field>
                <Field label="Low stock alert at">
                  <Input type="number" min={0} value={form.checkout.lowStockThreshold} onChange={(e) => set('checkout', { lowStockThreshold: Number(e.target.value) })} />
                </Field>
              </div>
              <Field label="Order confirmation message" hint="Shown after a customer places an order.">
                <Textarea rows={2} value={form.checkout.orderSuccessMessage ?? ''} onChange={(e) => set('checkout', { orderSuccessMessage: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Switch checked={form.checkout.allowGuestCheckout} onChange={(v) => set('checkout', { allowGuestCheckout: v })} label="Guest checkout" description="Let customers order without an account." />
                <Switch checked={form.checkout.enableWhatsAppOrdering} onChange={(v) => set('checkout', { enableWhatsAppOrdering: v })} label="WhatsApp / Messenger ordering buttons" />
              </div>
            </div>
          )}

          {tab === 'Highlights' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">The strip of selling points under the homepage slider (up to 8).</p>
              {form.features.map((feature, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[150px_1fr_1fr_auto]">
                  <Select value={feature.icon} onChange={(e) => setForm((f) => f && { ...f, features: f.features.map((x, j) => (j === i ? { ...x, icon: e.target.value } : x)) })}>
                    {iconOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                  <Input value={feature.title} onChange={(e) => setForm((f) => f && { ...f, features: f.features.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="Title" />
                  <Input value={feature.subtitle ?? ''} onChange={(e) => setForm((f) => f && { ...f, features: f.features.map((x, j) => (j === i ? { ...x, subtitle: e.target.value } : x)) })} placeholder="Subtitle" />
                  <div className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <DynamicIcon name={feature.icon} className="size-4.5" />
                    </span>
                    <Button size="icon-sm" variant="ghost" onClick={() => setForm((f) => f && { ...f, features: f.features.filter((_, j) => j !== i) })} aria-label="Remove highlight" className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {form.features.length < 8 && (
                <Button size="sm" variant="outline" leftIcon={<Plus className="size-4" />} onClick={() => setForm((f) => f && { ...f, features: [...f.features, { icon: 'truck', title: '', subtitle: '' }] })}>
                  Add highlight
                </Button>
              )}
            </div>
          )}

          {tab === 'SEO' && (
            <div className="grid gap-5 md:grid-cols-[1fr_260px]">
              <div className="space-y-4">
                <Field label="Homepage title" hint={`${(form.seo.metaTitle ?? '').length}/70`}>
                  <Input value={form.seo.metaTitle ?? ''} onChange={(e) => set('seo', { metaTitle: e.target.value })} />
                </Field>
                <Field label="Homepage description" hint={`${(form.seo.metaDescription ?? '').length}/160`}>
                  <Textarea rows={3} value={form.seo.metaDescription ?? ''} onChange={(e) => set('seo', { metaDescription: e.target.value })} />
                </Field>
              </div>
              <Field label="Social share image" hint="Shown when your homepage is shared on Facebook/WhatsApp. 1200 × 630.">
                <ImageUpload value={form.seo.ogImageUrl} onChange={(url) => set('seo', { ogImageUrl: url })} folder="settings" aspect="aspect-[1.9/1]" />
              </Field>
            </div>
          )}

          {tab === 'Footer' && (
            <div className="space-y-4">
              <Field label="About text">
                <Textarea rows={3} value={form.footer.aboutText ?? ''} onChange={(e) => set('footer', { aboutText: e.target.value })} />
              </Field>
              <Field label="Copyright text" hint="The year is added automatically.">
                <Input value={form.footer.copyrightText ?? ''} onChange={(e) => set('footer', { copyrightText: e.target.value })} />
              </Field>
              <Switch checked={form.footer.showNewsletter} onChange={(v) => set('footer', { showNewsletter: v })} label="Show newsletter sign-up" />
            </div>
          )}

          {tab === 'Analytics' && (
            <div className="space-y-4">
              <Field label="Google Analytics 4 measurement ID" hint="Looks like G-XXXXXXXXXX">
                <Input value={form.analytics.googleAnalyticsId ?? ''} onChange={(e) => set('analytics', { googleAnalyticsId: e.target.value })} />
              </Field>
              <Field label="Facebook Pixel ID" hint="Tracks page views, add to cart, checkout and purchases for your Facebook ads.">
                <Input value={form.analytics.facebookPixelId ?? ''} onChange={(e) => set('analytics', { facebookPixelId: e.target.value })} />
              </Field>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- delivery

type ShippingForm = Omit<AdminShippingMethod, 'id'>

export function ShippingPage() {
  useDocumentMeta({ title: 'Delivery', noIndex: true })
  const client = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const [editing, setEditing] = useState<{ id?: number; form: ShippingForm } | null>(null)
  const { data: methods, isLoading } = useQuery({ queryKey: ['admin', 'shipping'], queryFn: () => http.get<AdminShippingMethod[]>('/admin/shipping-methods') })
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['admin', 'shipping'] })
    client.invalidateQueries({ queryKey: ['checkout-options'] })
  }
  const save = useMutation({
    mutationFn: () => (editing?.id ? http.put(`/admin/shipping-methods/${editing.id}`, editing.form) : http.post('/admin/shipping-methods', editing!.form)),
    onSuccess: () => {
      toast.success('Delivery option saved')
      setEditing(null)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({ mutationFn: (id: number) => http.delete(`/admin/shipping-methods/${id}`), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) })
  const form = editing?.form
  const set = (patch: Partial<ShippingForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e))

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Delivery"
        description="Delivery areas and charges customers choose from at checkout."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing({ form: { name: '', description: '', cost: 0, estimatedDelivery: '', isPickup: false, freeShippingEligible: true, sortOrder: (methods?.length ?? 0) + 1, isActive: true } })}>
            Add delivery option
          </Button>
        }
      />
      <Card bodyClass="p-0">
        <DataTable
          rows={methods}
          loading={isLoading}
          rowKey={(m) => m.id}
          columns={[
            {
              header: 'Option',
              cell: (m) => (
                <div className="flex items-center gap-3">
                  <Truck className="size-5 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-900">
                      {m.name} {m.isPickup && <Badge>Pickup</Badge>}
                    </p>
                    {m.description && <p className="line-clamp-1 max-w-md text-xs text-slate-500">{m.description}</p>}
                  </div>
                </div>
              ),
            },
            { header: 'Charge', cell: (m) => <span className="font-semibold">{m.cost ? money(m.cost) : 'Free'}</span> },
            { header: 'Time', cell: (m) => m.estimatedDelivery ?? '—' },
            { header: 'Free delivery rule', cell: (m) => (m.freeShippingEligible ? 'Applies' : 'Never free') },
            { header: 'Status', cell: (m) => <ActiveBadge active={m.isActive} /> },
            {
              header: '',
              cell: (m) => (
                <div className="flex justify-end gap-1">
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditing({ id: m.id, form: { ...m } })} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-rose-600"
                    aria-label="Delete"
                    onClick={async () => {
                      if (await confirm({ title: `Delete “${m.name}”?`, confirmLabel: 'Delete', danger: true })) remove.mutate(m.id)
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
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit delivery option' : 'New delivery option'} footer={<Button loading={save.isPending} disabled={!form?.name.trim()} onClick={() => save.mutate()}>Save</Button>}>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Inside Dhaka City" />
            </Field>
            <Field label="Charge (৳)">
              <Input type="number" min={0} value={form.cost} onChange={(e) => set({ cost: Number(e.target.value) })} />
            </Field>
            <Field label="Delivery time">
              <Input value={form.estimatedDelivery ?? ''} onChange={(e) => set({ estimatedDelivery: e.target.value })} placeholder="e.g. 1-2 days" />
            </Field>
            <Field label="Description" hint="Shown under the option at checkout." className="sm:col-span-2">
              <Textarea rows={2} value={form.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label="Sort order">
              <Input type="number" value={form.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
            </Field>
            <div className="space-y-3 sm:col-span-2">
              <Switch checked={form.isPickup} onChange={(v) => set({ isPickup: v })} label="Store pickup" description="No delivery address required." />
              <Switch checked={form.freeShippingEligible} onChange={(v) => set({ freeShippingEligible: v })} label="Free over the free-delivery amount" />
              <Switch checked={form.isActive} onChange={(v) => set({ isActive: v })} label="Active" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------- payments

type PaymentForm = Omit<AdminPaymentMethod, 'id'>
const paymentTypes: { value: PaymentMethodType; label: string }[] = [
  { value: 'CashOnDelivery', label: 'Cash on delivery' },
  { value: 'MobileBanking', label: 'Mobile banking (bKash, Nagad, Rocket)' },
  { value: 'BankTransfer', label: 'Bank transfer' },
]

export function PaymentsPage() {
  useDocumentMeta({ title: 'Payments', noIndex: true })
  const client = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const [editing, setEditing] = useState<{ id?: number; form: PaymentForm } | null>(null)
  const { data: methods, isLoading } = useQuery({ queryKey: ['admin', 'payments'], queryFn: () => http.get<AdminPaymentMethod[]>('/admin/payment-methods') })
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['admin', 'payments'] })
    client.invalidateQueries({ queryKey: ['checkout-options'] })
  }
  const save = useMutation({
    mutationFn: () => (editing?.id ? http.put(`/admin/payment-methods/${editing.id}`, editing.form) : http.post('/admin/payment-methods', editing!.form)),
    onSuccess: () => {
      toast.success('Payment method saved')
      setEditing(null)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({ mutationFn: (id: number) => http.delete(`/admin/payment-methods/${id}`), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) })
  if (isLoading || !methods) return <PageLoader />
  const form = editing?.form
  const set = (patch: Partial<PaymentForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e))

  return (
    <div>
      {confirmDialog}
      <PageHeader
        title="Payments"
        description="How customers can pay. Mobile banking methods ask the customer for their transaction ID so you can verify it."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing({ form: { code: '', name: '', type: 'MobileBanking', instructions: '', accountNumber: '', feePercent: 0, requiresTransactionId: true, logoUrl: null, sortOrder: methods.length + 1, isActive: true } })}>
            Add payment method
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {methods.map((m) => (
          <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Wallet className="size-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-500">
                    {paymentTypes.find((t) => t.value === m.type)?.label} · code “{m.code}”
                  </p>
                </div>
              </div>
              <ActiveBadge active={m.isActive} on="Enabled" off="Disabled" />
            </div>
            {m.instructions && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{m.instructions}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {m.accountNumber && <Badge>Account: {m.accountNumber}</Badge>}
              {m.feePercent > 0 && <Badge tone="amber">{m.feePercent}% fee</Badge>}
              {m.requiresTransactionId && <Badge tone="blue">Asks for TrxID</Badge>}
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing({ id: m.id, form: { ...m } })}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-400 hover:text-rose-600"
                aria-label="Delete"
                onClick={async () => {
                  if (await confirm({ title: `Delete ${m.name}?`, message: 'You can also just disable it.', confirmLabel: 'Delete', danger: true })) remove.mutate(m.id)
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} size="lg" title={editing?.id ? 'Edit payment method' : 'New payment method'} footer={<Button loading={save.isPending} disabled={!form?.name.trim() || !form?.code.trim()} onClick={() => save.mutate()}>Save</Button>}>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. bKash" />
            </Field>
            <Field label="Code" required hint="Short id, e.g. bkash">
              <Input value={form.code} onChange={(e) => set({ code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} className="font-mono" />
            </Field>
            <Field label="Type">
              <Select
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as PaymentMethodType
                  set({ type, requiresTransactionId: type === 'MobileBanking' })
                }}
              >
                {paymentTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Account / merchant number">
              <Input value={form.accountNumber ?? ''} onChange={(e) => set({ accountNumber: e.target.value })} />
            </Field>
            <Field label="Instructions for customers" className="sm:col-span-2">
              <Textarea rows={3} value={form.instructions ?? ''} onChange={(e) => set({ instructions: e.target.value })} placeholder="Send Money to our number, then enter the transaction ID." />
            </Field>
            <Field label="Extra fee (%)" hint="Added to the order total, e.g. 1.5 for cash-out charges.">
              <Input type="number" min={0} max={100} step={0.1} value={form.feePercent} onChange={(e) => set({ feePercent: Number(e.target.value) })} />
            </Field>
            <Field label="Sort order">
              <Input type="number" value={form.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
            </Field>
            <div className="space-y-3 sm:col-span-2">
              <Switch checked={form.requiresTransactionId} onChange={(v) => set({ requiresTransactionId: v })} label="Ask for transaction ID at checkout" />
              <Switch checked={form.isActive} onChange={(v) => set({ isActive: v })} label="Enabled" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
