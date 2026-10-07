using System.Net.Sockets;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Grabity.Api.Emails;

/// <summary>Wakes the dispatcher as soon as an email is queued, instead of waiting for its next check.</summary>
public sealed class EmailSignal
{
    private readonly SemaphoreSlim _semaphore = new(0, 1);

    public void Notify()
    {
        try
        {
            _semaphore.Release();
        }
        catch (SemaphoreFullException)
        {
            // Already signalled.
        }
    }

    public async Task WaitAsync(TimeSpan timeout, CancellationToken ct)
    {
        try
        {
            await _semaphore.WaitAsync(timeout, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
        }
    }
}

/// <summary>Sends queued emails in the background, retrying failures with growing delays.</summary>
public sealed class EmailDispatcher(IServiceScopeFactory scopes, EmailSignal signal, ILogger<EmailDispatcher> logger) : BackgroundService
{
    private static readonly TimeSpan[] RetryDelays =
        [TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(15), TimeSpan.FromHours(1), TimeSpan.FromHours(3)];
    private static readonly TimeSpan Idle = TimeSpan.FromMinutes(1);
    private DateTime _nextCleanup;

    public static int MaxAttempts => RetryDelays.Length + 1;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var wait = Idle;
            try
            {
                wait = await RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "The email queue run failed.");
            }
            await signal.WaitAsync(wait, stoppingToken);
        }
    }

    private async Task<TimeSpan> RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var settingsService = scope.ServiceProvider.GetRequiredService<EmailSettingsService>();
        var now = DateTime.UtcNow;

        // Emails claimed by a run that was interrupted (crash, restart) go back in the queue.
        await db.EmailMessages.Where(m => m.Status == EmailStatus.Sending && m.LockedUntil < now)
            .ExecuteUpdateAsync(u => u.SetProperty(m => m.Status, EmailStatus.Pending).SetProperty(m => m.LockedUntil, (DateTime?)null), ct);
        if (now >= _nextCleanup)
        {
            await CleanupAsync(db, now, ct);
            _nextCleanup = now.AddHours(12);
        }

        var due = await db.EmailMessages.AsNoTracking()
            .Where(m => m.Status == EmailStatus.Pending && m.NextAttemptAt <= now)
            .OrderBy(m => m.NextAttemptAt).ThenBy(m => m.Id)
            .Select(m => m.Id).Take(20).ToListAsync(ct);
        if (due.Count > 0)
        {
            var settings = await settingsService.GetAsync(ct);
            if (!EmailSettingsService.IsReady(settings))
            {
                await db.EmailMessages.Where(m => due.Contains(m.Id) && m.Status == EmailStatus.Pending)
                    .ExecuteUpdateAsync(u => u.SetProperty(m => m.Status, EmailStatus.Skipped)
                        .SetProperty(m => m.LastError, "Not sent: email sending was switched off."), ct);
            }
            else
            {
                var composer = scope.ServiceProvider.GetRequiredService<EmailComposer>();
                await SendBatchAsync(db, composer, settings, settingsService.UnprotectPassword(settings), due, ct);
            }
        }

        var next = await db.EmailMessages.AsNoTracking().Where(m => m.Status == EmailStatus.Pending).MinAsync(m => (DateTime?)m.NextAttemptAt, ct);
        if (next is null) return Idle;
        var wait = next.Value - DateTime.UtcNow;
        return wait < TimeSpan.FromSeconds(1) ? TimeSpan.FromSeconds(1) : wait > Idle ? Idle : wait;
    }

    private async Task SendBatchAsync(AppDbContext db, EmailComposer composer, EmailSettings settings, string? password, List<int> ids, CancellationToken ct)
    {
        SmtpSession? session = null;
        try
        {
            foreach (var id in ids)
            {
                var claimUntil = DateTime.UtcNow.AddMinutes(5);
                var claimed = await db.EmailMessages.Where(m => m.Id == id && m.Status == EmailStatus.Pending)
                    .ExecuteUpdateAsync(u => u.SetProperty(m => m.Status, EmailStatus.Sending).SetProperty(m => m.LockedUntil, claimUntil), ct);
                if (claimed == 0) continue;

                var message = await db.EmailMessages.FirstAsync(m => m.Id == id, ct);
                var settingsProblem = false;
                try
                {
                    if (message.Subject is null || message.HtmlBody is null)
                    {
                        var composed = await composer.ComposeAsync(message, ct);
                        if (composed.Email is { } email)
                        {
                            message.Subject = email.Subject;
                            message.HtmlBody = email.Html;
                            message.TextBody = email.Text;
                        }
                        else
                        {
                            Skip(message, composed.SkipReason ?? "Not sent.");
                        }
                    }
                    if (message.Status == EmailStatus.Sending)
                    {
                        if (EmailAddresses.Problem(message.ToAddress) is { } problem)
                        {
                            Skip(message, $"Not sent: {problem}");
                        }
                        else
                        {
                            session ??= await SmtpMailer.ConnectAsync(settings, password, ct);
                            await session.SendAsync(message, ct);
                            message.Status = EmailStatus.Sent;
                            message.SentAt = DateTime.UtcNow;
                            message.Attempts++;
                            message.LastError = null;
                            if (message.Kind == EmailKind.PasswordReset) Scrub(message);
                        }
                    }
                }
                catch (EmailSendException ex)
                {
                    Fail(message, ex.Message, ex.Permanent);
                    settingsProblem = ex.SettingsProblem;
                    logger.LogWarning("Email {Id} ({Kind}) to {To} failed: {Error}", message.Id, message.Kind, message.ToAddress, ex.Message);
                    if (session is not null)
                    {
                        await session.DisposeAsync();
                        session = null;
                    }
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    // Shutting down: put it back for the next start.
                    message.Status = EmailStatus.Pending;
                    message.LockedUntil = null;
                    await db.SaveChangesAsync(CancellationToken.None);
                    throw;
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Couldn't write email {Id} ({Kind}).", message.Id, message.Kind);
                    Fail(message, $"Couldn't write this email: {ex.Message}", permanent: false);
                }

                message.LockedUntil = null;
                await db.SaveChangesAsync(CancellationToken.None);

                if (settingsProblem)
                {
                    // Every email would fail the same way, so hold the queue instead of burning through retries.
                    var later = DateTime.UtcNow.AddMinutes(5);
                    await db.EmailMessages.Where(m => m.Status == EmailStatus.Pending && m.NextAttemptAt < later)
                        .ExecuteUpdateAsync(u => u.SetProperty(m => m.NextAttemptAt, later), ct);
                    break;
                }
            }
        }
        finally
        {
            if (session is not null) await session.DisposeAsync();
        }
    }

    private static void Skip(EmailMessage m, string reason)
    {
        m.Status = EmailStatus.Skipped;
        m.LastError = reason;
        if (m.Kind == EmailKind.PasswordReset) Scrub(m);
    }

    private static void Fail(EmailMessage m, string error, bool permanent)
    {
        m.Attempts++;
        m.LastError = error.Length > 1000 ? error[..1000] : error;
        if (permanent || m.Attempts >= MaxAttempts)
        {
            m.Status = EmailStatus.Failed;
            if (m.Kind == EmailKind.PasswordReset) Scrub(m);
        }
        else
        {
            m.Status = EmailStatus.Pending;
            m.NextAttemptAt = DateTime.UtcNow + RetryDelays[Math.Min(m.Attempts - 1, RetryDelays.Length - 1)];
        }
    }

    /// <summary>Password reset emails carry a working one-time link, so their content isn't kept once they're done with.</summary>
    private static void Scrub(EmailMessage m)
    {
        if (m.Data.Link is not null)
        {
            var data = m.Data.Clone();
            data.Link = null;
            m.Data = data;
        }
        m.HtmlBody = null;
        m.TextBody = "(Removed after sending: it contained a one-time password reset link.)";
    }

    private static async Task CleanupAsync(AppDbContext db, DateTime now, CancellationToken ct)
    {
        var cutoff = now.AddDays(-180);
        await db.EmailMessages.Where(m => m.CreatedAt < cutoff && m.Status != EmailStatus.Pending && m.Status != EmailStatus.Sending)
            .ExecuteDeleteAsync(ct);
        var dayAgo = now.AddDays(-1);
        var resets = await db.EmailMessages
            .Where(m => m.Kind == EmailKind.PasswordReset && m.CreatedAt < dayAgo && m.Status != EmailStatus.Pending && m.Status != EmailStatus.Sending)
            .ToListAsync(ct);
        foreach (var m in resets.Where(m => m.Data.Link is not null || m.HtmlBody is not null)) Scrub(m);
        await db.SaveChangesAsync(ct);
    }
}

