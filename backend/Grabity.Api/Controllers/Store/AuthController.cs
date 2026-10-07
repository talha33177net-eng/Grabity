using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Grabity.Api.Controllers.Store;

[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<AppUser> users,
    SignInManager<AppUser> signIn,
    AppDbContext db,
    EmailSettingsService emailSettings,
    EmailNotifier emails) : ControllerBase
{
    [EnableRateLimiting("auth")]
    [HttpPost("register")]
    public async Task<UserDto> Register(RegisterRequest request, CancellationToken ct)
    {
        var phone = Phone.NormalizeBd(request.Phone) ?? throw new AppException("Please enter a valid mobile number, e.g. 01712345678.");
        var email = request.Email.NullIfBlank()?.ToLowerInvariant();
        await EnsureUniqueAsync(null, phone, email, ct);

        var user = new AppUser
        {
            UserName = phone,
            PhoneNumber = phone,
            Email = email,
            FullName = request.FullName.Trim(),
            Address = request.Address.NullIfBlank(),
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow,
        };
        var result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded) throw new AppException(string.Join(" ", result.Errors.Select(e => e.Description)));
        await users.AddToRoleAsync(user, Roles.Customer);
        await signIn.SignInAsync(user, isPersistent: true);
        await emails.WelcomeAsync(user);
        return await ToDtoAsync(user);
    }

    /// <summary>Emails a reset link. Always answers the same way, so it can't be used to find out who has an account.</summary>
    [EnableRateLimiting("forms")]
    [HttpPost("forgot-password")]
    public async Task<object> ForgotPassword(ForgotPasswordRequest request, CancellationToken ct)
    {
        if (!EmailSettingsService.IsReady(await emailSettings.GetAsync(ct)))
            throw new AppException("Password reset by email isn't available right now. Please contact us and we'll help you.");

        var normalized = users.NormalizeEmail(request.Email.Trim());
        var user = await db.Users.FirstOrDefaultAsync(u => u.NormalizedEmail == normalized, ct);
        if (user is { IsActive: true, Email: not null })
            await emails.PasswordResetAsync(user, await users.GeneratePasswordResetTokenAsync(user));

        return new { Message = "If an account uses this email, we've sent it a link to reset the password. Check your inbox and spam folder." };
    }

    [EnableRateLimiting("auth")]
    [HttpPost("reset-password")]
    public async Task<ResetPasswordResultDto> ResetPassword(ResetPasswordWithTokenRequest request, CancellationToken ct)
    {
        const string invalid = "This reset link is invalid or has expired. Please request a new one.";
        var normalized = users.NormalizeEmail(request.Email.Trim());
        var user = await db.Users.FirstOrDefaultAsync(u => u.NormalizedEmail == normalized, ct) ?? throw new AppException(invalid);
        string token;
        try
        {
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token));
        }
        catch (FormatException)
        {
            throw new AppException(invalid);
        }

        var result = await users.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded)
        {
            throw new AppException(result.Errors.Any(e => e.Code == nameof(IdentityErrorDescriber.InvalidToken))
                ? invalid
                : string.Join(" ", result.Errors.Select(e => e.Description)));
        }
        // A forgotten password often comes after a lockout from failed attempts.
        await users.SetLockoutEndDateAsync(user, null);
        await users.ResetAccessFailedCountAsync(user);
        await emails.PasswordChangedAsync(user, byStaff: false);

        var roles = await users.GetRolesAsync(user);
        return new ResetPasswordResultDto(roles.Any(r => r is Roles.Admin or Roles.Manager));
    }

    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    public async Task<UserDto> Login(LoginRequest request, CancellationToken ct)
    {
        var identifier = request.Identifier.Trim();
        AppUser? user;
        if (identifier.Contains('@'))
        {
            var normalized = users.NormalizeEmail(identifier);
            user = await db.Users.FirstOrDefaultAsync(u => u.NormalizedEmail == normalized, ct);
        }
        else
        {
            var phone = Phone.NormalizeBd(identifier);
            user = phone is null ? null : await db.Users.FirstOrDefaultAsync(u => u.PhoneNumber == phone, ct);
        }

        const string invalid = "The email/phone or password is incorrect.";
        if (user is null) throw new AppException(invalid, StatusCodes.Status401Unauthorized);
        if (!user.IsActive) throw new AppException("This account has been disabled. Please contact us.", StatusCodes.Status403Forbidden);

        var result = await signIn.PasswordSignInAsync(user, request.Password, request.RememberMe, lockoutOnFailure: true);
        if (result.IsLockedOut) throw new AppException("Too many failed attempts. Please try again in a few minutes.", StatusCodes.Status429TooManyRequests);
        if (!result.Succeeded) throw new AppException(invalid, StatusCodes.Status401Unauthorized);

        user.LastLoginAt = DateTime.UtcNow;
        await users.UpdateAsync(user);
        return await ToDtoAsync(user);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await signIn.SignOutAsync();
        return NoContent();
    }

    /// <summary>The signed-in user, or 204 when nobody is signed in.</summary>
    [HttpGet("me")]
    public async Task<ActionResult<UserDto?>> Me()
    {
        if (User.GetUserId() is not int id) return NoContent();
        var user = await users.FindByIdAsync(id.ToString());
        if (user is null || !user.IsActive)
        {
            await signIn.SignOutAsync();
            return NoContent();
        }
        return await ToDtoAsync(user);
    }

    private async Task EnsureUniqueAsync(int? userId, string phone, string? email, CancellationToken ct)
    {
        if (await db.Users.AnyAsync(u => u.PhoneNumber == phone && u.Id != userId, ct))
            throw AppException.Conflict("An account with this phone number already exists. Try signing in instead.");
        if (email is not null)
        {
            var normalized = users.NormalizeEmail(email);
            if (await db.Users.AnyAsync(u => u.NormalizedEmail == normalized && u.Id != userId, ct))
                throw AppException.Conflict("An account with this email already exists.");
        }
    }

    private async Task<UserDto> ToDtoAsync(AppUser user) =>
        new(user.Id, user.FullName, user.Email, user.PhoneNumber, user.Address, await users.GetRolesAsync(user));
}
