import type {
  BannerPlacement,
  DiscountType,
  FooterGroup,
  HomeSectionType,
  OrderSource,
  OrderStatus,
  OrderSummary,
  PaymentMethodType,
  PaymentStatus,
  ProductOption,
  ProductSource,
  SectionImage,
} from './types'

export interface LookupCategory {
  id: number
  name: string
  parentId?: number | null
  path: string
  isActive: boolean
}

export interface Lookups {
  categories: LookupCategory[]
  brands: { id: number; name: string }[]
}

export interface AdminProductListItem {
  id: number
  name: string
  slug: string
  sku?: string | null
  imageUrl?: string | null
  categoryName: string
  brandName?: string | null
  price: number
  compareAtPrice?: number | null
  stockQuantity: number
  trackInventory: boolean
  isPreOrder: boolean
  hidePrice: boolean
  isActive: boolean
  isFeatured: boolean
  variantCount: number
  soldCount: number
  updatedAt: string
}

export interface VariantInput {
  id?: number | null
  option1?: string | null
  option2?: string | null
  option3?: string | null
  sku?: string | null
  price: number
  compareAtPrice?: number | null
  costPrice?: number | null
  stockQuantity: number
  imageUrl?: string | null
  isActive: boolean
}

export interface ProductForm {
  name: string
  slug?: string | null
  sku?: string | null
  categoryId: number
  brandId?: number | null
  shortDescription?: string | null
  description?: string | null
  warrantyInfo?: string | null
  badge?: string | null
  videoUrl?: string | null
  tags?: string | null
  trackInventory: boolean
  isPreOrder: boolean
  hidePrice: boolean
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  options: ProductOption[]
  specifications: { name: string; value: string }[]
  faqs: { question: string; answer: string }[]
  images: { url: string; altText?: string | null }[]
  variants: VariantInput[]
  metaTitle?: string | null
  metaDescription?: string | null
}

