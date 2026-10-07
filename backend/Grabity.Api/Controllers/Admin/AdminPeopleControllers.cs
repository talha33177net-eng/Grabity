using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Grabity.Api.Controllers.Admin;

[Route("api/admin/customers")]
public class AdminCustomersController(AppDbContext db, UserManager<AppUser> users, OrderService orders, EmailNotifier emails) : AdminControllerBase
{
    [HttpGet]
    public async Task<PagedResult<AdminCustomerListItemDto>> List([FromQuery] string? q, [FromQuery] string? status,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var customerRoleId = await db.Roles.Where(r => r.Name == Roles.Customer).Select(r => r.Id).FirstAsync(ct);
        var query = db.Users.AsNoTracking().Where(u => db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == customerRoleId));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(u => u.FullName.Contains(term) || (u.Email != null && u.Email.Contains(term)) ||
                (u.PhoneNumber != null && u.PhoneNumber.Contains(term)));
        }
        if (status == "active") query = query.Where(u => u.IsActive);
        else if (status == "blocked") query = query.Where(u => !u.IsActive);

        return await query.OrderByDescending(u => u.CreatedAt)
            .Select(u => new AdminCustomerListItemDto(u.Id, u.FullName, u.Email, u.PhoneNumber, u.IsActive, u.CreatedAt, u.LastLoginAt,
                db.Orders.Count(o => o.UserId == u.Id),
                db.Orders.Where(o => o.UserId == u.Id && o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.Returned)
                    .Sum(o => (decimal?)o.Total) ?? 0))
            .ToPagedAsync(page, pageSize, ct);
    }

    [HttpGet("{id:int}")]
    public async Task<AdminCustomerDto> Get(int id, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct) ?? throw AppException.NotFound("Customer");
        var userOrders = db.Orders.AsNoTracking().Where(o => o.UserId == id);
        var recent = await userOrders.OrderByDescending(o => o.CreatedAt).Take(20)
            .Select(o => new OrderSummaryDto(o.OrderNumber, o.CreatedAt, o.Status, o.PaymentStatus, o.Total, o.Items.Sum(i => i.Quantity),
                o.Items.OrderBy(i => i.Id).Select(i => i.ProductName).FirstOrDefault() ?? "",
                o.Items.OrderBy(i => i.Id).Select(i => i.ImageUrl).FirstOrDefault()))
            .ToListAsync(ct);
        var spent = await userOrders.Where(o => o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.Returned)
            .SumAsync(o => (decimal?)o.Total, ct) ?? 0;
        var phoneHistory = user.PhoneNumber is null ? null : await orders.GetPhoneStatsAsync(user.PhoneNumber, null, ct);

        return new AdminCustomerDto(user.Id, user.FullName, user.Email, user.PhoneNumber, user.Address, user.IsActive, user.CreatedAt,
            user.LastLoginAt, await userOrders.CountAsync(ct), spent, recent, phoneHistory);
    }

    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, SetActiveRequest request)
    {
        var user = await users.FindByIdAsync(id.ToString()) ?? throw AppException.NotFound("Customer");
        user.IsActive = request.IsActive;
        await users.UpdateAsync(user);
        // Invalidates existing sign-in cookies at the next security stamp check.
        await users.UpdateSecurityStampAsync(user);
        return NoContent();
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpPost("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, ResetPasswordRequest request)
    {
        var user = await users.FindByIdAsync(id.ToString()) ?? throw AppException.NotFound("Customer");
        var token = await users.GeneratePasswordResetTokenAsync(user);
        var result = await users.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded) throw new AppException(string.Join(" ", result.Errors.Select(e => e.Description)));
        await emails.PasswordChangedAsync(user, byStaff: true);
        return NoContent();
    }
}

