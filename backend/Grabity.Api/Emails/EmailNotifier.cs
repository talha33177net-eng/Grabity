using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace Grabity.Api.Emails;

/// <summary>
/// Puts emails in the outbox when something happens in the store. Never throws: a problem with email
/// must not break checkout or the admin action that triggered it.
/// </summary>
public class EmailNotifier(
    AppDbContext db,
    EmailSettingsService emailSettings,
    SettingsService storeSettings,
    EmailSignal signal,
    IHttpContextAccessor http,
    ILogger<EmailNotifier> logger)
{
    /// <summary>Status emails wait this long, so a mis-click can be undone and a tracking code added first.</summary>
    public static readonly TimeSpan StatusDelay = TimeSpan.FromMinutes(2);

    /// <summary>How long a password reset link works (also set on the Identity token provider).</summary>
    public static readonly TimeSpan ResetLinkLifetime = TimeSpan.FromHours(2);

    // ------------------------------------------------------------------ events

    /// <summary>A new order from checkout, or one entered by staff (which may already be confirmed).</summary>
    public Task OrderPlacedAsync(Order order) => RunAsync(async s =>
    {
        var kind = order.Status == OrderStatus.Confirmed ? EmailKind.OrderConfirmed : EmailKind.OrderPlaced;
        await QueueForCustomerAsync(s, order, kind, new EmailData { ByStaff = order.Source != OrderSource.Website }, TimeSpan.Zero);
        if (order.Source == OrderSource.Website)
            await QueueForStaffAsync(s, EmailKind.StaffNewOrder, new EmailData(), order.Id, $"order:{order.Id}:{EmailKind.StaffNewOrder}");
        await QueueLowStockAsync(s, order);
    });

    public Task OrderStatusChangedAsync(Order order, OrderStatus previous, string? note) => RunAsync(async s =>
    {
        if (order.Status == previous) return;
        EmailKind? kind = order.Status switch
        {
            OrderStatus.Confirmed => EmailKind.OrderConfirmed,
            OrderStatus.Shipped => EmailKind.OrderShipped,
            OrderStatus.Delivered => EmailKind.OrderDelivered,
            OrderStatus.Cancelled => EmailKind.OrderCancelled,
            OrderStatus.Returned => EmailKind.OrderReturned,
            _ => null,
        };
        if (kind is { } k) await QueueForCustomerAsync(s, order, k, new EmailData { Note = note.NullIfBlank() }, StatusDelay);
    });

    public Task PaymentChangedAsync(Order order, PaymentStatus previousStatus, decimal previousPaid) => RunAsync(async s =>
    {
        if (order.PaymentStatus is PaymentStatus.Paid or PaymentStatus.PartiallyPaid && order.PaidAmount > previousPaid)
        {
            var key = $"order:{order.Id}:paid:{order.PaidAmount.ToString("0.##", CultureInfo.InvariantCulture)}";
            await QueueForCustomerAsync(s, order, EmailKind.PaymentReceived, new EmailData { Amount = order.PaidAmount - previousPaid }, StatusDelay, key);
        }
        else if (order.PaymentStatus == PaymentStatus.Refunded && previousStatus is PaymentStatus.Paid or PaymentStatus.PartiallyPaid && previousPaid > 0)
        {
            await QueueForCustomerAsync(s, order, EmailKind.PaymentRefunded, new EmailData { Amount = previousPaid }, StatusDelay);
        }
    });

    public Task WelcomeAsync(AppUser user) =>
        RunAsync(s => QueueForUserAsync(s, user, EmailKind.Welcome, new EmailData(), $"user:{user.Id}:{EmailKind.Welcome}"));

    public Task PasswordResetAsync(AppUser user, string token) => RunAsync(async s =>
    {
        // Stops anyone using the form to flood an inbox.
        var hourAgo = DateTime.UtcNow.AddHours(-1);
        if (await db.EmailMessages.CountAsync(m => m.UserId == user.Id && m.Kind == EmailKind.PasswordReset && m.CreatedAt > hourAgo) >= 3)
        {
            logger.LogWarning("Skipped a password reset email for user {UserId}: too many requests in the last hour.", user.Id);
            return;
        }
        var encoded = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
        var link = $"{BaseUrlFor(s)}/reset-password?email={Uri.EscapeDataString(user.Email ?? "")}&token={encoded}";
        await QueueForUserAsync(s, user, EmailKind.PasswordReset, new EmailData { Link = link }, null);
    });

    public Task PasswordChangedAsync(AppUser user, bool byStaff) =>
        RunAsync(s => QueueForUserAsync(s, user, EmailKind.PasswordChanged, new EmailData { ByStaff = byStaff }, null));

    public Task StaffWelcomeAsync(AppUser user, string role, string addedBy) =>
        RunAsync(s => QueueForUserAsync(s, user, EmailKind.StaffWelcome, new EmailData { Role = role, Note = addedBy }, $"user:{user.Id}:{EmailKind.StaffWelcome}"));

    public Task NewsletterWelcomeAsync(string email) =>
        RunAsync(s => QueueAsync(s, EmailKind.NewsletterWelcome, email, null, new EmailData(), dedupe: $"newsletter:{email.ToLowerInvariant()}"));

    public Task ReviewSubmittedAsync(ProductReview review) =>
        RunAsync(s => QueueForStaffAsync(s, EmailKind.StaffNewReview, new EmailData { ReviewId = review.Id }, null, null));

    // ------------------------------------------------------------------ admin actions

    /// <summary>Retries a failed or skipped email, or queues a fresh copy of a sent one.</summary>
    public async Task<EmailMessage> ResendAsync(int messageId, CancellationToken ct)
    {
        var original = await db.EmailMessages.FirstOrDefaultAsync(m => m.Id == messageId, ct) ?? throw AppException.NotFound("Email");
        if (original.Kind == EmailKind.PasswordReset) throw new AppException("Password reset links can't be resent. Ask the customer to request a new one.");
        if (original.Kind == EmailKind.Test) throw new AppException("Send a new test from Settings → Email instead.");
        if (!EmailSettingsService.IsReady(await emailSettings.GetAsync(ct))) throw new AppException("Email sending is switched off. Turn it on in Settings → Email first.");
        if (EmailAddresses.Problem(original.ToAddress) is { } problem) throw new AppException($"Can't send to {original.ToAddress}: {problem}");

        var data = original.Data.Clone();
        data.Force = true;
        var now = DateTime.UtcNow;
        EmailMessage target;
        if (original.Status is EmailStatus.Sent or EmailStatus.Sending)
        {
            target = new EmailMessage
            {
                Kind = original.Kind,
                Status = EmailStatus.Pending,
                ToAddress = original.ToAddress,
                ToName = original.ToName,
                OrderId = original.OrderId,
                UserId = original.UserId,
                Data = data,
                NextAttemptAt = now,
                CreatedAt = now,
            };
            db.EmailMessages.Add(target);
        }
        else
        {
            target = original;
            original.Data = data;
            original.Status = EmailStatus.Pending;
            original.Attempts = 0;
            original.LastError = null;
            original.NextAttemptAt = now;
            original.LockedUntil = null;
            // Written again from the current order details.
            original.Subject = null;
            original.HtmlBody = null;
            original.TextBody = null;
        }
        await db.SaveChangesAsync(ct);
        signal.Notify();
        return target;
    }

    /// <summary>Sends a scheduled email straight away instead of waiting for its delay.</summary>
    public async Task SendNowAsync(int messageId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var updated = await db.EmailMessages.Where(m => m.Id == messageId && m.Status == EmailStatus.Pending)
            .ExecuteUpdateAsync(u => u.SetProperty(m => m.NextAttemptAt, now), ct);
        if (updated == 0) throw new AppException("This email isn't waiting to be sent any more.");
        signal.Notify();
    }

    /// <summary>Storefront address for links: the configured website address, else the address of the current request.</summary>
    public string BaseUrlFor(EmailSettings s) => s.SiteUrl.NullIfBlank()?.TrimEnd('/') ?? RequestBaseUrl();

    public string RequestBaseUrl()
    {
        var request = http.HttpContext?.Request;
        return request is null ? "" : $"{request.Scheme}://{request.Host}{request.PathBase}";
    }

    // ------------------------------------------------------------------ queueing

    private async Task RunAsync(Func<EmailSettings, Task> queue)
    {
        try
        {
            var settings = await emailSettings.GetAsync();
            if (!EmailSettingsService.IsReady(settings)) return;
            await queue(settings);
            if (db.ChangeTracker.Entries<EmailMessage>().Any(e => e.State == EntityState.Added))
            {
                await db.SaveChangesAsync();
                signal.Notify();
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Could not queue an email.");
            foreach (var entry in db.ChangeTracker.Entries<EmailMessage>().Where(e => e.State == EntityState.Added).ToList())
                entry.State = EntityState.Detached;
        }
    }

    private Task QueueForCustomerAsync(EmailSettings s, Order order, EmailKind kind, EmailData data, TimeSpan delay, string? dedupe = null) =>
        QueueAsync(s, kind, order.Email, order.CustomerName, data, order.Id, order.UserId, dedupe ?? $"order:{order.Id}:{kind}", delay);

    private Task QueueForUserAsync(EmailSettings s, AppUser user, EmailKind kind, EmailData data, string? dedupe) =>
        QueueAsync(s, kind, user.Email, user.FullName, data, userId: user.Id, dedupe: dedupe);

    private async Task QueueForStaffAsync(EmailSettings s, EmailKind kind, EmailData data, int? orderId, string? dedupe)
    {
        foreach (var address in EmailAddresses.ParseList(s.StaffRecipients).Valid)
            await QueueAsync(s, kind, address, null, data.Clone(), orderId, dedupe: dedupe is null ? null : $"{dedupe}:{address.ToLowerInvariant()}");
    }

    private async Task QueueLowStockAsync(EmailSettings s, Order order)
    {
        if (!EmailSettingsService.IsKindEnabled(s, EmailKind.StaffLowStock) || EmailAddresses.ParseList(s.StaffRecipients).Valid.Count == 0) return;
        var ordered = order.Items.Where(i => i.TracksStock && i.VariantId is not null)
            .GroupBy(i => i.VariantId!.Value).ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));
        if (ordered.Count == 0) return;

        var threshold = (await storeSettings.GetAsync()).Checkout.LowStockThreshold;
        var ids = ordered.Keys.ToList();
        var variants = await db.ProductVariants.AsNoTracking().Where(v => ids.Contains(v.Id))
            .Select(v => new
            {
                v.Id, v.ProductId, v.Product.Name, v.Option1, v.Option2, v.Option3, v.StockQuantity,
                Image = v.ImageUrl ?? v.Product.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
            })
            .ToListAsync();
        // Only alert when this order pushed the level over the edge, not on every sale of an already-low item.
        var lines = variants
            .Where(v =>
            {
                var before = v.StockQuantity + ordered[v.Id];
                return (v.StockQuantity <= threshold && before > threshold) || (v.StockQuantity <= 0 && before > 0);
            })
            .OrderBy(v => v.StockQuantity)
            .Select(v => new StockAlertLine
            {
                ProductId = v.ProductId,
                ProductName = v.Name,
                VariantTitle = EmailComposer.VariantTitle(v.Option1, v.Option2, v.Option3),
                ImageUrl = v.Image,
                Stock = v.StockQuantity,
            })
            .ToList();
        if (lines.Count > 0) await QueueForStaffAsync(s, EmailKind.StaffLowStock, new EmailData { Stock = lines }, order.Id, null);
    }

    private async Task QueueAsync(EmailSettings s, EmailKind kind, string? to, string? toName, EmailData data,
        int? orderId = null, int? userId = null, string? dedupe = null, TimeSpan? delay = null)
    {
        if (!EmailSettingsService.IsKindEnabled(s, kind)) return;
        if (EmailAddresses.Normalize(to) is not { } address) return;
        if (dedupe is not null && await db.EmailMessages.AnyAsync(m => m.DedupeKey == dedupe && m.Status != EmailStatus.Failed && m.Status != EmailStatus.Skipped))
            return;

        data.BaseUrl ??= BaseUrlFor(s);
        var now = DateTime.UtcNow;
        var problem = EmailAddresses.Problem(address);
        db.EmailMessages.Add(new EmailMessage
        {
            Kind = kind,
            Status = problem is null ? EmailStatus.Pending : EmailStatus.Skipped,
            LastError = problem is null ? null : $"Not sent: {problem}",
            ToAddress = address,
            ToName = toName.NullIfBlank(),
            OrderId = orderId,
            UserId = userId,
            Data = data,
            DedupeKey = dedupe,
            NextAttemptAt = now + (delay ?? TimeSpan.Zero),
            CreatedAt = now,
        });
    }
}
