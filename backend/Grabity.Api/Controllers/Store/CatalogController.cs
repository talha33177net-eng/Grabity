using Microsoft.AspNetCore.Mvc;

namespace Grabity.Api.Controllers.Store;

[ApiController]
[Route("api")]
public class CatalogController(AppDbContext db, CatalogCache catalog, ProductQueries queries, StorefrontService storefront) : ControllerBase
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
    public async Task<CategoryPageDto> Category(string slug, CancellationToken ct) =>
        await storefront.GetCategoryAsync(slug, ct) ?? throw AppException.NotFound("Category");

    [HttpGet("brands")]
    public async Task<List<BrandDto>> Brands(CancellationToken ct) =>
        await db.Brands.AsNoTracking().Where(b => b.IsActive)
            .OrderBy(b => b.SortOrder).ThenBy(b => b.Name)
            .Select(b => new BrandDto(b.Id, b.Name, b.Slug, b.LogoUrl, null, null, null))
            .ToListAsync(ct);

    [HttpGet("brands/{slug}")]
    public async Task<BrandDto> Brand(string slug, CancellationToken ct) =>
        await storefront.GetBrandAsync(slug, ct) ?? throw AppException.NotFound("Brand");

    [HttpGet("products")]
    public Task<ProductListDto> Products([FromQuery] ProductListQuery query, CancellationToken ct) => queries.ListAsync(query, ct);

    [HttpGet("products/{slug}")]
    public async Task<ProductDetailDto> Product(string slug, CancellationToken ct) =>
        await storefront.GetProductAsync(slug, ct) ?? throw AppException.NotFound("Product");

    /// <summary>
    /// Counts a product page view. Kept out of the GET above because the storefront fetches product data
    /// ahead of a click (and embeds it in the page), which would otherwise count views nobody saw.
    /// </summary>
    [HttpPost("products/{slug}/view")]
    public async Task<IActionResult> View(string slug, CancellationToken ct)
    {
        await db.Products.Where(p => p.Slug == slug && p.IsActive)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.ViewCount, p => p.ViewCount + 1), ct);
        return NoContent();
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
