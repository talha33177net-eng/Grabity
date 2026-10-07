namespace Grabity.Api.Services;

/// <summary>A priced cart line plus the internal facts order placement needs.</summary>
public record PricedLine(QuoteLineDto Dto, int RequestedQuantity, bool TracksStock, decimal? CostPrice, string? Sku);

public record Quote(QuoteDto Dto, List<PricedLine> Lines, Coupon? Coupon, ShippingMethod? Shipping, PaymentMethod? Payment);

/// <summary>Prices a cart with current product data, coupon, delivery charge and payment fee.</summary>
public class PricingService(AppDbContext db, SettingsService settings)
{
    public async Task<Quote> QuoteAsync(QuoteRequest request, CancellationToken ct)
    {
        var store = await settings.GetAsync(ct);
        var requested = request.Items
            .Where(i => i.Quantity > 0)
            .GroupBy(i => i.VariantId)
            .Select(g => (VariantId: g.Key, Quantity: Math.Min(g.Sum(x => x.Quantity), 999)))
            .ToList();
        var ids = requested.Select(r => r.VariantId).ToList();

        var variants = await db.ProductVariants.AsNoTracking()
            .Where(v => ids.Contains(v.Id))
            .Select(v => new
            {
                v.Id,
                v.ProductId,
                v.Option1,
                v.Option2,
                v.Option3,
                v.Sku,
                v.Price,
                v.CompareAtPrice,
                v.CostPrice,
                v.StockQuantity,
                v.IsActive,
                v.ImageUrl,
                ProductName = v.Product.Name,
                ProductSlug = v.Product.Slug,
                ProductActive = v.Product.IsActive,
                v.Product.HidePrice,
                v.Product.TrackInventory,
                v.Product.IsPreOrder,
                ProductImage = v.Product.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.Url).FirstOrDefault(),
            })
            .ToDictionaryAsync(v => v.Id, ct);

        var lines = new List<PricedLine>();
        var issues = new List<string>();
        foreach (var (variantId, quantity) in requested)
        {
            if (!variants.TryGetValue(variantId, out var v))
            {
                issues.Add("An item in your cart is no longer available.");
                lines.Add(new PricedLine(new QuoteLineDto(variantId, 0, "Unavailable item", "", null, null, 0, null, 0, 0, 0, false,
                    "This item is no longer available."), quantity, false, null, null));
                continue;
            }

            var title = ProductVariant.BuildTitle(v.Option1, v.Option2, v.Option3);
            var tracks = v.TrackInventory && !v.IsPreOrder;
            string? message = null;
            var available = true;
            var finalQuantity = quantity;
            int? max = tracks ? Math.Max(0, v.StockQuantity) : null;

            if (!v.IsActive || !v.ProductActive)
            {
                available = false;
                message = "This item is no longer available.";
            }
            else if (v.HidePrice)
            {
                available = false;
                message = "Price on request. Please contact us to order.";
            }
            else if (tracks && v.StockQuantity <= 0)
            {
                available = false;
                message = "Out of stock.";
            }
            else if (tracks && quantity > v.StockQuantity)
            {
                finalQuantity = v.StockQuantity;
                message = $"Only {v.StockQuantity} left in stock.";
            }

            if (!available) issues.Add($"{v.ProductName}: {message}");
            else if (message is not null) issues.Add($"{v.ProductName}: {message}");

            var lineQuantity = available ? finalQuantity : quantity;
            var lineTotal = available ? v.Price * lineQuantity : 0;
            lines.Add(new PricedLine(
                new QuoteLineDto(v.Id, v.ProductId, v.ProductName, v.ProductSlug, title, v.ImageUrl ?? v.ProductImage,
                    v.Price, v.CompareAtPrice > v.Price ? v.CompareAtPrice : null, lineQuantity, lineTotal, max, available, message),
                quantity, tracks, v.CostPrice, v.Sku ?? null));
        }

        var subtotal = lines.Where(l => l.Dto.Available).Sum(l => l.Dto.LineTotal);

