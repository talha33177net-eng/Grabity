using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace Grabity.Api.Infrastructure;

public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public static class PagingExtensions
{
    public static async Task<PagedResult<T>> ToPagedAsync<T>(this IQueryable<T> query, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new PagedResult<T>(items, page, pageSize, total);
    }
}

public static partial class Slug
{
    /// <summary>Turns "Galaxy S26 Ultra (5G)" into "galaxy-s26-ultra-5g".</summary>
    public static string Create(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "";
        var normalized = text.Trim().ToLowerInvariant().Replace("+", " plus ").Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(c is >= 'a' and <= 'z' or >= '0' and <= '9' ? c : '-');
        }
        var slug = DashRun().Replace(sb.ToString(), "-").Trim('-');
        return slug.Length > 120 ? slug[..120].TrimEnd('-') : slug;
    }

    /// <summary>Creates a slug and appends -2, -3... until <paramref name="exists"/> reports it free.</summary>
    public static async Task<string> UniqueAsync(string? requested, string fallbackSource, Func<string, Task<bool>> exists)
    {
        var baseSlug = Create(string.IsNullOrWhiteSpace(requested) ? fallbackSource : requested);
        if (baseSlug.Length == 0) baseSlug = "item-" + Guid.NewGuid().ToString("N")[..8];
        var candidate = baseSlug;
        for (var i = 2; await exists(candidate); i++) candidate = $"{baseSlug}-{i}";
        return candidate;
    }

    [GeneratedRegex("-{2,}")]
    private static partial Regex DashRun();
}

public static partial class Phone
{
    /// <summary>Normalizes Bangladeshi mobile numbers to the 11 digit local form (01XXXXXXXXX). Returns null if invalid.</summary>
    public static string? NormalizeBd(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var digits = new string(input.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("880")) digits = digits[2..];
        return BdMobile().IsMatch(digits) ? digits : null;
    }

    [GeneratedRegex(@"^01[3-9]\d{8}$")]
    private static partial Regex BdMobile();
}

public static class ClaimsPrincipalExtensions
{
    public static int? GetUserId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public static int RequireUserId(this ClaimsPrincipal user) =>
        user.GetUserId() ?? throw new AppException("Please sign in.", StatusCodes.Status401Unauthorized);
}

public static class StringExtensions
{
    public static string? NullIfBlank(this string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public static class Money
{
    /// <summary>Formats an amount like the storefront does ("৳12,500"), independent of the server culture.</summary>
    public static string Format(decimal amount, string currency = "") => currency + amount.ToString("#,0", CultureInfo.InvariantCulture);
}

public static class StoreClock
{
    private static readonly TimeZoneInfo Zone =
        TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Dhaka", out var tz) ? tz
        : TimeZoneInfo.TryFindSystemTimeZoneById("Bangladesh Standard Time", out tz) ? tz
        : TimeZoneInfo.CreateCustomTimeZone("BDT", TimeSpan.FromHours(6), "Bangladesh", "Bangladesh");

    public static DateTime ToLocal(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Zone);

    public static DateTime LocalToday => ToLocal(DateTime.UtcNow).Date;

    /// <summary>UTC instant at which the given store-local date starts.</summary>
    public static DateTime StartOfLocalDayUtc(DateTime localDate) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(localDate.Date, DateTimeKind.Unspecified), Zone);
}
