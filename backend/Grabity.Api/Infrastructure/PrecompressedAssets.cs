using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Net.Http.Headers;

namespace Grabity.Api.Infrastructure;

/// <summary>
/// The frontend build writes Brotli (.br) and gzip (.gz) copies of its scripts and styles at maximum compression
/// (see vite.config.ts). This points requests at those copies when the browser accepts them, so the files are
/// compressed once at build time instead of quickly and less tightly on every request.
/// </summary>
public class PrecompressedAssetsMiddleware(RequestDelegate next, IWebHostEnvironment env)
{
    private static readonly (string Encoding, string Extension)[] Encodings = [("br", ".br"), ("gzip", ".gz")];

    public Task InvokeAsync(HttpContext context)
    {
        var request = context.Request;
        if ((HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method)) &&
            request.Path.StartsWithSegments("/assets") && !PrecompressedContentTypes.IsCompressedCopy(request.Path.Value!))
        {
            var accepted = request.GetTypedHeaders().AcceptEncoding;
            foreach (var (encoding, extension) in Encodings)
            {
                if (!accepted.Any(e => e.Value.Equals(encoding, StringComparison.OrdinalIgnoreCase) && e.Quality != 0)) continue;
                var copy = request.Path.Value + extension;
                if (!env.WebRootFileProvider.GetFileInfo(copy).Exists) continue;
                request.Path = copy;
                break;
            }
            context.Response.Headers.Vary = HeaderNames.AcceptEncoding;
        }
        return next(context);
    }
}

/// <summary>Gives <c>app.js.br</c> the content type of <c>app.js</c>; the encoding header is added by <see cref="Apply"/>.</summary>
public class PrecompressedContentTypes : IContentTypeProvider
{
    private readonly FileExtensionContentTypeProvider _inner = new();

    public static bool IsCompressedCopy(string path) =>
        path.EndsWith(".br", StringComparison.OrdinalIgnoreCase) || path.EndsWith(".gz", StringComparison.OrdinalIgnoreCase);

    public bool TryGetContentType(string subpath, out string contentType) =>
        _inner.TryGetContentType(IsCompressedCopy(subpath) ? subpath[..^3] : subpath, out contentType!);

    /// <summary>Marks a response that is serving a .br/.gz copy with the matching Content-Encoding.</summary>
    public static void Apply(StaticFileResponseContext ctx)
    {
        var name = ctx.File.Name;
        if (name.EndsWith(".br", StringComparison.OrdinalIgnoreCase)) ctx.Context.Response.Headers.ContentEncoding = "br";
        else if (name.EndsWith(".gz", StringComparison.OrdinalIgnoreCase)) ctx.Context.Response.Headers.ContentEncoding = "gzip";
    }
}
