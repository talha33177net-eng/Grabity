using System.Text.Json;
using Grabity.Api.Data;
using Grabity.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Grabity.Api.Services;

public class SettingsService(AppDbContext db, IMemoryCache cache)
{
    public const string StoreKey = "store";
    private const string CacheKey = "settings:store";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<StoreSettings> GetAsync(CancellationToken ct = default)
    {
        if (cache.TryGetValue(CacheKey, out StoreSettings? cached) && cached is not null) return cached;

        var row = await db.Settings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == StoreKey, ct);
        var settings = row is null ? new StoreSettings() : JsonSerializer.Deserialize<StoreSettings>(row.Value, Json) ?? new StoreSettings();
        cache.Set(CacheKey, settings, TimeSpan.FromMinutes(30));
        return settings;
    }

    public async Task SaveAsync(StoreSettings settings, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(settings, Json);
        var row = await db.Settings.FirstOrDefaultAsync(s => s.Key == StoreKey, ct);
        if (row is null)
            db.Settings.Add(new Setting { Key = StoreKey, Value = json, UpdatedAt = DateTime.UtcNow });
        else
        {
            row.Value = json;
            row.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        cache.Remove(CacheKey);
    }
}