[Route("api/admin/reviews")]
public class AdminReviewsController(AppDbContext db, CatalogCache catalog) : AdminControllerBase
{
    [HttpGet]
    public async Task<PagedResult<AdminReviewDto>> List([FromQuery] string? status, [FromQuery] string? q, [FromQuery] int? productId,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var query = db.ProductReviews.AsNoTracking();
        query = status switch
        {
            "pending" => query.Where(r => !r.IsApproved),
            "approved" => query.Where(r => r.IsApproved),
            "featured" => query.Where(r => r.IsFeatured),
            _ => query,
        };
        if (productId is int pid) query = query.Where(r => r.ProductId == pid);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(r => r.CustomerName.Contains(term) || r.Comment.Contains(term) || r.Product.Name.Contains(term));
        }
        return await query.OrderBy(r => r.IsApproved).ThenByDescending(r => r.CreatedAt)
            .Select(Projection)
            .ToPagedAsync(page, pageSize, ct);
    }

    [HttpPost]
    public async Task<AdminReviewDto> Create(AdminReviewCreateRequest request, CancellationToken ct)
    {
        if (!await db.Products.AnyAsync(p => p.Id == request.ProductId, ct)) throw AppException.NotFound("Product");
        var review = new ProductReview
        {
            ProductId = request.ProductId,
            CustomerName = request.CustomerName.Trim(),
            Rating = request.Rating,
            Title = request.Title.NullIfBlank(),
            Comment = request.Comment.Trim(),
            IsApproved = request.IsApproved,
            IsFeatured = request.IsFeatured,
            IsVerifiedPurchase = request.IsVerifiedPurchase,
            CreatedAt = request.CreatedAt?.ToUniversalTime() ?? DateTime.UtcNow,
        };
        db.ProductReviews.Add(review);
        await db.SaveChangesAsync(ct);
        await AfterChangeAsync(review.ProductId, ct);
        return await db.ProductReviews.AsNoTracking().Where(r => r.Id == review.Id).Select(Projection).FirstAsync(ct);
    }

    [HttpPut("{id:int}")]
    public async Task<AdminReviewDto> Update(int id, AdminReviewUpdateRequest request, CancellationToken ct)
    {
        var review = await db.ProductReviews.FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw AppException.NotFound("Review");
        review.IsApproved = request.IsApproved;
        review.IsFeatured = request.IsFeatured && request.IsApproved;
        review.AdminReply = request.AdminReply.NullIfBlank();
        await db.SaveChangesAsync(ct);
        await AfterChangeAsync(review.ProductId, ct);
        return await db.ProductReviews.AsNoTracking().Where(r => r.Id == id).Select(Projection).FirstAsync(ct);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var review = await db.ProductReviews.FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw AppException.NotFound("Review");
        db.ProductReviews.Remove(review);
        await db.SaveChangesAsync(ct);
        await AfterChangeAsync(review.ProductId, ct);
        return NoContent();
    }

    private async Task AfterChangeAsync(int productId, CancellationToken ct)
    {
        await ProductService.RecalculateRatingAsync(db, productId, ct);
        catalog.InvalidateStorefront();
    }

    private static readonly System.Linq.Expressions.Expression<Func<ProductReview, AdminReviewDto>> Projection = r =>
        new AdminReviewDto(r.Id, r.ProductId, r.Product.Name, r.Product.Slug,
            r.Product.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
            r.UserId, r.CustomerName, r.Rating, r.Title, r.Comment, r.IsApproved, r.IsFeatured, r.IsVerifiedPurchase, r.AdminReply, r.CreatedAt);
}

