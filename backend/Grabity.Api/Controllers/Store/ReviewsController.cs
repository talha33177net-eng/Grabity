using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Grabity.Api.Controllers.Store;

[ApiController]
[Route("api")]
public class ReviewsController(AppDbContext db, SettingsService settings, CatalogCache catalog, EmailNotifier emails) : ControllerBase
{
    [HttpGet("products/{productId:int}/reviews")]
    public async Task<PagedResult<ReviewDto>> ForProduct(int productId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken ct = default) =>
        await db.ProductReviews.AsNoTracking()
            .Where(r => r.ProductId == productId && r.IsApproved)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReviewDto(r.Id, r.CustomerName, r.Rating, r.Title, r.Comment, r.IsVerifiedPurchase, r.AdminReply, r.CreatedAt))
            .ToPagedAsync(page, Math.Min(pageSize, 50), ct);

    [Authorize]
    [EnableRateLimiting("forms")]
    [HttpPost("products/{productId:int}/reviews")]
    public async Task<ActionResult<object>> Create(int productId, CreateReviewRequest request, CancellationToken ct)
    {
        var userId = User.RequireUserId();
        var product = await db.Products.AsNoTracking().Where(p => p.Id == productId && p.IsActive)
            .Select(p => new { p.Id }).FirstOrDefaultAsync(ct) ?? throw AppException.NotFound("Product");
        if (await db.ProductReviews.AnyAsync(r => r.ProductId == productId && r.UserId == userId, ct))
            throw AppException.Conflict("You have already reviewed this product.");

        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        var verified = await db.Orders.AnyAsync(o => o.UserId == userId && o.Status == OrderStatus.Delivered &&
            o.Items.Any(i => i.ProductId == productId), ct);
        var store = await settings.GetAsync(ct);

        var review = new ProductReview
        {
            ProductId = product.Id,
            UserId = userId,
            CustomerName = user.FullName,
            Rating = request.Rating,
            Title = request.Title.NullIfBlank(),
            Comment = request.Comment.Trim(),
            IsVerifiedPurchase = verified,
            IsApproved = !store.General.ReviewsRequireApproval,
        };
        db.ProductReviews.Add(review);
        await db.SaveChangesAsync(ct);

        if (review.IsApproved)
        {
            await ProductService.RecalculateRatingAsync(db, product.Id, ct);
            catalog.InvalidateStorefront();
        }
        else
        {
            await emails.ReviewSubmittedAsync(review);
        }

        return Ok(new
        {
            review.Id,
            review.IsApproved,
            Message = review.IsApproved ? "Thanks! Your review is live." : "Thanks! Your review will appear after a quick check.",
        });
    }

    /// <summary>All approved reviews across the store.</summary>
    [HttpGet("reviews")]
    public async Task<PagedResult<ReviewCardDto>> All([FromQuery] string? sort, [FromQuery] int page = 1, [FromQuery] int pageSize = 12, CancellationToken ct = default)
    {
        var query = db.ProductReviews.AsNoTracking().Where(r => r.IsApproved && r.Product.IsActive);
        query = sort switch
        {
            "oldest" => query.OrderBy(r => r.CreatedAt),
            "highest" => query.OrderByDescending(r => r.Rating).ThenByDescending(r => r.CreatedAt),
            "lowest" => query.OrderBy(r => r.Rating).ThenByDescending(r => r.CreatedAt),
            "newest" => query.OrderByDescending(r => r.CreatedAt),
            _ => query.OrderByDescending(r => r.IsFeatured).ThenByDescending(r => r.CreatedAt),
        };
        return await query
            .Select(r => new ReviewCardDto(r.Id, r.CustomerName, r.Rating, r.Comment, r.CreatedAt, r.ProductId, r.Product.Name, r.Product.Slug,
                r.Product.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault()))
            .ToPagedAsync(page, Math.Min(pageSize, 48), ct);
    }

    public static async Task<ReviewSummaryDto> SummaryAsync(AppDbContext db, int productId, CancellationToken ct)
    {
        var counts = await db.ProductReviews.AsNoTracking()
            .Where(r => r.ProductId == productId && r.IsApproved)
            .GroupBy(r => r.Rating)
            .Select(g => new { Rating = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var breakdown = new int[5];
        foreach (var c in counts.Where(c => c.Rating is >= 1 and <= 5)) breakdown[c.Rating - 1] = c.Count;
        var total = breakdown.Sum();
        var average = total == 0 ? 0 : Math.Round((decimal)counts.Sum(c => c.Rating * c.Count) / total, 1);
        return new ReviewSummaryDto(average, total, breakdown);
    }
}
