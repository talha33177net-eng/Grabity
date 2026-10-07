namespace Grabity.Api.Domain;

public enum OrderStatus
{
    Pending,
    Confirmed,
    Processing,
    Shipped,
    Delivered,
    Cancelled,
    Returned,
}

public enum PaymentStatus
{
    Unpaid,
    /// <summary>Customer submitted a mobile-banking transaction ID that staff still need to verify.</summary>
    Verifying,
    PartiallyPaid,
    Paid,
    Refunded,
}

public enum OrderSource
{
    Website,
    Phone,
    Facebook,
    WhatsApp,
    Instagram,
    Store,
    Other,
}

public class Order : ITimestamped
{
    public int Id { get; set; }
    /// <summary>Human friendly number from the OrderNumbers sequence, shown to customers.</summary>
    public int OrderNumber { get; set; }
    public int? UserId { get; set; }
    public AppUser? User { get; set; }

    public string CustomerName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? Email { get; set; }
    public string Address { get; set; } = "";

    public int? ShippingMethodId { get; set; }
    public string ShippingMethodName { get; set; } = "";
    public decimal ShippingCost { get; set; }

    public string PaymentMethodCode { get; set; } = "";
    public string PaymentMethodName { get; set; } = "";
    public decimal PaymentFee { get; set; }

    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public string? CouponCode { get; set; }
    public decimal Total { get; set; }

    public PaymentStatus PaymentStatus { get; set; }
    public decimal PaidAmount { get; set; }
    public string? TransactionId { get; set; }
    public string? PaymentSenderNumber { get; set; }

    public OrderStatus Status { get; set; }
    public string? CustomerNote { get; set; }
    public string? AdminNote { get; set; }
    public string? CourierName { get; set; }
    public string? TrackingCode { get; set; }

    public OrderSource Source { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    /// <summary>True while the ordered quantities are subtracted from stock.</summary>
    public bool StockDeducted { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<OrderItem> Items { get; set; } = [];
    public List<OrderStatusHistory> StatusHistory { get; set; } = [];

    public static bool IsClosedStatus(OrderStatus status) =>
        status is OrderStatus.Cancelled or OrderStatus.Returned;
}

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int? ProductId { get; set; }
    public int? VariantId { get; set; }
    public string ProductName { get; set; } = "";
    public string? ProductSlug { get; set; }
    public string? VariantTitle { get; set; }
    public string? Sku { get; set; }
    public string? ImageUrl { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal? CostPrice { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
    /// <summary>Whether this line reduced stock when it was ordered (tracked, in-stock products).</summary>
    public bool TracksStock { get; set; }
}

public class OrderStatusHistory
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public OrderStatus Status { get; set; }
    public string? Note { get; set; }
    public string? ChangedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}
