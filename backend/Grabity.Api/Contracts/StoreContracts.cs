using System.ComponentModel.DataAnnotations;
using Grabity.Api.Domain;

namespace Grabity.Api.Contracts;

// ---------- Catalog ----------

public record ProductCardDto(
    int Id,
    string Name,
    string Slug,
    string? ImageUrl,
    decimal Price,
    decimal? CompareAtPrice,
    bool HidePrice,
    bool InStock,
    bool IsPreOrder,
    string? Badge,
    decimal RatingAverage,
    int RatingCount,
    string? BrandName,
    /// <summary>Set when the product has exactly one purchasable variant, so cards can add it straight to the cart.</summary>
    int? QuickAddVariantId);

public record BreadcrumbDto(string Name, string Slug);

public record ImageDto(string Url, string? AltText);

public record BrandRefDto(int Id, string Name, string Slug, string? LogoUrl);

public record CategoryRefDto(int Id, string Name, string Slug);

public record VariantDto(
    int Id,
    string? Option1,
    string? Option2,
    string? Option3,
    string? Title,
    string? Sku,
    decimal Price,
    decimal? CompareAtPrice,
    bool InStock,
    int? AvailableQuantity,
    string? ImageUrl);

public record ProductDetailDto(
    int Id,
    string Name,
    string Slug,
    string? Sku,
    BrandRefDto? Brand,
    CategoryRefDto Category,
    List<BreadcrumbDto> Breadcrumbs,
    string? ShortDescription,
    string? Description,
    string? WarrantyInfo,
    string? Badge,
    string? VideoUrl,
    decimal Price,
    decimal? CompareAtPrice,
    bool HidePrice,
    bool IsPreOrder,
    bool InStock,
    List<ImageDto> Images,
    List<ProductOption> Options,
    List<VariantDto> Variants,
    List<ProductSpecification> Specifications,
    List<ProductFaq> Faqs,
    ReviewSummaryDto Reviews,
    string? MetaTitle,
    string? MetaDescription);

public record CategoryCardDto(int Id, string Name, string Slug, string? ImageUrl, string? Icon);

public record CategoryPageDto(
    int Id,
    string Name,
    string Slug,
    string? Description,
    string? BannerUrl,
    string? ImageUrl,
    string? SeoContent,
    string? MetaTitle,
    string? MetaDescription,
    List<BreadcrumbDto> Breadcrumbs,
    List<CategoryCardDto> Children);

public record CategoryGroupDto(int Id, string Name, string Slug, string? ImageUrl, string? Icon, List<CategoryCardDto> Children);

public record BrandDto(int Id, string Name, string Slug, string? LogoUrl, string? Description, string? MetaTitle, string? MetaDescription);

public record BrandFacetDto(int Id, string Name, string Slug, int Count);

public record ProductFacetsDto(List<BrandFacetDto> Brands, decimal MinPrice, decimal MaxPrice);

public record ProductListDto(PagedResult<ProductCardDto> Products, ProductFacetsDto? Facets);

