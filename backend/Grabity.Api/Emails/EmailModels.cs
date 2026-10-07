using System.Globalization;

namespace Grabity.Api.Emails;

/// <summary>Colours for one email, derived from the store's brand colour.</summary>
public sealed record EmailTheme(string Brand, string BrandStrong, string BrandSoft, string BrandBorder)
{
    public const string Font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
    public const string Ink = "#0f172a";
    public const string Body = "#334155";
    public const string Muted = "#64748b";
    public const string Faint = "#94a3b8";
    public const string Line = "#e2e8f0";
    public const string Panel = "#f8fafc";
    public const string Canvas = "#eef2f7";

    public static EmailTheme From(string? hex)
    {
        var brand = Parse(hex) ?? Parse("#0ea5e9")!.Value;
        // Buttons and links need readable white text, so darken light brand colours until they reach 4.5:1.
        var strong = brand;
        for (var i = 0; i < 12 && Contrast(strong, (255, 255, 255)) < 4.5; i++) strong = Scale(strong, 0.9);
        return new EmailTheme(ToHex(brand), ToHex(strong), ToHex(Mix(brand, 0.9)), ToHex(Mix(brand, 0.72)));
    }

    /// <summary>Background, border and title colours for a callout box.</summary>
    public (string Background, string Border, string Title) Tone(CalloutTone tone) => tone switch
    {
        CalloutTone.Success => ("#ecfdf5", "#a7f3d0", "#047857"),
        CalloutTone.Warning => ("#fffbeb", "#fde68a", "#b45309"),
        CalloutTone.Danger => ("#fff1f2", "#fecdd3", "#be123c"),
        _ => (BrandSoft, BrandBorder, BrandStrong),
    };

    private static (double R, double G, double B)? Parse(string? hex)
    {
        if (hex is not { Length: 7 } || hex[0] != '#' || !int.TryParse(hex.AsSpan(1), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var value))
            return null;
        return ((value >> 16) & 255, (value >> 8) & 255, value & 255);
    }

    private static (double, double, double) Scale((double R, double G, double B) c, double f) => (c.R * f, c.G * f, c.B * f);

    private static (double, double, double) Mix((double R, double G, double B) c, double white) =>
        (c.R + (255 - c.R) * white, c.G + (255 - c.G) * white, c.B + (255 - c.B) * white);

    private static double Contrast((double R, double G, double B) a, (double R, double G, double B) b)
    {
        var (la, lb) = (Luminance(a), Luminance(b));
        return (Math.Max(la, lb) + 0.05) / (Math.Min(la, lb) + 0.05);
    }

    private static double Luminance((double R, double G, double B) c)
    {
        static double Channel(double v)
        {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.Pow((v + 0.055) / 1.055, 2.4);
        }
        return 0.2126 * Channel(c.R) + 0.7152 * Channel(c.G) + 0.0722 * Channel(c.B);
    }

    private static string ToHex((double R, double G, double B) c) =>
        $"#{(int)Math.Round(c.R):x2}{(int)Math.Round(c.G):x2}{(int)Math.Round(c.B):x2}";
}

/// <summary>Inline style snippets. Email clients ignore most stylesheets, so every element carries its own.</summary>
public static class Css
{
    public static string Text(int size, int lineHeight, int weight = 400, string color = EmailTheme.Body) =>
        $"font-family:{EmailTheme.Font};font-size:{size}px;line-height:{lineHeight}px;font-weight:{weight};color:{color};";
}

/// <summary>Store branding and contact details shared by every email.</summary>
public sealed class EmailStore
{
    public string Name { get; init; } = "";
    public string? Tagline { get; init; }
    /// <summary>Absolute logo URL, or null to show the name instead (no logo, or one mail apps can't load).</summary>
    public string? LogoUrl { get; set; }
    /// <summary>Storefront address without a trailing slash.</summary>
    public string BaseUrl { get; init; } = "";
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string? WhatsAppUrl { get; init; }
    public string? Address { get; init; }
    public string? BusinessHours { get; init; }
    public string CurrencySymbol { get; init; } = "৳";
    public string? Copyright { get; init; }
    public List<EmailLink> Socials { get; init; } = [];
    public EmailTheme Theme { get; init; } = EmailTheme.From(null);
    /// <summary>Whether recipients' mail apps can load images from <see cref="BaseUrl"/>.</summary>
    public bool ShowImages { get; init; }

