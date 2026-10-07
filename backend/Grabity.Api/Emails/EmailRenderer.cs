using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.DataProtection;

namespace Grabity.Api.Emails;

public sealed record ComposedEmail(string Subject, string Html, string Text);

/// <summary>Renders the Razor templates in Emails/Templates to HTML, plus a plain-text copy for the text part.</summary>
public sealed class EmailRenderer(IServiceProvider services, ILoggerFactory loggers)
{
    public async Task<ComposedEmail> RenderAsync<TTemplate>(EmailStore store, EmailModelBase model) where TTemplate : IComponent
    {
        await using var renderer = new HtmlRenderer(services, loggers);
        var html = await renderer.Dispatcher.InvokeAsync(async () =>
        {
            var parameters = ParameterView.FromDictionary(new Dictionary<string, object?> { ["Store"] = store, ["Model"] = model });
            var output = await renderer.RenderComponentAsync<TTemplate>(parameters);
            return output.ToHtmlString();
        });
        return new ComposedEmail(model.Subject, html, EmailText.FromHtml(html));
    }
}

/// <summary>Turns our own email HTML into readable plain text (links become "label (url)").</summary>
public static partial class EmailText
{
    public static string FromHtml(string html)
    {
        var text = Hidden().Replace(html, "");
        text = Anchor().Replace(text, m =>
        {
            var href = m.Groups["href"].Value;
            var label = Tag().Replace(m.Groups["label"].Value, "").Trim();
            if (href.StartsWith("tel:", StringComparison.OrdinalIgnoreCase) || href.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase))
                return label;
            return label.Length == 0 || label == href ? href : $"{label} ({href})";
        });
        text = BlockEnd().Replace(text, "\n");
        text = CellEnd().Replace(text, "   ");
        text = WebUtility.HtmlDecode(Tag().Replace(text, ""));

        var output = new StringBuilder();
        var pendingBlank = false;
        foreach (var raw in text.Split('\n'))
        {
            var line = Spaces().Replace(raw, " ").Trim();
            if (line.Length == 0)
            {
                pendingBlank = output.Length > 0;
                continue;
            }
            if (pendingBlank) output.Append('\n');
            output.Append(line).Append('\n');
            pendingBlank = false;
        }
        return output.ToString().Trim();
    }

    [GeneratedRegex(@"<(head|style)\b.*?</\1>|<div[^>]*\bdata-text-skip\b[^>]*>.*?</div>", RegexOptions.Singleline | RegexOptions.IgnoreCase)]
    private static partial Regex Hidden();

    [GeneratedRegex(@"<a\b[^>]*?\bhref=""(?<href>[^""]*)""[^>]*>(?<label>.*?)</a>", RegexOptions.Singleline | RegexOptions.IgnoreCase)]
    private static partial Regex Anchor();

    [GeneratedRegex(@"<br\s*/?>|</(p|h[1-6]|tr|table|div|li)>", RegexOptions.IgnoreCase)]
    private static partial Regex BlockEnd();

    [GeneratedRegex(@"</td>", RegexOptions.IgnoreCase)]
    private static partial Regex CellEnd();

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex Tag();

    [GeneratedRegex(@"[\s ]+")]
    private static partial Regex Spaces();
}

/// <summary>Signed tokens for the unsubscribe link in newsletter emails, so nobody can unsubscribe someone else.</summary>
public sealed class NewsletterTokens(IDataProtectionProvider protection)
{
    private readonly IDataProtector _protector = protection.CreateProtector("Grabity.Newsletter.Unsubscribe");

    public string Create(string email) => _protector.Protect(email.Trim().ToLowerInvariant());

    public bool Verify(string email, string token)
    {
        try
        {
            return _protector.Unprotect(token) == email.Trim().ToLowerInvariant();
        }
        catch (CryptographicException)
        {
            return false;
        }
    }
}
