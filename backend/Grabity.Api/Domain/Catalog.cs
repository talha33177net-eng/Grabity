namespace Grabity.Api.Domain;

public class Category : ITimestamped
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public int? ParentId { get; set; }
    public Category? Parent { get; set; }
    public List<Category> Children { get; set; } = [];
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? BannerUrl { get; set; }
    /// <summary>Key of an icon from the storefront's curated icon set (e.g. "headphones").</summary>
    public string? Icon { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public bool ShowInMenu { get; set; } = true;
    public bool IsFeatured { get; set; }
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    /// <summary>Optional HTML block rendered under the product grid (SEO copy).</summary>
    public string? SeoContent { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class Brand : ITimestamped
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public string? LogoUrl { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsFeatured { get; set; }
    public int SortOrder { get; set; }
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class Product : ITimestamped
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public string? Sku { get; set; }
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public int? BrandId { get; set; }
    public Brand? Brand { get; set; }

    /// <summary>Key highlights shown next to the price (sanitized HTML).</summary>
    public string? ShortDescription { get; set; }
    /// <summary>Full description tab (sanitized HTML).</summary>
    public string? Description { get; set; }
    public string? WarrantyInfo { get; set; }
    /// <summary>Small label shown on product cards, e.g. "Official Warranty".</summary>
    public string? Badge { get; set; }
    public string? VideoUrl { get; set; }
    /// <summary>Comma separated search keywords.</summary>
    public string? Tags { get; set; }

    // Denormalized from variants by ProductService so listings can filter and sort cheaply.
    public decimal Price { get; set; }
    public decimal? CompareAtPrice { get; set; }
    public int StockQuantity { get; set; }

    public bool TrackInventory { get; set; } = true;
    /// <summary>Allows ordering while out of stock and labels the product "Pre-order".</summary>
    public bool IsPreOrder { get; set; }
    /// <summary>Shows "Call for price" and disables online ordering.</summary>
    public bool HidePrice { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsFeatured { get; set; }
    public int SortOrder { get; set; }

    public int ViewCount { get; set; }
    public int SoldCount { get; set; }
    public decimal RatingAverage { get; set; }
    public int RatingCount { get; set; }

    public List<ProductOption> Options { get; set; } = [];
    public List<ProductSpecification> Specifications { get; set; } = [];
    public List<ProductFaq> Faqs { get; set; } = [];

    public List<ProductImage> Images { get; set; } = [];
    public List<ProductVariant> Variants { get; set; } = [];

    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public bool IsPurchasable => IsActive && !HidePrice;

    public bool InStock => !TrackInventory || IsPreOrder || StockQuantity > 0;
}

/// <summary>A selectable option such as "Color" with its values. Stored as JSON on the product.</summary>
public class ProductOption
{
    public string Name { get; set; } = "";
    public List<string> Values { get; set; } = [];
}

public class ProductSpecification
{
    public string Name { get; set; } = "";
    public string Value { get; set; } = "";
}

public class ProductFaq
{
    public string Question { get; set; } = "";
    public string Answer { get; set; } = "";
}

public class ProductImage
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string Url { get; set; } = "";
    public string? AltText { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>
/// Every product has at least one variant. Products without options have a single
/// variant whose option values are all null.
/// </summary>
public class ProductVariant
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public string? Option1 { get; set; }
    public string? Option2 { get; set; }
    public string? Option3 { get; set; }
    public string? Sku { get; set; }
    public decimal Price { get; set; }
    public decimal? CompareAtPrice { get; set; }
    public decimal? CostPrice { get; set; }
    public int StockQuantity { get; set; }
    public string? ImageUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public string? Title => BuildTitle(Option1, Option2, Option3);

    public static string? BuildTitle(string? o1, string? o2, string? o3)
    {
        var parts = new[] { o1, o2, o3 }.Where(p => !string.IsNullOrWhiteSpace(p)).ToArray();
        return parts.Length == 0 ? null : string.Join(" / ", parts);
    }
}
