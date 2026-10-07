namespace Grabity.Api.Domain;

public class ShippingMethod : ITimestamped
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    /// <summary>Shown under the option at checkout, e.g. how payment works for this zone.</summary>
    public string? Description { get; set; }
    public decimal Cost { get; set; }
    public string? EstimatedDelivery { get; set; }
    /// <summary>Customer collects from the store, so no delivery address is needed.</summary>
    public bool IsPickup { get; set; }
    /// <summary>Whether the store-wide free delivery threshold applies to this method.</summary>
    public bool FreeShippingEligible { get; set; } = true;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum PaymentMethodType
{
    CashOnDelivery,
    /// <summary>bKash / Nagad / Rocket "send money" with a transaction ID.</summary>
    MobileBanking,
    BankTransfer,
}

public class PaymentMethod : ITimestamped
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public PaymentMethodType Type { get; set; }
    /// <summary>Payment instructions shown when the method is selected.</summary>
    public string? Instructions { get; set; }
    public string? AccountNumber { get; set; }
    /// <summary>Extra charge in percent of the order total (e.g. 1.5 for bKash cash-out).</summary>
    public decimal FeePercent { get; set; }
    public bool RequiresTransactionId { get; set; }
    public string? LogoUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum DiscountType
{
    Percentage,
    FixedAmount,
    FreeShipping,
}

public class Coupon : ITimestamped
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string? Description { get; set; }
    public DiscountType Type { get; set; }
    public decimal Value { get; set; }
    public decimal? MinOrderAmount { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int? UsageLimit { get; set; }
    /// <summary>Maximum uses per customer phone number.</summary>
    public int? UsageLimitPerCustomer { get; set; }
    public int UsedCount { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
