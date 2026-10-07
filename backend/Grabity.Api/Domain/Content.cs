namespace Grabity.Api.Domain;

public enum BannerPlacement
{
    /// <summary>Large rotating slides at the top of the homepage.</summary>
    HeroSlider,
    /// <summary>Two promotional tiles beside the hero slider.</summary>
    HeroSide,
    /// <summary>Promotion shown in a popup when the homepage opens.</summary>
    Popup,
}

public class Banner : ITimestamped
{
    public int Id { get; set; }
    public string? Title { get; set; }
    public string ImageUrl { get; set; } = "";
    public string? MobileImageUrl { get; set; }
    public string? LinkUrl { get; set; }
    public BannerPlacement Placement { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum HomeSectionType
{
    Categories,
    Products,
    ProductTabs,
    Brands,
    Reviews,
    Blog,
    Banners,
    RichText,
}

public enum ProductSource
{
    Newest,
    Featured,
    BestSelling,
    OnSale,
    TopRated,
    Category,
    Brand,
    Manual,
}

/// <summary>A configurable block on the homepage. Sections render in SortOrder.</summary>
public class HomeSection : ITimestamped
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string? Subtitle { get; set; }
    public HomeSectionType Type { get; set; }
    public HomeSectionConfig Config { get; set; } = new();
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Per-type settings, stored as JSON. Only the fields relevant to the section type are used.</summary>
public class HomeSectionConfig
{
    // Products
    public ProductSource Source { get; set; } = ProductSource.Newest;
    public int? CategoryId { get; set; }
    public int? BrandId { get; set; }
    public List<int> ProductIds { get; set; } = [];
    public int Limit { get; set; } = 12;

    // ProductTabs
    public List<HomeSectionTab> Tabs { get; set; } = [];

    // Categories (empty = categories marked as featured)
    public List<int> CategoryIds { get; set; } = [];

    // Banners
    public List<SectionImage> Images { get; set; } = [];

    // RichText
    public string? Html { get; set; }

    public string? ViewAllUrl { get; set; }
}

public class HomeSectionTab
{
    public string Title { get; set; } = "";
    public ProductSource Source { get; set; } = ProductSource.Newest;
    public int? CategoryId { get; set; }
    public int? BrandId { get; set; }
    public List<int> ProductIds { get; set; } = [];
    public int Limit { get; set; } = 12;
}

public class SectionImage
{
    public string ImageUrl { get; set; } = "";
    public string? LinkUrl { get; set; }
    public string? Alt { get; set; }
}

public class ProductReview : ITimestamped
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int? UserId { get; set; }
    public AppUser? User { get; set; }
    public string CustomerName { get; set; } = "";
    public int Rating { get; set; }
    public string? Title { get; set; }
    public string Comment { get; set; } = "";
    public bool IsApproved { get; set; }
    /// <summary>Shown in the homepage "Customer Reviews" carousel.</summary>
    public bool IsFeatured { get; set; }
    public bool IsVerifiedPurchase { get; set; }
    public string? AdminReply { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class BlogPost : ITimestamped
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Slug { get; set; } = "";
    public string? Excerpt { get; set; }
    public string Content { get; set; } = "";
    public string? CoverImageUrl { get; set; }
    public string? AuthorName { get; set; }
    public bool IsPublished { get; set; }
    public DateTime? PublishedAt { get; set; }
    public int ViewCount { get; set; }
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum FooterGroup
{
    None,
    About,
    Policy,
    Help,
}

/// <summary>CMS page such as About Us, Return Policy or FAQ.</summary>
public class Page : ITimestamped
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Slug { get; set; } = "";
    public string Content { get; set; } = "";
    public FooterGroup FooterGroup { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class NewsletterSubscriber
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

/// <summary>Key/value store for settings documents; values are JSON.</summary>
public class Setting
{
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
    public DateTime UpdatedAt { get; set; }
}
