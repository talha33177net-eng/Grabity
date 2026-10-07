using Microsoft.AspNetCore.Mvc;

namespace Grabity.Api.Controllers.Admin;

[Route("api/admin/categories")]
public class AdminCategoriesController(AppDbContext db, CatalogCache catalog, HtmlCleaner html) : AdminControllerBase
{
    [HttpGet]
    public async Task<List<AdminCategoryDto>> List(CancellationToken ct) =>
        await db.Categories.AsNoTracking()
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new AdminCategoryDto(c.Id, c.Name, c.Slug, c.ParentId, c.Description, c.ImageUrl, c.BannerUrl, c.Icon, c.SortOrder,
                c.IsActive, c.ShowInMenu, c.IsFeatured, c.MetaTitle, c.MetaDescription, c.SeoContent,
                db.Products.Count(p => p.CategoryId == c.Id)))
            .ToListAsync(ct);

    [HttpGet("{id:int}")]
    public async Task<AdminCategoryDto> Get(int id, CancellationToken ct) =>
        (await List(ct)).FirstOrDefault(c => c.Id == id) ?? throw AppException.NotFound("Category");

    [HttpPost]
    public async Task<AdminCategoryDto> Create(CategoryUpsertRequest request, CancellationToken ct)
    {
        var category = new Category();
        db.Categories.Add(category);
        await ApplyAsync(category, request, ct);
        return await Get(category.Id, ct);
    }

    [HttpPut("{id:int}")]
    public async Task<AdminCategoryDto> Update(int id, CategoryUpsertRequest request, CancellationToken ct)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw AppException.NotFound("Category");
        await ApplyAsync(category, request, ct);
        return await Get(category.Id, ct);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw AppException.NotFound("Category");
        if (await db.Categories.AnyAsync(c => c.ParentId == id, ct))
            throw AppException.Conflict("Move or delete the subcategories first.");
        var productCount = await db.Products.CountAsync(p => p.CategoryId == id, ct);
        if (productCount > 0)
            throw AppException.Conflict($"{productCount} product(s) are in this category. Move them to another category first.");
        db.Categories.Remove(category);
        await db.SaveChangesAsync(ct);
        catalog.Invalidate();
        return NoContent();
    }

    [HttpPut("reorder")]
    public async Task<IActionResult> Reorder(ReorderRequest request, CancellationToken ct)
    {
        for (var i = 0; i < request.Ids.Count; i++)
        {
            var id = request.Ids[i];
            var order = i;
            await db.Categories.Where(c => c.Id == id).ExecuteUpdateAsync(s => s.SetProperty(c => c.SortOrder, order), ct);
        }
        catalog.Invalidate();
        return NoContent();
    }

    private async Task ApplyAsync(Category category, CategoryUpsertRequest r, CancellationToken ct)
    {
        if (r.ParentId is int parentId)
        {
            if (parentId == category.Id) throw new AppException("A category can't be its own parent.");
            if (!await db.Categories.AnyAsync(c => c.Id == parentId, ct)) throw new AppException("The parent category does not exist.");
            if (category.Id != 0)
            {
                var descendants = await catalog.GetSelfAndDescendantIdsAsync(category.Id, ct, includeInactive: true);
                if (descendants.Contains(parentId)) throw new AppException("A category can't be moved under one of its own subcategories.");
            }
        }

        var currentId = category.Id;
        category.Name = r.Name.Trim();
        category.Slug = await Slug.UniqueAsync(r.Slug, r.Name, s => db.Categories.AnyAsync(c => c.Slug == s && c.Id != currentId, ct));
        category.ParentId = r.ParentId;
        category.Description = r.Description.NullIfBlank();
        category.ImageUrl = r.ImageUrl.NullIfBlank();
        category.BannerUrl = r.BannerUrl.NullIfBlank();
        category.Icon = r.Icon.NullIfBlank();
        category.SortOrder = r.SortOrder;
        category.IsActive = r.IsActive;
        category.ShowInMenu = r.ShowInMenu;
        category.IsFeatured = r.IsFeatured;
        category.MetaTitle = r.MetaTitle.NullIfBlank();
        category.MetaDescription = r.MetaDescription.NullIfBlank();
        category.SeoContent = html.Clean(r.SeoContent);
        await db.SaveChangesAsync(ct);
        catalog.Invalidate();
    }
}

[Route("api/admin/brands")]
public class AdminBrandsController(AppDbContext db, CatalogCache catalog) : AdminControllerBase
{
    [HttpGet]
    public async Task<List<AdminBrandDto>> List(CancellationToken ct) =>
        await db.Brands.AsNoTracking()
            .OrderBy(b => b.SortOrder).ThenBy(b => b.Name)
            .Select(b => new AdminBrandDto(b.Id, b.Name, b.Slug, b.LogoUrl, b.Description, b.IsActive, b.IsFeatured, b.SortOrder,
                b.MetaTitle, b.MetaDescription, db.Products.Count(p => p.BrandId == b.Id)))
            .ToListAsync(ct);

    [HttpGet("{id:int}")]
    public async Task<AdminBrandDto> Get(int id, CancellationToken ct) =>
        (await List(ct)).FirstOrDefault(b => b.Id == id) ?? throw AppException.NotFound("Brand");

    [HttpPost]
    public async Task<AdminBrandDto> Create(BrandUpsertRequest request, CancellationToken ct)
    {
        var brand = new Brand();
        db.Brands.Add(brand);
        await ApplyAsync(brand, request, ct);
        return await Get(brand.Id, ct);
    }

    [HttpPut("{id:int}")]
    public async Task<AdminBrandDto> Update(int id, BrandUpsertRequest request, CancellationToken ct)
    {
        var brand = await db.Brands.FirstOrDefaultAsync(b => b.Id == id, ct) ?? throw AppException.NotFound("Brand");
        await ApplyAsync(brand, request, ct);
        return await Get(brand.Id, ct);
    }

    /// <summary>Products of a deleted brand are kept and simply lose their brand.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var deleted = await db.Brands.Where(b => b.Id == id).ExecuteDeleteAsync(ct);
        if (deleted == 0) throw AppException.NotFound("Brand");
        catalog.InvalidateStorefront();
        return NoContent();
    }

    private async Task ApplyAsync(Brand brand, BrandUpsertRequest r, CancellationToken ct)
    {
        var currentId = brand.Id;
        brand.Name = r.Name.Trim();
        brand.Slug = await Slug.UniqueAsync(r.Slug, r.Name, s => db.Brands.AnyAsync(b => b.Slug == s && b.Id != currentId, ct));
        brand.LogoUrl = r.LogoUrl.NullIfBlank();
        brand.Description = r.Description.NullIfBlank();
        brand.IsActive = r.IsActive;
        brand.IsFeatured = r.IsFeatured;
        brand.SortOrder = r.SortOrder;
        brand.MetaTitle = r.MetaTitle.NullIfBlank();
        brand.MetaDescription = r.MetaDescription.NullIfBlank();
        await db.SaveChangesAsync(ct);
        catalog.InvalidateStorefront();
    }
}
