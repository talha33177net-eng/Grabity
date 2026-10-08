using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Grabity.Api.Controllers.Admin;

[Route("api/admin/settings")]
public class AdminSettingsController(SettingsService settings, CatalogCache catalog) : AdminControllerBase
{
    [HttpGet]
    public Task<StoreSettings> Get(CancellationToken ct) => settings.GetAsync(ct);

    [Authorize(Roles = Roles.Admin)]
    [HttpPut]
    public async Task<StoreSettings> Update(StoreSettings request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.General.StoreName)) throw new AppException("Store name is required.");
        if (!System.Text.RegularExpressions.Regex.IsMatch(request.General.PrimaryColor ?? "", "^#[0-9a-fA-F]{6}$"))
            throw new AppException("Primary color must be a hex color like #6d28d9.");
        // Same ranges as the logo size sliders in SettingsPages.tsx.
        request.General.LogoHeight = Math.Clamp(request.General.LogoHeight, 24, 96);
        request.General.LogoHeightMobile = Math.Clamp(request.General.LogoHeightMobile, 20, 64);
        request.Features = request.Features.Where(f => !string.IsNullOrWhiteSpace(f.Title)).Take(8).ToList();
        request.Checkout.FreeShippingThreshold = Math.Max(0, request.Checkout.FreeShippingThreshold);
        request.Checkout.MinimumOrderAmount = Math.Max(0, request.Checkout.MinimumOrderAmount);
        request.Checkout.LowStockThreshold = Math.Max(0, request.Checkout.LowStockThreshold);
        if (request.Contact.WhatsAppNumber is { } wa)
            request.Contact.WhatsAppNumber = new string(wa.Where(char.IsDigit).ToArray()).NullIfBlank();

        await settings.SaveAsync(request, ct);
        catalog.InvalidateStorefront();
        return await settings.GetAsync(ct);
    }
}

[Route("api/admin/shipping-methods")]
public class AdminShippingMethodsController(AppDbContext db) : AdminControllerBase
{
    [HttpGet]
    public async Task<List<AdminShippingMethodDto>> List(CancellationToken ct) =>
        await db.ShippingMethods.AsNoTracking().OrderBy(s => s.SortOrder).ThenBy(s => s.Id)
            .Select(s => new AdminShippingMethodDto(s.Id, s.Name, s.Description, s.Cost, s.EstimatedDelivery, s.IsPickup, s.FreeShippingEligible, s.SortOrder, s.IsActive))
            .ToListAsync(ct);

    [HttpPost]
    public async Task<AdminShippingMethodDto> Create(ShippingMethodUpsertRequest request, CancellationToken ct)
    {
        var method = new ShippingMethod();
        db.ShippingMethods.Add(method);
        return await SaveAsync(method, request, ct);
    }

    [HttpPut("{id:int}")]
    public async Task<AdminShippingMethodDto> Update(int id, ShippingMethodUpsertRequest request, CancellationToken ct)
    {
        var method = await db.ShippingMethods.FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw AppException.NotFound("Delivery option");
        return await SaveAsync(method, request, ct);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (await db.ShippingMethods.Where(s => s.Id == id).ExecuteDeleteAsync(ct) == 0) throw AppException.NotFound("Delivery option");
        return NoContent();
    }

    private async Task<AdminShippingMethodDto> SaveAsync(ShippingMethod m, ShippingMethodUpsertRequest r, CancellationToken ct)
    {
        m.Name = r.Name.Trim();
        m.Description = r.Description.NullIfBlank();
        m.Cost = r.Cost;
        m.EstimatedDelivery = r.EstimatedDelivery.NullIfBlank();
        m.IsPickup = r.IsPickup;
        m.FreeShippingEligible = r.FreeShippingEligible;
        m.SortOrder = r.SortOrder;
        m.IsActive = r.IsActive;
        await db.SaveChangesAsync(ct);
        return new AdminShippingMethodDto(m.Id, m.Name, m.Description, m.Cost, m.EstimatedDelivery, m.IsPickup, m.FreeShippingEligible, m.SortOrder, m.IsActive);
    }
}

