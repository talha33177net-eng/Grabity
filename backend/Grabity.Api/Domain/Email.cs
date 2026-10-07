namespace Grabity.Api.Domain;

/// <summary>Every email the store sends: customer emails first, then alerts for staff.</summary>
public enum EmailKind
{
    OrderPlaced,
    OrderConfirmed,
    OrderShipped,
    OrderDelivered,
    OrderCancelled,
    OrderReturned,
    PaymentReceived,
    PaymentRefunded,
    Welcome,
    PasswordReset,
    PasswordChanged,
    NewsletterWelcome,
    StaffWelcome,
    StaffNewOrder,
    StaffLowStock,
    StaffNewReview,
    Test,
}

public enum EmailStatus
{
    /// <summary>Waiting in the outbox until <see cref="EmailMessage.NextAttemptAt"/>.</summary>
    Pending,
    Sending,
    Sent,
    /// <summary>Gave up after several attempts, or the mail server permanently refused it.</summary>
    Failed,
    /// <summary>Deliberately not sent, e.g. a placeholder address or the order changed before it was due.</summary>
    Skipped,
}

/// <summary>
/// An email in the outbox. Rows are written when something happens in the store and sent in the
/// background by EmailDispatcher, which also writes the content just before sending.
/// </summary>
public class EmailMessage
{
    public int Id { get; set; }
    public EmailKind Kind { get; set; }
    public EmailStatus Status { get; set; }
    public string ToAddress { get; set; } = "";
    public string? ToName { get; set; }
    public int? OrderId { get; set; }
    public Order? Order { get; set; }
    public int? UserId { get; set; }
    /// <summary>Details of the event that the email is written from.</summary>
    public EmailData Data { get; set; } = new();
    public string? Subject { get; set; }
    public string? HtmlBody { get; set; }
    public string? TextBody { get; set; }
    /// <summary>Stops the same email going out twice, e.g. "order:15:OrderShipped".</summary>
    public string? DedupeKey { get; set; }
    public int Attempts { get; set; }
    public DateTime NextAttemptAt { get; set; }
    /// <summary>While sending: when the claim expires, so an email interrupted by a crash is picked up again.</summary>
    public DateTime? LockedUntil { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? SentAt { get; set; }
}

public class EmailData
{
    /// <summary>Storefront address used for links and images, e.g. https://grabity.com.bd.</summary>
    public string? BaseUrl { get; set; }
    /// <summary>One-time link, e.g. to reset a password.</summary>
    public string? Link { get; set; }
    /// <summary>Status note (customers also see it on the tracking page), or the staff member's name for invitations.</summary>
    public string? Note { get; set; }
    /// <summary>The change was made by staff rather than by the customer.</summary>
    public bool ByStaff { get; set; }
    public decimal? Amount { get; set; }
    public string? Role { get; set; }
    public int? ReviewId { get; set; }
    public List<StockAlertLine>? Stock { get; set; }
    /// <summary>Send even if the order has moved on (a manual resend from the admin panel).</summary>
    public bool Force { get; set; }

    public EmailData Clone() => (EmailData)MemberwiseClone();
}

public class StockAlertLine
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = "";
    public string? VariantTitle { get; set; }
    public string? ImageUrl { get; set; }
    public int Stock { get; set; }
}

public enum SmtpSecurity
{
    /// <summary>Upgrades to TLS after connecting, usually port 587 (Gmail, Outlook, Zoho).</summary>
    StartTls,
    /// <summary>TLS from the first byte, usually port 465.</summary>
    SslOnConnect,
    /// <summary>Let the client pick based on the port.</summary>
    Auto,
    None,
}

/// <summary>Outgoing email settings, stored under the "email" settings key and never sent to the storefront.</summary>
public class EmailSettings
{
    public bool Enabled { get; set; }
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public SmtpSecurity Security { get; set; } = SmtpSecurity.StartTls;
    public string? UserName { get; set; }
    /// <summary>The SMTP password, encrypted with ASP.NET Core Data Protection.</summary>
    public string? ProtectedPassword { get; set; }
    public string? FromName { get; set; }
    public string? FromAddress { get; set; }
    public string? ReplyTo { get; set; }
    /// <summary>Public storefront address for links and images. Empty uses the address the request came in on.</summary>
    public string? SiteUrl { get; set; }
    /// <summary>Who gets store alerts (new orders, low stock, reviews). Comma or line separated.</summary>
    public string? StaffRecipients { get; set; }
    /// <summary>Email types the admin switched off. Anything not listed is sent.</summary>
    public List<EmailKind> DisabledKinds { get; set; } = [];
}
