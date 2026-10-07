using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Grabity.Api.Services;

/// <summary>
/// Serves the built React app (wwwroot/index.html) for client-side routes, with the page title,
/// description and Open Graph tags filled in on the server so link previews and crawlers see them.
/// </summary>
public partial class SpaRenderer(IWebHostEnvironment env, IServiceScopeFactory scopes)
{
    private record PageMeta(string Title, string? Description, string? Image, string Type = "website", string? JsonLd = null, bool NotFound = false);

    private string? _template;
    private DateTime _templateStamp;
    private readonly Lock _gate = new();

    public async Task<IResult> RenderAsync(HttpContext ctx, CancellationToken ct)
    {
        var path = ctx.Request.Path.Value ?? "/";
        if (!HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method)) return Results.NotFound();
        if (Path.HasExtension(path) || path.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase)) return Results.NotFound();

        var template = LoadTemplate();
        if (template is null)
        {
            return Results.Content(
                "<!doctype html><meta charset=utf-8><title>Grabity API</title><body style=\"font-family:system-ui;padding:2rem\">" +
                "<h1>Grabity API is running</h1><p>The storefront is not built yet. Run <code>npm run dev</code> in <code>frontend</code> " +
                "and open http://localhost:5173, or run <code>npm run build</code> to serve it from here.</p><p>API docs: <a href=\"/api/docs\">/api/docs</a></p>",
                "text/html; charset=utf-8");
        }

        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var settings = await scope.ServiceProvider.GetRequiredService<SettingsService>().GetAsync(ct);
        var baseUrl = $"{ctx.Request.Scheme}://{ctx.Request.Host}";
        var meta = await ResolveAsync(path, db, settings, baseUrl, ct);

        var html = Inject(template, meta, settings, baseUrl + path);
        ctx.Response.Headers.CacheControl = "no-cache";
        return Results.Content(html, "text/html; charset=utf-8", Encoding.UTF8, meta.NotFound ? 404 : 200);
    }

    public IResult RobotsTxt(HttpContext ctx)
    {
        var baseUrl = $"{ctx.Request.Scheme}://{ctx.Request.Host}";
        var body = $"User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /cart\nDisallow: /checkout\nDisallow: /api/\n\nSitemap: {baseUrl}/sitemap.xml\n";
        return Results.Text(body, "text/plain");
    }

    public async Task<IResult> SitemapAsync(HttpContext ctx, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var baseUrl = $"{ctx.Request.Scheme}://{ctx.Request.Host}";
        var sb = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        void Add(string loc, DateTime? lastMod = null) =>
            sb.Append("<url><loc>").Append(WebUtility.HtmlEncode(baseUrl + loc)).Append("</loc>")
              .Append(lastMod is { } d ? $"<lastmod>{d:yyyy-MM-dd}</lastmod>" : "").Append("</url>\n");

        Add("/");
        foreach (var c in await db.Categories.AsNoTracking().Where(c => c.IsActive).Select(c => new { c.Slug, c.UpdatedAt }).ToListAsync(ct))
            Add($"/category/{c.Slug}", c.UpdatedAt);
        foreach (var b in await db.Brands.AsNoTracking().Where(b => b.IsActive).Select(b => new { b.Slug, b.UpdatedAt }).ToListAsync(ct))
            Add($"/brand/{b.Slug}", b.UpdatedAt);
        foreach (var p in await db.Products.AsNoTracking().Where(p => p.IsActive).OrderByDescending(p => p.UpdatedAt).Take(45000)
                     .Select(p => new { p.Slug, p.UpdatedAt }).ToListAsync(ct))
            Add($"/product/{p.Slug}", p.UpdatedAt);
        foreach (var p in await db.BlogPosts.AsNoTracking().Where(p => p.IsPublished).Select(p => new { p.Slug, p.UpdatedAt }).ToListAsync(ct))
            Add($"/blog/{p.Slug}", p.UpdatedAt);
        foreach (var p in await db.Pages.AsNoTracking().Where(p => p.IsActive).Select(p => new { p.Slug, p.UpdatedAt }).ToListAsync(ct))
            Add($"/page/{p.Slug}", p.UpdatedAt);
        sb.Append("</urlset>");
        return Results.Text(sb.ToString(), "application/xml");
    }

    private async Task<PageMeta> ResolveAsync(string path, AppDbContext db, StoreSettings settings, string baseUrl, CancellationToken ct)
    {
        var store = settings.General.StoreName;
        var defaultTitle = settings.Seo.MetaTitle ?? (settings.General.Tagline is { } tagline ? $"{store} | {tagline}" : store);
        var fallback = new PageMeta(defaultTitle, settings.Seo.MetaDescription, settings.Seo.OgImageUrl);
        var segments = path.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length != 2) return fallback;
        var slug = Uri.UnescapeDataString(segments[1]);

        switch (segments[0])
        {
            case "product":
            {
                var p = await db.Products.AsNoTracking().Where(x => x.Slug == slug && x.IsActive)
                    .Select(x => new
                    {
                        x.Id, x.Name, x.MetaTitle, x.MetaDescription, x.ShortDescription, x.Description, x.Price, x.HidePrice,
                        x.Sku, x.RatingAverage, x.RatingCount,
                        InStock = !x.TrackInventory || x.IsPreOrder || x.StockQuantity > 0,
                        Brand = x.Brand != null ? x.Brand.Name : null,
                        Image = x.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                    })
                    .FirstOrDefaultAsync(ct);
                if (p is null) return fallback with { Title = $"Product not found | {store}", NotFound = true };

                var description = p.MetaDescription ?? Excerpt(p.ShortDescription ?? p.Description) ?? fallback.Description;
                var image = Absolute(baseUrl, p.Image);
                var ld = new Dictionary<string, object?>
                {
                    ["@context"] = "https://schema.org",
                    ["@type"] = "Product",
                    ["name"] = p.Name,
                    ["image"] = image,
                    ["description"] = description,
                    ["sku"] = p.Sku,
                    ["brand"] = p.Brand is null ? null : new Dictionary<string, object> { ["@type"] = "Brand", ["name"] = p.Brand },
                    ["offers"] = p.HidePrice ? null : new Dictionary<string, object?>
                    {
                        ["@type"] = "Offer",
                        ["priceCurrency"] = "BDT",
                        ["price"] = p.Price,
                        ["availability"] = p.InStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                        ["url"] = $"{baseUrl}/product/{slug}",
                    },
                    ["aggregateRating"] = p.RatingCount > 0
                        ? new Dictionary<string, object>
                        {
                            ["@type"] = "AggregateRating",
                            ["ratingValue"] = p.RatingAverage,
                            ["reviewCount"] = p.RatingCount,
                        }
                        : null,
                };
                return new PageMeta(p.MetaTitle ?? $"{p.Name} | {store}", description, p.Image ?? fallback.Image, "product",
                    JsonSerializer.Serialize(ld.Where(kv => kv.Value is not null).ToDictionary()));
            }
            case "category":
            {
                var c = await db.Categories.AsNoTracking().Where(x => x.Slug == slug && x.IsActive)
                    .Select(x => new { x.Name, x.MetaTitle, x.MetaDescription, x.Description, x.ImageUrl, x.BannerUrl }).FirstOrDefaultAsync(ct);
                return c is null
                    ? fallback with { Title = $"Category not found | {store}", NotFound = true }
                    : new PageMeta(c.MetaTitle ?? $"{c.Name} | {store}", c.MetaDescription ?? Excerpt(c.Description) ?? fallback.Description,
                        c.BannerUrl ?? c.ImageUrl ?? fallback.Image);
            }
            case "brand":
            {
                var b = await db.Brands.AsNoTracking().Where(x => x.Slug == slug && x.IsActive)
                    .Select(x => new { x.Name, x.MetaTitle, x.MetaDescription, x.Description, x.LogoUrl }).FirstOrDefaultAsync(ct);
                return b is null
                    ? fallback with { Title = $"Brand not found | {store}", NotFound = true }
                    : new PageMeta(b.MetaTitle ?? $"{b.Name} products | {store}", b.MetaDescription ?? Excerpt(b.Description) ?? fallback.Description,
                        b.LogoUrl ?? fallback.Image);
            }
            case "blog":
            {
                var post = await db.BlogPosts.AsNoTracking().Where(x => x.Slug == slug && x.IsPublished)
                    .Select(x => new { x.Title, x.MetaTitle, x.MetaDescription, x.Excerpt, x.CoverImageUrl }).FirstOrDefaultAsync(ct);
                return post is null
                    ? fallback with { Title = $"Post not found | {store}", NotFound = true }
                    : new PageMeta(post.MetaTitle ?? $"{post.Title} | {store}", post.MetaDescription ?? post.Excerpt ?? fallback.Description,
                        post.CoverImageUrl ?? fallback.Image, "article");
            }
            case "page":
            {
                var page = await db.Pages.AsNoTracking().Where(x => x.Slug == slug && x.IsActive)
                    .Select(x => new { x.Title, x.MetaTitle, x.MetaDescription, x.Content }).FirstOrDefaultAsync(ct);
                return page is null
                    ? fallback with { Title = $"Page not found | {store}", NotFound = true }
                    : new PageMeta(page.MetaTitle ?? $"{page.Title} | {store}", page.MetaDescription ?? Excerpt(page.Content) ?? fallback.Description, fallback.Image);
            }
            default:
                return fallback;
        }
    }

    private static string Inject(string template, PageMeta meta, StoreSettings settings, string url)
    {
        var baseUrl = new Uri(url).GetLeftPart(UriPartial.Authority);
        var e = (string? s) => WebUtility.HtmlEncode(s ?? "");
        var tags = new StringBuilder();
        if (meta.Description is { } description)
        {
            tags.Append($"<meta name=\"description\" content=\"{e(description)}\" data-seo>");
            tags.Append($"<meta property=\"og:description\" content=\"{e(description)}\" data-seo>");
        }
        tags.Append($"<meta property=\"og:title\" content=\"{e(meta.Title)}\" data-seo>");
        tags.Append($"<meta property=\"og:type\" content=\"{meta.Type}\" data-seo>");
        tags.Append($"<meta property=\"og:url\" content=\"{e(url)}\" data-seo>");
        tags.Append($"<meta property=\"og:site_name\" content=\"{e(settings.General.StoreName)}\" data-seo>");
        if (Absolute(baseUrl, meta.Image) is { } image)
        {
            tags.Append($"<meta property=\"og:image\" content=\"{e(image)}\" data-seo>");
            tags.Append("<meta name=\"twitter:card\" content=\"summary_large_image\" data-seo>");
        }
        tags.Append($"<link rel=\"canonical\" href=\"{e(url)}\" data-seo>");
        if (settings.General.FaviconUrl is { } favicon)
            tags.Append($"<link rel=\"icon\" href=\"{e(favicon)}\">");
        if (meta.JsonLd is { } jsonLd)
            tags.Append($"<script type=\"application/ld+json\" data-seo>{jsonLd.Replace("</", "<\\/")}</script>");
        if (meta.NotFound)
            tags.Append("<meta name=\"robots\" content=\"noindex\" data-seo>");

        var html = TitleTag().Replace(template, $"<title>{e(meta.Title)}</title>", 1);
        // Paint the store's brand colour from the first byte instead of flashing the stylesheet default.
        if (HexColor().IsMatch(settings.General.PrimaryColor))
        {
            tags.Append($"<style>:root{{--brand:{settings.General.PrimaryColor}}}</style>");
            html = ThemeColorTag().Replace(html, $"<meta name=\"theme-color\" content=\"{settings.General.PrimaryColor}\"", 1);
        }
        return html.Replace("</head>", tags + "</head>");
    }

    private string? LoadTemplate()
    {
        var file = Path.Combine(env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot"), "index.html");
        if (!File.Exists(file)) return null;
        var stamp = File.GetLastWriteTimeUtc(file);
        lock (_gate)
        {
            if (_template is null || stamp != _templateStamp)
            {
                _template = File.ReadAllText(file);
                _templateStamp = stamp;
            }
            return _template;
        }
    }

    private static string? Absolute(string baseUrl, string? url) =>
        string.IsNullOrWhiteSpace(url) ? null : url.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? url : baseUrl + url;

    private static string? Excerpt(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;
        var text = WebUtility.HtmlDecode(Tags().Replace(html, " "));
        text = Spaces().Replace(text, " ").Trim();
        return text.Length == 0 ? null : text.Length <= 160 ? text : text[..157].TrimEnd() + "...";
    }

    [GeneratedRegex("<title>.*?</title>", RegexOptions.Singleline | RegexOptions.IgnoreCase)]
    private static partial Regex TitleTag();

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex Tags();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColor();

    [GeneratedRegex("<meta name=\"theme-color\" content=\"[^\"]*\"", RegexOptions.IgnoreCase)]
    private static partial Regex ThemeColorTag();
}