export interface AdminProduct extends ProductForm {
  id: number
  slug: string
  soldCount: number
  viewCount: number
  ratingAverage: number
  ratingCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminCategory {
  id: number
  name: string
  slug: string
  parentId?: number | null
  description?: string | null
  imageUrl?: string | null
  bannerUrl?: string | null
  icon?: string | null
  sortOrder: number
  isActive: boolean
  showInMenu: boolean
  isFeatured: boolean
  metaTitle?: string | null
  metaDescription?: string | null
  seoContent?: string | null
  productCount: number
}

export interface AdminBrand {
  id: number
  name: string
  slug: string
  logoUrl?: string | null
  description?: string | null
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  metaTitle?: string | null
  metaDescription?: string | null
  productCount: number
}

export interface AdminOrderListItem {
  id: number
  orderNumber: number
  createdAt: string
  customerName: string
  phone: string
  total: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethodName: string
  shippingMethodName: string
  itemCount: number
  source: OrderSource
}

export interface PhoneOrderStats {
  totalOrders: number
  delivered: number
  cancelled: number
  returned: number
  active: number
  deliveredValue: number
  successRate?: number | null
}

export interface AdminOrder {
  id: number
  orderNumber: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  source: OrderSource
  createdAt: string
  updatedAt: string
  userId?: number | null
  customerName: string
  phone: string
  email?: string | null
  address: string
  shippingMethodId?: number | null
  shippingMethodName: string
  shippingCost: number
  paymentMethodCode: string
  paymentMethodName: string
  paymentFee: number
  subtotal: number
  discountAmount: number
  couponCode?: string | null
  total: number
  paidAmount: number
  transactionId?: string | null
  paymentSenderNumber?: string | null
  customerNote?: string | null
  adminNote?: string | null
  courierName?: string | null
  trackingCode?: string | null
  ipAddress?: string | null
  items: {
    id: number
    productId?: number | null
    variantId?: number | null
    productName: string
    productSlug?: string | null
    variantTitle?: string | null
    sku?: string | null
    imageUrl?: string | null
    unitPrice: number
    costPrice?: number | null
    quantity: number
    lineTotal: number
  }[]
  history: { status: OrderStatus; note?: string | null; changedBy?: string | null; createdAt: string }[]
  customerHistory: PhoneOrderStats
}

export interface AdminCustomerListItem {
  id: number
  fullName: string
  email?: string | null
  phone?: string | null
  isActive: boolean
  createdAt: string
  lastLoginAt?: string | null
  orderCount: number
  totalSpent: number
}

export interface AdminCustomer extends AdminCustomerListItem {
  address?: string | null
  recentOrders: OrderSummary[]
  phoneHistory?: PhoneOrderStats | null
}

export interface AdminReview {
  id: number
  productId: number
  productName: string
  productSlug: string
  productImage?: string | null
  userId?: number | null
  customerName: string
  rating: number
  title?: string | null
  comment: string
  isApproved: boolean
  isFeatured: boolean
  isVerifiedPurchase: boolean
  adminReply?: string | null
  createdAt: string
}

export interface AdminCoupon {
  id: number
  code: string
  description?: string | null
  type: DiscountType
  value: number
  minOrderAmount?: number | null
  maxDiscountAmount?: number | null
  startsAt?: string | null
  expiresAt?: string | null
  usageLimit?: number | null
  usageLimitPerCustomer?: number | null
  usedCount: number
  isActive: boolean
  createdAt: string
}

export interface AdminBanner {
  id: number
  title?: string | null
  imageUrl: string
  mobileImageUrl?: string | null
  linkUrl?: string | null
  placement: BannerPlacement
  sortOrder: number
  isActive: boolean
  startsAt?: string | null
  endsAt?: string | null
}

export interface HomeSectionTab {
  title: string
  source: ProductSource
  categoryId?: number | null
  brandId?: number | null
  productIds: number[]
  limit: number
}

export interface HomeSectionConfig {
  source: ProductSource
  categoryId?: number | null
  brandId?: number | null
  productIds: number[]
  limit: number
  tabs: HomeSectionTab[]
  categoryIds: number[]
  images: SectionImage[]
  html?: string | null
  viewAllUrl?: string | null
}

export interface AdminHomeSection {
  id: number
  title: string
  subtitle?: string | null
  type: HomeSectionType
  config: HomeSectionConfig
  sortOrder: number
  isActive: boolean
}

export interface AdminBlogPostListItem {
  id: number
  title: string
  slug: string
  coverImageUrl?: string | null
  isPublished: boolean
  publishedAt?: string | null
  viewCount: number
  updatedAt: string
}

export interface AdminBlogPost {
  id: number
  title: string
  slug: string
  excerpt?: string | null
  content: string
  coverImageUrl?: string | null
  authorName?: string | null
  isPublished: boolean
  publishedAt?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
}

export interface AdminPage {
  id: number
  title: string
  slug: string
  content: string
  footerGroup: FooterGroup
  sortOrder: number
  isActive: boolean
  metaTitle?: string | null
  metaDescription?: string | null
  updatedAt: string
}

export interface AdminShippingMethod {
  id: number
  name: string
  description?: string | null
  cost: number
  estimatedDelivery?: string | null
  isPickup: boolean
  freeShippingEligible: boolean
  sortOrder: number
  isActive: boolean
}

export interface AdminPaymentMethod {
  id: number
  code: string
  name: string
  type: PaymentMethodType
  instructions?: string | null
  accountNumber?: string | null
  feePercent: number
  requiresTransactionId: boolean
  logoUrl?: string | null
  sortOrder: number
  isActive: boolean
}

export interface Staff {
  id: number
  fullName: string
  email?: string | null
  phone?: string | null
  role: 'Admin' | 'Manager'
  isActive: boolean
  createdAt: string
  lastLoginAt?: string | null
}

export interface DailySalesPoint {
  date: string
  orders: number
  revenue: number
}

export interface TopProduct {
  productId?: number | null
  name: string
  imageUrl?: string | null
  quantity: number
  revenue: number
}

export interface AdminCounts {
  pendingOrders: number
  pendingReviews: number
}

export interface Dashboard {
  revenueToday: number
  ordersToday: number
  revenueThisMonth: number
  ordersThisMonth: number
  revenueLastMonth: number
  pendingOrders: number
  totalCustomers: number
  newCustomersThisMonth: number
  activeProducts: number
  lowStockCount: number
  outOfStockCount: number
  pendingReviews: number
  sales: DailySalesPoint[]
  statusBreakdown: Record<string, number>
  recentOrders: AdminOrderListItem[]
  topProducts: TopProduct[]
  lowStock: { productId: number; variantId: number; productName: string; variantTitle?: string | null; stock: number; imageUrl?: string | null }[]
}

export interface SalesReport {
  from: string
  to: string
  orders: number
  revenue: number
  averageOrderValue: number
  discounts: number
  shippingCharges: number
  grossProfit?: number | null
  itemsSold: number
  cancelledOrders: number
  daily: DailySalesPoint[]
  topProducts: TopProduct[]
  byPaymentMethod: { name: string; value: number; count: number }[]
  bySource: { name: string; value: number; count: number }[]
  byCategory: { name: string; value: number; count: number }[]
}

// ---------- Email ----------

export type EmailKind =
  | 'OrderPlaced'
  | 'OrderConfirmed'
  | 'OrderShipped'
  | 'OrderDelivered'
  | 'OrderCancelled'
  | 'OrderReturned'
  | 'PaymentReceived'
  | 'PaymentRefunded'
  | 'Welcome'
  | 'PasswordReset'
  | 'PasswordChanged'
  | 'NewsletterWelcome'
  | 'StaffWelcome'
  | 'StaffNewOrder'
  | 'StaffLowStock'
  | 'StaffNewReview'
  | 'Test'

export type EmailStatus = 'Pending' | 'Sending' | 'Sent' | 'Failed' | 'Skipped'
export type SmtpSecurity = 'StartTls' | 'SslOnConnect' | 'Auto' | 'None'

export interface EmailSettings {
  enabled: boolean
  host?: string | null
  port: number
  security: SmtpSecurity
  userName?: string | null
  hasPassword: boolean
  passwordUnreadable: boolean
  fromName?: string | null
  fromAddress?: string | null
  replyTo?: string | null
  siteUrl?: string | null
  staffRecipients?: string | null
  disabledKinds: EmailKind[]
  detectedSiteUrl: string
  health: { lastSentAt?: string | null; sentLast24Hours: number; waiting: number; failedLast7Days: number; lastError?: string | null }
}

export interface EmailMessageItem {
  id: number
  kind: EmailKind
  status: EmailStatus
  toAddress: string
  toName?: string | null
  subject?: string | null
  orderId?: number | null
  orderNumber?: number | null
  attempts: number
  lastError?: string | null
  createdAt: string
  nextAttemptAt: string
  sentAt?: string | null
}

export interface EmailMessageDetail {
  message: EmailMessageItem
  html?: string | null
  text?: string | null
}
