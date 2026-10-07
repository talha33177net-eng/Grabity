import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, FileText, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ActiveBadge, Card, DataTable, ImageUpload, PageHeader, SearchInput, useConfirm } from '@/components/admin/Common'
import { RichTextEditor } from '@/components/admin/RichTextEditor'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Badge, PageLoader } from '@/components/ui/Feedback'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Form'
import { Pagination } from '@/components/ui/Misc'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { errorMessage, http } from '@/lib/api'
import type { AdminBlogPost, AdminBlogPostListItem, AdminPage } from '@/lib/adminTypes'
import { formatDate } from '@/lib/format'
import type { FooterGroup, Paged } from '@/lib/types'
import { img } from '@/lib/utils'

const toLocalInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ---------------------------------------------------------------- blog

export function BlogPostsPage() {
  useDocumentMeta({ title: 'Blog', noIndex: true })
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'blog', q, page],
    queryFn: () => http.get<Paged<AdminBlogPostListItem>>('/admin/blog', { q, page }),
    placeholderData: keepPreviousData,
  })
  return (
    <div>
      <PageHeader
        title="Blog"
        description="Buying guides, reviews and news help customers and bring in search traffic."
        actions={
          <ButtonLink to="/admin/blog/new">
            <Plus className="size-4" /> New post
          </ButtonLink>
        }
      />
      <Card bodyClass="p-0">
        <div className="border-b border-slate-100 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Search posts..." className="w-full sm:w-72" />
        </div>
        <DataTable
          rows={data?.items}
          loading={isLoading}
          rowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/admin/blog/${p.id}`)}
          empty="No posts yet."
          columns={[
            {
              header: 'Post',
              cell: (p) => (
                <div className="flex items-center gap-3">
                  <span className="h-11 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">{p.coverImageUrl && <img src={img(p.coverImageUrl, 160)} alt="" className="size-full object-cover" />}</span>
                  <div className="min-w-0">
                    <p className="line-clamp-1 font-medium text-slate-900">{p.title}</p>
                    <p className="text-xs text-slate-500">/blog/{p.slug}</p>
                  </div>
                </div>
              ),
            },
            { header: 'Status', cell: (p) => (p.isPublished ? <Badge tone="green" dot>Published</Badge> : <Badge dot>Draft</Badge>) },
            { header: 'Published', cell: (p) => <span className="text-xs text-slate-500">{p.publishedAt ? formatDate(p.publishedAt) : '—'}</span> },
            { header: 'Views', cell: (p) => p.viewCount },
          ]}
        />
        {data && (
          <div className="flex justify-end border-t border-slate-100 px-4 py-3">
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  )
}

type PostForm = Omit<AdminBlogPost, 'id'>
const emptyPost: PostForm = { title: '', slug: '', excerpt: '', content: '', coverImageUrl: null, authorName: '', isPublished: false, publishedAt: null, metaTitle: '', metaDescription: '' }

export function BlogPostEditPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const client = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const [form, setForm] = useState<PostForm>(emptyPost)
  const { data: post, isLoading } = useQuery({ queryKey: ['admin', 'post', id], queryFn: () => http.get<AdminBlogPost>(`/admin/blog/${id}`), enabled: !isNew })
  useDocumentMeta({ title: isNew ? 'New post' : (post?.title ?? 'Post'), noIndex: true })
  useEffect(() => {
    if (post) setForm({ ...post })
  }, [post])

  const save = useMutation({
    mutationFn: () => (isNew ? http.post<AdminBlogPost>('/admin/blog', form) : http.put<AdminBlogPost>(`/admin/blog/${id}`, form)),
    onSuccess: (saved) => {
      toast.success('Post saved')
      client.invalidateQueries({ queryKey: ['admin', 'blog'] })
      if (isNew) navigate(`/admin/blog/${saved.id}`, { replace: true })
      else setForm({ ...saved })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: () => http.delete(`/admin/blog/${id}`),
    onSuccess: () => {
      toast.success('Post deleted')
      client.invalidateQueries({ queryKey: ['admin', 'blog'] })
      navigate('/admin/blog')
    },
  })

  if (!isNew && (isLoading || !post)) return <PageLoader />
  const set = (patch: Partial<PostForm>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <div>
      {confirmDialog}
      <PageHeader
        back="/admin/blog"
        title={isNew ? 'New post' : form.title || 'Edit post'}
        actions={
          <>
            {!isNew && post?.isPublished && (
              <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <ExternalLink className="size-4" /> View
              </a>
            )}
            <Button loading={save.isPending} disabled={!form.title.trim()} onClick={() => save.mutate()}>
              {form.isPublished ? 'Save & publish' : 'Save draft'}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <div className="space-y-4">
            <Field label="Title" required>
              <Input value={form.title} onChange={(e) => set({ title: e.target.value })} className="text-base font-semibold" />
            </Field>
            <Field label="Excerpt" hint="Short summary shown on blog cards.">
              <Textarea rows={2} value={form.excerpt ?? ''} onChange={(e) => set({ excerpt: e.target.value })} />
            </Field>
            <Field label="Content">
              <RichTextEditor value={form.content} onChange={(content) => set({ content })} folder="blog" minHeight="min-h-[420px]" />
            </Field>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Publishing">
            <div className="space-y-4">
              <Switch checked={form.isPublished} onChange={(v) => set({ isPublished: v })} label="Published" description="Drafts are only visible here." />
              <Field label="Publish date" hint="Future dates schedule the post.">
                <Input type="datetime-local" value={toLocalInput(form.publishedAt)} onChange={(e) => set({ publishedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </Field>
              <Field label="Author">
                <Input value={form.authorName ?? ''} onChange={(e) => set({ authorName: e.target.value })} />
              </Field>
            </div>
          </Card>
          <Card title="Cover image">
            <ImageUpload value={form.coverImageUrl} onChange={(url) => set({ coverImageUrl: url })} folder="blog" aspect="aspect-[1.9/1]" />
          </Card>
          <Card title="SEO">
            <div className="space-y-4">
              <Field label="URL slug">
                <Input value={form.slug ?? ''} onChange={(e) => set({ slug: e.target.value })} placeholder="Auto from title" />
              </Field>
              <Field label="Meta title">
                <Input value={form.metaTitle ?? ''} onChange={(e) => set({ metaTitle: e.target.value })} />
              </Field>
              <Field label="Meta description">
                <Textarea rows={3} value={form.metaDescription ?? ''} onChange={(e) => set({ metaDescription: e.target.value })} />
              </Field>
            </div>
          </Card>
          {!isNew && (
            <Button
              variant="ghost"
              className="w-full text-rose-600 hover:bg-rose-50"
              leftIcon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await confirm({ title: 'Delete this post?', confirmLabel: 'Delete', danger: true })) remove.mutate()
              }}
            >
              Delete post
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- pages

const groups: { value: FooterGroup; label: string }[] = [
  { value: 'None', label: 'Not in footer' },
  { value: 'About', label: 'About column' },
  { value: 'Policy', label: 'Policy column' },
  { value: 'Help', label: 'Help column' },
]

export function PagesPage() {
  useDocumentMeta({ title: 'Pages', noIndex: true })
  const navigate = useNavigate()
  const { data: pages, isLoading } = useQuery({ queryKey: ['admin', 'pages'], queryFn: () => http.get<AdminPage[]>('/admin/pages') })
  return (
    <div>
      <PageHeader
        title="Pages"
        description="About us, policies, FAQ and other content pages. Choose a footer column to link them in the footer."
        actions={
          <ButtonLink to="/admin/pages/new">
            <Plus className="size-4" /> New page
          </ButtonLink>
        }
      />
      <Card bodyClass="p-0">
        <DataTable
          rows={pages}
          loading={isLoading}
          rowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/admin/pages/${p.id}`)}
          columns={[
            {
              header: 'Page',
              cell: (p) => (
                <div className="flex items-center gap-3">
                  <FileText className="size-5 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-900">{p.title}</p>
                    <p className="text-xs text-slate-500">/page/{p.slug}</p>
                  </div>
                </div>
              ),
            },
            { header: 'Footer', cell: (p) => groups.find((g) => g.value === p.footerGroup)?.label },
            { header: 'Updated', cell: (p) => <span className="text-xs text-slate-500">{formatDate(p.updatedAt)}</span> },
            { header: 'Status', cell: (p) => <ActiveBadge active={p.isActive} /> },
          ]}
        />
      </Card>
    </div>
  )
}