        // Coupon
        Coupon? coupon = null;
        string? couponMessage = null;
        decimal discount = 0;
        var couponFreeShipping = false;
        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            var result = await EvaluateCouponAsync(request.CouponCode, subtotal, request.Phone, store.General.CurrencySymbol, ct);
            coupon = result.Coupon;
            couponMessage = result.Message;
            discount = result.Discount;
            couponFreeShipping = result.FreeShipping;
        }

        // Delivery
        ShippingMethod? shipping = null;
        if (request.ShippingMethodId is int shippingId)
            shipping = await db.ShippingMethods.AsNoTracking().FirstOrDefaultAsync(s => s.Id == shippingId && s.IsActive, ct);
        var threshold = store.Checkout.FreeShippingThreshold;
        var thresholdMet = threshold > 0 && subtotal >= threshold;
        var shippingCost = shipping?.Cost ?? 0;
        var freeShippingApplied = shipping is not null && shippingCost > 0 &&
            (couponFreeShipping || (thresholdMet && shipping.FreeShippingEligible));
        if (freeShippingApplied) shippingCost = 0;

        // Payment fee
        PaymentMethod? payment = null;
        if (!string.IsNullOrWhiteSpace(request.PaymentMethodCode))
            payment = await db.PaymentMethods.AsNoTracking().FirstOrDefaultAsync(p => p.Code == request.PaymentMethodCode && p.IsActive, ct);
        var beforeFee = subtotal - discount + shippingCost;
        var fee = payment is { FeePercent: > 0 } ? Math.Ceiling(beforeFee * payment.FeePercent / 100m) : 0;

        var total = beforeFee + fee;
        var hasUnavailable = lines.Any(l => !l.Dto.Available);
        var belowMinimum = store.Checkout.MinimumOrderAmount > 0 && subtotal < store.Checkout.MinimumOrderAmount;
        if (belowMinimum) issues.Add($"Minimum order amount is {Money.Format(store.Checkout.MinimumOrderAmount, store.General.CurrencySymbol)}.");

        var dto = new QuoteDto(
            lines.Select(l => l.Dto).ToList(),
            lines.Where(l => l.Dto.Available).Sum(l => l.Dto.Quantity),
            subtotal,
            discount,
            shippingCost,
            fee,
            total,
            coupon?.Code ?? request.CouponCode?.Trim().ToUpperInvariant(),
            coupon is not null,
            couponMessage,
            threshold,
            threshold > 0 ? Math.Max(0, threshold - subtotal) : 0,
            freeShippingApplied,
            lines.Count > 0 && !hasUnavailable && !belowMinimum,
            issues.Distinct().ToList());

        return new Quote(dto, lines, coupon, shipping, payment);
    }

    private async Task<(Coupon? Coupon, decimal Discount, bool FreeShipping, string Message)> EvaluateCouponAsync(
        string code, decimal subtotal, string? phone, string currency, CancellationToken ct)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var coupon = await db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Code == normalized, ct);
        var now = DateTime.UtcNow;

        string? error = coupon switch
        {
            null => "This coupon code is not valid.",
            { IsActive: false } => "This coupon is no longer active.",
            { StartsAt: { } starts } when starts > now => "This coupon is not active yet.",
            { ExpiresAt: { } expires } when expires < now => "This coupon has expired.",
            { UsageLimit: { } limit } when coupon.UsedCount >= limit => "This coupon has reached its usage limit.",
            { MinOrderAmount: { } minimum } when subtotal < minimum => $"Add items worth {Money.Format(minimum - subtotal, currency)} more to use this coupon.",
            _ => null,
        };

        if (error is null && coupon!.UsageLimitPerCustomer is int perCustomer && Phone.NormalizeBd(phone) is { } normalizedPhone)
        {
            var used = await db.Orders.CountAsync(o => o.CouponCode == coupon.Code && o.Phone == normalizedPhone &&
                o.Status != OrderStatus.Cancelled, ct);
            if (used >= perCustomer) error = "You have already used this coupon.";
        }

        if (error is not null) return (null, 0, false, error);

        var discount = coupon!.Type switch
        {
            DiscountType.Percentage => subtotal * coupon.Value / 100m,
            DiscountType.FixedAmount => coupon.Value,
            _ => 0m,
        };
        if (coupon.MaxDiscountAmount is decimal cap && discount > cap) discount = cap;
        discount = Math.Min(Math.Round(discount, 0, MidpointRounding.AwayFromZero), subtotal);

        var message = coupon.Type == DiscountType.FreeShipping ? "Free delivery applied." : $"Coupon applied. You saved {Money.Format(discount, currency)}.";
        return (coupon, discount, coupon.Type == DiscountType.FreeShipping, message);
    }
}
