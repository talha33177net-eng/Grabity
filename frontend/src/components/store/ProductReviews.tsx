import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Form'
import { Pagination, StarInput, Stars } from '@/components/ui/Misc'
import { useMe } from '@/hooks/useStore'
import { errorMessage, http } from '@/lib/api'
import { formatDate } from '@/lib/format'
import type { Paged, Review, ReviewSummary } from '@/lib/types'
import { initials } from '@/lib/utils'

export function ProductReviews({ productId, summary }: { productId: number; summary: ReviewSummary }) {
  const [page, setPage] = useState(1)
  const [writing, setWriting] = useState(false)
  const { data: user } = useMe()
  const location = useLocation()
  const { data } = useQuery({
    queryKey: ['reviews', productId, page],
    queryFn: () => http.get<Paged<Review>>(`/products/${productId}/reviews`, { page, pageSize: 5 }),
  })

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      <div>
        <div className="rounded-2xl bg-slate-50 p-5">
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-slate-900">{summary.count ? summary.average.toFixed(1) : '–'}</span>
            <div className="pb-1">
              <Stars value={summary.average} size="md" />
              <p className="mt-0.5 text-xs text-slate-500">
                {summary.count} review{summary.count === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.breakdown[star - 1] ?? 0
              const pct = summary.count ? (count / summary.count) * 100 : 0
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-3">{star}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-slate-400">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
        {user ? (
          <Button className="mt-4 w-full" variant="outline" onClick={() => setWriting((v) => !v)} leftIcon={<MessageSquareText className="size-4" />}>
            Write a review
          </Button>
        ) : (
          <Link to={`/login?redirect=${encodeURIComponent(location.pathname + '#reviews')}`} className="mt-4 block rounded-xl border border-dashed border-slate-300 p-3 text-center text-sm text-slate-600 hover:border-brand hover:text-brand">
            <span className="font-semibold">Sign in</span> to write a review
          </Link>
        )}
      </div>

      <div className="min-w-0">
        {writing && <ReviewForm productId={productId} onDone={() => setWriting(false)} />}
        {data && data.items.length === 0 && !writing && (
          <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No reviews yet. Be the first to share your experience!</p>
        )}
        <ul className="divide-y divide-slate-100">
          {data?.items.map((review) => (
            <li key={review.id} className="py-5 first:pt-0">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{initials(review.customerName)}</span>
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    {review.customerName}
                    {review.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600">
                        <BadgeCheck className="size-3.5" /> Verified purchase
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <Stars value={review.rating} size="xs" />
                    <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                  </div>
                </div>
              </div>
              {review.title && <p className="mt-3 text-sm font-semibold text-slate-900">{review.title}</p>}
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-700">{review.comment}</p>
              {review.adminReply && (
                <div className="mt-3 rounded-xl border-l-4 border-brand bg-brand-softer px-4 py-3 text-sm text-slate-700">
                  <p className="mb-1 text-xs font-semibold text-brand">Reply from the store</p>
                  {review.adminReply}
                </div>
              )}
            </li>
          ))}
        </ul>
        {data && <Pagination className="mt-4" page={data.page} totalPages={data.totalPages} onChange={setPage} />}
      </div>
    </div>
  )
}

function ReviewForm({ productId, onDone }: { productId: number; onDone: () => void }) {
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const client = useQueryClient()
  const submit = useMutation({
    mutationFn: () => http.post<{ message: string; isApproved: boolean }>(`/products/${productId}/reviews`, { rating, title, comment }),
    onSuccess: (r) => {
      toast.success(r.message)
      client.invalidateQueries({ queryKey: ['reviews', productId] })
      onDone()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <form
      className="mb-6 space-y-3 rounded-2xl border border-slate-200 p-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit.mutate()
      }}
    >
      <p className="text-sm font-semibold text-slate-900">Your rating</p>
      <StarInput value={rating} onChange={setRating} />
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Title (optional)" className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand" />
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} required minLength={3} maxLength={4000} placeholder="What did you like or dislike? How was the delivery?" />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={submit.isPending}>
          Submit review
        </Button>
      </div>
    </form>
  )
}
