using System.Linq.Expressions;

namespace Grabity.Api.Services;

/// <summary>Read-side product queries shared by listings, search and homepage sections.</summary>
public class ProductQueries(AppDbContext db, CatalogCache catalog)
{
    public static readonly Expression<Func<Product, ProductCardDto>> CardProjection = p => new ProductCardDto(
        p.Id,
        p.Name,
        p.Slug,
        p.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.Url).FirstOrDefault(),
        p.Price,
        p.CompareAtPrice,
        p.HidePrice,
        !p.TrackInventory || p.IsPreOrder || p.StockQuantity > 0,
        p.IsPreOrder,
        p.Badge,
        p.RatingAverage,
        p.RatingCount,
        p.Brand != null ? p.Brand.Name : null,
        p.Variants.Count(v => v.IsActive) == 1
            ? p.Variants.Where(v => v.IsActive).Select(v => (int?)v.Id).FirstOrDefault()
            : null);

    private IQueryable<Product> Active => db.Products.AsNoTracking().Where(p => p.IsActive);

    public async Task<ProductListDto> ListAsync(ProductListQuery q, CancellationToken ct)
    {
        var scope = Active;

        if (!string.IsNullOrWhiteSpace(q.Category))
        {
            var category = (await catalog.GetCategoriesAsync(ct)).FirstOrDefault(c => c.Slug == q.Category && c.IsActive)
                ?? throw AppException.NotFound("Category");
            var ids = await catalog.GetSelfAndDescendantIdsAsync(category.Id, ct);
            scope = scope.Where(p => ids.Contains(p.CategoryId));
        }
        if (!string.IsNullOrWhiteSpace(q.Brand)) scope = scope.Where(p => p.Brand != null && p.Brand.Slug == q.Brand);
        if (!string.IsNullOrWhiteSpace(q.Q)) scope = ApplySearch(scope, q.Q);
        if (q.OnSale) scope = scope.Where(p => !p.HidePrice && p.CompareAtPrice > p.Price);
        if (q.Featured) scope = scope.Where(p => p.IsFeatured);

        // Facets describe the whole scope so brand chips and the price slider stay stable while filtering.
        var facets = q.Facets ? await GetFacetsAsync(scope, ct) : null;

        var filtered = scope;
        var brandSlugs = (q.Brands ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (brandSlugs.Length > 0) filtered = filtered.Where(p => p.Brand != null && brandSlugs.Contains(p.Brand.Slug));
        if (q.MinPrice is decimal min) filtered = filtered.Where(p => p.Price >= min);
        if (q.MaxPrice is decimal max) filtered = filtered.Where(p => p.Price <= max);
        if (q.InStock) filtered = filtered.Where(p => !p.TrackInventory || p.IsPreOrder || p.StockQuantity > 0);

        var page = await ApplySort(filtered, q.Sort).Select(CardProjection)
            .ToPagedAsync(q.Page, Math.Clamp(q.PageSize, 1, 60), ct);
        return new ProductListDto(page, facets);
    }

    public async Task<List<SearchSuggestionDto>> SuggestAsync(string term, int limit, CancellationToken ct)
    {
        term = term.Trim();
        if (term.Length < 2) return [];
        return await ApplySearch(Active, term)
            .OrderByDescending(p => p.Name.StartsWith(term))
            .ThenByDescending(p => p.SoldCount)
            .ThenBy(p => p.Name)
            .Take(Math.Clamp(limit, 1, 20))
            .Select(p => new SearchSuggestionDto(
                p.Id, p.Name, p.Slug,
                p.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.Url).FirstOrDefault(),
                p.Price, p.CompareAtPrice, p.HidePrice))
            .ToListAsync(ct);
    }

    /// <summary>Products for a homepage section or tab.</summary>
    public async Task<List<ProductCardDto>> BySourceAsync(
        ProductSource source, int? categoryId, int? brandId, IReadOnlyList<int> productIds, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 48);
        var query = Active;

        if (source == ProductSource.Manual)
        {
            if (productIds.Count == 0) return [];
            var ids = productIds.ToList();
            var cards = await query.Where(p => ids.Contains(p.Id)).Select(CardProjection).ToListAsync(ct);
            return cards.OrderBy(c => ids.IndexOf(c.Id)).Take(limit).ToList();
        }

        if (categoryId is int cid)
        {
            var ids = await catalog.GetSelfAndDescendantIdsAsync(cid, ct);
            query = query.Where(p => ids.Contains(p.CategoryId));
        }
        if (brandId is int bid) query = query.Where(p => p.BrandId == bid);

        query = source switch
        {
            ProductSource.Featured => query.Where(p => p.IsFeatured).OrderBy(p => p.SortOrder).ThenByDescending(p => p.CreatedAt),
            ProductSource.BestSelling => query.OrderByDescending(p => p.SoldCount).ThenByDescending(p => p.ViewCount),
            ProductSource.OnSale => query.Where(p => !p.HidePrice && p.CompareAtPrice > p.Price)
                .OrderByDescending(p => p.CompareAtPrice - p.Price),
            ProductSource.TopRated => query.Where(p => p.RatingCount > 0)
                .OrderByDescending(p => p.RatingAverage).ThenByDescending(p => p.RatingCount),
            _ => query.OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id),
        };

        return await query.Take(limit).Select(CardProjection).ToListAsync(ct);
    }

    public static IQueryable<Product> ApplySearch(IQueryable<Product> query, string term)
    {
        foreach (var token in term.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(6))
        {
            var t = token;
            query = query.Where(p =>
                p.Name.Contains(t) ||
                (p.Sku != null && p.Sku.Contains(t)) ||
                (p.Tags != null && p.Tags.Contains(t)) ||
                (p.Brand != null && p.Brand.Name.Contains(t)) ||
                p.Category.Name.Contains(t));
        }
        return query;
    }

    private static IQueryable<Product> ApplySort(IQueryable<Product> query, string? sort)
    {
        // Purchasable items first for the browsing sorts; price/name sorts stay strict.
        var inStockFirst = query.OrderByDescending(p => !p.TrackInventory || p.IsPreOrder || p.StockQuantity > 0);
        return sort switch
        {
            "price-asc" => query.OrderBy(p => p.HidePrice).ThenBy(p => p.Price).ThenBy(p => p.Id),
            "price-desc" => query.OrderBy(p => p.HidePrice).ThenByDescending(p => p.Price).ThenBy(p => p.Id),
            "name" => query.OrderBy(p => p.Name).ThenBy(p => p.Id),
            "popular" => inStockFirst.ThenByDescending(p => p.SoldCount).ThenByDescending(p => p.ViewCount).ThenBy(p => p.Id),
            "rating" => inStockFirst.ThenByDescending(p => p.RatingAverage).ThenByDescending(p => p.RatingCount).ThenBy(p => p.Id),
            "manual" => inStockFirst.ThenBy(p => p.SortOrder).ThenByDescending(p => p.CreatedAt).ThenBy(p => p.Id),
            _ => inStockFirst.ThenByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id),
        };
    }

    private async Task<ProductFacetsDto> GetFacetsAsync(IQueryable<Product> scope, CancellationToken ct)
    {
        var counts = await scope.Where(p => p.BrandId != null)
            .GroupBy(p => p.BrandId!.Value)
            .Select(g => new { BrandId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var brandIds = counts.Select(c => c.BrandId).ToList();
        var brands = (await db.Brands.AsNoTracking()
                .Where(b => brandIds.Contains(b.Id) && b.IsActive)
                .Select(b => new { b.Id, b.Name, b.Slug })
                .ToListAsync(ct))
            .Select(b => new BrandFacetDto(b.Id, b.Name, b.Slug, counts.First(c => c.BrandId == b.Id).Count))
            .OrderBy(b => b.Name)
            .ToList();

        var priced = scope.Where(p => !p.HidePrice);
        var hasPrices = await priced.AnyAsync(ct);
        var min = hasPrices ? await priced.MinAsync(p => p.Price, ct) : 0;
        var max = hasPrices ? await priced.MaxAsync(p => p.Price, ct) : 0;
        return new ProductFacetsDto(brands, Math.Floor(min), Math.Ceiling(max));
    }
}
