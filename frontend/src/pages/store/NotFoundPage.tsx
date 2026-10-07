import { SearchX, TriangleAlert } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

export function NotFoundPage({ title = 'Page not found', description = "We couldn't find the page you were looking for. It may have moved or no longer exists." }: { title?: string; description?: string }) {
  useDocumentMeta({ title, noIndex: true })
  return (
    <div className="container-x py-16">
      <EmptyState
        icon={<SearchX className="size-6" />}
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink to="/">Go to homepage</ButtonLink>
            <ButtonLink to="/categories" variant="outline">
              Browse categories
            </ButtonLink>
          </div>
        }
      />
    </div>
  )
}

/** Shown when a route throws (e.g. a lazy chunk fails to load after a deploy). */
export function RouteErrorPage() {
  const error = useRouteError()
  const chunkError = error instanceof Error && /dynamically imported module|Failed to fetch/i.test(error.message)
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
      <EmptyState
        icon={<TriangleAlert className="size-6" />}
        title={isRouteErrorResponse(error) && error.status === 404 ? 'Page not found' : 'Something went wrong'}
        description={chunkError ? 'A new version of the site is available. Please reload the page.' : 'Please reload the page or go back to the homepage.'}
        action={
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white">
              Reload
            </button>
            <a href="/" className="flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800">
              Homepage
            </a>
          </div>
        }
      />
    </div>
  )
}
