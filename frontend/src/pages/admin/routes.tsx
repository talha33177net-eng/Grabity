import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'
import { PageLoader } from '@/components/ui/Feedback'
import { NotFoundPage, RouteErrorPage } from '@/pages/store/NotFoundPage'

/** Lazily loads one named export of a page module. */
const page =
  <M,>(loader: () => Promise<M>, pick: (module: M) => ComponentType) =>
  async () => ({ Component: pick(await loader()) })

const orders = () => import('./OrdersPages')
const products = () => import('./ProductsPages')
const catalog = () => import('./CatalogPages')
const people = () => import('./PeoplePages')
const marketing = () => import('./MarketingPages')
const content = () => import('./ContentPages')
const settings = () => import('./SettingsPages')
const email = () => import('./EmailPages')

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin/login',
    lazy: page(() => import('./LoginPage'), (m) => m.default),
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <PageLoader />,
  },
  {
    // Printable invoice renders without the admin chrome.
    path: '/admin/orders/:id/invoice',
    lazy: async () => {
      const [{ InvoicePage }, { RequireStaff }] = await Promise.all([orders(), import('@/layouts/AdminLayout')])
      return {
        Component: () => (
          <RequireStaff>
            <InvoicePage />
          </RequireStaff>
        ),
      }
    },
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <PageLoader />,
  },
  {
    path: '/admin',
    lazy: page(() => import('@/layouts/AdminLayout'), (m) => m.AdminLayout),
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      { index: true, lazy: page(() => import('./DashboardPage'), (m) => m.default) },
      { path: 'orders', lazy: page(orders, (m) => m.OrdersPage) },
      { path: 'orders/new', lazy: page(orders, (m) => m.OrderCreatePage) },
      { path: 'orders/:id', lazy: page(orders, (m) => m.OrderDetailPage) },
      { path: 'products', lazy: page(products, (m) => m.ProductsPage) },
      { path: 'products/new', lazy: page(products, (m) => m.ProductEditPage) },
      { path: 'products/:id', lazy: page(products, (m) => m.ProductEditPage) },
      { path: 'categories', lazy: page(catalog, (m) => m.CategoriesPage) },
      { path: 'brands', lazy: page(catalog, (m) => m.BrandsPage) },
      { path: 'customers', lazy: page(people, (m) => m.CustomersPage) },
      { path: 'customers/:id', lazy: page(people, (m) => m.CustomerDetailPage) },
      { path: 'reviews', lazy: page(people, (m) => m.ReviewsAdminPage) },
      { path: 'staff', lazy: page(people, (m) => m.StaffPage) },
      { path: 'newsletter', lazy: page(people, (m) => m.NewsletterPage) },
      { path: 'coupons', lazy: page(marketing, (m) => m.CouponsPage) },
      { path: 'banners', lazy: page(marketing, (m) => m.BannersPage) },
      { path: 'home-sections', lazy: page(marketing, (m) => m.HomeSectionsPage) },
      { path: 'blog', lazy: page(content, (m) => m.BlogPostsPage) },
      { path: 'blog/new', lazy: page(content, (m) => m.BlogPostEditPage) },
      { path: 'blog/:id', lazy: page(content, (m) => m.BlogPostEditPage) },
      { path: 'pages', lazy: page(content, (m) => m.PagesPage) },
      { path: 'pages/new', lazy: page(content, (m) => m.PageEditPage) },
      { path: 'pages/:id', lazy: page(content, (m) => m.PageEditPage) },
      { path: 'settings', lazy: page(settings, (m) => m.SettingsPage) },
      { path: 'shipping', lazy: page(settings, (m) => m.ShippingPage) },
      { path: 'payments', lazy: page(settings, (m) => m.PaymentsPage) },
      { path: 'email', lazy: page(email, (m) => m.EmailSettingsPage) },
      { path: 'email/log', lazy: page(email, (m) => m.EmailLogPage) },
      { path: 'reports', lazy: page(() => import('./ReportsPage'), (m) => m.default) },
      { path: '*', element: <NotFoundPage title="Admin page not found" /> },
    ],
  },
]
