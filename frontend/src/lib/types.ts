// Types mirroring the ASP.NET Core API contracts (camelCase JSON).

export type OrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned'
export type PaymentStatus = 'Unpaid' | 'Verifying' | 'PartiallyPaid' | 'Paid' | 'Refunded'
export type OrderSource = 'Website' | 'Phone' | 'Facebook' | 'WhatsApp' | 'Instagram' | 'Store' | 'Other'
export type PaymentMethodType = 'CashOnDelivery' | 'MobileBanking' | 'BankTransfer'
export type DiscountType = 'Percentage' | 'FixedAmount' | 'FreeShipping'
export type BannerPlacement = 'HeroSlider' | 'HeroSide' | 'Popup'
export type HomeSectionType = 'Categories' | 'Products' | 'ProductTabs' | 'Brands' | 'Reviews' | 'Blog' | 'Banners' | 'RichText'
export type ProductSource = 'Newest' | 'Featured' | 'BestSelling' | 'OnSale' | 'TopRated' | 'Category' | 'Brand' | 'Manual'
export type FooterGroup = 'None' | 'About' | 'Policy' | 'Help'

export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

// ---------- Settings ----------

export interface StoreSettings {
  general: {
    storeName: string
    tagline?: string | null
    logoUrl?: string | null
    faviconUrl?: string | null
    primaryColor: string
    currencySymbol: string
    announcementText?: string | null
    reviewsRequireApproval: boolean
  }
  contact: {
    phone?: string | null
    email?: string | null
    address?: string | null
    mapUrl?: string | null
    whatsAppNumber?: string | null
    messengerUsername?: string | null
    businessHours?: string | null
  }
  social: {
    facebook?: string | null
    instagram?: string | null
    youTube?: string | null
    tikTok?: string | null
    linkedIn?: string | null
    x?: string | null
  }
  seo: { metaTitle?: string | null; metaDescription?: string | null; ogImageUrl?: string | null }
  checkout: {
    freeShippingThreshold: number
    minimumOrderAmount: number
    allowGuestCheckout: boolean
    enableWhatsAppOrdering: boolean
    orderSuccessMessage?: string | null
    lowStockThreshold: number
  }
  features: { icon: string; title: string; subtitle?: string | null }[]
  footer: { aboutText?: string | null; copyrightText?: string | null; showNewsletter: boolean }
  analytics: { googleAnalyticsId?: string | null; facebookPixelId?: string | null }
}

export interface MenuCategory {
  id: number
  name: string
  slug: string
  icon?: string | null
  imageUrl?: string | null
  children: MenuCategory[]
}

export interface FooterLink {
  title: string
  slug: string
  group: FooterGroup
}

export interface Bootstrap {
  settings: StoreSettings
  menu: MenuCategory[]
  footerPages: FooterLink[]
  /** Email is set up, so "Forgot password?" can be offered. */
  passwordResetByEmail: boolean
}

// ---------- Catalog ----------

export interface ProductCard {
  id: number
  name: string
  slug: string
  imageUrl?: string | null
  price: number
  compareAtPrice?: number | null
  hidePrice: boolean
  inStock: boolean
  isPreOrder: boolean
  badge?: string | null
  ratingAverage: number
  ratingCount: number
  brandName?: string | null
  quickAddVariantId?: number | null
}

export interface Breadcrumb {
  name: string
  slug: string
}

export interface ProductOption {
  name: string
  values: string[]
}

export interface Variant {
  id: number
  option1?: string | null
  option2?: string | null
  option3?: string | null
  title?: string | null
  sku?: string | null
  price: number
  compareAtPrice?: number | null
  inStock: boolean
  availableQuantity?: number | null
  imageUrl?: string | null
}

export interface ReviewSummary {
  average: number
  count: number
  breakdown: number[]
}

export interface ProductDetail {
  id: number
  name: string
  slug: string
  sku?: string | null
  brand?: { id: number; name: string; slug: string; logoUrl?: string | null } | null
  category: { id: number; name: string; slug: string }
  breadcrumbs: Breadcrumb[]
  shortDescription?: string | null
  description?: string | null
  warrantyInfo?: string | null
  badge?: string | null
  videoUrl?: string | null
  price: number
  compareAtPrice?: number | null
  hidePrice: boolean
  isPreOrder: boolean
  inStock: boolean
  images: { url: string; altText?: string | null }[]
  options: ProductOption[]
  variants: Variant[]
  specifications: { name: string; value: string }[]
  faqs: { question: string; answer: string }[]
  reviews: ReviewSummary
  metaTitle?: string | null
  metaDescription?: string | null
}

export interface CategoryCard {
  id: number
  name: string
  slug: string
  imageUrl?: string | null
  icon?: string | null
}

export interface CategoryPage {
  id: number
  name: string
  slug: string
  description?: string | null
  bannerUrl?: string | null
  imageUrl?: string | null
  seoContent?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  breadcrumbs: Breadcrumb[]
  children: CategoryCard[]
}

export interface CategoryGroup extends CategoryCard {
  children: CategoryCard[]
}

export interface Brand {
  id: number
  name: string
  slug: string
  logoUrl?: string | null
  description?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
}

export interface ProductFacets {
  brands: { id: number; name: string; slug: string; count: number }[]
  minPrice: number
  maxPrice: number
}

