using Grabity.Api.Controllers.Store;
using Microsoft.Extensions.Caching.Memory;

namespace Grabity.Api.Services;

/// <summary>
/// Storefront payloads served by the API and also embedded in the first HTML response of a page
/// (see <see cref="SpaRenderer"/>), so both always carry exactly the same data.
/// </summary>
public class StorefrontService(AppDbContext db, SettingsService settings, EmailSettingsService emailSettings, CatalogCache catalog, IMemoryCache cache)
{
    /// <summary>Everything the storefront shell needs: settings, menu and footer links.</summary>
    public async Task<BootstrapDto> GetBootstrapAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(CatalogCache.BootstrapKey, out BootstrapDto? cached) && cached is not null) return cached;

        var store = await settings.GetAsync(ct);
        var categories = (await catalog.GetCategoriesAsync(ct)).Where(c => c.IsActive).ToList();
        List<MenuCategoryDto> Build(int? parentId, int depth) => categories
            .Where(c => c.ParentId == parentId && c.ShowInMenu)
            .Select(c => new MenuCategoryDto(c.Id, c.Name, c.Slug, c.Icon, c.ImageUrl, depth < 2 ? Build(c.Id, depth + 1) : []))
            .ToList();

        var pages = await db.Pages.AsNoTracking()
            .Where(p => p.IsActive && p.FooterGroup != FooterGroup.None)
            .OrderBy(p => p.SortOrder).ThenBy(p => p.Title)
            .Select(p => new FooterLinkDto(p.Title, p.Slug, p.FooterGroup))
            .ToListAsync(ct);

        var dto = new BootstrapDto(store, Build(null, 0), pages, EmailSettingsService.IsReady(await emailSettings.GetAsync(ct)));
        cache.Set(CatalogCache.BootstrapKey, dto, TimeSpan.FromMinutes(10));
        return dto;
    }

    public async Task<CategoryPageDto?> GetCategoryAsync(string slug, CancellationToken ct)
    {
        var category = await db.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.Slug == slug && c.IsActive, ct);
        if (category is null) return null;
        var path = await catalog.GetPathAsync(category.Id, ct);
        var children = (await catalog.GetCategoriesAsync(ct))
            .Where(c => c.ParentId == category.Id && c.IsActive)
            .Select(c => new CategoryCardDto(c.Id, c.Name, c.Slug, c.ImageUrl, c.Icon))
            .ToList();

        return new CategoryPageDto(category.Id, category.Name, category.Slug, category.Description, category.BannerUrl, category.ImageUrl,
            category.SeoContent, category.MetaTitle, category.MetaDescription,
            path.Select(c => new BreadcrumbDto(c.Name, c.Slug)).ToList(), children);
    }

    public Task<BrandDto?> GetBrandAsync(string slug, CancellationToken ct) =>
        db.Brands.AsNoTracking().Where(b => b.Slug == slug && b.IsActive)
            .Select(b => new BrandDto(b.Id, b.Name, b.Slug, b.LogoUrl, b.Description, b.MetaTitle, b.MetaDescription))
            .FirstOrDefaultAsync(ct);

    /// <summary>The product page payload. Has no side effects, so pages can fetch it ahead of a click.</summary>
    public async Task<ProductDetailDto?> GetProductAsync(string slug, CancellationToken ct)
    {
        var p = await db.Products.AsNoTracking()
            .Include(x => x.Images).Include(x => x.Variants).Include(x => x.Brand).Include(x => x.Category)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Slug == slug && x.IsActive, ct);
        if (p is null) return null;

        var path = await catalog.GetPathAsync(p.CategoryId, ct);
        var tracks = p.TrackInventory && !p.IsPreOrder;
        var variants = p.Variants.Where(v => v.IsActive).OrderBy(v => v.SortOrder).ThenBy(v => v.Id)
            .Select(v => new VariantDto(v.Id, v.Option1, v.Option2, v.Option3, v.Title, v.Sku, v.Price,
                v.CompareAtPrice > v.Price ? v.CompareAtPrice : null,
                !tracks || v.StockQuantity > 0,
                tracks ? Math.Clamp(v.StockQuantity, 0, 99) : null,
                v.ImageUrl))
            .ToList();

        return new ProductDetailDto(
            p.Id, p.Name, p.Slug, p.Sku,
            p.Brand is null ? null : new BrandRefDto(p.Brand.Id, p.Brand.Name, p.Brand.Slug, p.Brand.LogoUrl),
            new CategoryRefDto(p.Category.Id, p.Category.Name, p.Category.Slug),
            path.Select(c => new BreadcrumbDto(c.Name, c.Slug)).ToList(),
            p.ShortDescription, p.Description, p.WarrantyInfo, p.Badge, p.VideoUrl,
            p.Price, p.CompareAtPrice, p.HidePrice, p.IsPreOrder, p.InStock,
            p.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => new ImageDto(i.Url, i.AltText ?? p.Name)).ToList(),
            p.Options, variants, p.Specifications, p.Faqs,
            await ReviewsController.SummaryAsync(db, p.Id, ct),
            p.MetaTitle, p.MetaDescription);
    }
}
