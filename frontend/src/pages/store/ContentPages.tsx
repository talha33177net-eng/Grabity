import { useQuery } from '@tanstack/react-query'
import { CalendarDays, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { BlogCardView, ReviewCardView } from '@/components/store/HomeBlocks'
import { Breadcrumbs, RichContent } from '@/components/store/Sections'
import { PageLoader } from '@/components/ui/Feedback'
import { Select } from '@/components/ui/Form'
import { Pagination } from '@/components/ui/Misc'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { ApiError, http } from '@/lib/api'
import { formatDate } from '@/lib/format'
import type { BlogCard, BlogPost, CmsPage, Paged, ReviewCard } from '@/lib/types'
import { img } from '@/lib/utils'
import { NotFoundPage } from './NotFoundPage'

export function ReviewsPage() {
  const [sort, setSort] = useState('')
  const [page, setPage] = useState(1)
  useDocumentMeta({ title: 'Customer reviews', description: 'Read what our customers say about their purchases.' })
  const { data, isLoading } = useQuery({ queryKey: ['all-reviews', sort, page], queryFn: () => http.get<Paged<ReviewCard>>('/reviews', { sort, page, pageSize: 12 }) })

  return (
    <div className="container-x pt-4 sm:pt-6">
      <Breadcrumbs items={[]} current="Customer reviews" className="mb-4" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Customer reviews</h1>
          <p className="mt-1 text-sm text-slate-500">{data ? `${data.totalCount} verified reviews from our customers` : 'Loading reviews...'}</p>
        </div>
        <Select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value)
            setPage(1)
          }}
          className="w-auto"
        >
          <option value="">Featured</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="highest">Highest rating</option>
          <option value="lowest">Lowest rating</option>
        </Select>
      </div>
      {isLoading ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.items.map((review) => (
              <ReviewCardView key={review.id} review={review} />
            ))}
          </div>
          {data && <Pagination className="mt-8" page={data.page} totalPages={data.totalPages} onChange={setPage} />}
        </>
      )}
    </div>
  )
}

export function BlogPage() {
  const [page, setPage] = useState(1)
  useDocumentMeta({ title: 'Blog', description: 'Reviews, tips, buying guides and news from the world of gadgets.' })
  const { data, isLoading } = useQuery({ queryKey: ['blog', page], queryFn: () => http.get<Paged<BlogCard>>('/blog', { page, pageSize: 9 }) })
  return (
    <div className="container-x pt-4 sm:pt-6">
      <Breadcrumbs items={[]} current="Blog" className="mb-4" />
      <p className="text-sm font-semibold tracking-widest text-brand uppercase">Blog</p>
      <h1 className="mt-1 mb-6 text-2xl font-bold text-slate-900 sm:text-3xl">Latest posts</h1>
      {isLoading ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data?.items.map((post) => (
              <BlogCardView key={post.id} post={post} />
            ))}
          </div>
          {data && <Pagination className="mt-8" page={data.page} totalPages={data.totalPages} onChange={setPage} />}
        </>
      )}
    </div>
  )
}

export function BlogPostPage() {
  const { slug = '' } = useParams()
  const { data: post, error, isLoading } = useQuery({ queryKey: ['post', slug], queryFn: () => http.get<BlogPost>(`/blog/${slug}`) })
  useDocumentMeta({ title: post?.metaTitle ?? post?.title, description: post?.metaDescription ?? post?.excerpt, image: post?.coverImageUrl })
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage title="Post not found" />
  if (isLoading || !post) return <PageLoader />
  return (
    <div className="container-x pt-4 sm:pt-6">
      <Breadcrumbs items={[{ name: 'Blog', to: '/blog' }]} current={post.title} className="mb-4" />
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl leading-tight font-bold tracking-tight text-slate-900 sm:text-4xl">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
          {post.publishedAt && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {formatDate(post.publishedAt)}
            </span>
          )}
          {post.authorName && (
            <span className="flex items-center gap-1.5">
              <UserRound className="size-4" /> {post.authorName}
            </span>
          )}
        </div>
        {post.coverImageUrl && <img src={img(post.coverImageUrl, 1200)} alt="" className="mt-6 aspect-[1.9/1] w-full rounded-3xl object-cover" />}
        <div className="mt-8 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-10">
          <RichContent html={post.content} className="prose-lg" />
        </div>
      </article>
    </div>
  )
}

export function CmsPageView() {
  const { slug = '' } = useParams()
  const { data: page, error, isLoading } = useQuery({ queryKey: ['page', slug], queryFn: () => http.get<CmsPage>(`/pages/${slug}`) })
  useDocumentMeta({ title: page?.metaTitle ?? page?.title, description: page?.metaDescription })
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />
  if (isLoading || !page) return <PageLoader />
  return (
    <div className="container-x pt-4 sm:pt-6">
      <Breadcrumbs items={[]} current={page.title} className="mb-4" />
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-10">
        <h1 className="mb-6 text-2xl font-bold text-slate-900 sm:text-3xl">{page.title}</h1>
        <RichContent html={page.content} />
      </div>
    </div>
  )
}
