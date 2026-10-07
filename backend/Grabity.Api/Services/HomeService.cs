using Microsoft.Extensions.Caching.Memory;

namespace Grabity.Api.Services;

public class HomeService(AppDbContext db, ProductQueries products, CatalogCache catalog, IMemoryCache cache)
{
    public async Task<HomeDto> GetAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(CatalogCache.HomeKey, out HomeDto? cached) && cached is not null) return cached;

        var now = DateTime.UtcNow;
        var banners = await db.Banners.AsNoTracking()
            .Where(b => b.IsActive && (b.StartsAt == null || b.StartsAt <= now) && (b.EndsAt == null || b.EndsAt >= now))
            .OrderBy(b => b.SortOrder).ThenBy(b => b.Id)
            .ToListAsync(ct);
        BannerDto Map(Banner b) => new(b.Id, b.Title, b.ImageUrl, b.MobileImageUrl, b.LinkUrl);

        var sections = new List<HomeSectionDto>();
        var definitions = await db.HomeSections.AsNoTracking().Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Id).ToListAsync(ct);
        foreach (var section in definitions)
        {
            var dto = await BuildSectionAsync(section, ct);
            if (dto is not null) sections.Add(dto);
        }

        var home = new HomeDto(
            banners.Where(b => b.Placement == BannerPlacement.HeroSlider).Select(Map).ToList(),
            banners.Where(b => b.Placement == BannerPlacement.HeroSide).Select(Map).Take(2).ToList(),
            banners.Where(b => b.Placement == BannerPlacement.Popup).Select(Map).FirstOrDefault(),
            sections);

        // Short lifetime so scheduled banners and stock changes show up without manual cache clearing.
        cache.Set(CatalogCache.HomeKey, home, TimeSpan.FromMinutes(2));
        return home;
    }

    private async Task<HomeSectionDto?> BuildSectionAsync(HomeSection section, CancellationToken ct)
    {
        var c = section.Config;
        switch (section.Type)
        {
            case HomeSectionType.Products:
            {
                var items = await products.BySourceAsync(c.Source, c.CategoryId, c.BrandId, c.ProductIds, c.Limit, ct);
                if (items.Count == 0) return null;
                var viewAll = c.ViewAllUrl ?? await DefaultViewAllAsync(c.Source, c.CategoryId, c.BrandId, ct);
                return new HomeSectionDto(section.Id, section.Type, section.Title, section.Subtitle, viewAll, Products: items);
            }
            case HomeSectionType.ProductTabs:
            {
                var tabs = new List<HomeTabDto>();
                foreach (var tab in c.Tabs)
                {
                    var items = await products.BySourceAsync(tab.Source, tab.CategoryId, tab.BrandId, tab.ProductIds, tab.Limit, ct);
                    if (items.Count > 0)
                        tabs.Add(new HomeTabDto(tab.Title, await DefaultViewAllAsync(tab.Source, tab.CategoryId, tab.BrandId, ct), items));
                }
                return tabs.Count == 0 ? null
                    : new HomeSectionDto(section.Id, section.Type, section.Title, section.Subtitle, c.ViewAllUrl, Tabs: tabs);
            }
            case HomeSectionType.Categories:
            {
                var all = (await catalog.GetCategoriesAsync(ct)).Where(x => x.IsActive).ToList();
                var picked = c.CategoryIds.Count > 0
                    ? c.CategoryIds.Select(id => all.FirstOrDefault(x => x.Id == id)).OfType<CategoryNode>().ToList()
                    : all.Where(x => x.IsFeatured).ToList();
                if (picked.Count == 0) return null;
                return new HomeSectionDto(section.Id, section.Type, section.Title, section.Subtitle, c.ViewAllUrl ?? "/categories",
                    Categories: picked.Take(Math.Max(c.Limit, 1)).Select(x => new CategoryCardDto(x.Id, x.Name, x.Slug, x.ImageUrl, x.Icon)).ToList());
            }
            case HomeSectionType.Brands:
            {
                var brands = await db.Brands.AsNoTracking().Where(b => b.IsActive && b.IsFeatured)
                    .OrderBy(b => b.SortOrder).ThenBy(b => b.Name).Take(Math.Max(c.Limit, 1))
                    .Select(b => new BrandDto(b.Id, b.Name, b.Slug, b.LogoUrl, null, null, null))
                    .ToListAsync(ct);
                return brands.Count == 0 ? null
                    : new HomeSectionDto(section.Id, section.Type, section.Title, section.Subtitle, c.ViewAllUrl ?? "/brands", Brands: brands);
            }
            case HomeSectionType.Reviews:
            {
                var reviews = await db.ProductReviews.AsNoTracking()
                    .Where(r => r.IsApproved && r.IsFeatured && r.Product.IsActive)
                    .OrderByDescending(r => r.CreatedAt).Take(Math.Max(c.Limit, 1))
                    .Select(r => new ReviewCardDto(r.Id, r.CustomerName, r.Rating, r.Comment, r.CreatedAt, r.ProductId, r.Product.Name, r.Product.Slug,
                        r.Product.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault()))
                    .ToListAsync(ct);
                return reviews.Count == 0 ? null
                    : new HomeSectionDto(section.Id, section.Type, section.Title, section.Subtitle, c.ViewAllUrl ?? "/reviews", Reviews: reviews);
            }
            case HomeSectionType.Blog:
            {
                var now = DateTime.UtcNow;
                var posts = await db.BlogPosts.AsNoTracking()
                    .Where(p => p.IsPublished && p.PublishedAt <= now)
                    .OrderByDescending(p => p.PublishedAt).Take(Math.Clamp(c.Limit, 1, 12))
                    .Select(p => new BlogCardDto(p.Id, p.Title, p.Slug, p.Excerpt, p.CoverImageUrl, p.PublishedAt, p.AuthorName))
                    .ToListAsync(ct);
                return posts.Count == 0 ? null
                    : new HomeSectionDto(section.Id, section.Type, section.Title, section.Subtitle, c.ViewAllUrl ?? "/blog", Posts: posts);
            }
            case HomeSectionType.Banners:
                return c.Images.Count == 0 ? null
                    : new HomeSectionDto(section.Id, section.Type, section.Title, section.Subtitle, null, Images: c.Images);
            case HomeSectionType.RichText:
                return string.IsNullOrWhiteSpace(c.Html) ? null
                    : new HomeSectionDto(section.Id, section.Type, section.Title, section.Subtitle, null, Html: c.Html);
            default:
                return null;
        }
    }

    private async Task<string?> DefaultViewAllAsync(ProductSource source, int? categoryId, int? brandId, CancellationToken ct)
    {
        if (categoryId is int cid)
        {
            var category = (await catalog.GetCategoriesAsync(ct)).FirstOrDefault(c => c.Id == cid);
            if (category is not null) return $"/category/{category.Slug}";
        }
        if (brandId is int bid)
        {
            var slug = await db.Brands.Where(b => b.Id == bid).Select(b => b.Slug).FirstOrDefaultAsync(ct);
            if (slug is not null) return $"/brand/{slug}";
        }
        return source switch
        {
            ProductSource.OnSale => "/offers",
            ProductSource.BestSelling => "/search?sort=popular",
            ProductSource.TopRated => "/search?sort=rating",
            ProductSource.Featured => "/search?featured=true",
            ProductSource.Newest => "/search?sort=newest",
            _ => null,
        };
    }
}
