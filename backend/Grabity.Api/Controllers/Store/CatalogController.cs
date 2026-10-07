using Microsoft.AspNetCore.Mvc;

namespace Grabity.Api.Controllers.Store;

[ApiController]
[Route("api")]
public class CatalogController(AppDbContext db, CatalogCache catalog, ProductQueries queries) : ControllerBase
{
    /// <summary>Top-level categories with their subcategories, for the "All categories" page.</summary>
    [HttpGet("categories")]
    public async Task<List<CategoryGroupDto>> Categories(CancellationToken ct)
    {
        var all = (await catalog.GetCategoriesAsync(ct)).Where(c => c.IsActive).ToList();
        return all.Where(c => c.ParentId is null)
            .Select(root => new CategoryGroupDto(root.Id, root.Name, root.Slug, root.ImageUrl, root.Icon,
                all.Where(c => c.ParentId == root.Id).Select(c => new CategoryCardDto(c.Id, c.Name, c.Slug, c.ImageUrl, c.Icon)).ToList()))
            .ToList();
    }

    [HttpGet("categories/{slug}")]
    public async Task<CategoryPageDto> Category(string slug, CancellationToken ct)
    {
        var category = await db.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.Slug == slug && c.IsActive, ct)
            ?? throw AppException.NotFound("Category");
        var path = await catalog.GetPathAsync(category.Id, ct);
        var children = (await catalog.GetCategoriesAsync(ct))
            .Where(c => c.ParentId == category.Id && c.IsActive)
            .Select(c => new CategoryCardDto(c.Id, c.Name, c.Slug, c.ImageUrl, c.Icon))
            .ToList();

        return new CategoryPageDto(category.Id, category.Name, category.Slug, category.Description, category.BannerUrl, category.ImageUrl,
            category.SeoContent, category.MetaTitle, category.MetaDescription,
            path.Select(c => new BreadcrumbDto(c.Name, c.Slug)).ToList(), children);
    }

    [HttpGet("brands")]
    public async Task<List<BrandDto>> Brands(CancellationToken ct) =>
        await db.Brands.AsNoTracking().Where(b => b.IsActive)
            .OrderBy(b => b.SortOrder).ThenBy(b => b.Name)
            .Select(b => new BrandDto(b.Id, b.Name, b.Slug, b.LogoUrl, null, null, null))
            .ToListAsync(ct);

    [HttpGet("brands/{slug}")]
    public async Task<BrandDto> Brand(string slug, CancellationToken ct) =>
        await db.Brands.AsNoTracking().Where(b => b.Slug == slug && b.IsActive)
            .Select(b => new BrandDto(b.Id, b.Name, b.Slug, b.LogoUrl, b.Description, b.MetaTitle, b.MetaDescription))
            .FirstOrDefaultAsync(ct) ?? throw AppException.NotFound("Brand");

    [HttpGet("products")]
    public Task<ProductListDto> Products([FromQuery] ProductListQuery query, CancellationToken ct) => queries.ListAsync(query, ct);

    [HttpGet("products/{slug}")]
    public async Task<ProductDetailDto> Product(string slug, CancellationToken ct)
    {
        var p = await db.Products.AsNoTracking()
            .Include(x => x.Images).Include(x => x.Variants).Include(x => x.Brand).Include(x => x.Category)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Slug == slug && x.IsActive, ct) ?? throw AppException.NotFound("Product");

        await db.Products.Where(x => x.Id == p.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.ViewCount, x => x.ViewCount + 1), ct);

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

    [HttpGet("products/{slug}/related")]
    public async Task<List<ProductCardDto>> Related(string slug, [FromQuery] int limit = 10, CancellationToken ct = default)
    {
        var product = await db.Products.AsNoTracking().Where(p => p.Slug == slug)
            .Select(p => new { p.Id, p.CategoryId, p.BrandId }).FirstOrDefaultAsync(ct) ?? throw AppException.NotFound("Product");
        limit = Math.Clamp(limit, 1, 20);

        var related = await db.Products.AsNoTracking()
            .Where(p => p.IsActive && p.Id != product.Id && p.CategoryId == product.CategoryId)
            .OrderByDescending(p => !p.TrackInventory || p.IsPreOrder || p.StockQuantity > 0)
            .ThenByDescending(p => p.SoldCount).ThenByDescending(p => p.CreatedAt)
            .Take(limit).Select(ProductQueries.CardProjection).ToListAsync(ct);

        if (related.Count < limit)
        {
            // Top up with products from the parent category's other branches.
            var path = await catalog.GetPathAsync(product.CategoryId, ct);
            if (path.Count > 1)
            {
                var siblings = await catalog.GetSelfAndDescendantIdsAsync(path[^2].Id, ct);
                var exclude = related.Select(r => r.Id).Append(product.Id).ToList();
                related.AddRange(await db.Products.AsNoTracking()
                    .Where(p => p.IsActive && siblings.Contains(p.CategoryId) && !exclude.Contains(p.Id))
                    .OrderByDescending(p => p.SoldCount).ThenByDescending(p => p.CreatedAt)
                    .Take(limit - related.Count).Select(ProductQueries.CardProjection).ToListAsync(ct));
            }
        }
        return related;
    }

    [HttpGet("search/suggest")]
    public Task<List<SearchSuggestionDto>> Suggest([FromQuery] string q, CancellationToken ct) =>
        queries.SuggestAsync(q ?? "", 8, ct);
}