    public string Url(string path) => BaseUrl + path;

    public string Price(decimal amount) => Money.Format(amount, CurrencySymbol);

    /// <summary>Absolute URL of an uploaded image at the given width, or null when mail apps couldn't show it.</summary>
    public string? Image(string? url, int width)
    {
        if (!ShowImages || string.IsNullOrWhiteSpace(url)) return null;
        // Gmail and Outlook don't display SVG.
        if (url.Split('?')[0].EndsWith(".svg", StringComparison.OrdinalIgnoreCase)) return null;
        if (url.StartsWith("http", StringComparison.OrdinalIgnoreCase)) return url;
        var resizable = url.StartsWith("/uploads/", StringComparison.Ordinal) && !url.EndsWith(".gif", StringComparison.OrdinalIgnoreCase);
        return BaseUrl + url + (resizable ? $"?w={width}" : "");
    }
}

public sealed record EmailLink(string Text, string Url);

public enum CalloutTone
{
    Info,
    Success,
    Warning,
    Danger,
}

public sealed record EmailCallout(CalloutTone Tone, string? Title, string Text);

public sealed record EmailFact(string Label, string Value, bool Mono = false);

public sealed record EmailTotal(string Label, string Value, bool Strong = false, string? Color = null);

public sealed record OrderEmailLine(string Name, string? Variant, int Quantity, string UnitPrice, string LineTotal, string? ImageUrl, string? Url, string? ReviewUrl);

/// <summary>A row in a simple list, e.g. a low-stock product.</summary>
public sealed record EmailListRow(string Title, string? Subtitle, string? ImageUrl, string? Badge, CalloutTone BadgeTone, string? Url);

/// <summary>Content shared by the layout: preheader, footer text and who the email is for.</summary>
public abstract class EmailModelBase
{
    public string Subject { get; init; } = "";
    /// <summary>Preview text shown after the subject in the inbox.</summary>
    public string Preheader { get; init; } = "";
    public string Emoji { get; init; } = "";
    public string Title { get; init; } = "";
    public string? Intro { get; init; }
    public List<EmailFact> Facts { get; init; } = [];
    public List<EmailCallout> Callouts { get; init; } = [];
    public EmailLink? Button { get; init; }
    /// <summary>Why the recipient got this email, shown in the footer.</summary>
    public string? FooterNote { get; init; }
    public string? UnsubscribeUrl { get; init; }
    /// <summary>Show the "Need help?" box. Off for staff alerts.</summary>
    public bool ShowHelp { get; init; } = true;
}

public sealed class OrderEmailModel : EmailModelBase
{
    /// <summary>Progress bar position: 0 placed, 1 confirmed, 2 shipped, 3 delivered; null hides it.</summary>
    public int? TrackerStep { get; init; }
    public List<OrderEmailLine> Lines { get; init; } = [];
    public List<EmailTotal> Totals { get; init; } = [];
    public bool ShowAddress { get; init; }
    public string CustomerName { get; init; } = "";
    public string Phone { get; init; } = "";
    public string Address { get; init; } = "";
    public string Delivery { get; init; } = "";
    public string? CustomerNote { get; init; }
    public string PaymentMethod { get; init; } = "";
    public string PaymentStatus { get; init; } = "";
    public string? Outro { get; init; }
}

public sealed class MessageEmailModel : EmailModelBase
{
    public List<string> Paragraphs { get; init; } = [];
    public List<string> Bullets { get; init; } = [];
    public List<EmailListRow> Rows { get; init; } = [];
    /// <summary>Printed under the button for mail apps that block buttons.</summary>
    public string? LinkFallback { get; init; }
    public string? FinePrint { get; init; }
}
