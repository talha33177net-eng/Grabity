using System.Text;
using Microsoft.AspNetCore.Mvc;

namespace Grabity.Api.Controllers.Admin;

[Route("api/admin/coupons")]
public class AdminCouponsController(AppDbContext db) : AdminControllerBase
{
    [HttpGet]
    public async Task<List<AdminCouponDto>> List(CancellationToken ct) =>
        await db.Coupons.AsNoTracking().OrderByDescending(c => c.CreatedAt).Select(Projection).ToListAsync(ct);

    [HttpPost]
    public async Task<AdminCouponDto> Create(CouponUpsertRequest request, CancellationToken ct)
    {
        var coupon = new Coupon();
        db.Coupons.Add(coupon);
        await ApplyAsync(coupon, request, ct);
        return await db.Coupons.AsNoTracking().Where(c => c.Id == coupon.Id).Select(Projection).FirstAsync(ct);
    }

    [HttpPut("{id:int}")]
    public async Task<AdminCouponDto> Update(int id, CouponUpsertRequest request, CancellationToken ct)
    {
        var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw AppException.NotFound("Coupon");
        await ApplyAsync(coupon, request, ct);
        return await db.Coupons.AsNoTracking().Where(c => c.Id == id).Select(Projection).FirstAsync(ct);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (await db.Coupons.Where(c => c.Id == id).ExecuteDeleteAsync(ct) == 0) throw AppException.NotFound("Coupon");
        return NoContent();
    }

    private async Task ApplyAsync(Coupon coupon, CouponUpsertRequest r, CancellationToken ct)
    {
        var code = r.Code.Trim().ToUpperInvariant();
        if (await db.Coupons.AnyAsync(c => c.Code == code && c.Id != coupon.Id, ct))
            throw AppException.Conflict("A coupon with this code already exists.");
        if (r.Type == DiscountType.Percentage && (r.Value <= 0 || r.Value > 100))
            throw new AppException("Percentage discounts must be between 1 and 100.");
        if (r.Type == DiscountType.FixedAmount && r.Value <= 0)
            throw new AppException("Enter the discount amount.");
        if (r.StartsAt is { } start && r.ExpiresAt is { } end && end <= start)
            throw new AppException("The end date must be after the start date.");

        coupon.Code = code;
        coupon.Description = r.Description.NullIfBlank();
        coupon.Type = r.Type;
        coupon.Value = r.Type == DiscountType.FreeShipping ? 0 : r.Value;
        coupon.MinOrderAmount = r.MinOrderAmount > 0 ? r.MinOrderAmount : null;
        coupon.MaxDiscountAmount = r.MaxDiscountAmount > 0 ? r.MaxDiscountAmount : null;
        coupon.StartsAt = r.StartsAt?.ToUniversalTime();
        coupon.ExpiresAt = r.ExpiresAt?.ToUniversalTime();
        coupon.UsageLimit = r.UsageLimit;
        coupon.UsageLimitPerCustomer = r.UsageLimitPerCustomer;
        coupon.IsActive = r.IsActive;
        await db.SaveChangesAsync(ct);
    }

    private static readonly System.Linq.Expressions.Expression<Func<Coupon, AdminCouponDto>> Projection = c =>
        new AdminCouponDto(c.Id, c.Code, c.Description, c.Type, c.Value, c.MinOrderAmount, c.MaxDiscountAmount, c.StartsAt, c.ExpiresAt,
            c.UsageLimit, c.UsageLimitPerCustomer, c.UsedCount, c.IsActive, c.CreatedAt);
}

[Route("api/admin/banners")]
public class AdminBannersController(AppDbContext db, CatalogCache catalog) : AdminControllerBase
{
    [HttpGet]
    public async Task<List<AdminBannerDto>> List([FromQuery] BannerPlacement? placement, CancellationToken ct)
    {
        var query = db.Banners.AsNoTracking();
        if (placement is BannerPlacement p) query = query.Where(b => b.Placement == p);
        return await query.OrderBy(b => b.Placement).ThenBy(b => b.SortOrder).ThenBy(b => b.Id)
            .Select(b => new AdminBannerDto(b.Id, b.Title, b.ImageUrl, b.MobileImageUrl, b.LinkUrl, b.Placement, b.SortOrder, b.IsActive, b.StartsAt, b.EndsAt))
            .ToListAsync(ct);
    }

