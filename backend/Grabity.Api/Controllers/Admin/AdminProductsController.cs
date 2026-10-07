using Microsoft.AspNetCore.Mvc;

namespace Grabity.Api.Controllers.Admin;

[Route("api/admin/products")]
public class AdminProductsController(AppDbContext db, ProductService products, CatalogCache catalog, SettingsService settings)
    : AdminControllerBase
{
    [HttpGet]
    public async Task<PagedResult<AdminProductListItemDto>> List([FromQuery] AdminProductQuery q, CancellationToken ct)
    {
        var query = db.Products.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = q.Q.Trim();
            query = query.Where(p => p.Name.Contains(term) || (p.Sku != null && p.Sku.Contains(term)) ||
                p.Variants.Any(v => v.Sku != null && v.Sku.Contains(term)));
        }
        if (q.CategoryId is int categoryId)
        {
            var ids = await catalog.GetSelfAndDescendantIdsAsync(categoryId, ct, includeInactive: true);
            query = query.Where(p => ids.Contains(p.CategoryId));
        }
        if (q.BrandId is int brandId) query = query.Where(p => p.BrandId == brandId);
        query = q.Status switch
        {
            "active" => query.Where(p => p.IsActive),
            "draft" => query.Where(p => !p.IsActive),
            _ => query,
        };
        var low = (await settings.GetAsync(ct)).Checkout.LowStockThreshold;
        query = q.Stock switch
        {
            "out" => query.Where(p => p.TrackInventory && !p.IsPreOrder && p.StockQuantity <= 0),
            "low" => query.Where(p => p.TrackInventory && !p.IsPreOrder && p.StockQuantity > 0 && p.StockQuantity <= low),
            "in" => query.Where(p => !p.TrackInventory || p.IsPreOrder || p.StockQuantity > 0),
            _ => query,
        };
        if (q.Featured is bool featured) query = query.Where(p => p.IsFeatured == featured);

        query = q.Sort switch
        {
            "updated" => query.OrderByDescending(p => p.UpdatedAt),
            "name" => query.OrderBy(p => p.Name),
            "price-asc" => query.OrderBy(p => p.Price),
            "price-desc" => query.OrderByDescending(p => p.Price),
            "stock" => query.OrderBy(p => p.StockQuantity),
            "sold" => query.OrderByDescending(p => p.SoldCount),
            _ => query.OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id),
        };

        return await query.Select(p => new AdminProductListItemDto(
                p.Id, p.Name, p.Slug, p.Sku,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                p.Category.Name,
                p.Brand != null ? p.Brand.Name : null,
                p.Price, p.CompareAtPrice, p.StockQuantity, p.TrackInventory, p.IsPreOrder, p.HidePrice, p.IsActive, p.IsFeatured,
                p.Variants.Count, p.SoldCount, p.UpdatedAt))
            .ToPagedAsync(q.Page, q.PageSize, ct);
    }

    /// <summary>Names and images for a set of product ids (used by pickers in the admin UI).</summary>
    [HttpGet("by-ids")]
    public async Task<List<LookupProductDto>> ByIds([FromQuery] string ids, CancellationToken ct)
    {
        var list = (ids ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => int.TryParse(s, out var n) ? n : 0).Where(n => n > 0).Distinct().Take(100).ToList();
        if (list.Count == 0) return [];
        var rows = await db.Products.AsNoTracking().Where(p => list.Contains(p.Id))
            .Select(p => new LookupProductDto(p.Id, p.Name, p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(), p.Price, p.IsActive))
            .ToListAsync(ct);
        return rows.OrderBy(r => list.IndexOf(r.Id)).ToList();
    }

    [HttpGet("{id:int}")]
    public async Task<AdminProductDto> Get(int id, CancellationToken ct)
    {
        var product = await db.Products.AsNoTracking().Include(p => p.Images).Include(p => p.Variants).AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.NotFound("Product");
        return ToDto(product);
    }

    [HttpPost]
    public async Task<AdminProductDto> Create(ProductUpsertRequest request, CancellationToken ct) =>
        ToDto(await products.SaveAsync(null, request, ct));

    [HttpPut("{id:int}")]
    public async Task<AdminProductDto> Update(int id, ProductUpsertRequest request, CancellationToken ct) =>
        ToDto(await products.SaveAsync(id, request, ct));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var deleted = await db.Products.Where(p => p.Id == id).ExecuteDeleteAsync(ct);
        if (deleted == 0) throw AppException.NotFound("Product");
        catalog.InvalidateStorefront();
        return NoContent();
    }

    [HttpPost("{id:int}/duplicate")]
    public async Task<object> Duplicate(int id, CancellationToken ct)
    {
        var copy = await products.DuplicateAsync(id, ct);
        return new { copy.Id };
    }

    [HttpPost("bulk")]
    public async Task<object> Bulk(BulkProductActionRequest request, CancellationToken ct)
    {
        var target = db.Products.Where(p => request.Ids.Contains(p.Id));
        var now = DateTime.UtcNow;
        var affected = request.Action switch
        {
            "activate" => await target.ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, true).SetProperty(p => p.UpdatedAt, now), ct),
            "deactivate" => await target.ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, false).SetProperty(p => p.UpdatedAt, now), ct),
            "feature" => await target.ExecuteUpdateAsync(s => s.SetProperty(p => p.IsFeatured, true).SetProperty(p => p.UpdatedAt, now), ct),
            "unfeature" => await target.ExecuteUpdateAsync(s => s.SetProperty(p => p.IsFeatured, false).SetProperty(p => p.UpdatedAt, now), ct),
            "delete" => await target.ExecuteDeleteAsync(ct),
            _ => throw new AppException("Unknown bulk action."),
        };
        catalog.InvalidateStorefront();
        return new { Affected = affected };
    }

    /// <summary>Quick stock edit from the product list without opening the full form.</summary>
    [HttpPut("{id:int}/stock")]
    public async Task<AdminProductDto> UpdateStock(int id, StockUpdateRequest request, CancellationToken ct)
    {
        var product = await db.Products.Include(p => p.Images).Include(p => p.Variants).AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.NotFound("Product");
        foreach (var input in request.Variants)
        {
            var variant = product.Variants.FirstOrDefault(v => v.Id == input.VariantId)
                ?? throw new AppException("A variant in the request does not belong to this product.");
            variant.StockQuantity = input.StockQuantity;
        }
        ProductService.RecalculateAggregates(product);
        await db.SaveChangesAsync(ct);
        catalog.InvalidateStorefront();
        return ToDto(product);
    }

    private static AdminProductDto ToDto(Product p) => new(
        p.Id, p.Name, p.Slug, p.Sku, p.CategoryId, p.BrandId, p.ShortDescription, p.Description, p.WarrantyInfo, p.Badge, p.VideoUrl, p.Tags,
        p.TrackInventory, p.IsPreOrder, p.HidePrice, p.IsActive, p.IsFeatured, p.SortOrder, p.Options, p.Specifications, p.Faqs,
        p.Images.OrderBy(i => i.SortOrder).Select(i => new ProductImageInput { Url = i.Url, AltText = i.AltText }).ToList(),
        p.Variants.OrderBy(v => v.SortOrder).ThenBy(v => v.Id).Select(v => new VariantInput
        {
            Id = v.Id,
            Option1 = v.Option1,
            Option2 = v.Option2,
            Option3 = v.Option3,
            Sku = v.Sku,
            Price = v.Price,
            CompareAtPrice = v.CompareAtPrice,
            CostPrice = v.CostPrice,
            StockQuantity = v.StockQuantity,
            ImageUrl = v.ImageUrl,
            IsActive = v.IsActive,
        }).ToList(),
        p.MetaTitle, p.MetaDescription, p.SoldCount, p.ViewCount, p.RatingAverage, p.RatingCount, p.CreatedAt, p.UpdatedAt);
}
