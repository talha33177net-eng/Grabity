using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Grabity.Api.Controllers.Store;

[ApiController]
[Route("api")]
public class ContentController(AppDbContext db, EmailNotifier emails, NewsletterTokens newsletterTokens) : ControllerBase
{
    [HttpGet("blog")]
    public async Task<PagedResult<BlogCardDto>> Blog([FromQuery] int page = 1, [FromQuery] int pageSize = 9, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        return await db.BlogPosts.AsNoTracking()
            .Where(p => p.IsPublished && p.PublishedAt <= now)
            .OrderByDescending(p => p.PublishedAt)
            .Select(p => new BlogCardDto(p.Id, p.Title, p.Slug, p.Excerpt, p.CoverImageUrl, p.PublishedAt, p.AuthorName))
            .ToPagedAsync(page, Math.Min(pageSize, 30), ct);
    }

    [HttpGet("blog/{slug}")]
    public async Task<BlogPostDto> Post(string slug, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var post = await db.BlogPosts.AsNoTracking()
            .Where(p => p.Slug == slug && p.IsPublished && p.PublishedAt <= now)
            .Select(p => new BlogPostDto(p.Id, p.Title, p.Slug, p.Excerpt, p.Content, p.CoverImageUrl, p.PublishedAt, p.AuthorName, p.MetaTitle, p.MetaDescription))
            .FirstOrDefaultAsync(ct) ?? throw AppException.NotFound("Post");
        await db.BlogPosts.Where(p => p.Id == post.Id).ExecuteUpdateAsync(s => s.SetProperty(p => p.ViewCount, p => p.ViewCount + 1), ct);
        return post;
    }

    [HttpGet("pages/{slug}")]
    public async Task<PageDto> Page(string slug, CancellationToken ct) =>
        await db.Pages.AsNoTracking().Where(p => p.Slug == slug && p.IsActive)
            .Select(p => new PageDto(p.Title, p.Slug, p.Content, p.MetaTitle, p.MetaDescription))
            .FirstOrDefaultAsync(ct) ?? throw AppException.NotFound("Page");

    [EnableRateLimiting("forms")]
    [HttpPost("newsletter")]
    public async Task<object> Subscribe(SubscribeRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (!await db.NewsletterSubscribers.AnyAsync(n => n.Email == email, ct))
        {
            db.NewsletterSubscribers.Add(new NewsletterSubscriber { Email = email, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync(ct);
            await emails.NewsletterWelcomeAsync(email);
        }
        return new { Message = "Thanks for subscribing! We'll keep you posted on new arrivals and offers." };
    }

    /// <summary>The unsubscribe link in newsletter emails. The token proves the request came from that email.</summary>
    [EnableRateLimiting("forms")]
    [HttpPost("newsletter/unsubscribe")]
    public async Task<object> Unsubscribe(UnsubscribeRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (!newsletterTokens.Verify(email, request.Token)) throw new AppException("This unsubscribe link isn't valid. Please use the link from your latest email.");
        await db.NewsletterSubscribers.Where(n => n.Email == email).ExecuteDeleteAsync(ct);
        return new { Message = $"{email} has been unsubscribed. You won't receive newsletter emails from us any more." };
    }
}
