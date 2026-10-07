namespace Grabity.Api.Domain;

/// <summary>All admin-editable store settings. Persisted as one JSON document in the Settings table.</summary>
public class StoreSettings
{
    public GeneralSettings General { get; set; } = new();
    public ContactSettings Contact { get; set; } = new();
    public SocialSettings Social { get; set; } = new();
    public SeoSettings Seo { get; set; } = new();
    public CheckoutSettings Checkout { get; set; } = new();
    public List<FeatureHighlight> Features { get; set; } = [];
    public FooterSettings Footer { get; set; } = new();
    public AnalyticsSettings Analytics { get; set; } = new();
}

public class GeneralSettings
{
    public string StoreName { get; set; } = "Grabity";
    public string? Tagline { get; set; }
    public string? LogoUrl { get; set; }
    public string? FaviconUrl { get; set; }
    public string PrimaryColor { get; set; } = "#0ea5e9";
    public string CurrencySymbol { get; set; } = "৳";
    /// <summary>Optional text for the thin bar above the header.</summary>
    public string? AnnouncementText { get; set; }
    public bool ReviewsRequireApproval { get; set; } = true;
}

public class ContactSettings
{
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? MapUrl { get; set; }
    /// <summary>Number in international format without "+", e.g. 8801XXXXXXXXX.</summary>
    public string? WhatsAppNumber { get; set; }
    /// <summary>Facebook page username used for m.me links.</summary>
    public string? MessengerUsername { get; set; }
    public string? BusinessHours { get; set; }
}

public class SocialSettings
{
    public string? Facebook { get; set; }
    public string? Instagram { get; set; }
    public string? YouTube { get; set; }
    public string? TikTok { get; set; }
    public string? LinkedIn { get; set; }
    public string? X { get; set; }
}

public class SeoSettings
{
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public string? OgImageUrl { get; set; }
}

public class CheckoutSettings
{
    /// <summary>Order subtotal from which delivery is free. 0 disables free delivery.</summary>
    public decimal FreeShippingThreshold { get; set; }
    public decimal MinimumOrderAmount { get; set; }
    public bool AllowGuestCheckout { get; set; } = true;
    public bool EnableWhatsAppOrdering { get; set; } = true;
    public string? OrderSuccessMessage { get; set; }
    /// <summary>Variants at or below this stock level are reported as low stock.</summary>
    public int LowStockThreshold { get; set; } = 5;
}

public class FeatureHighlight
{
    public string Icon { get; set; } = "truck";
    public string Title { get; set; } = "";
    public string? Subtitle { get; set; }
}

public class FooterSettings
{
    public string? AboutText { get; set; }
    public string? CopyrightText { get; set; }
    public bool ShowNewsletter { get; set; } = true;
}

public class AnalyticsSettings
{
    public string? GoogleAnalyticsId { get; set; }
    public string? FacebookPixelId { get; set; }
}
