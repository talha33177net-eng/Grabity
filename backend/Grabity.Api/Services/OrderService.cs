namespace Grabity.Api.Services;

public record PhoneOrderStats(int TotalOrders, int Delivered, int Cancelled, int Returned, int Active, decimal DeliveredValue)
{
    /// <summary>Share of finished orders that were delivered, or null when there is no history yet.</summary>
    public decimal? SuccessRate => Delivered + Cancelled + Returned == 0
        ? null
        : Math.Round(Delivered * 100m / (Delivered + Cancelled + Returned), 1);
}

public class OrderService(AppDbContext db, PricingService pricing, SettingsService settings)
{
    public async Task<Order> PlaceAsync(
        PlaceOrderRequest request, int? userId, OrderSource source, string actor, string? ipAddress, string? userAgent, CancellationToken ct)
    {
        var store = await settings.GetAsync(ct);
        if (userId is null && source == OrderSource.Website && !store.Checkout.AllowGuestCheckout)
            throw new AppException("Please sign in to place your order.", StatusCodes.Status401Unauthorized);

        var phone = Phone.NormalizeBd(request.Phone)
            ?? throw new AppException("Please enter a valid mobile number, e.g. 01712345678.");
        var shipping = await db.ShippingMethods.AsNoTracking().FirstOrDefaultAsync(s => s.Id == request.ShippingMethodId && s.IsActive, ct)
            ?? throw new AppException("Please choose a delivery option.");
        if (!shipping.IsPickup && string.IsNullOrWhiteSpace(request.Address))
            throw new AppException("Please enter your full delivery address.");
        var payment = await db.PaymentMethods.AsNoTracking().FirstOrDefaultAsync(p => p.Code == request.PaymentMethodCode && p.IsActive, ct)
            ?? throw new AppException("Please choose a payment method.");
        if (payment.RequiresTransactionId && string.IsNullOrWhiteSpace(request.TransactionId))
            throw new AppException($"Please enter your {payment.Name} transaction ID.");

        var quote = await pricing.QuoteAsync(new QuoteRequest
        {
            Items = request.Items,
            CouponCode = request.CouponCode,
            ShippingMethodId = shipping.Id,
            PaymentMethodCode = payment.Code,
            Phone = phone,
        }, ct);

        if (quote.Lines.Count == 0) throw new AppException("Your cart is empty.");
        var problem = quote.Lines.FirstOrDefault(l => !l.Dto.Available || l.Dto.Quantity != l.RequestedQuantity);
        if (problem is not null)
            throw new AppException($"{problem.Dto.ProductName}: {problem.Dto.Message ?? "not available"}", StatusCodes.Status409Conflict);
        if (!string.IsNullOrWhiteSpace(request.CouponCode) && quote.Coupon is null)
            throw new AppException(quote.Dto.CouponMessage ?? "This coupon code is not valid.");
        if (!quote.Dto.CanCheckout)
            throw new AppException(quote.Dto.Issues.FirstOrDefault() ?? "Your order can't be placed right now.");

        var now = DateTime.UtcNow;
        var hasTransaction = !string.IsNullOrWhiteSpace(request.TransactionId);
        var order = new Order
        {
            UserId = userId,
            CustomerName = request.CustomerName.Trim(),
            Phone = phone,
            Email = request.Email.NullIfBlank(),
            Address = shipping.IsPickup && string.IsNullOrWhiteSpace(request.Address) ? "Store pickup" : request.Address!.Trim(),
            ShippingMethodId = shipping.Id,
            ShippingMethodName = shipping.Name,
            ShippingCost = quote.Dto.ShippingCost,
            PaymentMethodCode = payment.Code,
            PaymentMethodName = payment.Name,
            PaymentFee = quote.Dto.PaymentFee,
            Subtotal = quote.Dto.Subtotal,
            DiscountAmount = quote.Dto.Discount,
            CouponCode = quote.Coupon?.Code,
            Total = quote.Dto.Total,
            PaymentStatus = hasTransaction ? PaymentStatus.Verifying : PaymentStatus.Unpaid,
            TransactionId = request.TransactionId.NullIfBlank(),
            PaymentSenderNumber = Phone.NormalizeBd(request.PaymentSenderNumber) ?? request.PaymentSenderNumber.NullIfBlank(),
            Status = OrderStatus.Pending,
            CustomerNote = request.Note.NullIfBlank(),
            Source = source,
            IpAddress = ipAddress,
            UserAgent = userAgent is { Length: > 500 } ? userAgent[..500] : userAgent,
            StockDeducted = true,
            Items = quote.Lines.Select(l => new OrderItem
            {
                ProductId = l.Dto.ProductId,
                VariantId = l.Dto.VariantId,
                ProductName = l.Dto.ProductName,
                ProductSlug = l.Dto.ProductSlug,
                VariantTitle = l.Dto.VariantTitle,
                Sku = l.Sku,
                ImageUrl = l.Dto.ImageUrl,
                UnitPrice = l.Dto.UnitPrice,
                CostPrice = l.CostPrice,
                Quantity = l.Dto.Quantity,
                LineTotal = l.Dto.LineTotal,
                TracksStock = l.TracksStock,
            }).ToList(),
            StatusHistory = [new OrderStatusHistory { Status = OrderStatus.Pending, Note = "Order placed", ChangedBy = actor, CreatedAt = now }],
        };

        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await DeductStockAsync(order.Items, ct);

            if (order.CouponCode is { } couponCode)
            {
                var claimed = await db.Coupons
                    .Where(c => c.Code == couponCode && (c.UsageLimit == null || c.UsedCount < c.UsageLimit))
                    .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, c => c.UsedCount + 1), ct);
                if (claimed == 0) throw new AppException("This coupon has just reached its usage limit.", StatusCodes.Status409Conflict);
            }

            if (userId is int uid)
            {
                await db.Users.Where(u => u.Id == uid && (u.Address == null || u.Address == ""))
                    .ExecuteUpdateAsync(s => s.SetProperty(u => u.Address, order.Address), ct);
            }

            db.Orders.Add(order);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });

        return order;
    }

    public async Task<Order> UpdateStatusAsync(int orderId, OrderStatus newStatus, string? note, string actor, CancellationToken ct)
    {
        var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId, ct)
            ?? throw AppException.NotFound("Order");

        if (order.Status == newStatus && string.IsNullOrWhiteSpace(note)) return order;

        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);

            var closing = Order.IsClosedStatus(newStatus);
            if (closing && order.StockDeducted)
            {
                await RestockAsync(order.Items, ct);
                order.StockDeducted = false;
                if (order.CouponCode is { } code && newStatus == OrderStatus.Cancelled)
                {
                    await db.Coupons.Where(c => c.Code == code && c.UsedCount > 0)
                        .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, c => c.UsedCount - 1), ct);
                }
            }
            else if (!closing && !order.StockDeducted)
            {
                await DeductStockAsync(order.Items, ct);
                order.StockDeducted = true;
            }

            if (newStatus == OrderStatus.Delivered && order.PaymentStatus != PaymentStatus.Paid)
            {
                // Cash on delivery is collected by the courier on delivery.
                order.PaymentStatus = PaymentStatus.Paid;
                order.PaidAmount = order.Total;
            }

            if (order.Status != newStatus || !string.IsNullOrWhiteSpace(note))
            {
                db.OrderStatusHistory.Add(new OrderStatusHistory
                {
                    OrderId = order.Id,
                    Status = newStatus,
                    Note = note.NullIfBlank(),
                    ChangedBy = actor,
                    CreatedAt = DateTime.UtcNow,
                });
            }
            order.Status = newStatus;

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });

        return order;
    }

    public async Task<PhoneOrderStats> GetPhoneStatsAsync(string phone, int? excludeOrderId, CancellationToken ct)
    {
        var rows = await db.Orders.AsNoTracking()
            .Where(o => o.Phone == phone && o.Id != excludeOrderId)
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count(), Value = g.Sum(o => o.Total) })
            .ToListAsync(ct);

        int Count(OrderStatus s) => rows.FirstOrDefault(r => r.Status == s)?.Count ?? 0;
        return new PhoneOrderStats(
            rows.Sum(r => r.Count),
            Count(OrderStatus.Delivered),
            Count(OrderStatus.Cancelled),
            Count(OrderStatus.Returned),
            rows.Where(r => !Order.IsClosedStatus(r.Status) && r.Status != OrderStatus.Delivered).Sum(r => r.Count),
            rows.FirstOrDefault(r => r.Status == OrderStatus.Delivered)?.Value ?? 0);
    }

    public static OrderDetailDto ToDetailDto(Order o) => new(
        o.OrderNumber,
        o.Status,
        o.PaymentStatus,
        o.CreatedAt,
        o.CustomerName,
        o.Phone,
        o.Email,
        o.Address,
        o.ShippingMethodName,
        o.ShippingCost,
        o.PaymentMethodName,
        o.PaymentFee,
        o.Subtotal,
        o.DiscountAmount,
        o.CouponCode,
        o.Total,
        o.PaidAmount,
        o.TransactionId,
        o.CourierName,
        o.TrackingCode,
        o.CustomerNote,
        o.Items.Select(i => new OrderItemDto(i.ProductId, i.ProductName, i.ProductSlug, i.VariantTitle, i.Sku, i.ImageUrl, i.UnitPrice, i.Quantity, i.LineTotal)).ToList(),
        o.StatusHistory.OrderBy(h => h.CreatedAt).ThenBy(h => h.Id)
            .Select(h => new OrderHistoryDto(h.Status, h.Note, h.CreatedAt)).ToList());

    private async Task DeductStockAsync(IEnumerable<OrderItem> items, CancellationToken ct)
    {
        var lines = items.Where(i => i.VariantId is not null).ToList();
        foreach (var item in lines.Where(i => i.TracksStock))
        {
            var quantity = item.Quantity;
            var updated = await db.ProductVariants
                .Where(v => v.Id == item.VariantId && v.StockQuantity >= quantity)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.StockQuantity, v => v.StockQuantity - quantity), ct);
            if (updated == 0)
                throw new AppException($"Sorry, {item.ProductName} doesn't have enough stock.", StatusCodes.Status409Conflict);
        }
        await AdjustProductsAsync(lines, +1, ct);
    }

    private async Task RestockAsync(IEnumerable<OrderItem> items, CancellationToken ct)
    {
        var lines = items.Where(i => i.VariantId is not null).ToList();
        foreach (var item in lines.Where(i => i.TracksStock))
        {
            var quantity = item.Quantity;
            await db.ProductVariants.Where(v => v.Id == item.VariantId)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.StockQuantity, v => v.StockQuantity + quantity), ct);
        }
        await AdjustProductsAsync(lines, -1, ct);
    }

    /// <summary>Keeps the denormalized product stock and sold counters in line with variant changes.</summary>
    private async Task AdjustProductsAsync(List<OrderItem> lines, int direction, CancellationToken ct)
    {
        foreach (var group in lines.Where(l => l.ProductId is not null).GroupBy(l => l.ProductId!.Value))
        {
            var sold = group.Sum(l => l.Quantity) * direction;
            var productId = group.Key;
            await db.Products.Where(p => p.Id == productId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.SoldCount, p => p.SoldCount + sold < 0 ? 0 : p.SoldCount + sold)
                    .SetProperty(p => p.StockQuantity, p => p.Variants.Where(v => v.IsActive).Sum(v => v.StockQuantity)), ct);
        }
    }
}