[Authorize(Roles = Roles.Admin)]
[Route("api/admin/staff")]
public class AdminStaffController(AppDbContext db, UserManager<AppUser> users, SignInManager<AppUser> signIn, EmailNotifier emails) : AdminControllerBase
{
    [HttpGet]
    public async Task<List<StaffDto>> List(CancellationToken ct)
    {
        var staffRoles = await db.Roles.Where(r => r.Name == Roles.Admin || r.Name == Roles.Manager)
            .Select(r => new { r.Id, r.Name }).ToListAsync(ct);
        var roleIds = staffRoles.Select(r => r.Id).ToList();
        var links = await db.UserRoles.Where(ur => roleIds.Contains(ur.RoleId)).ToListAsync(ct);
        var userIds = links.Select(l => l.UserId).Distinct().ToList();
        var staff = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).OrderBy(u => u.FullName).ToListAsync(ct);
        return staff.Select(u =>
        {
            var role = links.Where(l => l.UserId == u.Id).Select(l => staffRoles.First(r => r.Id == l.RoleId).Name)
                .OrderBy(n => n == Roles.Admin ? 0 : 1).First()!;
            return new StaffDto(u.Id, u.FullName, u.Email, u.PhoneNumber, role, u.IsActive, u.CreatedAt, u.LastLoginAt);
        }).ToList();
    }

    [HttpPost]
    public async Task<StaffDto> Create(StaffUpsertRequest request, CancellationToken ct)
    {
        ValidateRole(request.Role);
        if (string.IsNullOrWhiteSpace(request.Password)) throw new AppException("Please set a password for the new staff member.");
        var email = request.Email.Trim().ToLowerInvariant();
        var phone = Phone.NormalizeBd(request.Phone);
        await EnsureUniqueAsync(null, email, phone, ct);

        var user = new AppUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            PhoneNumber = phone,
            FullName = request.FullName.Trim(),
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow,
        };
        var result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded) throw new AppException(string.Join(" ", result.Errors.Select(e => e.Description)));
        await users.AddToRoleAsync(user, request.Role);
        if (user.IsActive) await emails.StaffWelcomeAsync(user, request.Role, Actor);
        return (await List(ct)).First(s => s.Id == user.Id);
    }

    [HttpPut("{id:int}")]
    public async Task<StaffDto> Update(int id, StaffUpsertRequest request, CancellationToken ct)
    {
        ValidateRole(request.Role);
        var user = await users.FindByIdAsync(id.ToString()) ?? throw AppException.NotFound("Staff member");
        var currentUserId = User.RequireUserId();
        if (id == currentUserId && (!request.IsActive || request.Role != Roles.Admin))
            throw new AppException("You can't remove your own admin access or deactivate yourself.");

        var email = request.Email.Trim().ToLowerInvariant();
        var phone = Phone.NormalizeBd(request.Phone);
        await EnsureUniqueAsync(id, email, phone, ct);

        user.FullName = request.FullName.Trim();
        user.Email = email;
        user.UserName = email;
        user.PhoneNumber = phone;
        user.IsActive = request.IsActive;
        var result = await users.UpdateAsync(user);
        if (!result.Succeeded) throw new AppException(string.Join(" ", result.Errors.Select(e => e.Description)));

        var roles = await users.GetRolesAsync(user);
        var staffRoles = roles.Where(r => r is Roles.Admin or Roles.Manager).ToList();
        if (staffRoles.Count != 1 || staffRoles[0] != request.Role)
        {
            await users.RemoveFromRolesAsync(user, staffRoles);
            await users.AddToRoleAsync(user, request.Role);
        }
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            var token = await users.GeneratePasswordResetTokenAsync(user);
            var reset = await users.ResetPasswordAsync(user, token, request.Password);
            if (!reset.Succeeded) throw new AppException(string.Join(" ", reset.Errors.Select(e => e.Description)));
            await emails.PasswordChangedAsync(user, byStaff: id != currentUserId);
        }
        // Forces other sessions of this user to sign in again with the new role/password,
        // while keeping the current admin's own session valid.
        if (id != currentUserId) await users.UpdateSecurityStampAsync(user);
        else await signIn.RefreshSignInAsync(user);
        return (await List(ct)).First(s => s.Id == user.Id);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id == User.RequireUserId()) throw new AppException("You can't delete your own account.");
        var user = await users.FindByIdAsync(id.ToString()) ?? throw AppException.NotFound("Staff member");
        var result = await users.DeleteAsync(user);
        if (!result.Succeeded) throw new AppException(string.Join(" ", result.Errors.Select(e => e.Description)));
        return NoContent();
    }

    private static void ValidateRole(string role)
    {
        if (role is not (Roles.Admin or Roles.Manager)) throw new AppException("Role must be Admin or Manager.");
    }

    private async Task EnsureUniqueAsync(int? id, string email, string? phone, CancellationToken ct)
    {
        var normalized = users.NormalizeEmail(email);
        if (await db.Users.AnyAsync(u => u.NormalizedEmail == normalized && u.Id != id, ct))
            throw AppException.Conflict("Another account already uses this email.");
        if (phone is not null && await db.Users.AnyAsync(u => u.PhoneNumber == phone && u.Id != id, ct))
            throw AppException.Conflict("Another account already uses this phone number.");
    }
}
