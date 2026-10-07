import { createBrowserRouter, type RouteObject } from 'react-router'
import { PageLoader } from '@/components/ui/Feedback'
import { StoreLayout, type StoreRouteHandle } from '@/layouts/StoreLayout'
import { ensureHistoryKey } from '@/lib/scroll'
import HomePage from '@/pages/store/HomePage'
import { NotFoundPage, RouteErrorPage } from '@/pages/store/NotFoundPage'
import { adminRoutes } from '@/pages/admin/routes'

const catalog = () => import('@/pages/store/CatalogPages')
const orders = () => import('@/pages/store/OrderPages')
const auth = () => import('@/pages/store/AuthPages')
const account = () => import('@/pages/store/AccountPages')
const content = () => import('@/pages/store/ContentPages')

const storeRoutes: RouteObject[] = [
  { index: true, element: <HomePage /> },
  { path: 'category/:slug', lazy: async () => ({ Component: (await catalog()).CategoryPage }) },
  { path: 'categories', lazy: async () => ({ Component: (await catalog()).CategoriesPage }) },
  { path: 'brand/:slug', lazy: async () => ({ Component: (await catalog()).BrandPage }) },
  { path: 'brands', lazy: async () => ({ Component: (await catalog()).BrandsPage }) },
  { path: 'search', lazy: async () => ({ Component: (await catalog()).SearchPage }) },
  { path: 'offers', lazy: async () => ({ Component: (await catalog()).OffersPage }) },
  {
    path: 'product/:slug',
    handle: { ownBottomBar: true } satisfies StoreRouteHandle,
    lazy: async () => ({ Component: (await import('@/pages/store/ProductPage')).default }),
  },
  { path: 'cart', lazy: async () => ({ Component: (await import('@/pages/store/CartPage')).default }) },
  {
    path: 'checkout',
    handle: { hideWhatsApp: true, ownBottomBar: true } satisfies StoreRouteHandle,
    lazy: async () => ({ Component: (await import('@/pages/store/CheckoutPage')).default }),
  },
  { path: 'order/success/:orderNumber', lazy: async () => ({ Component: (await orders()).OrderSuccessPage }) },
  { path: 'track-order', lazy: async () => ({ Component: (await orders()).TrackOrderPage }) },
  { path: 'login', lazy: async () => ({ Component: (await auth()).LoginPage }) },
  { path: 'register', lazy: async () => ({ Component: (await auth()).RegisterPage }) },
  { path: 'forgot-password', lazy: async () => ({ Component: (await auth()).ForgotPasswordPage }) },
  { path: 'reset-password', lazy: async () => ({ Component: (await auth()).ResetPasswordPage }) },
  { path: 'newsletter/unsubscribe', lazy: async () => ({ Component: (await auth()).UnsubscribePage }) },
  {
    path: 'account',
    lazy: async () => ({ Component: (await account()).AccountLayout }),
    children: [
      { index: true, lazy: async () => ({ Component: (await account()).AccountOverviewPage }) },
      { path: 'orders', lazy: async () => ({ Component: (await account()).AccountOrdersPage }) },
      { path: 'orders/:orderNumber', lazy: async () => ({ Component: (await account()).AccountOrderPage }) },
      { path: 'reviews', lazy: async () => ({ Component: (await account()).AccountReviewsPage }) },
      { path: 'settings', lazy: async () => ({ Component: (await account()).AccountSettingsPage }) },
    ],
  },
  { path: 'reviews', lazy: async () => ({ Component: (await content()).ReviewsPage }) },
  { path: 'blog', lazy: async () => ({ Component: (await content()).BlogPage }) },
  { path: 'blog/:slug', lazy: async () => ({ Component: (await content()).BlogPostPage }) },
  { path: 'page/:slug', lazy: async () => ({ Component: (await content()).CmsPageView }) },
  { path: '*', element: <NotFoundPage /> },
]

ensureHistoryKey()

export const router = createBrowserRouter([
  {
    element: <StoreLayout />,
    errorElement: <RouteErrorPage />,
    // Shown while the first lazily-loaded page chunk downloads.
    hydrateFallbackElement: <PageLoader />,
    children: storeRoutes,
  },
  ...adminRoutes,
])