[Route("api/admin/payment-methods")]
public class AdminPaymentMethodsController(AppDbContext db) : AdminControllerBase
{
    [HttpGet]
    public async Task<List<AdminPaymentMethodDto>> List(CancellationToken ct) =>
        await db.PaymentMethods.AsNoTracking().OrderBy(p => p.SortOrder).ThenBy(p => p.Id)
            .Select(p => new AdminPaymentMethodDto(p.Id, p.Code, p.Name, p.Type, p.Instructions, p.AccountNumber, p.FeePercent,
                p.RequiresTransactionId, p.LogoUrl, p.SortOrder, p.IsActive))
            .ToListAsync(ct);

    [HttpPost]
    public async Task<AdminPaymentMethodDto> Create(PaymentMethodUpsertRequest request, CancellationToken ct)
    {
        var method = new PaymentMethod();
        db.PaymentMethods.Add(method);
        return await SaveAsync(method, request, ct);
    }

    [HttpPut("{id:int}")]
    public async Task<AdminPaymentMethodDto> Update(int id, PaymentMethodUpsertRequest request, CancellationToken ct)
    {
        var method = await db.PaymentMethods.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.NotFound("Payment method");
        return await SaveAsync(method, request, ct);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (await db.PaymentMethods.Where(p => p.Id == id).ExecuteDeleteAsync(ct) == 0) throw AppException.NotFound("Payment method");
        return NoContent();
    }

    private async Task<AdminPaymentMethodDto> SaveAsync(PaymentMethod m, PaymentMethodUpsertRequest r, CancellationToken ct)
    {
        var code = r.Code.Trim().ToLowerInvariant();
        if (await db.PaymentMethods.AnyAsync(p => p.Code == code && p.Id != m.Id, ct))
            throw AppException.Conflict("Another payment method already uses this code.");
        m.Code = code;
        m.Name = r.Name.Trim();
        m.Type = r.Type;
        m.Instructions = r.Instructions.NullIfBlank();
        m.AccountNumber = r.AccountNumber.NullIfBlank();
        m.FeePercent = r.FeePercent;
        m.RequiresTransactionId = r.RequiresTransactionId;
        m.LogoUrl = r.LogoUrl.NullIfBlank();
        m.SortOrder = r.SortOrder;
        m.IsActive = r.IsActive;
        await db.SaveChangesAsync(ct);
        return new AdminPaymentMethodDto(m.Id, m.Code, m.Name, m.Type, m.Instructions, m.AccountNumber, m.FeePercent, m.RequiresTransactionId,
            m.LogoUrl, m.SortOrder, m.IsActive);
    }
}

[Route("api/admin")]
public class AdminDashboardController(AppDbContext db, SettingsService settings) : AdminControllerBase
{
    private static readonly OrderStatus[] NotCounted = [OrderStatus.Cancelled, OrderStatus.Returned];