type PageForm = Omit<AdminPage, 'id' | 'updatedAt'>
const emptyPage: PageForm = { title: '', slug: '', content: '', footerGroup: 'None', sortOrder: 0, isActive: true, metaTitle: '', metaDescription: '' }

export function PageEditPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const client = useQueryClient()
  const [confirm, confirmDialog] = useConfirm()
  const [form, setForm] = useState<PageForm>(emptyPage)
  const { data: page, isLoading } = useQuery({ queryKey: ['admin', 'page', id], queryFn: () => http.get<AdminPage>(`/admin/pages/${id}`), enabled: !isNew })
  useDocumentMeta({ title: isNew ? 'New page' : (page?.title ?? 'Page'), noIndex: true })
  useEffect(() => {
    if (page) setForm({ ...page })
  }, [page])

  const save = useMutation({
    mutationFn: () => (isNew ? http.post<AdminPage>('/admin/pages', form) : http.put<AdminPage>(`/admin/pages/${id}`, form)),
    onSuccess: (saved) => {
      toast.success('Page saved')
      client.invalidateQueries({ queryKey: ['admin', 'pages'] })
      if (isNew) navigate(`/admin/pages/${saved.id}`, { replace: true })
      else setForm({ ...saved })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: () => http.delete(`/admin/pages/${id}`),
    onSuccess: () => {
      toast.success('Page deleted')
      client.invalidateQueries({ queryKey: ['admin', 'pages'] })
      navigate('/admin/pages')
    },
  })

  if (!isNew && (isLoading || !page)) return <PageLoader />
  const set = (patch: Partial<PageForm>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <div>
      {confirmDialog}
      <PageHeader
        back="/admin/pages"
        title={isNew ? 'New page' : form.title || 'Edit page'}
        actions={
          <>
            {!isNew && page && (
              <a href={`/page/${page.slug}`} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <ExternalLink className="size-4" /> View
              </a>
            )}
            <Button loading={save.isPending} disabled={!form.title.trim()} onClick={() => save.mutate()}>
              Save page
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <div className="space-y-4">
            <Field label="Title" required>
              <Input value={form.title} onChange={(e) => set({ title: e.target.value })} className="text-base font-semibold" />
            </Field>
            <Field label="Content">
              <RichTextEditor value={form.content} onChange={(content) => set({ content })} folder="pages" minHeight="min-h-[420px]" />
            </Field>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Settings">
            <div className="space-y-4">
              <Switch checked={form.isActive} onChange={(v) => set({ isActive: v })} label="Published" />
              <Field label="Footer column">
                <Select value={form.footerGroup} onChange={(e) => set({ footerGroup: e.target.value as FooterGroup })}>
                  {groups.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Order in footer">
                <Input type="number" value={form.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
              </Field>
              <Field label="URL slug">
                <Input value={form.slug ?? ''} onChange={(e) => set({ slug: e.target.value })} placeholder="Auto from title" />
              </Field>
            </div>
          </Card>
          <Card title="SEO">
            <div className="space-y-4">
              <Field label="Meta title">
                <Input value={form.metaTitle ?? ''} onChange={(e) => set({ metaTitle: e.target.value })} />
              </Field>
              <Field label="Meta description">
                <Textarea rows={3} value={form.metaDescription ?? ''} onChange={(e) => set({ metaDescription: e.target.value })} />
              </Field>
            </div>
          </Card>
          {!isNew && (
            <Button
              variant="ghost"
              className="w-full text-rose-600 hover:bg-rose-50"
              leftIcon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await confirm({ title: 'Delete this page?', message: 'Links to it will stop working.', confirmLabel: 'Delete', danger: true })) remove.mutate()
              }}
            >
              Delete page
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
