using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using MvcJsonOptions = Microsoft.AspNetCore.Mvc.JsonOptions;

namespace Grabity.Api.Services;

/// <summary>
/// Serves the built React app (wwwroot/index.html) for client-side routes, with the page title,
/// description and Open Graph tags filled in on the server so link previews and crawlers see them.
/// Storefront pages also carry the API responses they start with and a preload for their main image,
/// so the browser doesn't have to run the app and call the API before it can show anything.
/// </summary>
public partial class SpaRenderer(IWebHostEnvironment env, IServiceScopeFactory scopes, IOptions<MvcJsonOptions> json)
{
    private record PageMeta(string Title, string? Description, string? Image, string Type = "website", string? JsonLd = null, bool NotFound = false);

    /// <summary>API responses keyed the way api.ts looks them up, and preload tags for the page's main image.</summary>
    private sealed class PageData
    {
        public Dictionary<string, object> Responses { get; } = [];
        public StringBuilder Preloads { get; } = new();
    }

    // These mirror the frontend so the embedded data and preloaded images are exactly what the page asks for:
    // the listing request in ProductListing.tsx and the image sizes in lib/utils.ts, HomeBlocks.tsx,
    // ProductCard.tsx, ProductPage.tsx and CatalogPages.tsx.
    private const int ListingPageSize = 24;
    private static readonly string[] ListingParams = ["page", "brands", "min", "max", "stock", "sort"];
    private const int CardImageWidth = 400;
    private const int GalleryImageWidth = 960;
    private const int BannerFallbackWidth = 1200;
    private static readonly int[] BannerWidths = [640, 960, 1200, 1600];
    private static readonly int[] MobileBannerWidths = [640, 960, 1200];
    private const string HeroSizes = "(min-width: 1440px) 920px, (min-width: 1024px) 64vw, 100vw";
    private const string WideSizes = "(min-width: 1440px) 1380px, 100vw";

    /// <summary>Lazily loaded page code, by first URL segment, as source paths in Vite's build manifest.</summary>
    private static readonly Dictionary<string, string> RouteModules = new()
    {
        ["product"] = "src/pages/store/ProductPage.tsx",
        ["category"] = "src/pages/store/CatalogPages.tsx",
        ["brand"] = "src/pages/store/CatalogPages.tsx",
    };

    private sealed record ManifestChunk(string File, string[]? Imports);

    private string? _template;
    private DateTime _templateStamp;
    private Dictionary<string, ManifestChunk>? _manifest;
    private DateTime _manifestStamp;
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
        var storefront = !meta.NotFound && !path.StartsWith("/admin", StringComparison.OrdinalIgnoreCase);
        var page = storefront ? await CollectAsync(path, ctx.Request.Query, scope.ServiceProvider, ct) : new PageData();
        if (storefront) PreloadRouteModule(page, path);

