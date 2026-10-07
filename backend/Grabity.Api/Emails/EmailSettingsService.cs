using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Caching.Memory;

namespace Grabity.Api.Emails;

/// <summary>Loads and saves <see cref="EmailSettings"/>. The SMTP password is encrypted at rest.</summary>
public class EmailSettingsService(AppDbContext db, IMemoryCache cache, IDataProtectionProvider protection, ILogger<EmailSettingsService> logger)
{
    public const string Key = "email";
    private const string CacheKey = "settings:email";
    // Enums as names, so adding an email type later doesn't shift the saved values.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private IDataProtector Protector => protection.CreateProtector("Grabity.Email.SmtpPassword");

    public async Task<EmailSettings> GetAsync(CancellationToken ct = default)
    {
        if (cache.TryGetValue(CacheKey, out EmailSettings? cached) && cached is not null) return cached;

        var row = await db.Settings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == Key, ct);
        var settings = row is null ? new EmailSettings() : JsonSerializer.Deserialize<EmailSettings>(row.Value, Json) ?? new EmailSettings();
        cache.Set(CacheKey, settings, TimeSpan.FromMinutes(30));
        return settings;
    }

    public async Task SaveAsync(EmailSettings settings, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(settings, Json);
        var row = await db.Settings.FirstOrDefaultAsync(s => s.Key == Key, ct);
        if (row is null)
            db.Settings.Add(new Setting { Key = Key, Value = json, UpdatedAt = DateTime.UtcNow });
        else
        {
            row.Value = json;
            row.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        cache.Remove(CacheKey);
    }

    /// <summary>Email is switched on and has enough settings to send.</summary>
    public static bool IsReady(EmailSettings s) =>
        s.Enabled && !string.IsNullOrWhiteSpace(s.Host) && s.Port > 0 && EmailAddresses.Normalize(s.FromAddress) is not null;

    /// <summary>Whether this type of email should go out. Password resets and tests can't be switched off.</summary>
    public static bool IsKindEnabled(EmailSettings s, EmailKind kind) =>
        kind is EmailKind.PasswordReset or EmailKind.Test || !s.DisabledKinds.Contains(kind);

    public string Protect(string password) => Protector.Protect(password);

    /// <summary>The saved SMTP password, or null when there is none or it can't be decrypted (e.g. App_Data/keys was lost).</summary>
    public string? UnprotectPassword(EmailSettings s)
    {
        if (string.IsNullOrEmpty(s.ProtectedPassword)) return null;
        try
        {
            return Protector.Unprotect(s.ProtectedPassword);
        }
        catch (CryptographicException ex)
        {
            logger.LogWarning(ex, "The saved SMTP password can't be decrypted; it needs to be entered again in Settings → Email.");
            return null;
        }
    }
}

public static class EmailAddresses
{
    // Reserved for documentation and testing (RFC 2606, RFC 6761); mail to them can never be delivered.
    private static readonly string[] PlaceholderDomains = ["example.com", "example.net", "example.org", "localhost"];
    private static readonly string[] PlaceholderSuffixes = [".example", ".test", ".invalid", ".localhost", ".local"];

    /// <summary>The trimmed address, or null when it isn't a plain, valid email address.</summary>
    public static string? Normalize(string? address)
    {
        if (string.IsNullOrWhiteSpace(address)) return null;
        var trimmed = address.Trim();
        if (!System.Net.Mail.MailAddress.TryCreate(trimmed, out var parsed) || parsed.Address != trimmed) return null;
        var domain = parsed.Host;
        return domain.Contains('.') || domain.Equals("localhost", StringComparison.OrdinalIgnoreCase) ? trimmed : null;
    }

    /// <summary>Why mail to this address can't be delivered, or null when it can.</summary>
    public static string? Problem(string? address)
    {
        if (Normalize(address) is not { } normalized) return "this isn't a valid email address.";
        var domain = normalized[(normalized.LastIndexOf('@') + 1)..].ToLowerInvariant();
        var placeholder = PlaceholderDomains.Any(d => domain == d || domain.EndsWith("." + d, StringComparison.Ordinal)) ||
            PlaceholderSuffixes.Any(s => domain.EndsWith(s, StringComparison.Ordinal));
        return placeholder ? $"{domain} is a placeholder domain that can't receive email." : null;
    }

    /// <summary>Splits a comma, semicolon or line separated list into distinct addresses. Invalid entries are returned separately.</summary>
    public static (List<string> Valid, List<string> Invalid) ParseList(string? value)
    {
        var valid = new List<string>();
        var invalid = new List<string>();
        foreach (var entry in (value ?? "").Split([',', ';', '\n', '\r', ' '], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (Normalize(entry) is { } address)
            {
                if (!valid.Contains(address, StringComparer.OrdinalIgnoreCase)) valid.Add(address);
            }
            else invalid.Add(entry);
        }
        return (valid, invalid);
    }
}
