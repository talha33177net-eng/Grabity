using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Grabity.Api.Controllers.Admin;

[ApiController]
[Authorize(Roles = Roles.Staff)]
public abstract class AdminControllerBase : ControllerBase
{
    /// <summary>Display name of the signed-in staff member, used in order history.</summary>
    protected string Actor => User.FindFirstValue(AppClaimsFactory.FullNameClaim) ?? User.Identity?.Name ?? "Staff";
}

/// <summary>Adds the user's display name to the auth cookie so it doesn't need a lookup per request.</summary>
public class AppClaimsFactory(UserManager<AppUser> users, RoleManager<AppRole> roles, IOptions<IdentityOptions> options)
    : UserClaimsPrincipalFactory<AppUser, AppRole>(users, roles, options)
{
    public const string FullNameClaim = "full_name";

    protected override async Task<ClaimsIdentity> GenerateClaimsAsync(AppUser user)
    {
        var identity = await base.GenerateClaimsAsync(user);
        identity.AddClaim(new Claim(FullNameClaim, user.FullName));
        return identity;
    }
}

[Route("api/admin")]
public class AdminUtilityController(MediaStorage media, CatalogCache catalog, AppDbContext db) : AdminControllerBase
{
    [HttpPost("uploads")]
    [RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<UploadResultDto> Upload(IFormFile file, [FromQuery] string? folder, [FromQuery] bool trim, CancellationToken ct) =>
        new(await media.SaveImageAsync(file, folder, trim, ct));

    /// <summary>Options for category/brand pickers in admin forms.</summary>
    [HttpGet("lookups")]
    public async Task<AdminLookupsDto> Lookups(CancellationToken ct)
    {
        var categories = await catalog.GetCategoriesAsync(ct);
        var byId = categories.ToDictionary(c => c.Id);
        string PathOf(CategoryNode c)
        {
            var names = new List<string>();
            for (var current = c; current is not null && names.Count < 10;
                 current = current.ParentId is int pid ? byId.GetValueOrDefault(pid) : null)
                names.Insert(0, current.Name);
            return string.Join(" › ", names);
        }

        var brands = await db.Brands.AsNoTracking().OrderBy(b => b.Name).Select(b => new LookupDto(b.Id, b.Name)).ToListAsync(ct);
        return new AdminLookupsDto(
            categories.Select(c => new LookupCategoryDto(c.Id, c.Name, c.ParentId, PathOf(c), c.IsActive))
                .OrderBy(c => c.Path).ToList(),
            brands);
    }

    /// <summary>Clears cached storefront data, e.g. after editing the database directly.</summary>
    [HttpPost("cache/clear")]
    public IActionResult ClearCache()
    {
        catalog.Invalidate();
        return NoContent();
    }
}
