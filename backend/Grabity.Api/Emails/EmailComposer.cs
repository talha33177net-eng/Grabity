using System.Globalization;
using System.Net;
using System.Net.Sockets;
using Grabity.Api.Emails.Templates;

namespace Grabity.Api.Emails;

/// <summary>Either the finished email, or the reason it should no longer be sent.</summary>
public sealed record ComposeResult(ComposedEmail? Email, string? SkipReason)
{
    public static ComposeResult Send(ComposedEmail email) => new(email, null);
    public static ComposeResult Skip(string reason) => new(null, reason);
}

/// <summary>
/// Writes the subject and body of an outbox email from the current store data, just before it is sent.
/// Status emails are checked against the order first, so an undone mis-click doesn't reach the customer.
/// </summary>
public class EmailComposer(
    AppDbContext db,
    SettingsService storeSettings,
    EmailSettingsService emailSettings,
    OrderService orders,
    NewsletterTokens newsletter,
    EmailRenderer renderer)
{
    private const string StaffFooter = "You're getting this because your address is on the store alerts list in Settings → Email.";

    public Task<ComposeResult> ComposeAsync(EmailMessage message, CancellationToken ct) => ComposeAsync(message, false, null, ct);

    /// <summary>Renders an email type with recent store data (or samples), for the admin panel. Nothing is saved or sent.</summary>
    public async Task<ComposedEmail> PreviewAsync(EmailKind kind, string baseUrl, int? userId, string actor, CancellationToken ct)
    {
        var message = new EmailMessage
        {
            Kind = kind,
            ToAddress = "customer@example.com",
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            Data = new EmailData { BaseUrl = baseUrl, Role = Roles.Manager, Note = kind == EmailKind.StaffWelcome ? actor : null },
        };
        Order? sample = null;
        if (IsOrderEmail(kind))
        {
            message.OrderId = await db.Orders.AsNoTracking().OrderByDescending(o => o.CreatedAt).Select(o => (int?)o.Id).FirstOrDefaultAsync(ct);
            if (message.OrderId is null) sample = SampleOrder();
        }
        switch (kind)
        {
            case EmailKind.PasswordReset:
                message.Data.Link = $"{baseUrl}/reset-password?email=customer%40example.com&token=preview";
                break;
            case EmailKind.StaffLowStock:
                message.Data.Stock = await LowStockSampleAsync(ct);
                break;
            case EmailKind.StaffNewReview:
                message.Data.ReviewId = await db.ProductReviews.AsNoTracking().OrderByDescending(r => r.CreatedAt).Select(r => (int?)r.Id).FirstOrDefaultAsync(ct);
                break;
        }
        var result = await ComposeAsync(message, true, sample, ct);
        return result.Email ?? throw new AppException(result.SkipReason ?? "Nothing to preview.");
    }

    private async Task<ComposeResult> ComposeAsync(EmailMessage m, bool preview, Order? sample, CancellationToken ct)
    {
        var store = await StoreAsync(m.Data.BaseUrl, preview, ct);
        if (IsOrderEmail(m.Kind))
        {
            var order = sample ?? await db.Orders.AsNoTracking().Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == m.OrderId, ct);
            if (order is null) return ComposeResult.Skip("Not sent: the order was deleted before the email went out.");
            if (!preview && !m.Data.Force && StaleReason(m.Kind, order) is { } reason) return ComposeResult.Skip(reason);
            return ComposeResult.Send(await OrderEmailAsync(m, order, store, ct));
        }

        return m.Kind switch
        {
            EmailKind.Welcome or EmailKind.PasswordReset or EmailKind.PasswordChanged or EmailKind.StaffWelcome => await AccountEmailAsync(m, store, preview, ct),
            EmailKind.NewsletterWelcome => ComposeResult.Send(await NewsletterAsync(m, store, preview)),
            EmailKind.StaffLowStock => ComposeResult.Send(await LowStockAsync(m, store, ct)),
            EmailKind.StaffNewReview => await ReviewAsync(m, store, preview, ct),
            EmailKind.Test => ComposeResult.Send(await TestAsync(store, ct)),
            _ => throw new InvalidOperationException($"There is no template for {m.Kind} emails."),
        };
    }

    public static bool IsOrderEmail(EmailKind kind) => kind is EmailKind.OrderPlaced or EmailKind.OrderConfirmed or EmailKind.OrderShipped
        or EmailKind.OrderDelivered or EmailKind.OrderCancelled or EmailKind.OrderReturned or EmailKind.PaymentReceived
        or EmailKind.PaymentRefunded or EmailKind.StaffNewOrder;

    /// <summary>Why a delayed order email no longer matches the order, e.g. "Shipped" was clicked by mistake and undone.</summary>
    private static string? StaleReason(EmailKind kind, Order o)
    {
        var current = kind switch
        {
            EmailKind.OrderConfirmed => o.Status is OrderStatus.Confirmed or OrderStatus.Processing or OrderStatus.Shipped or OrderStatus.Delivered,
            EmailKind.OrderShipped => o.Status is OrderStatus.Shipped or OrderStatus.Delivered,
            EmailKind.OrderDelivered => o.Status == OrderStatus.Delivered,
            EmailKind.OrderCancelled => o.Status == OrderStatus.Cancelled,
            EmailKind.OrderReturned => o.Status == OrderStatus.Returned,
            EmailKind.PaymentReceived => o.PaymentStatus is PaymentStatus.Paid or PaymentStatus.PartiallyPaid,
            EmailKind.PaymentRefunded => o.PaymentStatus == PaymentStatus.Refunded,
            _ => true,
        };
        if (current) return null;
        return kind is EmailKind.PaymentReceived or EmailKind.PaymentRefunded
            ? $"Not sent: the payment was changed to {PaymentLabel(o.PaymentStatus).ToLowerInvariant()} before the email was due."
            : $"Not sent: the order was changed to {o.Status.ToString().ToLowerInvariant()} before the email was due.";
    }

    // ------------------------------------------------------------------ orders

    private async Task<ComposedEmail> OrderEmailAsync(EmailMessage m, Order o, EmailStore store, CancellationToken ct)
    {
        var settings = await storeSettings.GetAsync(ct);
        var payment = await db.PaymentMethods.AsNoTracking().Where(p => p.Code == o.PaymentMethodCode)
            .Select(p => new { p.Type, p.Instructions, p.AccountNumber }).FirstOrDefaultAsync(ct);
        var shipping = await db.ShippingMethods.AsNoTracking().Where(s => s.Id == o.ShippingMethodId)
            .Select(s => new { s.EstimatedDelivery, s.IsPickup }).FirstOrDefaultAsync(ct);
        var cod = payment?.Type == PaymentMethodType.CashOnDelivery || (payment is null && o.PaymentMethodCode == "cod");
        var pickup = shipping?.IsPickup ?? false;
        var eta = shipping?.EstimatedDelivery.NullIfBlank();
        var staff = m.Kind == EmailKind.StaffNewOrder;

        var name = FirstName(o.CustomerName);
        var number = $"#{o.OrderNumber}";
        var total = store.Price(o.Total);
        var due = Math.Max(0, o.Total - o.PaidAmount);
        var dueText = store.Price(due);
        var note = m.Data.Note.NullIfBlank();
        var trackLink = new EmailLink("Track your order", store.Url($"/track-order?order={o.OrderNumber}&contact={Uri.EscapeDataString(o.Phone)}"));
        var shopLink = new EmailLink("Continue shopping", store.Url("/"));
        var noteCallout = note is null ? null : new EmailCallout(CalloutTone.Info, $"Message from {store.Name}", note);

        EmailCallout? PaymentCallout()
        {
            if (o.PaymentStatus == PaymentStatus.Verifying)
            {
                var trx = o.TransactionId is { } id ? $" (transaction {id})" : "";
                return new(CalloutTone.Info, "We're checking your payment", $"We'll confirm your {o.PaymentMethodName} payment{trx} as soon as we've verified it.");
            }
            if (due <= 0) return null;
            if (cod || o.PaidAmount > 0)
            {
                return pickup
                    ? new(CalloutTone.Info, "Pay when you collect", $"Please pay {dueText} when you collect your order.")
                    : new(CalloutTone.Info, "Pay on delivery", $"Please keep {dueText} ready for the delivery person.");
            }
            var how = string.Join(" ", new[] { payment?.Instructions, payment?.AccountNumber is { } account ? $"Account: {account}." : null }.Where(s => !string.IsNullOrWhiteSpace(s)));
            return new(CalloutTone.Warning, "Payment needed", $"We're waiting for your {o.PaymentMethodName} payment of {dueText}. {how}".Trim());
        }

        var reviewLinks = m.Kind == EmailKind.OrderDelivered;
        var lines = o.Items.OrderBy(i => i.Id).Select(i => new OrderEmailLine(
            i.ProductName,
            i.VariantTitle.NullIfBlank(),
            i.Quantity,
            store.Price(i.UnitPrice),
            store.Price(i.LineTotal),
            store.Image(i.ImageUrl, 120),
            staff
                ? i.ProductId is int productId ? store.Url($"/admin/products/{productId}") : null
                : i.ProductSlug is { } slug ? store.Url($"/product/{Uri.EscapeDataString(slug)}") : null,
            reviewLinks && i.ProductSlug is { } reviewSlug ? store.Url($"/product/{Uri.EscapeDataString(reviewSlug)}#reviews") : null)).ToList();

        var totals = new List<EmailTotal> { new("Subtotal", store.Price(o.Subtotal)) };
        if (o.DiscountAmount > 0)
            totals.Add(new(o.CouponCode is { } coupon ? $"Discount ({coupon})" : "Discount", "−" + store.Price(o.DiscountAmount), Color: "#047857"));
        totals.Add(new(pickup ? "Store pickup" : "Delivery", o.ShippingCost > 0 ? store.Price(o.ShippingCost) : "Free"));
        if (o.PaymentFee > 0) totals.Add(new($"{o.PaymentMethodName} fee", store.Price(o.PaymentFee)));
        totals.Add(new("Total", total, Strong: true));
        if (o.PaidAmount > 0 && due > 0)
        {
            totals.Add(new("Paid", store.Price(o.PaidAmount)));
            totals.Add(new("To pay", dueText, Color: "#be123c"));
        }
        else if (o.PaymentStatus == PaymentStatus.Paid)
        {
            totals.Add(new("Paid", "✓ " + store.Price(o.PaidAmount > 0 ? o.PaidAmount : o.Total), Color: "#047857"));
        }

        List<EmailFact> facts =
        [
            new("Order number", number),
            new("Order date", LocalDate(o.CreatedAt)),
            new("Payment", o.PaymentMethodName),
            new("Delivery", pickup || eta is null ? o.ShippingMethodName : $"{o.ShippingMethodName} · {eta}"),
        ];
        var callouts = new List<EmailCallout>();
        void Add(EmailCallout? callout)
        {
            if (callout is not null) callouts.Add(callout);
        }

        string subject, preheader, emoji, title, intro;
        string? outro = null;
        int? step = null;
        EmailLink? button = trackLink;
        bool showLines = true, showTotals = true, showAddress = false;

        switch (m.Kind)
        {
            case EmailKind.OrderPlaced:
                subject = $"We've received your order {number}";
                preheader = $"Order {number} · {total}. We'll be in touch shortly to confirm it.";
                emoji = "🎉";
                title = $"Thanks for your order, {name}!";
                intro = m.Data.ByStaff
                    ? $"Here are the details of the order you placed {SourcePhrase(o.Source)}. We'll be in touch shortly to confirm it."
                    : settings.Checkout.OrderSuccessMessage.NullIfBlank() ?? "We've received your order and our team will call you shortly to confirm it.";
                step = 0;
                Add(PaymentCallout());
                showAddress = true;
                break;

            case EmailKind.OrderConfirmed:
                subject = $"Your order {number} is confirmed";
                preheader = pickup ? "We're getting it ready for pickup." : eta is null ? "We're getting it ready to ship." : $"We're getting it ready. Estimated delivery: {eta}.";
                emoji = "✅";
                title = "Your order is confirmed";
                intro = (m.Data.ByStaff ? $"Thanks for ordering {SourcePhrase(o.Source)}, {name}! " : $"Good news, {name}! ")
                    + $"We've confirmed order {number} and we're getting it ready{(pickup ? " for pickup" : "")}."
                    + (!pickup && eta is not null ? $" Estimated delivery: {eta}." : "");
                step = 1;
                Add(noteCallout);
                Add(PaymentCallout());
                showAddress = true;
                break;

            case EmailKind.OrderShipped:
                subject = pickup ? $"Your order {number} is ready for pickup" : $"Your order {number} is on its way";
                preheader = o.TrackingCode is { } code
                    ? $"{o.CourierName ?? "Courier"} tracking code: {code}."
                    : due > 0 ? $"Please keep {dueText} ready." : "It will reach you soon.";
                emoji = pickup ? "🛍️" : "🚚";
                title = pickup ? "Your order is ready for pickup" : "Your order is on its way";
                intro = pickup
                    ? $"{name}, order {number} is packed and waiting for you at our store."
                    : $"{name}, order {number} has left our store and is heading to you." + (o.CourierName is { } courier ? $" It's being delivered by {courier}." : "");
                step = 2;
                facts =
                [
                    new("Order number", number),
                    new(pickup ? "Collect from" : "Courier", pickup ? store.Name : o.CourierName ?? "Our delivery team"),
                    .. o.TrackingCode is { } trackingCode ? [new EmailFact("Tracking code", trackingCode, Mono: true)] : Array.Empty<EmailFact>(),
                    new("To pay", due > 0 ? dueText : "Nothing, it's paid"),
                ];
                Add(noteCallout);
                if (pickup)
                    Add(new(CalloutTone.Info, "Where to collect", string.Join(" · ", new[] { store.Address, store.BusinessHours }.Where(s => !string.IsNullOrWhiteSpace(s))).NullIfBlank() ?? "Visit our store with your order number."));
                else if (due > 0)
                    Add(new(CalloutTone.Warning, "Keep the payment ready", $"The delivery person will call you before arriving. Please keep {dueText} ready."));
                showTotals = false;
                showAddress = !pickup;
                break;

            case EmailKind.OrderDelivered:
                subject = $"Your order {number} has been delivered";
                preheader = "We hope you love it. Tell us what you think!";
                emoji = "📦";
                title = $"Delivered! Enjoy, {name}";
                intro = $"Order {number} has been delivered. We hope you love your new gadgets!";
                step = 3;
                Add(noteCallout);
                Add(new(CalloutTone.Success, "Keep this email", "It's your proof of purchase if you ever need warranty support."));
                button = lines.FirstOrDefault(l => l.ReviewUrl is not null) is { ReviewUrl: { } reviewUrl } ? new EmailLink("Write a review", reviewUrl) : shopLink;
                outro = $"Thanks for shopping with {store.Name}. We'd love to see you again!";
                break;

            case EmailKind.OrderCancelled:
                subject = $"Your order {number} has been cancelled";
                preheader = note ?? "If you have any questions, we're here to help.";
                emoji = "❌";
                title = "Your order has been cancelled";
                intro = $"{name}, order {number} has been cancelled." + (note is null ? " If you didn't ask for this or have any questions, please get in touch." : "");
                if (note is not null) Add(new(CalloutTone.Info, "Reason", note));
                if (o.PaidAmount > 0)
                    Add(new(CalloutTone.Warning, "About your payment", $"You've paid {store.Price(o.PaidAmount)} for this order. Our team will contact you about the refund."));
                button = shopLink;
                break;

            case EmailKind.OrderReturned:
                subject = $"Return received for order {number}";
                preheader = "We've received the returned items.";
                emoji = "↩️";
                title = "We've received your return";
                intro = $"{name}, the items from order {number} have been returned to us.";
                Add(noteCallout);
                if (o.PaymentStatus == PaymentStatus.Refunded)
                    Add(new(CalloutTone.Success, "Refund", "Your refund has been processed."));
                else if (o.PaidAmount > 0)
                    Add(new(CalloutTone.Info, "Refund", "If a refund is due, our team will contact you about it."));
                button = shopLink;
                break;

            case EmailKind.PaymentReceived:
            {
                var received = m.Data.Amount is > 0 ? m.Data.Amount.Value : o.PaidAmount > 0 ? o.PaidAmount : o.Total;
                subject = $"Payment received for order {number}";
                preheader = due > 0 ? $"We've received {store.Price(received)}. Still to pay: {dueText}." : $"We've received {store.Price(received)}. Your order is fully paid.";
                emoji = "💳";
                title = "Payment received";
                intro = $"Thanks, {name}! We've received {store.Price(received)} for order {number}.";
                step = TrackerStep(o.Status);
                facts =
                [
                    new("Amount received", store.Price(received)),
                    new("Paid with", o.PaymentMethodName),
                    .. o.TransactionId is { } trx ? [new EmailFact("Transaction ID", trx, Mono: true)] : Array.Empty<EmailFact>(),
                    new("Balance", due > 0 ? $"{dueText} to pay" : "Fully paid ✓"),
                ];
                if (due > 0)
                    Add(new(CalloutTone.Info, "Remaining balance", pickup ? $"Please pay the remaining {dueText} when you collect your order." : $"Please pay the remaining {dueText} on delivery."));
                showLines = false;
                break;
            }

            case EmailKind.PaymentRefunded:
            {
                var refunded = m.Data.Amount is > 0 ? store.Price(m.Data.Amount.Value) : null;
                subject = $"Refund processed for order {number}";
                preheader = refunded is null ? "Your refund has been processed." : $"We've refunded {refunded}.";
                emoji = "💸";
                title = "Your refund has been processed";
                intro = (refunded is null ? $"We've processed the refund for order {number}." : $"We've refunded {refunded} for order {number}.")
                    + " Depending on how you paid, it can take a few days to show up.";
                facts = [new("Order number", number), new("Refund", refunded ?? "Processed"), new("Paid with", o.PaymentMethodName)];
                showLines = false;
                button = shopLink;
                break;
            }

            case EmailKind.StaffNewOrder:
            {
                var history = await orders.GetPhoneStatsAsync(o.Phone, o.Id == 0 ? null : o.Id, ct);
                var items = o.Items.Sum(i => i.Quantity);
                subject = $"New order {number} · {total} · {o.CustomerName}";
                preheader = $"{o.CustomerName} · {o.Phone} · {items} item{(items == 1 ? "" : "s")} · {o.PaymentMethodName} · {o.ShippingMethodName}";
                emoji = "🛒";
                title = $"New order {number}";
                intro = $"{o.CustomerName} just placed an order for {total}" + (o.Source == OrderSource.Website ? " on the website." : $" {SourcePhrase(o.Source)}.");
                facts =
                [
                    new("Customer", o.CustomerName),
                    new("Phone", o.Phone),
                    new("Payment", $"{o.PaymentMethodName} · {PaymentLabel(o.PaymentStatus)}"),
                    new("Delivery", o.ShippingMethodName),
                    new("Placed", LocalTime(o.CreatedAt)),
                    new("Items", items.ToString(CultureInfo.InvariantCulture)),
                ];
                if (o.PaymentStatus == PaymentStatus.Verifying)
                {
                    var from = o.PaymentSenderNumber is { } sender ? $" from {sender}" : "";
                    Add(new(CalloutTone.Warning, "Verify the payment",
                        $"{o.PaymentMethodName} transaction {o.TransactionId}{from} for {total}. Check it in your {o.PaymentMethodName} account, then mark the payment as verified."));
                }
                if (history.TotalOrders == 0)
                    Add(new(CalloutTone.Info, "First order", "This is the first order from this phone number."));
                else if (history.SuccessRate is { } rate)
                    Add(new(rate >= 80 ? CalloutTone.Success : rate >= 50 ? CalloutTone.Warning : CalloutTone.Danger,
                        $"{rate.ToString("0.#", CultureInfo.InvariantCulture)}% of earlier orders were delivered",
                        $"Earlier orders from {o.Phone}: {history.Delivered} delivered, {history.Cancelled} cancelled, {history.Returned} returned"
                        + (history.Active > 0 ? $", {history.Active} still in progress." : ".")));
                else
                    Add(new(CalloutTone.Info, "Returning customer", $"{history.Active} other order(s) from this number are still in progress."));
                if (o.CustomerNote.NullIfBlank() is { } customerNote) Add(new(CalloutTone.Info, "Customer's note", customerNote));
                button = new EmailLink("Open the order", store.Url($"/admin/orders/{o.Id}"));
                showAddress = true;
                break;
            }

            default:
                throw new InvalidOperationException($"{m.Kind} is not an order email.");
        }

        var model = new OrderEmailModel
        {
            Subject = subject,
            Preheader = preheader,
            Emoji = emoji,
            Title = title,
            Intro = intro,
            TrackerStep = step,
            Facts = facts,
            Callouts = callouts,
            Button = button,
            Lines = showLines ? lines : [],
            Totals = showLines && showTotals ? totals : [],
            ShowAddress = showAddress,
            CustomerName = o.CustomerName,
            Phone = o.Phone,
            Address = o.Address,
            Delivery = pickup || eta is null ? o.ShippingMethodName : $"{o.ShippingMethodName} · {eta}",
            CustomerNote = staff ? null : o.CustomerNote.NullIfBlank(),
            PaymentMethod = o.PaymentMethodName,
            PaymentStatus = PaymentLabel(o.PaymentStatus),
            Outro = outro,
            FooterNote = staff ? StaffFooter : $"You're receiving this email because you placed order {number} at {store.Name}.",
            ShowHelp = !staff,
        };
        return await renderer.RenderAsync<OrderEmail>(store, model);
    }

    // ------------------------------------------------------------------ accounts

    private async Task<ComposeResult> AccountEmailAsync(EmailMessage m, EmailStore store, bool preview, CancellationToken ct)
    {
        var user = m.UserId is int id ? await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct) : null;
        if (user is null && !preview) return ComposeResult.Skip("Not sent: the account was deleted before the email went out.");
        if (m.Kind == EmailKind.PasswordReset && !preview && DateTime.UtcNow - m.CreatedAt > EmailNotifier.ResetLinkLifetime)
            return ComposeResult.Skip("Not sent: the reset link expired before it could be delivered.");

        var name = FirstName(user?.FullName ?? m.ToName);
        var email = user?.Email ?? m.ToAddress;
        var hours = (int)EmailNotifier.ResetLinkLifetime.TotalHours;

        MessageEmailModel model;
        switch (m.Kind)
        {
            case EmailKind.Welcome:
                model = new MessageEmailModel
                {
                    Subject = $"Welcome to {store.Name}, {name}!",
                    Preheader = "Your account is ready. Track orders and check out faster.",
                    Emoji = "👋",
                    Title = $"Welcome, {name}!",
                    Intro = $"Your {store.Name} account is ready."
                        + (user?.PhoneNumber is { } phone ? $" Sign in any time with your mobile number ({phone}) or this email address." : ""),
                    Bullets = ["Track every order and see its full history", "Check out faster with your saved address", "Review the products you've bought"],
                    Button = new EmailLink("Start shopping", store.Url("/")),
                    FooterNote = $"You're receiving this email because you created an account at {store.Name}.",
                };
                break;

            case EmailKind.PasswordReset:
            {
                var link = m.Data.Link ?? store.Url("/forgot-password");
                model = new MessageEmailModel
                {
                    Subject = $"Reset your {store.Name} password",
                    Preheader = $"Use this link within {hours} hours to choose a new password.",
                    Emoji = "🔑",
                    Title = "Reset your password",
                    Intro = $"Hi {name}, we received a request to reset the password for your {store.Name} account ({email}).",
                    Paragraphs = [$"Click the button below to choose a new password. The link works for {hours} hours and can be used once."],
                    Button = new EmailLink("Choose a new password", link),
                    LinkFallback = link,
                    FinePrint = "Didn't ask for this? You can safely ignore this email. Your password won't change.",
                    FooterNote = "You're receiving this email because someone asked to reset the password for this account.",
                };
                break;
            }

            case EmailKind.PasswordChanged:
            {
                var when = LocalTime(m.CreatedAt == default ? DateTime.UtcNow : m.CreatedAt);
                var contact = store.Phone is { } storePhone ? $" and call us on {storePhone}" : " and contact us";
                model = new MessageEmailModel
                {
                    Subject = $"Your {store.Name} password was changed",
                    Preheader = m.Data.ByStaff ? "Our team reset your password." : "If this was you, there's nothing else to do.",
                    Emoji = "🔐",
                    Title = "Your password was changed",
                    Intro = m.Data.ByStaff
                        ? $"Hi {name}, our team reset the password for your {store.Name} account ({email}) on {when}."
                        : $"Hi {name}, the password for your {store.Name} account ({email}) was changed on {when}.",
                    Paragraphs = [m.Data.ByStaff
                        ? "Sign in with the new password you were given. You can change it any time from your account settings."
                        : "If this was you, there's nothing else to do."],
                    Callouts = [new EmailCallout(CalloutTone.Warning, "Wasn't you?", $"Reset your password right away{contact} so we can secure your account.")],
                    Button = new EmailLink("Reset my password", store.Url("/forgot-password")),
                    FooterNote = "You're receiving this security notice because the password on your account changed.",
                };
                break;
            }

            case EmailKind.StaffWelcome:
            {
                var role = m.Data.Role ?? Roles.Manager;
                var article = role == Roles.Admin ? "an" : "a";
                model = new MessageEmailModel
                {
                    Subject = $"You've been added to the {store.Name} admin panel",
                    Preheader = $"You can now sign in as {article} {role}.",
                    Emoji = "🙌",
                    Title = $"Welcome to the team, {name}!",
                    Intro = $"{m.Data.Note ?? "An admin"} added you to the {store.Name} admin panel as {article} {role}.",
                    Bullets = role == Roles.Admin
                        ? ["Full access to orders, products, customers and marketing", "Manage staff accounts and store settings"]
                        : ["Handle orders, products, customers and marketing", "Store settings and staff stay with the admins"],
                    Paragraphs = ["Sign in with the password your admin gave you. Don't have it? Choose “Forgot password?” on the sign-in page."],
                    Facts = [new EmailFact("Sign-in email", email), new EmailFact("Role", role)],
                    Button = new EmailLink("Open the admin panel", store.Url("/admin/login")),
                    FooterNote = $"You're receiving this email because a {store.Name} admin created a staff account for you.",
                    ShowHelp = false,
                };
                break;
            }

            default:
                throw new InvalidOperationException($"{m.Kind} is not an account email.");
        }
        return ComposeResult.Send(await renderer.RenderAsync<MessageEmail>(store, model));
    }

    // ------------------------------------------------------------------ newsletter, staff alerts, test

    private async Task<ComposedEmail> NewsletterAsync(EmailMessage m, EmailStore store, bool preview)
    {
        var unsubscribe = store.Url($"/newsletter/unsubscribe?email={Uri.EscapeDataString(m.ToAddress)}&token={Uri.EscapeDataString(newsletter.Create(m.ToAddress))}");
        // The dispatcher also puts this link in the List-Unsubscribe header.
        if (!preview) m.Data = WithLink(m.Data, unsubscribe);
        var model = new MessageEmailModel
        {
            Subject = $"You're subscribed to {store.Name} updates",
            Preheader = "New arrivals, exclusive offers and flash deals, straight to your inbox.",
            Emoji = "📬",
            Title = "You're on the list!",
            Intro = $"Thanks for subscribing to {store.Name}. You'll be the first to hear about:",
            Bullets = ["New arrivals and restocks", "Exclusive offers and coupon codes", "Flash deals before they sell out"],
            Button = new EmailLink("See today's offers", store.Url("/offers")),
            FooterNote = $"You're receiving this email because {m.ToAddress} subscribed to {store.Name} updates.",
            UnsubscribeUrl = unsubscribe,
        };
        return await renderer.RenderAsync<MessageEmail>(store, model);
    }

    private async Task<ComposedEmail> LowStockAsync(EmailMessage m, EmailStore store, CancellationToken ct)
    {
        var lines = m.Data.Stock ?? [];
        var threshold = (await storeSettings.GetAsync(ct)).Checkout.LowStockThreshold;
        var orderNumber = m.OrderId is int id ? await db.Orders.AsNoTracking().Where(o => o.Id == id).Select(o => (int?)o.OrderNumber).FirstOrDefaultAsync(ct) : null;
        static string Label(StockAlertLine l) => l.VariantTitle is { } variant ? $"{l.ProductName} ({variant})" : l.ProductName;
        static string Level(StockAlertLine l) => l.Stock <= 0 ? "out of stock" : $"{l.Stock} left";
        var allOut = lines.Count > 0 && lines.All(l => l.Stock <= 0);

        var model = new MessageEmailModel
        {
            Subject = lines.Count == 1
                ? (allOut ? $"Out of stock: {Label(lines[0])}" : $"Low stock: {Label(lines[0])} ({lines[0].Stock} left)")
                : allOut ? $"Out of stock: {lines.Count} products" : $"Low stock: {lines.Count} products need restocking",
            Preheader = string.Join(" · ", lines.Take(4).Select(l => $"{Label(l)}: {Level(l)}")),
            Emoji = "📉",
            Title = lines.Count == 1 ? (allOut ? "Sold out" : "Running low on stock") : $"{lines.Count} products are running low",
            Intro = (orderNumber is int n ? $"After order #{n}, " : "")
                + (lines.Count == 1 ? "this product is" : "these products are")
                + $" at or below your low-stock level of {threshold}. Restock soon so customers can keep ordering.",
            Rows = lines.Select(l => new EmailListRow(l.ProductName, l.VariantTitle, store.Image(l.ImageUrl, 96),
                l.Stock <= 0 ? "Out of stock" : $"{l.Stock} left", l.Stock <= 0 ? CalloutTone.Danger : CalloutTone.Warning,
                store.Url($"/admin/products/{l.ProductId}"))).ToList(),
            Button = new EmailLink("Manage stock", store.Url("/admin/products?sort=stock")),
            FooterNote = StaffFooter,
            ShowHelp = false,
        };
        return await renderer.RenderAsync<MessageEmail>(store, model);
    }

    private async Task<ComposeResult> ReviewAsync(EmailMessage m, EmailStore store, bool preview, CancellationToken ct)
    {
        var review = await db.ProductReviews.AsNoTracking().Where(r => r.Id == m.Data.ReviewId)
            .Select(r => new
            {
                r.CustomerName, r.Rating, r.Title, r.Comment, r.IsApproved, r.IsVerifiedPurchase, r.ProductId, Product = r.Product.Name,
                Image = r.Product.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
            })
            .FirstOrDefaultAsync(ct);
        if (review is null && !preview) return ComposeResult.Skip("Not sent: the review was deleted before the email went out.");
        if (review is { IsApproved: true } && !preview && !m.Data.Force) return ComposeResult.Skip("Not sent: the review was approved before the email went out.");

        var rating = Math.Clamp(review?.Rating ?? 5, 1, 5);
        var product = review?.Product ?? "Sample wireless earbuds";
        var customer = review?.CustomerName ?? "Rahim Uddin";
        var comment = review?.Comment ?? "Great sound and the battery lasts all day. Fast delivery too!";
        var stars = new string('★', rating) + new string('☆', 5 - rating);
        var model = new MessageEmailModel
        {
            Subject = $"New {rating}★ review on {product}",
            Preheader = $"{customer}: “{Shorten(comment, 90)}”",
            Emoji = "⭐",
            Title = "A new review is waiting",
            Intro = $"{customer} reviewed {product}{(review?.IsVerifiedPurchase == true ? " (verified purchase)" : "")}. It appears on your store once you approve it.",
            Rows = [new EmailListRow(product, stars, store.Image(review?.Image, 96), $"{rating}/5", rating >= 4 ? CalloutTone.Success : rating == 3 ? CalloutTone.Warning : CalloutTone.Danger,
                review is null ? null : store.Url($"/admin/products/{review.ProductId}"))],
            Callouts = [new EmailCallout(CalloutTone.Info, review?.Title ?? "Review", comment)],
            Button = new EmailLink("Review and approve", store.Url("/admin/reviews")),
            FooterNote = StaffFooter,
            ShowHelp = false,
        };
        return ComposeResult.Send(await renderer.RenderAsync<MessageEmail>(store, model));
    }

    private async Task<ComposedEmail> TestAsync(EmailStore store, CancellationToken ct)
    {
        var settings = await emailSettings.GetAsync(ct);
        var model = new MessageEmailModel
        {
            Subject = $"Test email from {store.Name}",
            Preheader = "Your email settings are working.",
            Emoji = "✅",
            Title = "Your email settings work!",
            Intro = $"This is a test email from {store.Name}. If you can read it, customers will receive their order emails too.",
            Facts = [new EmailFact("Mail server", $"{settings.Host}:{settings.Port}"), new EmailFact("Sent from", settings.FromAddress ?? ""), new EmailFact("Sent at", LocalTime(DateTime.UtcNow))],
            FinePrint = "Tip: if this landed in spam, mark it as “Not spam” so future emails reach the inbox.",
            FooterNote = "You're receiving this because someone sent a test from Settings → Email.",
            ShowHelp = false,
        };
        return await renderer.RenderAsync<MessageEmail>(store, model);
    }

    // ------------------------------------------------------------------ helpers

    private async Task<EmailStore> StoreAsync(string? baseUrl, bool preview, CancellationToken ct)
    {
        var s = await storeSettings.GetAsync(ct);
        var root = (baseUrl.NullIfBlank() ?? (await emailSettings.GetAsync(ct)).SiteUrl.NullIfBlank() ?? "").TrimEnd('/');
        // Mail apps fetch images from the internet, so a localhost address would show broken images.
        var showImages = preview || IsPublic(root);
        var socials = new (string Label, string? Url)[]
        {
            ("Facebook", s.Social.Facebook), ("Instagram", s.Social.Instagram), ("YouTube", s.Social.YouTube),
            ("TikTok", s.Social.TikTok), ("LinkedIn", s.Social.LinkedIn), ("X", s.Social.X),
        };
        var store = new EmailStore
        {
            Name = s.General.StoreName,
            Tagline = s.General.Tagline,
            BaseUrl = root,
            Phone = s.Contact.Phone.NullIfBlank(),
            Email = s.Contact.Email.NullIfBlank(),
            WhatsAppUrl = s.Contact.WhatsAppNumber.NullIfBlank() is { } wa ? $"https://wa.me/{wa}" : null,
            Address = s.Contact.Address.NullIfBlank(),
            BusinessHours = s.Contact.BusinessHours.NullIfBlank(),
            CurrencySymbol = s.General.CurrencySymbol,
            Copyright = s.Footer.CopyrightText.NullIfBlank(),
            Socials = socials.Where(x => Uri.TryCreate(x.Url, UriKind.Absolute, out var u) && u.Scheme is "http" or "https")
                .Select(x => new EmailLink(x.Label, x.Url!)).ToList(),
            Theme = EmailTheme.From(s.General.PrimaryColor),
            ShowImages = showImages,
        };
        store.LogoUrl = store.Image(s.General.LogoUrl, 440);
        return store;
    }

    private static bool IsPublic(string baseUrl)
    {
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) || uri.IsLoopback) return false;
        if (IPAddress.TryParse(uri.Host, out var ip))
        {
            if (ip.AddressFamily != AddressFamily.InterNetwork) return !ip.IsIPv6LinkLocal && !ip.IsIPv6SiteLocal;
            var b = ip.GetAddressBytes();
            return !(b[0] == 10 || (b[0] == 172 && b[1] >= 16 && b[1] <= 31) || (b[0] == 192 && b[1] == 168) || (b[0] == 169 && b[1] == 254));
        }
        return uri.Host.Contains('.') && !uri.Host.EndsWith(".local", StringComparison.OrdinalIgnoreCase);
    }

    private async Task<List<StockAlertLine>> LowStockSampleAsync(CancellationToken ct)
    {
        var threshold = (await storeSettings.GetAsync(ct)).Checkout.LowStockThreshold;
        var rows = await db.ProductVariants.AsNoTracking()
            .Where(v => v.IsActive && v.Product.IsActive && v.Product.TrackInventory && v.StockQuantity <= threshold)
            .OrderBy(v => v.StockQuantity).Take(5)
            .Select(v => new { v.ProductId, v.Product.Name, v.Option1, v.Option2, v.Option3, v.StockQuantity,
                Image = v.ImageUrl ?? v.Product.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault() })
            .ToListAsync(ct);
        if (rows.Count == 0) return [new StockAlertLine { ProductName = "Sample wireless earbuds", VariantTitle = "Black", Stock = 2 }];
        return rows.Select(v => new StockAlertLine
        {
            ProductId = v.ProductId,
            ProductName = v.Name,
            VariantTitle = VariantTitle(v.Option1, v.Option2, v.Option3),
            ImageUrl = v.Image,
            Stock = v.StockQuantity,
        }).ToList();
    }

    public static string? VariantTitle(params string?[] options) =>
        string.Join(" / ", options.Where(o => !string.IsNullOrWhiteSpace(o))).NullIfBlank();

    private static EmailData WithLink(EmailData data, string link)
    {
        var copy = data.Clone();
        copy.Link = link;
        return copy;
    }

    private static Order SampleOrder() => new()
    {
        OrderNumber = 100001,
        CustomerName = "Rahim Uddin",
        Phone = "01712345678",
        Email = "customer@example.com",
        Address = "House 12, Road 5, Dhanmondi, Dhaka",
        ShippingMethodName = "Inside Dhaka City",
        ShippingCost = 70,
        PaymentMethodCode = "cod",
        PaymentMethodName = "Cash on Delivery",
        Subtotal = 25000,
        Total = 25070,
        Status = OrderStatus.Pending,
        Source = OrderSource.Website,
        CreatedAt = DateTime.UtcNow,
        Items = [new OrderItem { Id = 1, ProductName = "Sample wireless earbuds", VariantTitle = "Black", UnitPrice = 12500, Quantity = 2, LineTotal = 25000 }],
    };

    private static int? TrackerStep(OrderStatus status) => status switch
    {
        OrderStatus.Pending => 0,
        OrderStatus.Confirmed or OrderStatus.Processing => 1,
        OrderStatus.Shipped => 2,
        OrderStatus.Delivered => 3,
        _ => null,
    };

    private static string PaymentLabel(PaymentStatus status) => status switch
    {
        PaymentStatus.Unpaid => "Not paid yet",
        PaymentStatus.Verifying => "Verifying payment",
        PaymentStatus.PartiallyPaid => "Partly paid",
        PaymentStatus.Paid => "Paid",
        PaymentStatus.Refunded => "Refunded",
        _ => status.ToString(),
    };

    private static string SourcePhrase(OrderSource source) => source switch
    {
        OrderSource.Phone => "over the phone",
        OrderSource.Facebook => "on Facebook",
        OrderSource.WhatsApp => "on WhatsApp",
        OrderSource.Instagram => "on Instagram",
        OrderSource.Store => "at our store",
        OrderSource.Website => "on our website",
        _ => "with us",
    };

    private static string FirstName(string? fullName) =>
        (fullName ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault() ?? "there";

    private static string LocalDate(DateTime utc) => StoreClock.ToLocal(utc).ToString("d MMM yyyy", CultureInfo.InvariantCulture);

    private static string LocalTime(DateTime utc) => StoreClock.ToLocal(utc).ToString("d MMM yyyy, h:mm tt", CultureInfo.InvariantCulture);

    private static string Shorten(string text, int max) => text.Length <= max ? text : text[..(max - 1)].TrimEnd() + "…";
}
