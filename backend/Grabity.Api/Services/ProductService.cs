namespace Grabity.Api.Services;

/// <summary>Write-side product logic used by the admin panel.</summary>
public class ProductService(AppDbContext db, HtmlCleaner html, CatalogCache catalog)
{
    public async Task<Product> SaveAsync(int? id, ProductUpsertRequest r, CancellationToken ct)
    {
        Product product;
        if (id is int productId)
        {
            product = await db.Products.Include(p => p.Images).Include(p => p.Variants).AsSplitQuery()
                .FirstOrDefaultAsync(p => p.Id == productId, ct) ?? throw AppException.NotFound("Product");
        }
        else
        {
            product = new Product();
            db.Products.Add(product);
        }

        if (!await db.Categories.AnyAsync(c => c.Id == r.CategoryId, ct))
            throw new AppException("The selected category does not exist.");
        if (r.BrandId is int brandId && !await db.Brands.AnyAsync(b => b.Id == brandId, ct))
            throw new AppException("The selected brand does not exist.");

        var options = NormalizeOptions(r.Options);
        var variants = NormalizeVariants(options, r.Variants);

        var currentId = product.Id;
        product.Name = r.Name.Trim();
        product.Slug = await Slug.UniqueAsync(r.Slug, r.Name, s => db.Products.AnyAsync(p => p.Slug == s && p.Id != currentId, ct));
        product.Sku = r.Sku.NullIfBlank();
        product.CategoryId = r.CategoryId;
        product.BrandId = r.BrandId;
        product.ShortDescription = html.Clean(r.ShortDescription);
        product.Description = html.Clean(r.Description);
        product.WarrantyInfo = r.WarrantyInfo.NullIfBlank();
        product.Badge = r.Badge.NullIfBlank();
        product.VideoUrl = r.VideoUrl.NullIfBlank();
        product.Tags = r.Tags.NullIfBlank();
        product.TrackInventory = r.TrackInventory;
        product.IsPreOrder = r.IsPreOrder;
        product.HidePrice = r.HidePrice;
        product.IsActive = r.IsActive;
        product.IsFeatured = r.IsFeatured;
        product.SortOrder = r.SortOrder;
        product.Options = options;
        product.Specifications = r.Specifications
            .Where(s => !string.IsNullOrWhiteSpace(s.Name) && !string.IsNullOrWhiteSpace(s.Value))
            .Select(s => new ProductSpecification { Name = s.Name.Trim(), Value = s.Value.Trim() })
            .ToList();
        product.Faqs = r.Faqs
            .Where(f => !string.IsNullOrWhiteSpace(f.Question) && !string.IsNullOrWhiteSpace(f.Answer))
            .Select(f => new ProductFaq { Question = f.Question.Trim(), Answer = f.Answer.Trim() })
            .ToList();
        product.MetaTitle = r.MetaTitle.NullIfBlank();
        product.MetaDescription = r.MetaDescription.NullIfBlank();

        product.Images.Clear();
        foreach (var (image, index) in r.Images.Where(i => !string.IsNullOrWhiteSpace(i.Url)).Select((img, i) => (img, i)))
            product.Images.Add(new ProductImage { Url = image.Url.Trim(), AltText = image.AltText.NullIfBlank(), SortOrder = index });

        var existing = product.Variants.Where(v => v.Id != 0).ToDictionary(v => v.Id);
        var kept = new HashSet<int>();
        var sort = 0;
        foreach (var input in variants)
        {
            ProductVariant variant;
            if (input.Id is int variantId && existing.TryGetValue(variantId, out var found))
            {
                variant = found;
                kept.Add(variantId);
            }
            else
            {
                variant = new ProductVariant();
                product.Variants.Add(variant);
            }

            variant.Option1 = input.Option1;
            variant.Option2 = input.Option2;
            variant.Option3 = input.Option3;
            variant.Sku = input.Sku.NullIfBlank();
            variant.Price = input.Price;
            variant.CompareAtPrice = input.CompareAtPrice > input.Price ? input.CompareAtPrice : null;
            variant.CostPrice = input.CostPrice;
            variant.StockQuantity = input.StockQuantity;
            variant.ImageUrl = input.ImageUrl.NullIfBlank();
            variant.IsActive = input.IsActive;
            variant.SortOrder = sort++;
        }
        foreach (var removed in existing.Values.Where(v => !kept.Contains(v.Id)))
            product.Variants.Remove(removed);

        RecalculateAggregates(product);
        await db.SaveChangesAsync(ct);
        catalog.InvalidateStorefront();
        return product;
    }