/// <summary>A send failure, explained in words the admin panel can show.</summary>
public sealed class EmailSendException(string message, bool permanent = false, bool settingsProblem = false, Exception? inner = null)
    : Exception(message, inner)
{
    /// <summary>Retrying won't help, e.g. the recipient address doesn't exist.</summary>
    public bool Permanent { get; } = permanent;

    /// <summary>The settings are wrong or the account is blocked, so every email would fail the same way.</summary>
    public bool SettingsProblem { get; } = settingsProblem;
}

public static class SmtpMailer
{
    public static async Task<SmtpSession> ConnectAsync(EmailSettings settings, string? password, CancellationToken ct)
    {
        var client = new SmtpClient { Timeout = 30_000 };
        try
        {
            var security = settings.Security switch
            {
                SmtpSecurity.SslOnConnect => SecureSocketOptions.SslOnConnect,
                SmtpSecurity.None => SecureSocketOptions.None,
                SmtpSecurity.Auto => SecureSocketOptions.Auto,
                _ => SecureSocketOptions.StartTls,
            };
            await client.ConnectAsync(settings.Host!.Trim(), settings.Port, security, ct);
            if (!string.IsNullOrWhiteSpace(settings.UserName))
            {
                if (string.IsNullOrEmpty(password))
                    throw new EmailSendException("No password is saved for the email account. Enter it in Settings → Email.", settingsProblem: true);
                await client.AuthenticateAsync(settings.UserName.Trim(), password, ct);
            }
            return new SmtpSession(client, settings);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            client.Dispose();
            throw Explain(ex, settings, connecting: true);
        }
    }