    [HttpPost]
    public async Task<AdminBannerDto> Create(BannerUpsertRequest request, CancellationToken ct)
    {
        var banner = new Banner();
        db.Banners.Add(banner);
        return await SaveAsync(banner, request, ct);
    }

    [HttpPut("{id:int}")]
    public async Task<AdminBannerDto> Update(int id, BannerUpsertRequest request, CancellationToken ct)
    {
        var banner = await db.Banners.FirstOrDefaultAsync(b => b.Id == id, ct) ?? throw AppException.NotFound("Banner");
        return await SaveAsync(banner, request, ct);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (await db.Banners.Where(b => b.Id == id).ExecuteDeleteAsync(ct) == 0) throw AppException.NotFound("Banner");
        catalog.InvalidateStorefront();
        return NoContent();
    }

    private async Task<AdminBannerDto> SaveAsync(Banner banner, BannerUpsertRequest r, CancellationToken ct)
    {
        banner.Title = r.Title.NullIfBlank();
        banner.ImageUrl = r.ImageUrl.Trim();
        banner.MobileImageUrl = r.MobileImageUrl.NullIfBlank();
        banner.LinkUrl = r.LinkUrl.NullIfBlank();
        banner.Placement = r.Placement;
        banner.SortOrder = r.SortOrder;
        banner.IsActive = r.IsActive;
        banner.StartsAt = r.StartsAt?.ToUniversalTime();
        banner.EndsAt = r.EndsAt?.ToUniversalTime();
        await db.SaveChangesAsync(ct);
        catalog.InvalidateStorefront();
        return new AdminBannerDto(banner.Id, banner.Title, banner.ImageUrl, banner.MobileImageUrl, banner.LinkUrl, banner.Placement,
            banner.SortOrder, banner.IsActive, banner.StartsAt, banner.EndsAt);
    }
}

[Route("api/admin/home-sections")]
public class AdminHomeSectionsController(AppDbContext db, CatalogCache catalog, HtmlCleaner html) : AdminControllerBase
{
    [HttpGet]
    public async Task<List<AdminHomeSectionDto>> List(CancellationToken ct) =>
        (await db.HomeSections.AsNoTracking().OrderBy(s => s.SortOrder).ThenBy(s => s.Id).ToListAsync(ct))
            .Select(ToDto).ToList();

    [HttpPost]
    public async Task<AdminHomeSectionDto> Create(HomeSectionUpsertRequest request, CancellationToken ct)
    {
        var section = new HomeSection { SortOrder = (await db.HomeSections.MaxAsync(s => (int?)s.SortOrder, ct) ?? 0) + 1 };
        db.HomeSections.Add(section);
        return await SaveAsync(section, request, ct);
    }

    [HttpPut("{id:int}")]
    public async Task<AdminHomeSectionDto> Update(int id, HomeSectionUpsertRequest request, CancellationToken ct)
    {
        var section = await db.HomeSections.FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw AppException.NotFound("Section");
        return await SaveAsync(section, request, ct);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (await db.HomeSections.Where(s => s.Id == id).ExecuteDeleteAsync(ct) == 0) throw AppException.NotFound("Section");
        catalog.InvalidateStorefront();
        return NoContent();
    }

