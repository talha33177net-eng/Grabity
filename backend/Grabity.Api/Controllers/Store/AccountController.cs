using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Grabity.Api.Controllers.Store;

[ApiController]
[Authorize]
[Route("api/account")]
public class AccountController(AppDbContext db, UserManager<AppUser> users, SignInManager<AppUser> signIn, EmailNotifier emails) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<AccountSummaryDto> Summary(CancellationToken ct)
    {
        var userId = User.RequireUserId();
        var orders = db.Orders.AsNoTracking().Where(o => o.UserId == userId);
        var spent = await orders.Where(o => o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.Returned)
            .SumAsync(o => (decimal?)o.Total, ct) ?? 0;
        var active = await orders.CountAsync(o => o.Status != OrderStatus.Delivered && o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.Returned, ct);
        return new AccountSummaryDto(await orders.CountAsync(ct), spent, active,
            await db.ProductReviews.CountAsync(r => r.UserId == userId, ct));
    }

    [HttpPut("profile")]
    public async Task<UserDto> UpdateProfile(UpdateProfileRequest request, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(User.RequireUserId().ToString()) ?? throw AppException.NotFound("Account");
        var phone = Phone.NormalizeBd(request.Phone) ?? throw new AppException("Please enter a valid mobile number, e.g. 01712345678.");
        var email = request.Email.NullIfBlank()?.ToLowerInvariant();

        if (await db.Users.AnyAsync(u => u.PhoneNumber == phone && u.Id != user.Id, ct))
            throw AppException.Conflict("Another account already uses this phone number.");
        var normalizedEmail = email is null ? null : users.NormalizeEmail(email);
        if (normalizedEmail is not null && await db.Users.AnyAsync(u => u.NormalizedEmail == normalizedEmail && u.Id != user.Id, ct))
            throw AppException.Conflict("Another account already uses this email.");

        user.FullName = request.FullName.Trim();
        user.Address = request.Address.NullIfBlank();
        user.PhoneNumber = phone;
        if (!await users.IsInRoleAsync(user, Roles.Admin) && !await users.IsInRoleAsync(user, Roles.Manager))
            user.UserName = phone;
        user.Email = email;
        var result = await users.UpdateAsync(user);
        if (!result.Succeeded) throw new AppException(string.Join(" ", result.Errors.Select(e => e.Description)));
        await signIn.RefreshSignInAsync(user);
        return new UserDto(user.Id, user.FullName, user.Email, user.PhoneNumber, user.Address, await users.GetRolesAsync(user));
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await users.FindByIdAsync(User.RequireUserId().ToString()) ?? throw AppException.NotFound("Account");
        var result = await users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            var message = result.Errors.Any(e => e.Code == nameof(IdentityErrorDescriber.PasswordMismatch))
                ? "Your current password is incorrect."
                : string.Join(" ", result.Errors.Select(e => e.Description));
            throw new AppException(message);
        }
        await signIn.RefreshSignInAsync(user);
        await emails.PasswordChangedAsync(user, byStaff: false);
        return NoContent();
    }

    [HttpGet("orders")]
    public async Task<PagedResult<OrderSummaryDto>> Orders([FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken ct = default)
    {
        var userId = User.RequireUserId();
        return await db.Orders.AsNoTracking()
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OrderSummaryDto(o.OrderNumber, o.CreatedAt, o.Status, o.PaymentStatus, o.Total,
                o.Items.Sum(i => i.Quantity),
                o.Items.OrderBy(i => i.Id).Select(i => i.ProductName).FirstOrDefault() ?? "",
                o.Items.OrderBy(i => i.Id).Select(i => i.ImageUrl).FirstOrDefault()))
            .ToPagedAsync(page, Math.Min(pageSize, 50), ct);
    }

    [HttpGet("orders/{orderNumber:int}")]
    public async Task<OrderDetailDto> Order(int orderNumber, CancellationToken ct)
    {
        var userId = User.RequireUserId();
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.StatusHistory).AsSplitQuery()
            .FirstOrDefaultAsync(o => o.OrderNumber == orderNumber && o.UserId == userId, ct) ?? throw AppException.NotFound("Order");
        return OrderService.ToDetailDto(order);
    }

    [HttpGet("reviews")]
    public async Task<List<MyReviewDto>> Reviews(CancellationToken ct)
    {
        var userId = User.RequireUserId();
        return await db.ProductReviews.AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new MyReviewDto(r.Id, r.ProductId, r.Product.Name, r.Product.Slug,
                r.Product.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                r.Rating, r.Title, r.Comment, r.IsApproved, r.AdminReply, r.CreatedAt))
            .ToListAsync(ct);
    }
}
