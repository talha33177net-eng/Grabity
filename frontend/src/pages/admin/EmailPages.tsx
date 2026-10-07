import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, History, RotateCcw, Send } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Card, DataTable, PageHeader, SearchInput } from '@/components/admin/Common'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Alert, Badge, PageLoader, type Tone } from '@/components/ui/Feedback'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Form'
import { Pagination } from '@/components/ui/Misc'
import { Modal } from '@/components/ui/Overlay'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { bootstrapKey, useMe } from '@/hooks/useStore'
import { errorMessage, http } from '@/lib/api'
import type { EmailKind, EmailMessageDetail, EmailMessageItem, EmailSettings, EmailStatus, SmtpSecurity } from '@/lib/adminTypes'
import { emailKinds, emailWhen } from '@/lib/emails'
import { formatDate } from '@/lib/format'
import type { Paged } from '@/lib/types'

// ---------------------------------------------------------------- shared

const customerKinds: EmailKind[] = ['OrderPlaced', 'OrderConfirmed', 'OrderShipped', 'OrderDelivered', 'OrderCancelled', 'OrderReturned', 'PaymentReceived', 'PaymentRefunded']
const accountKinds: EmailKind[] = ['Welcome', 'PasswordReset', 'PasswordChanged', 'NewsletterWelcome', 'StaffWelcome']
const staffKinds: EmailKind[] = ['StaffNewOrder', 'StaffLowStock', 'StaffNewReview']

const statusTone: Record<EmailStatus, Tone> = { Pending: 'amber', Sending: 'blue', Sent: 'green', Failed: 'red', Skipped: 'slate' }

export function EmailStatusBadge({ email }: { email: EmailMessageItem }) {
  const label = email.status === 'Pending' ? (email.attempts > 0 ? 'Retrying' : 'Waiting') : email.status
  return (
    <Badge tone={statusTone[email.status]} dot>
      {label}
    </Badge>
  )
}

/** Shows rendered email HTML in a sandboxed frame (no scripts, links open in a new tab). */
export function EmailFrame({ html, className = 'h-[70vh]' }: { html: string; className?: string }) {
  return <iframe title="Email preview" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={html} className={`w-full rounded-xl border border-slate-200 bg-white ${className}`} />
}

function PreviewModal({ kind, onClose }: { kind: EmailKind | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'email', 'preview', kind],
    queryFn: () => http.get<{ subject: string; html: string }>(`/admin/email/preview/${kind}`),
    enabled: !!kind,
  })
  return (
    <Modal open={!!kind} onClose={onClose} size="2xl" title={kind ? emailKinds[kind].label : ''} description={data ? `Subject: ${data.subject}` : 'Made with your latest order and store details.'}>
      {isLoading ? <PageLoader /> : error ? <Alert variant="error">{errorMessage(error)}</Alert> : data && <EmailFrame html={data.html} />}
    </Modal>
  )
}

// ---------------------------------------------------------------- settings

const presets: { name: string; host: string; port: number; security: SmtpSecurity }[] = [
  { name: 'Gmail', host: 'smtp.gmail.com', port: 587, security: 'StartTls' },
  { name: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, security: 'StartTls' },
  { name: 'Zoho Mail', host: 'smtp.zoho.com', port: 587, security: 'StartTls' },
]

export function EmailSettingsPage() {
  useDocumentMeta({ title: 'Email', noIndex: true })
  const { data: me } = useMe()
  const { data } = useQuery({ queryKey: ['admin', 'email', 'settings'], queryFn: () => http.get<EmailSettings>('/admin/email/settings') })
  if (!me?.roles.includes('Admin')) return <Alert variant="warning">Only admins can manage email settings.</Alert>
  if (!data) return <PageLoader />
  return <EmailSettingsForm current={data} defaultTestTo={me.email ?? ''} />
}