export interface ProductList {
  products: Paged<ProductCard>
  facets?: ProductFacets | null
}

export interface SearchSuggestion {
  id: number
  name: string
  slug: string
  imageUrl?: string | null
  price: number
  compareAtPrice?: number | null
  hidePrice: boolean
}

// ---------- Home ----------

export interface Banner {
  id: number
  title?: string | null
  imageUrl: string
  mobileImageUrl?: string | null
  linkUrl?: string | null
}

export interface ReviewCard {
  id: number
  customerName: string
  rating: number
  comment: string
  createdAt: string
  productId: number
  productName: string
  productSlug: string
  productImage?: string | null
}

export interface BlogCard {
  id: number
  title: string
  slug: string
  excerpt?: string | null
  coverImageUrl?: string | null
  publishedAt?: string | null
  authorName?: string | null
}

export interface SectionImage {
  imageUrl: string
  linkUrl?: string | null
  alt?: string | null
}

export interface HomeSection {
  id: number
  type: HomeSectionType
  title: string
  subtitle?: string | null
  viewAllUrl?: string | null
  products?: ProductCard[] | null
  tabs?: { title: string; viewAllUrl?: string | null; products: ProductCard[] }[] | null
  categories?: CategoryCard[] | null
  brands?: Brand[] | null
  reviews?: ReviewCard[] | null
  posts?: BlogCard[] | null
  images?: SectionImage[] | null
  html?: string | null
}

export interface Home {
  heroSlides: Banner[]
  sideBanners: Banner[]
  popup?: Banner | null
  sections: HomeSection[]
}

// ---------- Reviews & content ----------

export interface Review {
  id: number
  customerName: string
  rating: number
  title?: string | null
  comment: string
  isVerifiedPurchase: boolean
  adminReply?: string | null
  createdAt: string
}

export interface BlogPost extends BlogCard {
  content: string
  metaTitle?: string | null
  metaDescription?: string | null
}

export interface CmsPage {
  title: string
  slug: string
  content: string
  metaTitle?: string | null
  metaDescription?: string | null
}

// ---------- Cart & checkout ----------

export interface CartItemInput {
  variantId: number
  quantity: number
}

export interface QuoteLine {
  variantId: number
  productId: number
  productName: string
  productSlug: string
  variantTitle?: string | null
  imageUrl?: string | null
  unitPrice: number
  compareAtPrice?: number | null
  quantity: number
  lineTotal: number
  maxQuantity?: number | null
  available: boolean
  message?: string | null
}

export interface Quote {
  lines: QuoteLine[]
  itemCount: number
  subtotal: number
  discount: number
  shippingCost: number
  paymentFee: number
  total: number
  couponCode?: string | null
  couponApplied: boolean
  couponMessage?: string | null
  freeShippingThreshold: number
  amountToFreeShipping: number
  freeShippingApplied: boolean
  canCheckout: boolean
  issues: string[]
}

export interface ShippingMethod {
  id: number
  name: string
  description?: string | null
  cost: number
  estimatedDelivery?: string | null
  isPickup: boolean
  freeShippingEligible: boolean
}

export interface PaymentMethod {
  id: number
  code: string
  name: string
  type: PaymentMethodType
  instructions?: string | null
  accountNumber?: string | null
  feePercent: number
  requiresTransactionId: boolean
  logoUrl?: string | null
}

export interface CheckoutOptions {
  shippingMethods: ShippingMethod[]
  paymentMethods: PaymentMethod[]
  freeShippingThreshold: number
  minimumOrderAmount: number
  allowGuestCheckout: boolean
}

export interface PlaceOrderResponse {
  orderNumber: number
  total: number
  paymentMethodName: string
  paymentType: PaymentMethodType
  paymentInstructions?: string | null
  transactionId?: string | null
  message?: string | null
}

export interface OrderItem {
  productId?: number | null
  productName: string
  productSlug?: string | null
  variantTitle?: string | null
  sku?: string | null
  imageUrl?: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface OrderDetail {
  orderNumber: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  createdAt: string
  customerName: string
  phone: string
  email?: string | null
  address: string
  shippingMethodName: string
  shippingCost: number
  paymentMethodName: string
  paymentFee: number
  subtotal: number
  discountAmount: number
  couponCode?: string | null
  total: number
  paidAmount: number
  transactionId?: string | null
  courierName?: string | null
  trackingCode?: string | null
  customerNote?: string | null
  items: OrderItem[]
  history: { status: OrderStatus; note?: string | null; createdAt: string }[]
}

export interface OrderSummary {
  orderNumber: number
  createdAt: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: number
  itemCount: number
  firstItemName: string
  firstItemImage?: string | null
}

// ---------- Account ----------

export interface User {
  id: number
  fullName: string
  email?: string | null
  phone?: string | null
  address?: string | null
  roles: string[]
}

export interface AccountSummary {
  totalOrders: number
  totalSpent: number
  activeOrders: number
  reviewCount: number
}

export interface MyReview {
  id: number
  productId: number
  productName: string
  productSlug: string
  productImage?: string | null
  rating: number
  title?: string | null
  comment: string
  isApproved: boolean
  adminReply?: string | null
  createdAt: string
}
