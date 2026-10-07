using Grabity.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Grabity.Api.Services;

public record CategoryNode(
    int Id,
    int? ParentId,
    string Name,
    string Slug,
    string? ImageUrl,
    string? Icon,
    int SortOrder,
    bool IsActive,
    bool ShowInMenu,
    bool IsFeatured);

/// <summary>
/// In-memory snapshot of the category tree. Categories change rarely but are needed on almost
/// every request (menu, breadcrumbs, "include subcategories" filtering).
/// </summary>
public class CatalogCache(IServiceScopeFactory scopes, IMemoryCache cache)
{
    private const string CategoriesKey = "catalog:categories";
    public const string HomeKey = "catalog:home";
    public const string BootstrapKey = "catalog:bootstrap";

    public async Task<IReadOnlyList<CategoryNode>> GetCategoriesAsync(CancellationToken ct = default)
    {
        if (cache.TryGetValue(CategoriesKey, out IReadOnlyList<CategoryNode>? cached) && cached is not null) return cached;

        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var nodes = await db.Categories.AsNoTracking()
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new CategoryNode(c.Id, c.ParentId, c.Name, c.Slug, c.ImageUrl, c.Icon, c.SortOrder, c.IsActive, c.ShowInMenu, c.IsFeatured))
            .ToListAsync(ct);
        cache.Set(CategoriesKey, (IReadOnlyList<CategoryNode>)nodes, TimeSpan.FromMinutes(30));
        return nodes;
    }

    /// <summary>The category itself plus every descendant (only active ones unless <paramref name="includeInactive"/>).</summary>
    public async Task<List<int>> GetSelfAndDescendantIdsAsync(int categoryId, CancellationToken ct = default, bool includeInactive = false)
    {
        var all = await GetCategoriesAsync(ct);
        var byParent = all.Where(c => includeInactive || c.IsActive).ToLookup(c => c.ParentId);
        var result = new List<int> { categoryId };
        var queue = new Queue<int>([categoryId]);
        while (queue.Count > 0)
        {
            foreach (var child in byParent[queue.Dequeue()])
            {
                if (result.Contains(child.Id)) continue;
                result.Add(child.Id);
                queue.Enqueue(child.Id);
            }
        }
        return result;
    }

    /// <summary>Root-first chain of ancestors ending with the category itself.</summary>
    public async Task<List<CategoryNode>> GetPathAsync(int categoryId, CancellationToken ct = default)
    {
        var all = (await GetCategoriesAsync(ct)).ToDictionary(c => c.Id);
        var path = new List<CategoryNode>();
        var current = all.GetValueOrDefault(categoryId);
        while (current is not null && path.Count < 10)
        {
            path.Insert(0, current);
            current = current.ParentId is int parentId ? all.GetValueOrDefault(parentId) : null;
        }
        return path;
    }

    /// <summary>Call after any change that affects storefront catalog data.</summary>
    public void Invalidate()
    {
        cache.Remove(CategoriesKey);
        InvalidateStorefront();
    }

    /// <summary>Clears cached homepage and bootstrap payloads (products, banners, sections, settings, pages).</summary>
    public void InvalidateStorefront()
    {
        cache.Remove(HomeKey);
        cache.Remove(BootstrapKey);
    }
}
