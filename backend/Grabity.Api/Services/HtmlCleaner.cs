using Ganss.Xss;

namespace Grabity.Api.Services;

/// <summary>Sanitizes rich text coming from the admin editor before it is stored.</summary>
public class HtmlCleaner
{
    private static readonly string[] AllowedIframeHosts =
        ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "www.facebook.com"];

    private readonly HtmlSanitizer _sanitizer;

    public HtmlCleaner()
    {
        _sanitizer = new HtmlSanitizer();
        _sanitizer.AllowedTags.Add("iframe");
        _sanitizer.AllowedAttributes.Add("class");
        _sanitizer.AllowedAttributes.Add("target");
        _sanitizer.AllowedAttributes.Add("rel");
        _sanitizer.AllowedAttributes.Add("allowfullscreen");
        _sanitizer.AllowedAttributes.Add("frameborder");
        _sanitizer.AllowedAttributes.Add("allow");
        _sanitizer.AllowedSchemes.Add("tel");
        _sanitizer.AllowedSchemes.Add("mailto");
        _sanitizer.PostProcessNode += (_, e) =>
        {
            if (e.Node is AngleSharp.Dom.IElement { TagName: "IFRAME" } frame)
            {
                var src = frame.GetAttribute("src");
                if (!Uri.TryCreate(src, UriKind.Absolute, out var uri) || uri.Scheme != "https" ||
                    !AllowedIframeHosts.Contains(uri.Host, StringComparer.OrdinalIgnoreCase))
                {
                    frame.Remove();
                }
            }
        };
    }

    public string? Clean(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;
        var cleaned = _sanitizer.Sanitize(html).Trim();
        return cleaned.Length == 0 || cleaned == "<p></p>" ? null : cleaned;
    }
}
