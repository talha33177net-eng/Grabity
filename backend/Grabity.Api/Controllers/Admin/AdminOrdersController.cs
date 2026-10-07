using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Grabity.Api.Controllers.Admin;

[Route("api/admin/orders")]
public class AdminOrdersController(AppDbContext db, OrderService orders, EmailNotifier emails) : AdminControllerBase
{
    [HttpGet]
    public async Task<AdminOrderListDto> List([FromQuery] AdminOrderQuery q, CancellationToken ct)
    {
        var scope = db.Orders.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = q.Q.Trim().TrimStart('#');
            var number = int.TryParse(term, out var n) ? n : -1;
            var phone = Phone.NormalizeBd(term);
            scope = scope.Where(o => o.OrderNumber == number || o.CustomerName.Contains(term) || o.Phone.Contains(phone ?? term) ||
                (o.Email != null && o.Email.Contains(term)) || (o.TransactionId != null && o.TransactionId == term));
        }
        if (q.From is DateOnly from)
        {
            var start = StoreClock.StartOfLocalDayUtc(from.ToDateTime(TimeOnly.MinValue));
            scope = scope.Where(o => o.CreatedAt >= start);
        }
        if (q.To is DateOnly to)
        {
            var end = StoreClock.StartOfLocalDayUtc(to.AddDays(1).ToDateTime(TimeOnly.MinValue));
            scope = scope.Where(o => o.CreatedAt < end);
        }
        if (q.PaymentStatus is PaymentStatus paymentStatus) scope = scope.Where(o => o.PaymentStatus == paymentStatus);
        if (q.Source is OrderSource source) scope = scope.Where(o => o.Source == source);