    public async Task<Product> DuplicateAsync(int id, CancellationToken ct)
    {
        var source = await db.Products.AsNoTracking().Include(p => p.Images).Include(p => p.Variants).AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.NotFound("Product");

        var copyName = source.Name + " (Copy)";
        var copy = new Product
        {
            Name = copyName,
            Slug = await Slug.UniqueAsync(null, copyName, s => db.Products.AnyAsync(p => p.Slug == s, ct)),
            CategoryId = source.CategoryId,
            BrandId = source.BrandId,
            ShortDescription = source.ShortDescription,
            Description = source.Description,
            WarrantyInfo = source.WarrantyInfo,
            Badge = source.Badge,
            VideoUrl = source.VideoUrl,
            Tags = source.Tags,
            TrackInventory = source.TrackInventory,
            IsPreOrder = source.IsPreOrder,
            HidePrice = source.HidePrice,
            IsActive = false,
            Options = source.Options,
            Specifications = source.Specifications,
            Faqs = source.Faqs,
            MetaTitle = source.MetaTitle,
            MetaDescription = source.MetaDescription,
            Images = source.Images.OrderBy(i => i.SortOrder)
                .Select(i => new ProductImage { Url = i.Url, AltText = i.AltText, SortOrder = i.SortOrder }).ToList(),
            Variants = source.Variants.OrderBy(v => v.SortOrder).Select(v => new ProductVariant
            {
                Option1 = v.Option1,
                Option2 = v.Option2,
                Option3 = v.Option3,
                Price = v.Price,
                CompareAtPrice = v.CompareAtPrice,
                CostPrice = v.CostPrice,
                StockQuantity = 0,
                ImageUrl = v.ImageUrl,
                IsActive = v.IsActive,
                SortOrder = v.SortOrder,
            }).ToList(),
        };
        RecalculateAggregates(copy);
        db.Products.Add(copy);
        await db.SaveChangesAsync(ct);
        return copy;
    }

    public static void RecalculateAggregates(Product product)
    {
        var active = product.Variants.Where(v => v.IsActive).ToList();
        var cheapest = active.OrderBy(v => v.Price).FirstOrDefault();
        product.Price = cheapest?.Price ?? 0;
        product.CompareAtPrice = cheapest is { CompareAtPrice: { } compare } && compare > cheapest.Price ? compare : null;
        product.StockQuantity = active.Sum(v => v.StockQuantity);
    }

    public static async Task RecalculateRatingAsync(AppDbContext db, int productId, CancellationToken ct)
    {
        var stats = await db.ProductReviews.Where(r => r.ProductId == productId && r.IsApproved)
            .GroupBy(r => 1)
            .Select(g => new { Count = g.Count(), Average = g.Average(r => (decimal)r.Rating) })
            .SingleOrDefaultAsync(ct);
        await db.Products.Where(p => p.Id == productId).ExecuteUpdateAsync(s => s
            .SetProperty(p => p.RatingCount, stats == null ? 0 : stats.Count)
            .SetProperty(p => p.RatingAverage, stats == null ? 0 : Math.Round(stats.Average, 2)), ct);
    }

    private static List<ProductOption> NormalizeOptions(List<ProductOption> input)
    {
        var options = new List<ProductOption>();
        foreach (var option in input)
        {
            var name = option.Name?.Trim() ?? "";
            var values = option.Values.Select(v => v?.Trim() ?? "").Where(v => v.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (name.Length == 0 && values.Count == 0) continue;
            if (name.Length == 0) throw new AppException("Every option needs a name, e.g. Color.");
            if (values.Count == 0) throw new AppException($"Add at least one value for \"{name}\".");
            if (options.Any(o => o.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
                throw new AppException($"The option \"{name}\" is listed twice.");
            options.Add(new ProductOption { Name = name, Values = values });
        }
        if (options.Count > 3) throw new AppException("A product can have at most 3 options.");
        return options;
    }

    private static List<VariantInput> NormalizeVariants(List<ProductOption> options, List<VariantInput> input)
    {
        if (input.Count == 0) throw new AppException("Add a price for the product.");

        if (options.Count == 0)
        {
            var single = input[0];
            single.Option1 = single.Option2 = single.Option3 = null;
            return [single];
        }

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var result = new List<VariantInput>();
        foreach (var variant in input)
        {
            var values = new[] { variant.Option1, variant.Option2, variant.Option3 };
            for (var i = 0; i < 3; i++)
            {
                if (i >= options.Count)
                {
                    values[i] = null;
                    continue;
                }
                var match = options[i].Values.FirstOrDefault(v => v.Equals(values[i]?.Trim(), StringComparison.OrdinalIgnoreCase))
                    ?? throw new AppException($"Each variant needs a valid \"{options[i].Name}\" value.");
                values[i] = match;
            }
            var key = string.Join("|", values);
            if (!seen.Add(key))
                throw new AppException($"The variant \"{ProductVariant.BuildTitle(values[0], values[1], values[2])}\" is listed twice.");
            variant.Option1 = values[0];
            variant.Option2 = values[1];
            variant.Option3 = values[2];
            result.Add(variant);
        }
        return result;
    }
}