    [HttpPut("reorder")]
    public async Task<IActionResult> Reorder(ReorderRequest request, CancellationToken ct)
    {
        for (var i = 0; i < request.Ids.Count; i++)
        {
            var id = request.Ids[i];
            var order = i;
            await db.HomeSections.Where(s => s.Id == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.SortOrder, order), ct);
        }
        catalog.InvalidateStorefront();
        return NoContent();
    }

    private async Task<AdminHomeSectionDto> SaveAsync(HomeSection section, HomeSectionUpsertRequest r, CancellationToken ct)
    {
        var config = r.Config;
        config.Limit = Math.Clamp(config.Limit, 1, 48);
        foreach (var tab in config.Tabs) tab.Limit = Math.Clamp(tab.Limit, 1, 48);
        config.Tabs = config.Tabs.Where(t => !string.IsNullOrWhiteSpace(t.Title)).ToList();
        config.Images = config.Images.Where(i => !string.IsNullOrWhiteSpace(i.ImageUrl)).ToList();
        config.Html = html.Clean(config.Html);
        config.ViewAllUrl = config.ViewAllUrl.NullIfBlank();
        if (r.Type == HomeSectionType.ProductTabs && config.Tabs.Count == 0)
            throw new AppException("Add at least one tab.");

        section.Title = r.Title.Trim();
        section.Subtitle = r.Subtitle.NullIfBlank();
        section.Type = r.Type;
        section.Config = config;
        section.IsActive = r.IsActive;
        await db.SaveChangesAsync(ct);
        catalog.InvalidateStorefront();
        return ToDto(section);
    }

    private static AdminHomeSectionDto ToDto(HomeSection s) => new(s.Id, s.Title, s.Subtitle, s.Type, s.Config, s.SortOrder, s.IsActive);
}

[Route("api/admin/blog")]
public class AdminBlogController(AppDbContext db, HtmlCleaner html, CatalogCache catalog) : AdminControllerBase
{
    [HttpGet]
    public async Task<PagedResult<AdminBlogPostListItemDto>> List([FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var query = db.BlogPosts.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q)) query = query.Where(p => p.Title.Contains(q.Trim()));
        return await query.OrderByDescending(p => p.PublishedAt ?? p.CreatedAt)
            .Select(p => new AdminBlogPostListItemDto(p.Id, p.Title, p.Slug, p.CoverImageUrl, p.IsPublished, p.PublishedAt, p.ViewCount, p.UpdatedAt))
            .ToPagedAsync(page, pageSize, ct);
    }

    [HttpGet("{id:int}")]
    public async Task<AdminBlogPostDto> Get(int id, CancellationToken ct) =>
        await db.BlogPosts.AsNoTracking().Where(p => p.Id == id)
            .Select(p => new AdminBlogPostDto(p.Id, p.Title, p.Slug, p.Excerpt, p.Content, p.CoverImageUrl, p.AuthorName, p.IsPublished, p.PublishedAt, p.MetaTitle, p.MetaDescription))
            .FirstOrDefaultAsync(ct) ?? throw AppException.NotFound("Post");

    [HttpPost]
    public async Task<AdminBlogPostDto> Create(BlogPostUpsertRequest request, CancellationToken ct)
    {
        var post = new BlogPost();
        db.BlogPosts.Add(post);
        await ApplyAsync(post, request, ct);
        return await Get(post.Id, ct);
    }

    [HttpPut("{id:int}")]
    public async Task<AdminBlogPostDto> Update(int id, BlogPostUpsertRequest request, CancellationToken ct)
    {
        var post = await db.BlogPosts.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.NotFound("Post");
        await ApplyAsync(post, request, ct);
        return await Get(id, ct);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (await db.BlogPosts.Where(p => p.Id == id).ExecuteDeleteAsync(ct) == 0) throw AppException.NotFound("Post");
        catalog.InvalidateStorefront();
        return NoContent();
    }

    private async Task ApplyAsync(BlogPost post, BlogPostUpsertRequest r, CancellationToken ct)
    {
        var currentId = post.Id;
        post.Title = r.Title.Trim();
        post.Slug = await Slug.UniqueAsync(r.Slug, r.Title, s => db.BlogPosts.AnyAsync(p => p.Slug == s && p.Id != currentId, ct));
        post.Excerpt = r.Excerpt.NullIfBlank();
        post.Content = html.Clean(r.Content) ?? "";
        post.CoverImageUrl = r.CoverImageUrl.NullIfBlank();
        post.AuthorName = r.AuthorName.NullIfBlank();
        post.IsPublished = r.IsPublished;
        post.PublishedAt = r.IsPublished ? (r.PublishedAt?.ToUniversalTime() ?? post.PublishedAt ?? DateTime.UtcNow) : r.PublishedAt?.ToUniversalTime();
        post.MetaTitle = r.MetaTitle.NullIfBlank();
        post.MetaDescription = r.MetaDescription.NullIfBlank();
        await db.SaveChangesAsync(ct);
        catalog.InvalidateStorefront();
    }
}