    [HttpGet("dashboard")]
    public async Task<DashboardDto> Dashboard(CancellationToken ct)
    {
        var today = StoreClock.LocalToday;
        var todayStart = StoreClock.StartOfLocalDayUtc(today);
        var monthStart = StoreClock.StartOfLocalDayUtc(new DateTime(today.Year, today.Month, 1));
        var lastMonthStart = StoreClock.StartOfLocalDayUtc(new DateTime(today.Year, today.Month, 1).AddMonths(-1));
        var windowStart = StoreClock.StartOfLocalDayUtc(today.AddDays(-29));
        var lowThreshold = (await settings.GetAsync(ct)).Checkout.LowStockThreshold;

        var counted = db.Orders.AsNoTracking().Where(o => !NotCounted.Contains(o.Status));
        var recentOrders = await counted.Where(o => o.CreatedAt >= windowStart)
            .Select(o => new { o.CreatedAt, o.Total }).ToListAsync(ct);
        var lastMonthRevenue = await counted.Where(o => o.CreatedAt >= lastMonthStart && o.CreatedAt < monthStart)
            .SumAsync(o => (decimal?)o.Total, ct) ?? 0;
        var monthOrders = await counted.Where(o => o.CreatedAt >= monthStart).Select(o => o.Total).ToListAsync(ct);

        var sales = Enumerable.Range(0, 30).Select(i => DateOnly.FromDateTime(today.AddDays(-29 + i)))
            .Select(day => new DailySalesPointDto(day,
                recentOrders.Count(o => DateOnly.FromDateTime(StoreClock.ToLocal(o.CreatedAt)) == day),
                recentOrders.Where(o => DateOnly.FromDateTime(StoreClock.ToLocal(o.CreatedAt)) == day).Sum(o => o.Total)))
            .ToList();
        var todayPoint = sales[^1];

        var statusRows = await db.Orders.AsNoTracking().Where(o => o.CreatedAt >= windowStart)
            .GroupBy(o => o.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);

        var trackedVariants = db.ProductVariants.AsNoTracking()
            .Where(v => v.IsActive && v.Product.IsActive && v.Product.TrackInventory && !v.Product.IsPreOrder);

        var customerRoleId = await db.Roles.Where(r => r.Name == Roles.Customer).Select(r => r.Id).FirstAsync(ct);
        var customers = db.Users.AsNoTracking().Where(u => db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == customerRoleId));

