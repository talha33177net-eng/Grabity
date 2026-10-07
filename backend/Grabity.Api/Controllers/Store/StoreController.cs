using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace Grabity.Api.Controllers.Store;

[ApiController]
[Route("api/store")]
public class StoreController(AppDbContext db, SettingsService settings, EmailSettingsService emailSettings, CatalogCache catalog, HomeService home, IMemoryCache cache)
    : ControllerBase
{
    /// <summary>Everything the storefront shell needs: settings, menu and footer links.</summary>
    [HttpGet("bootstrap")]
    public async Task<BootstrapDto> Bootstrap(CancellationToken ct)
    {
        if (cache.TryGetValue(CatalogCache.BootstrapKey, out BootstrapDto? cached) && cached is not null) return cached;

        var store = await settings.GetAsync(ct);
        var categories = (await catalog.GetCategoriesAsync(ct)).Where(c => c.IsActive).ToList();
        List<MenuCategoryDto> Build(int? parentId, int depth) => categories
            .Where(c => c.ParentId == parentId && c.ShowInMenu)
            .Select(c => new MenuCategoryDto(c.Id, c.Name, c.Slug, c.Icon, c.ImageUrl, depth < 2 ? Build(c.Id, depth + 1) : []))
            .ToList();

        var pages = await db.Pages.AsNoTracking()
            .Where(p => p.IsActive && p.FooterGroup != FooterGroup.None)
            .OrderBy(p => p.SortOrder).ThenBy(p => p.Title)
            .Select(p => new FooterLinkDto(p.Title, p.Slug, p.FooterGroup))
            .ToListAsync(ct);

        var dto = new BootstrapDto(store, Build(null, 0), pages, EmailSettingsService.IsReady(await emailSettings.GetAsync(ct)));
        cache.Set(CatalogCache.BootstrapKey, dto, TimeSpan.FromMinutes(10));
        return dto;
    }

    [HttpGet("home")]
    public Task<HomeDto> Home(CancellationToken ct) => home.GetAsync(ct);
}
