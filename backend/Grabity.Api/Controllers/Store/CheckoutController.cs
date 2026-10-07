using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Grabity.Api.Controllers.Store;

[ApiController]
[Route("api/checkout")]
public class CheckoutController(AppDbContext db, SettingsService settings, PricingService pricing, OrderService orders, EmailNotifier emails) : ControllerBase
{
    [HttpGet("options")]
    public async Task<CheckoutOptionsDto> Options(CancellationToken ct)
    {
        var store = await settings.GetAsync(ct);
        var shipping = await db.ShippingMethods.AsNoTracking().Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Id)
            .Select(s => new ShippingMethodDto(s.Id, s.Name, s.Description, s.Cost, s.EstimatedDelivery, s.IsPickup, s.FreeShippingEligible))
            .ToListAsync(ct);
        var payments = await db.PaymentMethods.AsNoTracking().Where(p => p.IsActive)
            .OrderBy(p => p.SortOrder).ThenBy(p => p.Id)
            .Select(p => new PaymentMethodDto(p.Id, p.Code, p.Name, p.Type, p.Instructions, p.AccountNumber, p.FeePercent, p.RequiresTransactionId, p.LogoUrl))
            .ToListAsync(ct);
        return new CheckoutOptionsDto(shipping, payments, store.Checkout.FreeShippingThreshold, store.Checkout.MinimumOrderAmount,
            store.Checkout.AllowGuestCheckout);
    }

    /// <summary>Prices a cart. Used by the cart drawer and the checkout summary.</summary>
    [HttpPost("quote")]
    public async Task<QuoteDto> Quote(QuoteRequest request, CancellationToken ct) => (await pricing.QuoteAsync(request, ct)).Dto;

    [EnableRateLimiting("orders")]
    [HttpPost("orders")]
    public async Task<PlaceOrderResponse> PlaceOrder(PlaceOrderRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        var order = await orders.PlaceAsync(request, userId, OrderSource.Website, request.CustomerName,
            HttpContext.Connection.RemoteIpAddress?.ToString(), Request.Headers.UserAgent.ToString(), ct);
        await emails.OrderPlacedAsync(order);

        var payment = await db.PaymentMethods.AsNoTracking().FirstAsync(p => p.Code == order.PaymentMethodCode, ct);
        var store = await settings.GetAsync(ct);
        return new PlaceOrderResponse(order.OrderNumber, order.Total, order.PaymentMethodName, payment.Type, payment.Instructions, order.TransactionId,
            store.Checkout.OrderSuccessMessage);
    }

    [EnableRateLimiting("orders")]
    [HttpPost("track")]
    public async Task<OrderDetailDto> Track(TrackOrderRequest request, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking()
            .Include(o => o.Items).Include(o => o.StatusHistory)
            .AsSplitQuery()
            .FirstOrDefaultAsync(o => o.OrderNumber == request.OrderNumber, ct);

        var contact = request.Contact.Trim();
        var matches = order is not null &&
            (Phone.NormalizeBd(contact) is { } phone ? order.Phone == phone
                : order.Email is not null && order.Email.Equals(contact, StringComparison.OrdinalIgnoreCase));
        if (!matches) throw new AppException("We couldn't find an order with those details.", StatusCodes.Status404NotFound);

        return OrderService.ToDetailDto(order!);
    }
}