        // Counts ignore the status filter so the status tabs always show their totals.
        var counts = await scope.GroupBy(o => o.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var statusCounts = Enum.GetValues<OrderStatus>().ToDictionary(s => s.ToString(), s => counts.FirstOrDefault(c => c.Key == s)?.Count ?? 0);
        statusCounts["All"] = counts.Sum(c => c.Count);

        if (q.Status is OrderStatus status) scope = scope.Where(o => o.Status == status);

        var page = await scope.OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id)
            .Select(ListProjection)
            .ToPagedAsync(q.Page, q.PageSize, ct);
        return new AdminOrderListDto(page, statusCounts);
    }

    [HttpGet("{id:int}")]
    public async Task<AdminOrderDto> Get(int id, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.StatusHistory).AsSplitQuery()
            .FirstOrDefaultAsync(o => o.Id == id, ct) ?? throw AppException.NotFound("Order");
        var history = await orders.GetPhoneStatsAsync(order.Phone, order.Id, ct);
        return ToDto(order, history);
    }

    [HttpPut("{id:int}/status")]
    public async Task<AdminOrderDto> UpdateStatus(int id, UpdateOrderStatusRequest request, CancellationToken ct)
    {
        var previous = await db.Orders.AsNoTracking().Where(o => o.Id == id).Select(o => (OrderStatus?)o.Status).FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Order");
        var order = await orders.UpdateStatusAsync(id, request.Status, request.Note, Actor, ct);
        await emails.OrderStatusChangedAsync(order, previous, request.Note);
        return await Get(id, ct);
    }

    [HttpPut("{id:int}/payment")]
    public async Task<AdminOrderDto> UpdatePayment(int id, UpdateOrderPaymentRequest request, CancellationToken ct)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == id, ct) ?? throw AppException.NotFound("Order");
        var (previousStatus, previousPaid) = (order.PaymentStatus, order.PaidAmount);
        order.PaymentStatus = request.PaymentStatus;
        order.PaidAmount = request.PaidAmount ?? request.PaymentStatus switch
        {
            PaymentStatus.Paid => order.Total,
            PaymentStatus.Unpaid or PaymentStatus.Refunded => 0,
            _ => order.PaidAmount,
        };
        if (request.TransactionId is not null) order.TransactionId = request.TransactionId.NullIfBlank();
        db.OrderStatusHistory.Add(new OrderStatusHistory
        {
            OrderId = order.Id,
            Status = order.Status,
            Note = $"Payment marked {request.PaymentStatus}" + (order.PaidAmount > 0 ? $" ({Money.Format(order.PaidAmount)} received)" : ""),
            ChangedBy = Actor,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
        await emails.PaymentChangedAsync(order, previousStatus, previousPaid);
        return await Get(id, ct);
    }

    [HttpPut("{id:int}")]
    public async Task<AdminOrderDto> UpdateDetails(int id, UpdateOrderDetailsRequest request, CancellationToken ct)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == id, ct) ?? throw AppException.NotFound("Order");
        order.CustomerName = request.CustomerName.Trim();
        order.Phone = Phone.NormalizeBd(request.Phone) ?? throw new AppException("Please enter a valid mobile number.");
        order.Email = request.Email.NullIfBlank();
        order.Address = request.Address.Trim();
        order.AdminNote = request.AdminNote.NullIfBlank();
        order.CourierName = request.CourierName.NullIfBlank();
        order.TrackingCode = request.TrackingCode.NullIfBlank();
        await db.SaveChangesAsync(ct);
        return await Get(id, ct);
    }

    /// <summary>Records an order taken by phone, Facebook, WhatsApp or in store.</summary>
    [HttpPost]
    public async Task<AdminOrderDto> Create(AdminCreateOrderRequest request, CancellationToken ct)
    {
        var order = await orders.PlaceAsync(request, null, request.Source, Actor, null, null, ct);
        if (request.Confirm)
            await orders.UpdateStatusAsync(order.Id, OrderStatus.Confirmed, "Confirmed when the order was entered", Actor, ct);
        await emails.OrderPlacedAsync(order);
        return await Get(order.Id, ct);
    }

    /// <summary>Emails sent (or waiting) for this order, newest first.</summary>
    [HttpGet("{id:int}/emails")]
    public async Task<List<EmailMessageListItemDto>> Emails(int id, CancellationToken ct) =>
        await db.EmailMessages.AsNoTracking().Where(m => m.OrderId == id)
            .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Select(EmailProjection.ListItem)
            .ToListAsync(ct);

    [HttpPost("{id:int}/emails/{messageId:int}/resend")]
    public async Task<List<EmailMessageListItemDto>> ResendEmail(int id, int messageId, CancellationToken ct)
    {
        if (!await db.EmailMessages.AnyAsync(m => m.Id == messageId && m.OrderId == id, ct)) throw AppException.NotFound("Email");
        await emails.ResendAsync(messageId, ct);
        return await Emails(id, ct);
    }

    [HttpPost("{id:int}/emails/{messageId:int}/send-now")]
    public async Task<List<EmailMessageListItemDto>> SendEmailNow(int id, int messageId, CancellationToken ct)
    {
        if (!await db.EmailMessages.AnyAsync(m => m.Id == messageId && m.OrderId == id, ct)) throw AppException.NotFound("Email");
        await emails.SendNowAsync(messageId, ct);
        return await Emails(id, ct);
    }

    /// <summary>Removes a cancelled order permanently (e.g. test orders). Admins only.</summary>
    [Authorize(Roles = Roles.Admin)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id, ct) ?? throw AppException.NotFound("Order");
        if (order.Status != OrderStatus.Cancelled) throw new AppException("Only cancelled orders can be deleted. Cancel the order first.");
        await db.Orders.Where(o => o.Id == id).ExecuteDeleteAsync(ct);
        return NoContent();
    }

    private static readonly System.Linq.Expressions.Expression<Func<Order, AdminOrderListItemDto>> ListProjection = o =>
        new AdminOrderListItemDto(o.Id, o.OrderNumber, o.CreatedAt, o.CustomerName, o.Phone, o.Total, o.Status, o.PaymentStatus,
            o.PaymentMethodName, o.ShippingMethodName, o.Items.Sum(i => i.Quantity), o.Source);

    public static IQueryable<AdminOrderListItemDto> ProjectList(IQueryable<Order> query) => query.Select(ListProjection);

    private static AdminOrderDto ToDto(Order o, PhoneOrderStats history) => new(
        o.Id, o.OrderNumber, o.Status, o.PaymentStatus, o.Source, o.CreatedAt, o.UpdatedAt, o.UserId,
        o.CustomerName, o.Phone, o.Email, o.Address, o.ShippingMethodId, o.ShippingMethodName, o.ShippingCost,
        o.PaymentMethodCode, o.PaymentMethodName, o.PaymentFee, o.Subtotal, o.DiscountAmount, o.CouponCode, o.Total, o.PaidAmount,
        o.TransactionId, o.PaymentSenderNumber, o.CustomerNote, o.AdminNote, o.CourierName, o.TrackingCode, o.IpAddress,
        o.Items.OrderBy(i => i.Id).Select(i => new AdminOrderItemDto(i.Id, i.ProductId, i.VariantId, i.ProductName, i.ProductSlug,
            i.VariantTitle, i.Sku, i.ImageUrl, i.UnitPrice, i.CostPrice, i.Quantity, i.LineTotal)).ToList(),
        o.StatusHistory.OrderByDescending(h => h.CreatedAt).ThenByDescending(h => h.Id)
            .Select(h => new AdminOrderHistoryDto(h.Status, h.Note, h.ChangedBy, h.CreatedAt)).ToList(),
        history);
}