public class ProductListQuery
{
    public string? Category { get; set; }
    /// <summary>Limits the listing to one brand (brand pages). Facets are computed within this scope.</summary>
    public string? Brand { get; set; }
    /// <summary>Comma separated brand slugs used as a filter on top of the scope.</summary>
    public string? Brands { get; set; }
    public string? Q { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public bool InStock { get; set; }
    public bool OnSale { get; set; }
    public bool Featured { get; set; }
    /// <summary>newest | price-asc | price-desc | popular | rating | name | manual</summary>
    public string? Sort { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 24;
    public bool Facets { get; set; }
}

public record SearchSuggestionDto(int Id, string Name, string Slug, string? ImageUrl, decimal Price, decimal? CompareAtPrice, bool HidePrice);

// ---------- Storefront shell ----------

public record MenuCategoryDto(int Id, string Name, string Slug, string? Icon, string? ImageUrl, List<MenuCategoryDto> Children);

public record FooterLinkDto(string Title, string Slug, FooterGroup Group);

/// <param name="PasswordResetByEmail">Email is set up, so the sign-in page can offer "Forgot password?".</param>
public record BootstrapDto(StoreSettings Settings, List<MenuCategoryDto> Menu, List<FooterLinkDto> FooterPages, bool PasswordResetByEmail);

public record BannerDto(int Id, string? Title, string ImageUrl, string? MobileImageUrl, string? LinkUrl);

public record HomeTabDto(string Title, string? ViewAllUrl, List<ProductCardDto> Products);

public record ReviewCardDto(int Id, string CustomerName, int Rating, string Comment, DateTime CreatedAt, int ProductId, string ProductName, string ProductSlug, string? ProductImage);

public record BlogCardDto(int Id, string Title, string Slug, string? Excerpt, string? CoverImageUrl, DateTime? PublishedAt, string? AuthorName);

public record HomeSectionDto(
    int Id,
    HomeSectionType Type,
    string Title,
    string? Subtitle,
    string? ViewAllUrl,
    List<ProductCardDto>? Products = null,
    List<HomeTabDto>? Tabs = null,
    List<CategoryCardDto>? Categories = null,
    List<BrandDto>? Brands = null,
    List<ReviewCardDto>? Reviews = null,
    List<BlogCardDto>? Posts = null,
    List<SectionImage>? Images = null,
    string? Html = null);

public record HomeDto(List<BannerDto> HeroSlides, List<BannerDto> SideBanners, BannerDto? Popup, List<HomeSectionDto> Sections);

// ---------- Reviews ----------

public record ReviewSummaryDto(decimal Average, int Count, int[] Breakdown);

public record ReviewDto(int Id, string CustomerName, int Rating, string? Title, string Comment, bool IsVerifiedPurchase, string? AdminReply, DateTime CreatedAt);

public class CreateReviewRequest
{
    [Range(1, 5)] public int Rating { get; set; }
    [MaxLength(200)] public string? Title { get; set; }
    [Required, MinLength(3), MaxLength(4000)] public string Comment { get; set; } = "";
}

// ---------- Content ----------

public record BlogPostDto(int Id, string Title, string Slug, string? Excerpt, string Content, string? CoverImageUrl, DateTime? PublishedAt, string? AuthorName, string? MetaTitle, string? MetaDescription);

public record PageDto(string Title, string Slug, string Content, string? MetaTitle, string? MetaDescription);

public class SubscribeRequest
{
    [Required, EmailAddress, MaxLength(256)] public string Email { get; set; } = "";
}

// ---------- Cart & checkout ----------

public class CartItemInput
{
    public int VariantId { get; set; }
    [Range(1, 999)] public int Quantity { get; set; } = 1;
}

public class QuoteRequest
{
    [Required, MaxLength(100)] public List<CartItemInput> Items { get; set; } = [];
    [MaxLength(50)] public string? CouponCode { get; set; }
    public int? ShippingMethodId { get; set; }
    [MaxLength(50)] public string? PaymentMethodCode { get; set; }
    /// <summary>Used for per-customer coupon limits.</summary>
    [MaxLength(20)] public string? Phone { get; set; }
}

public record QuoteLineDto(
    int VariantId,
    int ProductId,
    string ProductName,
    string ProductSlug,
    string? VariantTitle,
    string? ImageUrl,
    decimal UnitPrice,
    decimal? CompareAtPrice,
    int Quantity,
    decimal LineTotal,
    int? MaxQuantity,
    bool Available,
    string? Message);

public record QuoteDto(
    List<QuoteLineDto> Lines,
    int ItemCount,
    decimal Subtotal,
    decimal Discount,
    decimal ShippingCost,
    decimal PaymentFee,
    decimal Total,
    string? CouponCode,
    bool CouponApplied,
    string? CouponMessage,
    decimal FreeShippingThreshold,
    decimal AmountToFreeShipping,
    bool FreeShippingApplied,
    bool CanCheckout,
    List<string> Issues);

public record ShippingMethodDto(int Id, string Name, string? Description, decimal Cost, string? EstimatedDelivery, bool IsPickup, bool FreeShippingEligible);

public record PaymentMethodDto(int Id, string Code, string Name, PaymentMethodType Type, string? Instructions, string? AccountNumber, decimal FeePercent, bool RequiresTransactionId, string? LogoUrl);

public record CheckoutOptionsDto(
    List<ShippingMethodDto> ShippingMethods,
    List<PaymentMethodDto> PaymentMethods,
    decimal FreeShippingThreshold,
    decimal MinimumOrderAmount,
    bool AllowGuestCheckout);

public class PlaceOrderRequest
{
    [Required, MaxLength(150)] public string CustomerName { get; set; } = "";
    [Required, MaxLength(20)] public string Phone { get; set; } = "";
    [EmailAddress, MaxLength(256)] public string? Email { get; set; }
    [MaxLength(500)] public string? Address { get; set; }
    public int ShippingMethodId { get; set; }
    [Required, MaxLength(50)] public string PaymentMethodCode { get; set; } = "";
    [MaxLength(50)] public string? CouponCode { get; set; }
    [MaxLength(100)] public string? TransactionId { get; set; }
    [MaxLength(20)] public string? PaymentSenderNumber { get; set; }
    [MaxLength(1000)] public string? Note { get; set; }
    [Required, MinLength(1), MaxLength(100)] public List<CartItemInput> Items { get; set; } = [];
}

public record PlaceOrderResponse(int OrderNumber, decimal Total, string PaymentMethodName, PaymentMethodType PaymentType,
    string? PaymentInstructions, string? TransactionId, string? Message);

public class TrackOrderRequest
{
    [Range(1, int.MaxValue)] public int OrderNumber { get; set; }
    /// <summary>Phone number or email used on the order.</summary>
    [Required, MaxLength(256)] public string Contact { get; set; } = "";
}

public record OrderItemDto(int? ProductId, string ProductName, string? ProductSlug, string? VariantTitle, string? Sku, string? ImageUrl, decimal UnitPrice, int Quantity, decimal LineTotal);

public record OrderHistoryDto(OrderStatus Status, string? Note, DateTime CreatedAt);

public record OrderDetailDto(
    int OrderNumber,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    DateTime CreatedAt,
    string CustomerName,
    string Phone,
    string? Email,
    string Address,
    string ShippingMethodName,
    decimal ShippingCost,
    string PaymentMethodName,
    decimal PaymentFee,
    decimal Subtotal,
    decimal DiscountAmount,
    string? CouponCode,
    decimal Total,
    decimal PaidAmount,
    string? TransactionId,
    string? CourierName,
    string? TrackingCode,
    string? CustomerNote,
    List<OrderItemDto> Items,
    List<OrderHistoryDto> History);

public record OrderSummaryDto(int OrderNumber, DateTime CreatedAt, OrderStatus Status, PaymentStatus PaymentStatus, decimal Total, int ItemCount, string FirstItemName, string? FirstItemImage);

// ---------- Account ----------

public class RegisterRequest
{
    [Required, MaxLength(150)] public string FullName { get; set; } = "";
    [Required, MaxLength(20)] public string Phone { get; set; } = "";
    [EmailAddress, MaxLength(256)] public string? Email { get; set; }
    [MaxLength(500)] public string? Address { get; set; }
    [Required, MinLength(6), MaxLength(100)] public string Password { get; set; } = "";
}

public class LoginRequest
{
    /// <summary>Email address or phone number.</summary>
    [Required, MaxLength(256)] public string Identifier { get; set; } = "";
    [Required, MaxLength(100)] public string Password { get; set; } = "";
    public bool RememberMe { get; set; } = true;
}

public class UpdateProfileRequest
{
    [Required, MaxLength(150)] public string FullName { get; set; } = "";
    [Required, MaxLength(20)] public string Phone { get; set; } = "";
    [EmailAddress, MaxLength(256)] public string? Email { get; set; }
    [MaxLength(500)] public string? Address { get; set; }
}

public class ChangePasswordRequest
{
    [Required] public string CurrentPassword { get; set; } = "";
    [Required, MinLength(6), MaxLength(100)] public string NewPassword { get; set; } = "";
}

public record UserDto(int Id, string FullName, string? Email, string? Phone, string? Address, IList<string> Roles);

public record AccountSummaryDto(int TotalOrders, decimal TotalSpent, int ActiveOrders, int ReviewCount);

public record MyReviewDto(int Id, int ProductId, string ProductName, string ProductSlug, string? ProductImage, int Rating, string? Title, string Comment, bool IsApproved, string? AdminReply, DateTime CreatedAt);

public class ForgotPasswordRequest
{
    [Required, EmailAddress, MaxLength(256)] public string Email { get; set; } = "";
}

public class ResetPasswordWithTokenRequest
{
    [Required, MaxLength(256)] public string Email { get; set; } = "";
    [Required, MaxLength(2000)] public string Token { get; set; } = "";
    [Required, MinLength(6), MaxLength(100)] public string NewPassword { get; set; } = "";
}

public record ResetPasswordResultDto(bool IsStaff);

public class UnsubscribeRequest
{
    [Required, MaxLength(256)] public string Email { get; set; } = "";
    [Required, MaxLength(1000)] public string Token { get; set; } = "";
}
