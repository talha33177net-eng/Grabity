using System.ComponentModel.DataAnnotations;

namespace Grabity.Api.Contracts;

public record NameValueDto(string Name, decimal Value, int Count = 0);

public record UploadResultDto(string Url);

public class SetActiveRequest
{
    public bool IsActive { get; set; }
}

public class ReorderRequest
{
    /// <summary>Ids in their new display order.</summary>
    [Required] public List<int> Ids { get; set; } = [];
}

// ---------- Lookups ----------

public record LookupCategoryDto(int Id, string Name, int? ParentId, string Path, bool IsActive);

public record LookupDto(int Id, string Name);

public record AdminLookupsDto(List<LookupCategoryDto> Categories, List<LookupDto> Brands);

public record LookupProductDto(int Id, string Name, string? ImageUrl, decimal Price, bool IsActive);

// ---------- Products ----------

public class AdminProductQuery
{
    public string? Q { get; set; }
    public int? CategoryId { get; set; }
    public int? BrandId { get; set; }
    /// <summary>active | draft</summary>
    public string? Status { get; set; }
    /// <summary>in | low | out</summary>
    public string? Stock { get; set; }
    public bool? Featured { get; set; }
    /// <summary>newest | updated | name | price-asc | price-desc | stock | sold</summary>
    public string? Sort { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public record AdminProductListItemDto(
    int Id,
    string Name,
    string Slug,
    string? Sku,
    string? ImageUrl,
    string CategoryName,
    string? BrandName,
    decimal Price,
    decimal? CompareAtPrice,
    int StockQuantity,
    bool TrackInventory,
    bool IsPreOrder,
    bool HidePrice,
    bool IsActive,
    bool IsFeatured,
    int VariantCount,
    int SoldCount,
    DateTime UpdatedAt);

public class ProductImageInput
{
    [Required, MaxLength(500)] public string Url { get; set; } = "";
    [MaxLength(300)] public string? AltText { get; set; }
}

public class VariantInput
{
    public int? Id { get; set; }
    [MaxLength(100)] public string? Option1 { get; set; }
    [MaxLength(100)] public string? Option2 { get; set; }
    [MaxLength(100)] public string? Option3 { get; set; }
    [MaxLength(100)] public string? Sku { get; set; }
    [Range(0, 999999999)] public decimal Price { get; set; }
    [Range(0, 999999999)] public decimal? CompareAtPrice { get; set; }
    [Range(0, 999999999)] public decimal? CostPrice { get; set; }
    [Range(0, 10000000)] public int StockQuantity { get; set; }
    [MaxLength(500)] public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ProductUpsertRequest
{
    [Required, MaxLength(300)] public string Name { get; set; } = "";
    [MaxLength(320)] public string? Slug { get; set; }
    [MaxLength(100)] public string? Sku { get; set; }
    [Range(1, int.MaxValue, ErrorMessage = "Please choose a category.")] public int CategoryId { get; set; }
    public int? BrandId { get; set; }
    public string? ShortDescription { get; set; }
    public string? Description { get; set; }
    [MaxLength(300)] public string? WarrantyInfo { get; set; }
    [MaxLength(50)] public string? Badge { get; set; }
    [MaxLength(500)] public string? VideoUrl { get; set; }
    [MaxLength(1000)] public string? Tags { get; set; }
    public bool TrackInventory { get; set; } = true;
    public bool IsPreOrder { get; set; }
    public bool HidePrice { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsFeatured { get; set; }
    public int SortOrder { get; set; }
    [MaxLength(3)] public List<ProductOption> Options { get; set; } = [];
    [MaxLength(100)] public List<ProductSpecification> Specifications { get; set; } = [];
    [MaxLength(50)] public List<ProductFaq> Faqs { get; set; } = [];
    [MaxLength(30)] public List<ProductImageInput> Images { get; set; } = [];
    [Required, MinLength(1), MaxLength(200)] public List<VariantInput> Variants { get; set; } = [];
    [MaxLength(200)] public string? MetaTitle { get; set; }
    [MaxLength(500)] public string? MetaDescription { get; set; }
}

public record AdminProductDto(
    int Id,
    string Name,
    string Slug,
    string? Sku,
    int CategoryId,
    int? BrandId,
    string? ShortDescription,
    string? Description,
    string? WarrantyInfo,
    string? Badge,
    string? VideoUrl,
    string? Tags,
    bool TrackInventory,
    bool IsPreOrder,
    bool HidePrice,
    bool IsActive,
    bool IsFeatured,
    int SortOrder,
    List<ProductOption> Options,
    List<ProductSpecification> Specifications,
    List<ProductFaq> Faqs,
    List<ProductImageInput> Images,
    List<VariantInput> Variants,
    string? MetaTitle,
    string? MetaDescription,
    int SoldCount,
    int ViewCount,
    decimal RatingAverage,
    int RatingCount,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public class BulkProductActionRequest
{
    [Required, MinLength(1)] public List<int> Ids { get; set; } = [];
    /// <summary>activate | deactivate | feature | unfeature | delete</summary>
    [Required] public string Action { get; set; } = "";
}

public class StockUpdateRequest
{
    [Required] public List<VariantStockInput> Variants { get; set; } = [];
}

public class VariantStockInput
{
    public int VariantId { get; set; }
    [Range(0, 10000000)] public int StockQuantity { get; set; }
}

// ---------- Categories & brands ----------

public record AdminCategoryDto(
    int Id,
    string Name,
    string Slug,
    int? ParentId,
    string? Description,
    string? ImageUrl,
    string? BannerUrl,
    string? Icon,
    int SortOrder,
    bool IsActive,
    bool ShowInMenu,
    bool IsFeatured,
    string? MetaTitle,
    string? MetaDescription,
    string? SeoContent,
    int ProductCount);

public class CategoryUpsertRequest
{
    [Required, MaxLength(150)] public string Name { get; set; } = "";
    [MaxLength(180)] public string? Slug { get; set; }
    public int? ParentId { get; set; }
    [MaxLength(2000)] public string? Description { get; set; }
    [MaxLength(500)] public string? ImageUrl { get; set; }
    [MaxLength(500)] public string? BannerUrl { get; set; }
    [MaxLength(50)] public string? Icon { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public bool ShowInMenu { get; set; } = true;
    public bool IsFeatured { get; set; }
    [MaxLength(200)] public string? MetaTitle { get; set; }
    [MaxLength(500)] public string? MetaDescription { get; set; }
    public string? SeoContent { get; set; }
}

public record AdminBrandDto(
    int Id,
    string Name,
    string Slug,
    string? LogoUrl,
    string? Description,
    bool IsActive,
    bool IsFeatured,
    int SortOrder,
    string? MetaTitle,
    string? MetaDescription,
    int ProductCount);

public class BrandUpsertRequest
{
    [Required, MaxLength(150)] public string Name { get; set; } = "";
    [MaxLength(180)] public string? Slug { get; set; }
    [MaxLength(500)] public string? LogoUrl { get; set; }
    [MaxLength(2000)] public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsFeatured { get; set; }
    public int SortOrder { get; set; }
    [MaxLength(200)] public string? MetaTitle { get; set; }
    [MaxLength(500)] public string? MetaDescription { get; set; }
}

// ---------- Orders ----------

public class AdminOrderQuery
{
    public string? Q { get; set; }
    public OrderStatus? Status { get; set; }
    public PaymentStatus? PaymentStatus { get; set; }
    public OrderSource? Source { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public record AdminOrderListItemDto(
    int Id,
    int OrderNumber,
    DateTime CreatedAt,
    string CustomerName,
    string Phone,
    decimal Total,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    string PaymentMethodName,
    string ShippingMethodName,
    int ItemCount,
    OrderSource Source);

public record AdminOrderListDto(PagedResult<AdminOrderListItemDto> Orders, Dictionary<string, int> StatusCounts);

public record AdminOrderHistoryDto(OrderStatus Status, string? Note, string? ChangedBy, DateTime CreatedAt);

public record AdminOrderItemDto(int Id, int? ProductId, int? VariantId, string ProductName, string? ProductSlug, string? VariantTitle, string? Sku, string? ImageUrl, decimal UnitPrice, decimal? CostPrice, int Quantity, decimal LineTotal);

public record AdminOrderDto(
    int Id,
    int OrderNumber,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    OrderSource Source,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int? UserId,
    string CustomerName,
    string Phone,
    string? Email,
    string Address,
    int? ShippingMethodId,
    string ShippingMethodName,
    decimal ShippingCost,
    string PaymentMethodCode,
    string PaymentMethodName,
    decimal PaymentFee,
    decimal Subtotal,
    decimal DiscountAmount,
    string? CouponCode,
    decimal Total,
    decimal PaidAmount,
    string? TransactionId,
    string? PaymentSenderNumber,
    string? CustomerNote,
    string? AdminNote,
    string? CourierName,
    string? TrackingCode,
    string? IpAddress,
    List<AdminOrderItemDto> Items,
    List<AdminOrderHistoryDto> History,
    PhoneOrderStats CustomerHistory);

public class UpdateOrderStatusRequest
{
    public OrderStatus Status { get; set; }
    [MaxLength(1000)] public string? Note { get; set; }
}

public class UpdateOrderPaymentRequest
{
    public PaymentStatus PaymentStatus { get; set; }
    [Range(0, 999999999)] public decimal? PaidAmount { get; set; }
    [MaxLength(100)] public string? TransactionId { get; set; }
}

public class UpdateOrderDetailsRequest
{
    [Required, MaxLength(150)] public string CustomerName { get; set; } = "";
    [Required, MaxLength(20)] public string Phone { get; set; } = "";
    [EmailAddress, MaxLength(256)] public string? Email { get; set; }
    [Required, MaxLength(500)] public string Address { get; set; } = "";
    [MaxLength(2000)] public string? AdminNote { get; set; }
    [MaxLength(100)] public string? CourierName { get; set; }
    [MaxLength(100)] public string? TrackingCode { get; set; }
}

public class AdminCreateOrderRequest : PlaceOrderRequest
{
    public OrderSource Source { get; set; } = OrderSource.Phone;
    /// <summary>Optionally mark the order confirmed straight away.</summary>
    public bool Confirm { get; set; }
}

// ---------- Customers ----------

public record AdminCustomerListItemDto(int Id, string FullName, string? Email, string? Phone, bool IsActive, DateTime CreatedAt, DateTime? LastLoginAt, int OrderCount, decimal TotalSpent);

public record AdminCustomerDto(
    int Id,
    string FullName,
    string? Email,
    string? Phone,
    string? Address,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastLoginAt,
    int OrderCount,
    decimal TotalSpent,
    List<OrderSummaryDto> RecentOrders,
    PhoneOrderStats? PhoneHistory);

// ---------- Reviews ----------

public record AdminReviewDto(
    int Id,
    int ProductId,
    string ProductName,
    string ProductSlug,
    string? ProductImage,
    int? UserId,
    string CustomerName,
    int Rating,
    string? Title,
    string Comment,
    bool IsApproved,
    bool IsFeatured,
    bool IsVerifiedPurchase,
    string? AdminReply,
    DateTime CreatedAt);

public class AdminReviewUpdateRequest
{
    public bool IsApproved { get; set; }
    public bool IsFeatured { get; set; }
    [MaxLength(4000)] public string? AdminReply { get; set; }
}

public class AdminReviewCreateRequest
{
    public int ProductId { get; set; }
    [Required, MaxLength(150)] public string CustomerName { get; set; } = "";
    [Range(1, 5)] public int Rating { get; set; } = 5;
    [MaxLength(200)] public string? Title { get; set; }
    [Required, MaxLength(4000)] public string Comment { get; set; } = "";
    public bool IsApproved { get; set; } = true;
    public bool IsFeatured { get; set; }
    public bool IsVerifiedPurchase { get; set; }
    public DateTime? CreatedAt { get; set; }
}

// ---------- Marketing & content ----------

public record AdminCouponDto(
    int Id,
    string Code,
    string? Description,
    DiscountType Type,
    decimal Value,
    decimal? MinOrderAmount,
    decimal? MaxDiscountAmount,
    DateTime? StartsAt,
    DateTime? ExpiresAt,
    int? UsageLimit,
    int? UsageLimitPerCustomer,
    int UsedCount,
    bool IsActive,
    DateTime CreatedAt);

public class CouponUpsertRequest
{
    [Required, MaxLength(50), RegularExpression("^[A-Za-z0-9_-]+$", ErrorMessage = "Use letters, numbers, - or _ only.")]
    public string Code { get; set; } = "";
    [MaxLength(300)] public string? Description { get; set; }
    public DiscountType Type { get; set; }
    [Range(0, 999999999)] public decimal Value { get; set; }
    [Range(0, 999999999)] public decimal? MinOrderAmount { get; set; }
    [Range(0, 999999999)] public decimal? MaxDiscountAmount { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    [Range(1, int.MaxValue)] public int? UsageLimit { get; set; }
    [Range(1, int.MaxValue)] public int? UsageLimitPerCustomer { get; set; }
    public bool IsActive { get; set; } = true;
}

public record AdminBannerDto(int Id, string? Title, string ImageUrl, string? MobileImageUrl, string? LinkUrl, BannerPlacement Placement, int SortOrder, bool IsActive, DateTime? StartsAt, DateTime? EndsAt);

public class BannerUpsertRequest
{
    [MaxLength(200)] public string? Title { get; set; }
    [Required, MaxLength(500)] public string ImageUrl { get; set; } = "";
    [MaxLength(500)] public string? MobileImageUrl { get; set; }
    [MaxLength(500)] public string? LinkUrl { get; set; }
    public BannerPlacement Placement { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
}

public record AdminHomeSectionDto(int Id, string Title, string? Subtitle, HomeSectionType Type, HomeSectionConfig Config, int SortOrder, bool IsActive);

public class HomeSectionUpsertRequest
{
    [Required, MaxLength(200)] public string Title { get; set; } = "";
    [MaxLength(300)] public string? Subtitle { get; set; }
    public HomeSectionType Type { get; set; }
    public HomeSectionConfig Config { get; set; } = new();
    public bool IsActive { get; set; } = true;
}

public record AdminBlogPostListItemDto(int Id, string Title, string Slug, string? CoverImageUrl, bool IsPublished, DateTime? PublishedAt, int ViewCount, DateTime UpdatedAt);

public record AdminBlogPostDto(int Id, string Title, string Slug, string? Excerpt, string Content, string? CoverImageUrl, string? AuthorName, bool IsPublished, DateTime? PublishedAt, string? MetaTitle, string? MetaDescription);

public class BlogPostUpsertRequest
{
    [Required, MaxLength(300)] public string Title { get; set; } = "";
    [MaxLength(320)] public string? Slug { get; set; }
    [MaxLength(1000)] public string? Excerpt { get; set; }
    public string Content { get; set; } = "";
    [MaxLength(500)] public string? CoverImageUrl { get; set; }
    [MaxLength(150)] public string? AuthorName { get; set; }
    public bool IsPublished { get; set; }
    public DateTime? PublishedAt { get; set; }
    [MaxLength(200)] public string? MetaTitle { get; set; }
    [MaxLength(500)] public string? MetaDescription { get; set; }
}

public record AdminPageDto(int Id, string Title, string Slug, string Content, FooterGroup FooterGroup, int SortOrder, bool IsActive, string? MetaTitle, string? MetaDescription, DateTime UpdatedAt);

public class PageUpsertRequest
{
    [Required, MaxLength(200)] public string Title { get; set; } = "";
    [MaxLength(220)] public string? Slug { get; set; }
    public string Content { get; set; } = "";
    public FooterGroup FooterGroup { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    [MaxLength(200)] public string? MetaTitle { get; set; }
    [MaxLength(500)] public string? MetaDescription { get; set; }
}

// ---------- Checkout configuration ----------

public record AdminShippingMethodDto(int Id, string Name, string? Description, decimal Cost, string? EstimatedDelivery, bool IsPickup, bool FreeShippingEligible, int SortOrder, bool IsActive);

public class ShippingMethodUpsertRequest
{
    [Required, MaxLength(150)] public string Name { get; set; } = "";
    [MaxLength(1000)] public string? Description { get; set; }
    [Range(0, 999999)] public decimal Cost { get; set; }
    [MaxLength(100)] public string? EstimatedDelivery { get; set; }
    public bool IsPickup { get; set; }
    public bool FreeShippingEligible { get; set; } = true;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public record AdminPaymentMethodDto(int Id, string Code, string Name, PaymentMethodType Type, string? Instructions, string? AccountNumber, decimal FeePercent, bool RequiresTransactionId, string? LogoUrl, int SortOrder, bool IsActive);

public class PaymentMethodUpsertRequest
{
    [Required, MaxLength(50), RegularExpression("^[a-z0-9_-]+$", ErrorMessage = "Use lowercase letters, numbers, - or _ only.")]
    public string Code { get; set; } = "";
    [Required, MaxLength(150)] public string Name { get; set; } = "";
    public PaymentMethodType Type { get; set; }
    [MaxLength(2000)] public string? Instructions { get; set; }
    [MaxLength(100)] public string? AccountNumber { get; set; }
    [Range(0, 100)] public decimal FeePercent { get; set; }
    public bool RequiresTransactionId { get; set; }
    [MaxLength(500)] public string? LogoUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

// ---------- Staff ----------

public record StaffDto(int Id, string FullName, string? Email, string? Phone, string Role, bool IsActive, DateTime CreatedAt, DateTime? LastLoginAt);

public class StaffUpsertRequest
{
    [Required, MaxLength(150)] public string FullName { get; set; } = "";
    [Required, EmailAddress, MaxLength(256)] public string Email { get; set; } = "";
    [MaxLength(20)] public string? Phone { get; set; }
    [Required] public string Role { get; set; } = Roles.Manager;
    [MinLength(6), MaxLength(100)] public string? Password { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ResetPasswordRequest
{
    [Required, MinLength(6), MaxLength(100)] public string NewPassword { get; set; } = "";
}

public record NewsletterSubscriberDto(int Id, string Email, DateTime CreatedAt);

// ---------- Dashboard & reports ----------

public record DailySalesPointDto(DateOnly Date, int Orders, decimal Revenue);

public record TopProductDto(int? ProductId, string Name, string? ImageUrl, int Quantity, decimal Revenue);

public record LowStockItemDto(int ProductId, int VariantId, string ProductName, string? VariantTitle, int Stock, string? ImageUrl);

/// <summary>Sidebar badge counts; cheap enough to poll from every admin page.</summary>
public record AdminCountsDto(int PendingOrders, int PendingReviews);

public record DashboardDto(
    decimal RevenueToday,
    int OrdersToday,
    decimal RevenueThisMonth,
    int OrdersThisMonth,
    decimal RevenueLastMonth,
    int PendingOrders,
    int TotalCustomers,
    int NewCustomersThisMonth,
    int ActiveProducts,
    int LowStockCount,
    int OutOfStockCount,
    int PendingReviews,
    List<DailySalesPointDto> Sales,
    Dictionary<string, int> StatusBreakdown,
    List<AdminOrderListItemDto> RecentOrders,
    List<TopProductDto> TopProducts,
    List<LowStockItemDto> LowStock);

public record SalesReportDto(
    DateOnly From,
    DateOnly To,
    int Orders,
    decimal Revenue,
    decimal AverageOrderValue,
    decimal Discounts,
    decimal ShippingCharges,
    decimal? GrossProfit,
    int ItemsSold,
    int CancelledOrders,
    List<DailySalesPointDto> Daily,
    List<TopProductDto> TopProducts,
    List<NameValueDto> ByPaymentMethod,
    List<NameValueDto> BySource,
    List<NameValueDto> ByCategory);

// ---------- Email ----------

public record EmailHealthDto(DateTime? LastSentAt, int SentLast24Hours, int Waiting, int FailedLast7Days, string? LastError);

public record EmailSettingsDto(
    bool Enabled,
    string? Host,
    int Port,
    SmtpSecurity Security,
    string? UserName,
    bool HasPassword,
    /// <summary>A password is saved but can't be decrypted any more (e.g. App_Data/keys was lost).</summary>
    bool PasswordUnreadable,
    string? FromName,
    string? FromAddress,
    string? ReplyTo,
    string? SiteUrl,
    string? StaffRecipients,
    List<EmailKind> DisabledKinds,
    /// <summary>Address used for links when SiteUrl is empty.</summary>
    string DetectedSiteUrl,
    EmailHealthDto Health);

public class EmailSettingsRequest
{
    public bool Enabled { get; set; }
    [MaxLength(200)] public string? Host { get; set; }
    [Range(1, 65535)] public int Port { get; set; } = 587;
    public SmtpSecurity Security { get; set; } = SmtpSecurity.StartTls;
    [MaxLength(256)] public string? UserName { get; set; }
    /// <summary>New password. Null keeps the saved one; an empty string removes it.</summary>
    [MaxLength(200)] public string? Password { get; set; }
    [MaxLength(150)] public string? FromName { get; set; }
    [MaxLength(256)] public string? FromAddress { get; set; }
    [MaxLength(256)] public string? ReplyTo { get; set; }
    [MaxLength(200)] public string? SiteUrl { get; set; }
    [MaxLength(1000)] public string? StaffRecipients { get; set; }
    public List<EmailKind> DisabledKinds { get; set; } = [];
}

public class SendTestEmailRequest
{
    [Required, MaxLength(256)] public string To { get; set; } = "";
}

public record EmailMessageListItemDto(
    int Id,
    EmailKind Kind,
    EmailStatus Status,
    string ToAddress,
    string? ToName,
    string? Subject,
    int? OrderId,
    int? OrderNumber,
    int Attempts,
    string? LastError,
    DateTime CreatedAt,
    DateTime NextAttemptAt,
    DateTime? SentAt);

public record EmailMessageDto(EmailMessageListItemDto Message, string? Html, string? Text);

public record EmailPreviewDto(string Subject, string Html);

public static class EmailProjection
{
    public static readonly System.Linq.Expressions.Expression<Func<EmailMessage, EmailMessageListItemDto>> ListItem = m =>
        new EmailMessageListItemDto(m.Id, m.Kind, m.Status, m.ToAddress, m.ToName, m.Subject, m.OrderId,
            m.Order != null ? (int?)m.Order.OrderNumber : null, m.Attempts, m.LastError, m.CreatedAt, m.NextAttemptAt, m.SentAt);
}