        return new DashboardDto(
            todayPoint.Revenue,
            todayPoint.Orders,
            monthOrders.Sum(),
            monthOrders.Count,
            lastMonthRevenue,
            await db.Orders.CountAsync(o => o.Status == OrderStatus.Pending, ct),
            await customers.CountAsync(ct),
            await customers.CountAsync(u => u.CreatedAt >= monthStart, ct),
            await db.Products.CountAsync(p => p.IsActive, ct),
            await trackedVariants.CountAsync(v => v.StockQuantity > 0 && v.StockQuantity <= lowThreshold, ct),
            await trackedVariants.CountAsync(v => v.StockQuantity <= 0, ct),
            await db.ProductReviews.CountAsync(r => !r.IsApproved, ct),
            sales,
            Enum.GetValues<OrderStatus>().ToDictionary(s => s.ToString(), s => statusRows.FirstOrDefault(r => r.Key == s)?.Count ?? 0),
            await AdminOrdersController.ProjectList(db.Orders.AsNoTracking().OrderByDescending(o => o.CreatedAt)).Take(8).ToListAsync(ct),
            await TopProductsAsync(windowStart, null, 6, ct),
            await trackedVariants.Where(v => v.StockQuantity <= lowThreshold)
                .OrderBy(v => v.StockQuantity).ThenBy(v => v.Product.Name).Take(10)
                .Select(v => new LowStockItemDto(v.ProductId, v.Id, v.Product.Name,
                    (v.Option1 ?? "") + (v.Option2 != null ? " / " + v.Option2 : "") + (v.Option3 != null ? " / " + v.Option3 : ""),
                    v.StockQuantity, v.Product.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault()))
                .ToListAsync(ct));
    }

    [HttpGet("dashboard/counts")]
    public async Task<AdminCountsDto> Counts(CancellationToken ct) => new(
        await db.Orders.CountAsync(o => o.Status == OrderStatus.Pending, ct),
        await db.ProductReviews.CountAsync(r => !r.IsApproved, ct));

    [HttpGet("reports/sales")]
    public async Task<SalesReportDto> Sales([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
    {
        var toDate = to ?? DateOnly.FromDateTime(StoreClock.LocalToday);
        var fromDate = from ?? toDate.AddDays(-29);
        if (fromDate > toDate) (fromDate, toDate) = (toDate, fromDate);
        if (toDate.DayNumber - fromDate.DayNumber > 366) throw new AppException("Please choose a range of one year or less.");

        var start = StoreClock.StartOfLocalDayUtc(fromDate.ToDateTime(TimeOnly.MinValue));
        var end = StoreClock.StartOfLocalDayUtc(toDate.AddDays(1).ToDateTime(TimeOnly.MinValue));
        var inRange = db.Orders.AsNoTracking().Where(o => o.CreatedAt >= start && o.CreatedAt < end);
        var counted = inRange.Where(o => !NotCounted.Contains(o.Status));

        var orders = await counted.Select(o => new { o.CreatedAt, o.Total, o.DiscountAmount, o.ShippingCost, o.PaymentMethodName, o.Source }).ToListAsync(ct);
        var items = await db.OrderItems.AsNoTracking()
            .Where(i => counted.Any(o => o.Id == i.OrderId))
            .Select(i => new
            {
                i.ProductId,
                i.Quantity,
                i.LineTotal,
                i.UnitPrice,
                i.CostPrice,
                Category = db.Products.Where(p => p.Id == i.ProductId).Select(p => p.Category.Name).FirstOrDefault(),
            })
            .ToListAsync(ct);

        var withCost = items.Where(i => i.CostPrice is not null).ToList();
        decimal? profit = withCost.Count == 0 ? null : withCost.Sum(i => (i.UnitPrice - i.CostPrice!.Value) * i.Quantity);
        var revenue = orders.Sum(o => o.Total);

        var daily = Enumerable.Range(0, toDate.DayNumber - fromDate.DayNumber + 1)
            .Select(offset => fromDate.AddDays(offset))
            .Select(day =>
            {
                var dayOrders = orders.Where(o => DateOnly.FromDateTime(StoreClock.ToLocal(o.CreatedAt)) == day).ToList();
                return new DailySalesPointDto(day, dayOrders.Count, dayOrders.Sum(o => o.Total));
            })
            .ToList();

        return new SalesReportDto(
            fromDate,
            toDate,
            orders.Count,
            revenue,
            orders.Count == 0 ? 0 : Math.Round(revenue / orders.Count, 0),
            orders.Sum(o => o.DiscountAmount),
            orders.Sum(o => o.ShippingCost),
            profit,
            items.Sum(i => i.Quantity),
            await inRange.CountAsync(o => o.Status == OrderStatus.Cancelled, ct),
            daily,
            await TopProductsAsync(start, end, 10, ct),
            orders.GroupBy(o => o.PaymentMethodName).Select(g => new NameValueDto(g.Key, g.Sum(o => o.Total), g.Count()))
                .OrderByDescending(x => x.Value).ToList(),
            orders.GroupBy(o => o.Source).Select(g => new NameValueDto(g.Key.ToString(), g.Sum(o => o.Total), g.Count()))
                .OrderByDescending(x => x.Value).ToList(),
            items.GroupBy(i => i.Category ?? "Deleted products").Select(g => new NameValueDto(g.Key, g.Sum(i => i.LineTotal), g.Sum(i => i.Quantity)))
                .OrderByDescending(x => x.Value).Take(12).ToList());
    }

    private async Task<List<TopProductDto>> TopProductsAsync(DateTime start, DateTime? end, int take, CancellationToken ct)
    {
        var orders = db.Orders.Where(o => o.CreatedAt >= start && (end == null || o.CreatedAt < end) && !NotCounted.Contains(o.Status));
        var rows = await db.OrderItems.AsNoTracking()
            .Where(i => orders.Any(o => o.Id == i.OrderId))
            .GroupBy(i => new { i.ProductId, i.ProductName })
            .Select(g => new { g.Key.ProductId, g.Key.ProductName, Quantity = g.Sum(i => i.Quantity), Revenue = g.Sum(i => i.LineTotal), Image = g.Max(i => i.ImageUrl) })
            .OrderByDescending(x => x.Revenue)
            .Take(take)
            .ToListAsync(ct);
        return rows.Select(r => new TopProductDto(r.ProductId, r.ProductName, r.Image, r.Quantity, r.Revenue)).ToList();
    }
}