[Route("api/admin/pages")]
public class AdminPagesController(AppDbContext db, HtmlCleaner html, CatalogCache catalog) : AdminControllerBase
{
    [HttpGet]
    public async Task<List<AdminPageDto>> List(CancellationToken ct) =>
        await db.Pages.AsNoTracking().OrderBy(p => p.FooterGroup).ThenBy(p => p.SortOrder).ThenBy(p => p.Title)
            .Select(p => new AdminPageDto(p.Id, p.Title, p.Slug, p.Content, p.FooterGroup, p.SortOrder, p.IsActive, p.MetaTitle, p.MetaDescription, p.UpdatedAt))
            .ToListAsync(ct);

    [HttpGet("{id:int}")]
    public async Task<AdminPageDto> Get(int id, CancellationToken ct) =>
        (await List(ct)).FirstOrDefault(p => p.Id == id) ?? throw AppException.NotFound("Page");

    [HttpPost]
    public async Task<AdminPageDto> Create(PageUpsertRequest request, CancellationToken ct)
    {
        var page = new Page();
        db.Pages.Add(page);
        await ApplyAsync(page, request, ct);
        return await Get(page.Id, ct);
    }

    [HttpPut("{id:int}")]
    public async Task<AdminPageDto> Update(int id, PageUpsertRequest request, CancellationToken ct)
    {
        var page = await db.Pages.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.NotFound("Page");
        await ApplyAsync(page, request, ct);
        return await Get(id, ct);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (await db.Pages.Where(p => p.Id == id).ExecuteDeleteAsync(ct) == 0) throw AppException.NotFound("Page");
        catalog.InvalidateStorefront();
        return NoContent();
    }

    private async Task ApplyAsync(Page page, PageUpsertRequest r, CancellationToken ct)
    {
        var currentId = page.Id;
        page.Title = r.Title.Trim();
        page.Slug = await Slug.UniqueAsync(r.Slug, r.Title, s => db.Pages.AnyAsync(p => p.Slug == s && p.Id != currentId, ct));
        page.Content = html.Clean(r.Content) ?? "";
        page.FooterGroup = r.FooterGroup;
        page.SortOrder = r.SortOrder;
        page.IsActive = r.IsActive;
        page.MetaTitle = r.MetaTitle.NullIfBlank();
        page.MetaDescription = r.MetaDescription.NullIfBlank();
        await db.SaveChangesAsync(ct);
        catalog.InvalidateStorefront();
    }
}

[Route("api/admin/newsletter")]
public class AdminNewsletterController(AppDbContext db) : AdminControllerBase
{
    [HttpGet]
    public async Task<PagedResult<NewsletterSubscriberDto>> List([FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var query = db.NewsletterSubscribers.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q)) query = query.Where(n => n.Email.Contains(q.Trim()));
        return await query.OrderByDescending(n => n.CreatedAt)
            .Select(n => new NewsletterSubscriberDto(n.Id, n.Email, n.CreatedAt))
            .ToPagedAsync(page, pageSize, ct);
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export(CancellationToken ct)
    {
        var rows = await db.NewsletterSubscribers.AsNoTracking().OrderBy(n => n.CreatedAt).ToListAsync(ct);
        var csv = new StringBuilder("Email,Subscribed At\n");
        foreach (var row in rows) csv.Append(row.Email).Append(',').Append(row.CreatedAt.ToString("u")).Append('\n');
        return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", "subscribers.csv");
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (await db.NewsletterSubscribers.Where(n => n.Id == id).ExecuteDeleteAsync(ct) == 0) throw AppException.NotFound("Subscriber");
        return NoContent();
    }
}