    internal static EmailSendException Explain(Exception ex, EmailSettings s, bool connecting)
    {
        var gmail = IsGmail(s.Host);
        return ex switch
        {
            EmailSendException known => known,
            AuthenticationException => new EmailSendException(
                "The mail server didn't accept the username or password." +
                (gmail ? " For Gmail, use a 16-character App password (Google Account → Security → App passwords), not your normal password." : ""),
                settingsProblem: true, inner: ex),
            SslHandshakeException => new EmailSendException(
                $"Couldn't set up a secure connection to {s.Host}:{s.Port}. Check the port and security setting (Gmail: port 587 with STARTTLS, or 465 with SSL).",
                settingsProblem: true, inner: ex),
            SmtpCommandException { ErrorCode: SmtpErrorCode.RecipientNotAccepted } cmd => new EmailSendException(
                $"The recipient's address was refused: {cmd.Message}", permanent: true, inner: ex),
            SmtpCommandException { ErrorCode: SmtpErrorCode.SenderNotAccepted } cmd => new EmailSendException(
                $"The mail server refused the sender address {s.FromAddress}." +
                (gmail ? " With Gmail, the sender must be your Gmail address or an alias added in Gmail's settings." : "") + $" ({cmd.Message})",
                settingsProblem: true, inner: ex),
            SmtpCommandException cmd when cmd.Message.Contains("limit", StringComparison.OrdinalIgnoreCase) => new EmailSendException(
                $"The email account has reached its sending limit, so emails will wait and retry: {cmd.Message}", settingsProblem: true, inner: ex),
            SmtpCommandException cmd => new EmailSendException(
                $"The mail server refused the email ({(int)cmd.StatusCode}): {cmd.Message}", permanent: (int)cmd.StatusCode >= 500, inner: ex),
            SmtpProtocolException => new EmailSendException("The mail server closed the connection unexpectedly. It will be retried.", inner: ex),
            SocketException or IOException when connecting => new EmailSendException(
                $"Couldn't reach {s.Host}:{s.Port}. Check the server name and port, and that this computer is online.", settingsProblem: true, inner: ex),
            SocketException or IOException => new EmailSendException("The connection to the mail server dropped. It will be retried.", inner: ex),
            OperationCanceledException or TimeoutException => new EmailSendException("The mail server took too long to respond. It will be retried.", inner: ex),
            _ => new EmailSendException($"Sending failed: {ex.Message}", inner: ex),
        };
    }

    public static bool IsGmail(string? host) =>
        host is not null && (host.EndsWith("gmail.com", StringComparison.OrdinalIgnoreCase) || host.EndsWith("googlemail.com", StringComparison.OrdinalIgnoreCase));
}

/// <summary>An open, signed-in SMTP connection that can send several emails.</summary>
public sealed class SmtpSession(SmtpClient client, EmailSettings settings) : IAsyncDisposable
{
    public async Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        var mime = new MimeMessage();
        mime.From.Add(new MailboxAddress(settings.FromName ?? "", settings.FromAddress!.Trim()));
        mime.To.Add(new MailboxAddress(message.ToName ?? "", message.ToAddress));
        if (EmailAddresses.Normalize(settings.ReplyTo) is { } replyTo) mime.ReplyTo.Add(MailboxAddress.Parse(replyTo));
        mime.Subject = message.Subject ?? "";
        // Tells auto-responders (vacation replies) not to answer automated mail.
        mime.Headers.Add("Auto-Submitted", "auto-generated");
        if (message.Kind == EmailKind.NewsletterWelcome && message.Data.Link is { } unsubscribe)
            mime.Headers.Add("List-Unsubscribe", $"<{unsubscribe}>");
        mime.Body = new BodyBuilder { HtmlBody = message.HtmlBody, TextBody = message.TextBody }.ToMessageBody();

        try
        {
            await client.SendAsync(mime, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            throw SmtpMailer.Explain(ex, settings, connecting: false);
        }
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            if (client.IsConnected) await client.DisconnectAsync(true);
        }
        catch
        {
            // Closing politely is best effort.
        }
        client.Dispose();
    }
}