        var html = Inject(template, meta, settings, baseUrl + path, page);
        ctx.Response.Headers.CacheControl = "no-cache";
        return Results.Content(html, "text/html; charset=utf-8", Encoding.UTF8, meta.NotFound ? 404 : 200);
    }

    private static async Task<PageData> CollectAsync(string path, IQueryCollection query, IServiceProvider services, CancellationToken ct)
    {
        var storefront = services.GetRequiredService<StorefrontService>();
        var page = new PageData();
        page.Responses["/api/store/bootstrap"] = await storefront.GetBootstrapAsync(ct);

        var segments = path.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0)
        {
            var home = await services.GetRequiredService<HomeService>().GetAsync(ct);
            page.Responses["/api/store/home"] = home;
            if (home.HeroSlides.FirstOrDefault() is { } slide)
            {
                // HeroSlider shows the mobile image through <source media="(max-width: 640px)">.
                var sizes = home.SideBanners.Count > 0 ? HeroSizes : WideSizes;
                if (slide.MobileImageUrl is { } mobile)
                {
                    PreloadImage(page, mobile, MobileBannerWidths, "100vw", "(max-width: 640px)");
                    PreloadImage(page, slide.ImageUrl, BannerWidths, sizes, "(min-width: 641px)");
                }
                else PreloadImage(page, slide.ImageUrl, BannerWidths, sizes);
            }
            return page;
        }
        if (segments.Length != 2) return page;

        var slug = Uri.UnescapeDataString(segments[1]);
        var defaultListing = !ListingParams.Any(query.ContainsKey);
        switch (segments[0])
        {
            case "product":
            {
                var product = await storefront.GetProductAsync(slug, ct);
                if (product is null) break;
                page.Responses[$"/api/products/{slug}"] = product;
                // ProductPage opens on the first in-stock variant's image when it has one.
                var variant = product.Variants.FirstOrDefault(v => v.InStock) ?? product.Variants.FirstOrDefault();
                var image = product.Images.FirstOrDefault(i => i.Url == variant?.ImageUrl) ?? product.Images.FirstOrDefault();
                if (image is not null) PreloadImage(page, image.Url, GalleryImageWidth);
                break;
            }
            case "category":
            {
                var category = await storefront.GetCategoryAsync(slug, ct);
                if (category is null) break;
                page.Responses[$"/api/categories/{slug}"] = category;
                var listing = defaultListing ? await AddListingAsync(page, services, ("category", slug), ct) : null;
                if (category.BannerUrl is { } banner) PreloadImage(page, banner, BannerWidths, WideSizes);
                else if (listing is not null) PreloadCards(page, listing);
                break;
            }
            case "brand":
            {
                var brand = await storefront.GetBrandAsync(slug, ct);
                if (brand is null) break;
                page.Responses[$"/api/brands/{slug}"] = brand;
                if (defaultListing && await AddListingAsync(page, services, ("brand", slug), ct) is { } listing) PreloadCards(page, listing);
                break;
            }
        }
        return page;
    }

    /// <summary>Embeds the first page of a category or brand listing, as ProductListing.tsx requests it with no filters.</summary>
    private static async Task<ProductListDto> AddListingAsync(PageData page, IServiceProvider services, (string Name, string Slug) scope, CancellationToken ct)
    {
        var query = new ProductListQuery { PageSize = ListingPageSize, Facets = true };
        if (scope.Name == "category") query.Category = scope.Slug;
        else query.Brand = scope.Slug;
        var listing = await services.GetRequiredService<ProductQueries>().ListAsync(query, ct);
        // Keys list the query parameters sorted by name, the way api.ts normalizes them.
        page.Responses[$"/api/products?{scope.Name}={scope.Slug}&facets=true&page=1&pageSize={ListingPageSize}"] = listing;
        return listing;
    }

    /// <summary>The first row of product cards on a phone, which is what fills the screen.</summary>
    private static void PreloadCards(PageData page, ProductListDto listing)
    {
        foreach (var url in listing.Products.Items.Take(2).Select(p => p.ImageUrl).OfType<string>().Distinct())
            PreloadImage(page, url, CardImageWidth);
    }

    private static void PreloadImage(PageData page, string url, int width) =>
        page.Preloads.Append($"<link rel=\"preload\" as=\"image\" href=\"{WebUtility.HtmlEncode(Sized(url, width))}\" fetchpriority=\"high\">");

    private static void PreloadImage(PageData page, string url, int[] widths, string sizes, string? media = null)
    {
        var e = (string s) => WebUtility.HtmlEncode(s);
        page.Preloads.Append($"<link rel=\"preload\" as=\"image\" href=\"{e(Sized(url, BannerFallbackWidth))}\"");
        if (IsResizable(url))
            page.Preloads.Append($" imagesrcset=\"{e(string.Join(", ", widths.Select(w => $"{Sized(url, w)} {w}w")))}\" imagesizes=\"{e(sizes)}\"");
        if (media is not null) page.Preloads.Append($" media=\"{e(media)}\"");
        page.Preloads.Append(" fetchpriority=\"high\">");
    }

    /// <summary>
    /// Starts downloading the page's lazily loaded code with the main bundle, instead of after the main bundle
    /// has run and asked for it.
    /// </summary>
    private void PreloadRouteModule(PageData page, string path)
    {
        var segment = path.Trim('/').Split('/')[0];
        if (!RouteModules.TryGetValue(segment, out var source) || LoadManifest() is not { } manifest) return;
        var inHtml = Reachable(manifest, "index.html");
        foreach (var key in Reachable(manifest, source).Except(inHtml))
            page.Preloads.Append($"<link rel=\"modulepreload\" crossorigin href=\"/{WebUtility.HtmlEncode(manifest[key].File)}\">");
    }

    /// <summary>A manifest chunk and every chunk it statically imports.</summary>
    private static HashSet<string> Reachable(Dictionary<string, ManifestChunk> manifest, string start)
    {
        var seen = new HashSet<string>();
        var pending = new Stack<string>([start]);
        while (pending.TryPop(out var key))
        {
            if (!manifest.TryGetValue(key, out var chunk) || !seen.Add(key)) continue;
            foreach (var import in chunk.Imports ?? []) pending.Push(import);
        }
        return seen;
    }

    private Dictionary<string, ManifestChunk>? LoadManifest()
    {
        var file = Path.Combine(env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot"), "vite-manifest.json");
        if (!File.Exists(file)) return null;
        var stamp = File.GetLastWriteTimeUtc(file);
        lock (_gate)
        {
            if (_manifest is null || stamp != _manifestStamp)
            {
                _manifest = JsonSerializer.Deserialize<Dictionary<string, ManifestChunk>>(File.ReadAllText(file), JsonSerializerOptions.Web);
                _manifestStamp = stamp;
            }
            return _manifest;
        }
    }

    // Same rules as img() in frontend/src/lib/utils.ts: only uploaded raster images have resized copies.
    private static bool IsResizable(string url) =>
        url.StartsWith(MediaStorage.RequestPath + "/", StringComparison.OrdinalIgnoreCase) &&
        !url.EndsWith(".svg", StringComparison.OrdinalIgnoreCase) && !url.EndsWith(".gif", StringComparison.OrdinalIgnoreCase);

    private static string Sized(string url, int width) => IsResizable(url) ? $"{url}?w={width}" : url;

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

    private string Inject(string template, PageMeta meta, StoreSettings settings, string url, PageData page)
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
        html = html.Replace("</head>", tags + "</head>");

        if (page.Preloads.Length > 0)
        {
            // Ahead of the scripts, so the main image downloads while the app is still loading.
            var scripts = html.IndexOf("<script", StringComparison.OrdinalIgnoreCase);
            html = html.Insert(scripts >= 0 ? scripts : html.IndexOf("</head>", StringComparison.Ordinal), page.Preloads.ToString());
        }
        if (page.Responses.Count > 0)
        {
            // JSON can't contain "<" outside strings, so escaping it keeps "</script>" in any text from ending the tag.
            var data = JsonSerializer.Serialize(page.Responses, json.Value.JsonSerializerOptions).Replace("<", "\\u003c");
            html = html.Replace("</body>", $"<script id=\"grabity-data\" type=\"application/json\">{data}</script></body>");
        }
        return html;
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
