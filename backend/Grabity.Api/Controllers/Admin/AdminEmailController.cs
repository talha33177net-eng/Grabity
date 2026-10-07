using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Grabity.Api.Controllers.Admin;

/// <summary>Email settings, test sends, template previews and the email log. Admins only.</summary>
[Authorize(Roles = Roles.Admin)]
[Route("api/admin/email")]
public class AdminEmailController(
    AppDbContext db,
    EmailSettingsService emailSettings,
    SettingsService storeSettings,
    EmailComposer composer,
    EmailNotifier notifier,
    CatalogCache catalog) : AdminControllerBase
{
    [HttpGet("settings")]
    public async Task<EmailSettingsDto> Get(CancellationToken ct) => await ToDtoAsync(await emailSettings.GetAsync(ct), ct);

    [HttpPut("settings")]
    public async Task<EmailSettingsDto> Update(EmailSettingsRequest r, CancellationToken ct)
    {
        var current = await emailSettings.GetAsync(ct);
        var host = r.Host.NullIfBlank();
        var fromAddress = r.FromAddress.NullIfBlank();
        if (fromAddress is not null && EmailAddresses.Normalize(fromAddress) is null) throw new AppException("The sender address isn't a valid email address.");
        var replyTo = r.ReplyTo.NullIfBlank();
        if (replyTo is not null && EmailAddresses.Normalize(replyTo) is null) throw new AppException("The reply-to address isn't a valid email address.");
        var (recipients, invalid) = EmailAddresses.ParseList(r.StaffRecipients);
        if (invalid.Count > 0) throw new AppException($"“{invalid[0]}” isn't a valid email address for store alerts.");

        string? siteUrl = null;
        if (r.SiteUrl.NullIfBlank() is { } site)
        {
            if (!Uri.TryCreate(site, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
                throw new AppException("The website address must start with https:// (or http://).");
            siteUrl = uri.GetLeftPart(UriPartial.Path).TrimEnd('/');
        }

        var password = r.Password switch
        {
            null => current.ProtectedPassword,
            "" => null,
            // Google shows app passwords in groups of four; the spaces aren't part of it.
            var p => emailSettings.Protect(SmtpMailer.IsGmail(host) ? p.Replace(" ", "") : p),
        };
        if (r.Enabled)
        {
            if (host is null) throw new AppException("Enter the SMTP server to turn email on.");
            if (fromAddress is null) throw new AppException("Enter the sender email address to turn email on.");
            if (r.UserName.NullIfBlank() is not null && password is null) throw new AppException("Enter the password for the email account.");
        }

        var store = await storeSettings.GetAsync(ct);
        var settings = new EmailSettings
        {
            Enabled = r.Enabled,
            Host = host,
            Port = r.Port,
            Security = r.Security,
            UserName = r.UserName.NullIfBlank(),
            ProtectedPassword = password,
            FromName = r.FromName.NullIfBlank() ?? store.General.StoreName,
            FromAddress = fromAddress,
            ReplyTo = replyTo,
            SiteUrl = siteUrl,
            StaffRecipients = recipients.Count == 0 ? null : string.Join(", ", recipients),
            DisabledKinds = r.DisabledKinds.Where(k => k is not (EmailKind.PasswordReset or EmailKind.Test)).Distinct().ToList(),
        };
        await emailSettings.SaveAsync(settings, ct);
        // The storefront only offers "Forgot password?" while email works.
        catalog.InvalidateStorefront();
        return await ToDtoAsync(settings, ct);
    }

    /// <summary>Sends a test email straight away (not through the queue) so problems show up immediately.</summary>
    [HttpPost("test")]
    public async Task<object> SendTest(SendTestEmailRequest request, CancellationToken ct)
    {
        var to = EmailAddresses.Normalize(request.To) ?? throw new AppException("Enter a valid email address to send the test to.");
        if (EmailAddresses.Problem(to) is { } problem) throw new AppException($"Can't send to {to}: {problem}");
        var settings = await emailSettings.GetAsync(ct);
        if (string.IsNullOrWhiteSpace(settings.Host) || EmailAddresses.Normalize(settings.FromAddress) is null)
            throw new AppException("Save the SMTP server and sender address first.");

        var now = DateTime.UtcNow;
        var message = new EmailMessage
        {
            Kind = EmailKind.Test,
            Status = EmailStatus.Sending,
            ToAddress = to,
            UserId = User.GetUserId(),
            Data = new EmailData { BaseUrl = notifier.BaseUrlFor(settings) },
            Attempts = 1,
            NextAttemptAt = now,
            CreatedAt = now,
        };
        var composed = (await composer.ComposeAsync(message, ct)).Email!;
        message.Subject = composed.Subject;
        message.HtmlBody = composed.Html;
        message.TextBody = composed.Text;
        db.EmailMessages.Add(message);

        try
        {
            await using var session = await SmtpMailer.ConnectAsync(settings, emailSettings.UnprotectPassword(settings), ct);
            await session.SendAsync(message, ct);
            message.Status = EmailStatus.Sent;
            message.SentAt = DateTime.UtcNow;
        }
        catch (EmailSendException ex)
        {
            message.Status = EmailStatus.Failed;
            message.LastError = ex.Message;
            await db.SaveChangesAsync(CancellationToken.None);
            throw new AppException(ex.Message);
        }
        await db.SaveChangesAsync(CancellationToken.None);
        return new { Message = $"Test email sent to {to}. It can take a minute to arrive; check the spam folder too." };
    }

    [HttpGet("messages")]
    public async Task<PagedResult<EmailMessageListItemDto>> Messages([FromQuery] EmailStatus? status, [FromQuery] EmailKind? kind,
        [FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = 30, CancellationToken ct = default)
    {
        var query = db.EmailMessages.AsNoTracking();
        if (status is { } s) query = query.Where(m => m.Status == s);
        if (kind is { } k) query = query.Where(m => m.Kind == k);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().TrimStart('#');
            var number = int.TryParse(term, out var n) ? n : -1;
            query = query.Where(m => m.ToAddress.Contains(term) || (m.Subject != null && m.Subject.Contains(term)) ||
                (m.Order != null && m.Order.OrderNumber == number));
        }
        return await query.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Select(EmailProjection.ListItem)
            .ToPagedAsync(page, pageSize, ct);
    }

    [HttpGet("messages/{id:int}")]
    public async Task<EmailMessageDto> Message(int id, CancellationToken ct)
    {
        var item = await db.EmailMessages.AsNoTracking().Where(m => m.Id == id).Select(EmailProjection.ListItem).FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Email");
        var body = await db.EmailMessages.AsNoTracking().Where(m => m.Id == id).Select(m => new { m.HtmlBody, m.TextBody }).FirstAsync(ct);
        // Reset emails hold a working one-time link; staff never need to see it.
        return item.Kind == EmailKind.PasswordReset
            ? new EmailMessageDto(item, null, "(Hidden: password reset emails contain a private one-time link.)")
            : new EmailMessageDto(item, body.HtmlBody, body.TextBody);
    }

    [HttpPost("messages/{id:int}/resend")]
    public async Task<EmailMessageListItemDto> Resend(int id, CancellationToken ct)
    {
        var message = await notifier.ResendAsync(id, ct);
        return await db.EmailMessages.AsNoTracking().Where(m => m.Id == message.Id).Select(EmailProjection.ListItem).FirstAsync(ct);
    }

    [HttpPost("messages/{id:int}/send-now")]
    public async Task<IActionResult> SendNow(int id, CancellationToken ct)
    {
        await notifier.SendNowAsync(id, ct);
        return NoContent();
    }

    /// <summary>Renders an email type with the latest order (or sample data) so admins can see what customers get.</summary>
    [HttpGet("preview/{kind}")]
    public async Task<EmailPreviewDto> Preview(EmailKind kind, CancellationToken ct)
    {
        var settings = await emailSettings.GetAsync(ct);
        var email = await composer.PreviewAsync(kind, notifier.BaseUrlFor(settings), User.GetUserId(), Actor, ct);
        return new EmailPreviewDto(email.Subject, email.Html);
    }

    private async Task<EmailSettingsDto> ToDtoAsync(EmailSettings s, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var dayAgo = now.AddDays(-1);
        var weekAgo = now.AddDays(-7);
        var lastSent = await db.EmailMessages.AsNoTracking().Where(m => m.Status == EmailStatus.Sent)
            .OrderByDescending(m => m.SentAt).Select(m => new { m.Id, m.SentAt }).FirstOrDefaultAsync(ct);
        var afterId = lastSent?.Id ?? 0;
        // Only report a problem that happened after the last successful send.
        var lastError = await db.EmailMessages.AsNoTracking()
            .Where(m => m.Id > afterId && m.Attempts > 0 && m.LastError != null && (m.Status == EmailStatus.Failed || m.Status == EmailStatus.Pending))
            .OrderByDescending(m => m.Id).Select(m => m.LastError).FirstOrDefaultAsync(ct);
        var health = new EmailHealthDto(
            lastSent?.SentAt,
            await db.EmailMessages.CountAsync(m => m.Status == EmailStatus.Sent && m.SentAt >= dayAgo, ct),
            await db.EmailMessages.CountAsync(m => m.Status == EmailStatus.Pending || m.Status == EmailStatus.Sending, ct),
            await db.EmailMessages.CountAsync(m => m.Status == EmailStatus.Failed && m.CreatedAt >= weekAgo, ct),
            lastError);

        var hasPassword = !string.IsNullOrEmpty(s.ProtectedPassword);
        return new EmailSettingsDto(s.Enabled, s.Host, s.Port, s.Security, s.UserName, hasPassword,
            hasPassword && emailSettings.UnprotectPassword(s) is null, s.FromName, s.FromAddress, s.ReplyTo, s.SiteUrl,
            s.StaffRecipients, s.DisabledKinds, notifier.RequestBaseUrl(), health);
    }
}