function EmailSettingsForm({ current, defaultTestTo }: { current: EmailSettings; defaultTestTo: string }) {
  const client = useQueryClient()
  const [form, setForm] = useState(current)
  const [password, setPassword] = useState('')
  const [preview, setPreview] = useState<EmailKind | null>(null)
  const [testTo, setTestTo] = useState(current.userName?.includes('@') ? current.userName : defaultTestTo)
  const set = (patch: Partial<EmailSettings>) => setForm((f) => ({ ...f, ...patch }))
  const gmail = /gmail\.com$/i.test(form.host ?? '')

  const payload = () => ({
    enabled: form.enabled,
    host: form.host || null,
    port: form.port,
    security: form.security,
    userName: form.userName || null,
    password: password === '' ? null : password,
    fromName: form.fromName || null,
    fromAddress: form.fromAddress || null,
    replyTo: form.replyTo || null,
    siteUrl: form.siteUrl || null,
    staffRecipients: form.staffRecipients || null,
    disabledKinds: form.disabledKinds,
  })

  const save = useMutation({
    mutationFn: () => http.put<EmailSettings>('/admin/email/settings', payload()),
    onSuccess: (saved) => {
      setForm(saved)
      setPassword('')
      client.setQueryData(['admin', 'email', 'settings'], saved)
      client.invalidateQueries({ queryKey: bootstrapKey })
    },
  })
  const test = useMutation({
    mutationFn: async () => {
      await save.mutateAsync()
      return http.post<{ message: string }>('/admin/email/test', { to: testTo })
    },
    onSuccess: (r) => {
      toast.success(r.message)
      client.invalidateQueries({ queryKey: ['admin', 'email'] })
    },
    onError: (e) => {
      toast.error(errorMessage(e))
      client.invalidateQueries({ queryKey: ['admin', 'email', 'settings'] })
    },
  })

  const toggleKind = (kind: EmailKind, on: boolean) =>
    set({ disabledKinds: on ? form.disabledKinds.filter((k) => k !== kind) : [...form.disabledKinds, kind] })
  const health = current.health

  const kindRow = (kind: EmailKind, locked = false) => (
    <li key={kind} className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{emailKinds[kind].label}</p>
        <p className="text-xs text-slate-500">{emailKinds[kind].description}</p>
      </div>
      <Button size="xs" variant="ghost" leftIcon={<Eye className="size-3.5" />} onClick={() => setPreview(kind)}>
        Preview
      </Button>
      <Switch checked={locked || !form.disabledKinds.includes(kind)} disabled={locked} onChange={(on) => toggleKind(kind, on)} />
    </li>
  )

  return (
    <div>
      <PageHeader
        title="Email"
        description="Order updates for customers, account emails and alerts for your team."
        actions={
          <>
            <ButtonLink to="/admin/email/log" variant="outline" className="gap-2">
              <History className="size-4" /> Email log
            </ButtonLink>
            <Button loading={save.isPending && !test.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => toast.success('Email settings saved'), onError: (e) => toast.error(errorMessage(e)) })}>
              Save settings
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <Switch
              checked={form.enabled}
              onChange={(enabled) => set({ enabled })}
              label="Send emails"
              description={form.enabled ? 'Customers and staff get emails as orders move along.' : 'Nothing is sent while this is off. Turn it on after a successful test.'}
            />
          </Card>

          <Card title="Sending account" description="The mailbox emails are sent from.">
            <div className="mb-4 flex flex-wrap gap-2">
              {presets.map((p) => (
                <Button key={p.name} size="sm" variant={form.host === p.host ? 'soft' : 'outline'} onClick={() => set({ host: p.host, port: p.port, security: p.security })}>
                  {p.name}
                </Button>
              ))}
            </div>
            {gmail && (
              <Alert variant="info" className="mb-4">
                Gmail needs an <b>App password</b>, not your normal password: Google Account → Security → 2-Step Verification → App passwords. A free Gmail account can send about 500 emails a day.
              </Alert>
            )}
            {current.passwordUnreadable && (
              <Alert variant="warning" className="mb-4">
                The saved password can no longer be read (the encryption keys in App_Data were replaced). Please enter it again.
              </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-[1fr_110px_170px]">
              <Field label="SMTP server">
                <Input value={form.host ?? ''} onChange={(e) => set({ host: e.target.value })} placeholder="smtp.gmail.com" />
              </Field>
              <Field label="Port">
                <Input type="number" min={1} max={65535} value={form.port} onChange={(e) => set({ port: Number(e.target.value) })} />
              </Field>
              <Field label="Security">
                <Select value={form.security} onChange={(e) => set({ security: e.target.value as SmtpSecurity })}>
                  <option value="StartTls">STARTTLS (587)</option>
                  <option value="SslOnConnect">SSL/TLS (465)</option>
                  <option value="Auto">Automatic</option>
                  <option value="None">None</option>
                </Select>
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Username" hint="Usually the full email address.">
                <Input value={form.userName ?? ''} onChange={(e) => set({ userName: e.target.value })} autoComplete="off" />
              </Field>
              <Field label={gmail ? 'App password' : 'Password'} hint={current.hasPassword && !current.passwordUnreadable ? 'Saved. Leave empty to keep it.' : 'Stored encrypted.'}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={current.hasPassword ? '••••••••••••••••' : ''} autoComplete="new-password" />
              </Field>
              <Field label="Sender name" hint="Shown as who the email is from.">
                <Input value={form.fromName ?? ''} onChange={(e) => set({ fromName: e.target.value })} />
              </Field>
              <Field label="Sender email" hint={gmail ? 'Use the same Gmail address (or a verified alias).' : undefined}>
                <Input type="email" value={form.fromAddress ?? ''} onChange={(e) => set({ fromAddress: e.target.value })} />
              </Field>
              <Field label="Reply-to email (optional)" hint="Where customer replies go, if not the sender.">
                <Input type="email" value={form.replyTo ?? ''} onChange={(e) => set({ replyTo: e.target.value })} />
              </Field>
              <Field label="Website address (optional)" hint={`Used for links and images in emails. Empty uses ${current.detectedSiteUrl || 'the address you are browsing'}.`}>
                <Input value={form.siteUrl ?? ''} onChange={(e) => set({ siteUrl: e.target.value })} placeholder="https://www.yourstore.com" />
              </Field>
            </div>
          </Card>

          <Card title="Store alerts" description="Emails for you and your team.">
            <Field label="Send alerts to" hint="One or more addresses, separated by commas.">
              <Textarea rows={2} value={form.staffRecipients ?? ''} onChange={(e) => set({ staffRecipients: e.target.value })} placeholder="you@gmail.com, manager@gmail.com" />
            </Field>
            {!form.staffRecipients?.trim() && <p className="mt-2 text-xs text-amber-700">Add an address to receive new-order and low-stock alerts.</p>}
            <ul className="mt-2 divide-y divide-slate-100">{staffKinds.map((k) => kindRow(k))}</ul>
          </Card>

          <Card title="Customer emails" description="Order emails are sent when the customer gave an email address. Status emails wait 2 minutes, so a mis-click can be undone and a tracking code added first.">
            <ul className="divide-y divide-slate-100">{customerKinds.map((k) => kindRow(k))}</ul>
          </Card>

          <Card title="Account emails">
            <ul className="divide-y divide-slate-100">{accountKinds.map((k) => kindRow(k, k === 'PasswordReset'))}</ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Send a test">
            <p className="mb-3 text-sm text-slate-600">Saves your settings and sends a test right away, so you can see any problem immediately.</p>
            <div className="flex gap-2">
              <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@gmail.com" />
              <Button loading={test.isPending} disabled={!testTo.includes('@')} leftIcon={<Send className="size-4" />} onClick={() => test.mutate()}>
                Send
              </Button>
            </div>
          </Card>

          <Card title="Status" actions={<Link to="/admin/email/log" className="text-sm font-medium text-brand hover:underline">View log</Link>}>
            <dl className="space-y-2 text-sm">
              <StatusRow label="Sending" value={current.enabled ? <Badge tone="green" dot>On</Badge> : <Badge dot>Off</Badge>} />
              <StatusRow label="Last email sent" value={health.lastSentAt ? formatDate(health.lastSentAt, true) : 'None yet'} />
              <StatusRow label="Sent in the last 24 hours" value={health.sentLast24Hours} />
              <StatusRow label="Waiting to send" value={health.waiting} />
              <StatusRow label="Failed this week" value={health.failedLast7Days ? <span className="font-semibold text-rose-600">{health.failedLast7Days}</span> : 0} />
            </dl>
            {health.lastError && (
              <Alert variant="error" title="Latest problem" className="mt-4">
                {health.lastError}
              </Alert>
            )}
          </Card>
        </div>
      </div>
      <PreviewModal kind={preview} onClose={() => setPreview(null)} />
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  )
}

// ---------------------------------------------------------------- log

export function EmailLogPage() {
  useDocumentMeta({ title: 'Email log', noIndex: true })
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [openId, setOpenId] = useState<number | null>(null)
  const status = params.get('status') ?? ''
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') ?? 1)
  const setFilter = (patch: Record<string, string>) =>
    setParams((p) => {
      for (const [k, v] of Object.entries({ page: '', ...patch })) {
        if (v) p.set(k, v)
        else p.delete(k)
      }
      return p
    })

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'email', 'log', status, q, page],
    queryFn: () => http.get<Paged<EmailMessageItem>>('/admin/email/messages', { status, q, page, pageSize: 30 }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  })
  const { data: detail } = useQuery({
    queryKey: ['admin', 'email', 'message', openId],
    queryFn: () => http.get<EmailMessageDetail>(`/admin/email/messages/${openId}`),
    enabled: openId !== null,
  })
  const refresh = () => client.invalidateQueries({ queryKey: ['admin', 'email'] })
  const resend = useMutation({
    mutationFn: (id: number) => http.post(`/admin/email/messages/${id}/resend`),
    onSuccess: () => {
      toast.success('Email queued')
      setOpenId(null)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const sendNow = useMutation({
    mutationFn: (id: number) => http.post(`/admin/email/messages/${id}/send-now`),
    onSuccess: () => {
      toast.success('Sending now')
      setOpenId(null)
      setTimeout(refresh, 2000)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const open = detail?.message

  return (
    <div>
      <PageHeader back="/admin/email" title="Email log" description="Every email the store has sent or tried to send. Kept for 6 months." />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <SearchInput value={q} onChange={(v) => setFilter({ q: v })} placeholder="Search by email, subject or order #" className="min-w-60 flex-1" />
          <Select value={status} onChange={(e) => setFilter({ status: e.target.value })} className="w-44">
            <option value="">All statuses</option>
            {(['Sent', 'Pending', 'Failed', 'Skipped'] as EmailStatus[]).map((s) => (
              <option key={s} value={s}>
                {s === 'Pending' ? 'Waiting' : s}
              </option>
            ))}
          </Select>
        </div>
        <DataTable
          rows={data?.items}
          loading={isLoading}
          rowKey={(m) => m.id}
          onRowClick={(m) => setOpenId(m.id)}
          empty="No emails yet."
          columns={[
            {
              header: 'Email',
              cell: (m) => (
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{m.subject ?? emailKinds[m.kind].label}</p>
                  <p className="text-xs text-slate-500">
                    {emailKinds[m.kind].label}
                    {m.orderNumber && ` · Order #${m.orderNumber}`}
                  </p>
                </div>
              ),
            },
            { header: 'To', cell: (m) => <span className="text-slate-600">{m.toAddress}</span> },
            {
              header: 'Status',
              cell: (m) => (
                <div className="max-w-72">
                  <EmailStatusBadge email={m} />
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{emailWhen(m)}</p>
                </div>
              ),
            },
          ]}
        />
        {data && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{data.totalCount} emails</span>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => setFilter({ page: String(p) })} />
          </div>
        )}
      </Card>

      <Modal
        open={openId !== null}
        onClose={() => setOpenId(null)}
        size="2xl"
        title={open?.subject ?? (open ? emailKinds[open.kind].label : 'Email')}
        description={open && `To ${open.toName ? `${open.toName} <${open.toAddress}>` : open.toAddress} · ${emailWhen(open)}`}
        footer={
          open && (
            <>
              {open.orderId && (
                <ButtonLink to={`/admin/orders/${open.orderId}`} variant="ghost">
                  Open order #{open.orderNumber}
                </ButtonLink>
              )}
              {open.status === 'Pending' && (
                <Button variant="outline" loading={sendNow.isPending} onClick={() => sendNow.mutate(open.id)}>
                  Send now
                </Button>
              )}
              {open.status !== 'Pending' && open.kind !== 'PasswordReset' && open.kind !== 'Test' && (
                <Button leftIcon={<RotateCcw className="size-4" />} loading={resend.isPending} onClick={() => resend.mutate(open.id)}>
                  {open.status === 'Sent' ? 'Send again' : 'Try again'}
                </Button>
              )}
            </>
          )
        }
      >
        {!detail ? (
          <PageLoader />
        ) : (
          <div className="space-y-3">
            {open?.lastError && <Alert variant={open.status === 'Skipped' ? 'info' : 'error'}>{open.lastError}</Alert>}
            {detail.html ? (
              <EmailFrame html={detail.html} />
            ) : (
              <p className="rounded-xl bg-slate-50 p-4 text-sm whitespace-pre-line text-slate-600">{detail.text ?? 'This email is written just before it is sent.'}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
