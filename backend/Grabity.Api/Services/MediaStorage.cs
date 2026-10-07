using System.Collections.Concurrent;
using Grabity.Api.Infrastructure;
using Microsoft.Extensions.FileProviders;
using SkiaSharp;

namespace Grabity.Api.Services;

/// <summary>
/// Stores uploaded images under the media root (served at /uploads) and produces
/// resized WebP copies on demand for <c>/uploads/...?w=480</c> style requests.
/// </summary>
public class MediaStorage
{
    public const string RequestPath = "/uploads";
    private const long MaxUploadBytes = 10 * 1024 * 1024;
    private const int MaxStoredDimension = 2000;
    private static readonly int[] Widths = [64, 96, 128, 160, 240, 320, 400, 480, 640, 800, 960, 1200, 1600];
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    private static readonly string[] Folders = ["products", "categories", "brands", "banners", "blog", "pages", "settings", "misc"];
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Locks = new();

    private readonly ILogger<MediaStorage> _logger;

    public MediaStorage(IConfiguration config, IWebHostEnvironment env, ILogger<MediaStorage> logger)
    {
        _logger = logger;
        var configured = config["Media:Root"];
        Root = Path.GetFullPath(string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(env.ContentRootPath, "uploads")
            : Path.IsPathRooted(configured) ? configured : Path.Combine(env.ContentRootPath, configured));
        Directory.CreateDirectory(Root);
    }

    public string Root { get; }

    public IFileProvider FileProvider => new PhysicalFileProvider(Root);

    public async Task<string> SaveImageAsync(IFormFile file, string? folder, CancellationToken ct)
    {
        if (file.Length == 0) throw new AppException("The file is empty.");
        if (file.Length > MaxUploadBytes) throw new AppException("Images must be 10 MB or smaller.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
            throw new AppException("Only JPG, PNG, WebP and GIF images are allowed.");

        folder = Folders.Contains(folder?.ToLowerInvariant()) ? folder!.ToLowerInvariant() : "misc";
        var now = DateTime.UtcNow;
        var relativeDir = Path.Combine(folder, now.ToString("yyyy"), now.ToString("MM"));
        Directory.CreateDirectory(Path.Combine(Root, relativeDir));
        var name = Guid.NewGuid().ToString("N");

        await using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        buffer.Position = 0;

        // Animated GIFs are kept as uploaded; everything else is normalised to WebP.
        if (extension == ".gif")
        {
            using var codecCheck = SKCodec.Create(new SKManagedStream(buffer, false));
            if (codecCheck is null) throw new AppException("The file is not a valid image.");
            buffer.Position = 0;
            var gifRelative = Path.Combine(relativeDir, name + ".gif");
            await File.WriteAllBytesAsync(Path.Combine(Root, gifRelative), buffer.ToArray(), ct);
            return ToUrl(gifRelative);
        }

        using var bitmap = DecodeOriented(buffer) ?? throw new AppException("The file is not a valid image.");
        using var resized = ResizeToFit(bitmap, MaxStoredDimension);
        using var image = SKImage.FromBitmap(resized ?? bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Webp, 85)
            ?? throw new AppException("The image could not be processed.");

        var relative = Path.Combine(relativeDir, name + ".webp");
        await using (var output = File.Create(Path.Combine(Root, relative)))
            data.SaveTo(output);
        return ToUrl(relative);
    }

    /// <summary>Deletes a file previously returned by <see cref="SaveImageAsync"/>. Unknown URLs are ignored.</summary>
    public void TryDelete(string? url)
    {
        var path = ResolvePath(url);
        if (path is null || !File.Exists(path)) return;
        try { File.Delete(path); }
        catch (IOException ex) { _logger.LogWarning(ex, "Could not delete {Path}", path); }
    }

    /// <summary>Returns the path of a resized WebP copy, creating it if needed. Null when the source can't be resized.</summary>
    public async Task<string?> GetResizedAsync(string relativeRequestPath, int requestedWidth, CancellationToken ct)
    {
        var source = ResolvePath(RequestPath + relativeRequestPath);
        if (source is null || !File.Exists(source)) return null;
        var ext = Path.GetExtension(source).ToLowerInvariant();
        if (ext is ".svg" or ".gif") return null;

        var width = Widths.FirstOrDefault(w => w >= requestedWidth, Widths[^1]);
        var cachePath = Path.Combine(Root, ".cache", width.ToString(), relativeRequestPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar) + ".webp");
        if (File.Exists(cachePath) && File.GetLastWriteTimeUtc(cachePath) >= File.GetLastWriteTimeUtc(source))
            return cachePath;

        var gate = Locks.GetOrAdd(cachePath, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            if (File.Exists(cachePath) && File.GetLastWriteTimeUtc(cachePath) >= File.GetLastWriteTimeUtc(source))
                return cachePath;

            await using var input = File.OpenRead(source);
            using var bitmap = DecodeOriented(input);
            if (bitmap is null) return null;
            using var resized = bitmap.Width > width ? ResizeToWidth(bitmap, width) : null;
            using var image = SKImage.FromBitmap(resized ?? bitmap);
            using var data = image.Encode(SKEncodedImageFormat.Webp, 80);
            if (data is null) return null;
            Directory.CreateDirectory(Path.GetDirectoryName(cachePath)!);
            var temp = cachePath + "." + Guid.NewGuid().ToString("N") + ".tmp";
            await using (var output = File.Create(temp))
                data.SaveTo(output);
            File.Move(temp, cachePath, overwrite: true);
            return cachePath;
        }
        finally
        {
            gate.Release();
        }
    }

    private string? ResolvePath(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || !url.StartsWith(RequestPath + "/", StringComparison.OrdinalIgnoreCase)) return null;
        var relative = Uri.UnescapeDataString(url[(RequestPath.Length + 1)..].Split('?')[0]);
        var full = Path.GetFullPath(Path.Combine(Root, relative));
        return full.StartsWith(Root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) ? full : null;
    }

    private static string ToUrl(string relative) => RequestPath + "/" + relative.Replace(Path.DirectorySeparatorChar, '/');

    private static SKBitmap? DecodeOriented(Stream stream)
    {
        using var codec = SKCodec.Create(new SKManagedStream(stream, false));
        if (codec is null) return null;
        var bitmap = SKBitmap.Decode(codec);
        if (bitmap is null) return null;

        // Phone photos often carry an EXIF rotation; bake it into the pixels.
        return codec.EncodedOrigin switch
        {
            SKEncodedOrigin.BottomRight => Rotate(bitmap, 180),
            SKEncodedOrigin.RightTop => Rotate(bitmap, 90),
            SKEncodedOrigin.LeftBottom => Rotate(bitmap, 270),
            _ => bitmap,
        };
    }

    private static SKBitmap Rotate(SKBitmap source, int degrees)
    {
        var swap = degrees is 90 or 270;
        var rotated = new SKBitmap(swap ? source.Height : source.Width, swap ? source.Width : source.Height);
        using (var canvas = new SKCanvas(rotated))
        {
            canvas.Translate(rotated.Width / 2f, rotated.Height / 2f);
            canvas.RotateDegrees(degrees);
            canvas.Translate(-source.Width / 2f, -source.Height / 2f);
            using var image = SKImage.FromBitmap(source);
            canvas.DrawImage(image, 0, 0, new SKSamplingOptions(SKFilterMode.Linear));
        }
        source.Dispose();
        return rotated;
    }

    private static SKBitmap? ResizeToFit(SKBitmap bitmap, int maxDimension)
    {
        var largest = Math.Max(bitmap.Width, bitmap.Height);
        if (largest <= maxDimension) return null;
        var scale = maxDimension / (double)largest;
        return bitmap.Resize(new SKImageInfo((int)(bitmap.Width * scale), (int)(bitmap.Height * scale)),
            new SKSamplingOptions(SKCubicResampler.Mitchell));
    }

    private static SKBitmap ResizeToWidth(SKBitmap bitmap, int width)
    {
        var height = (int)Math.Round(bitmap.Height * (width / (double)bitmap.Width));
        return bitmap.Resize(new SKImageInfo(width, Math.Max(1, height)), new SKSamplingOptions(SKCubicResampler.Mitchell));
    }
}

/// <summary>Serves resized copies for /uploads requests that carry a ?w= query.</summary>
public class ResizedImageMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, MediaStorage media)
    {
        var request = context.Request;
        if (HttpMethods.IsGet(request.Method) &&
            request.Path.StartsWithSegments(MediaStorage.RequestPath, out var remaining) &&
            int.TryParse(request.Query["w"], out var width) && width > 0)
        {
            var file = await media.GetResizedAsync(remaining.Value ?? "", width, context.RequestAborted);
            if (file is not null)
            {
                context.Response.ContentType = "image/webp";
                context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
                await context.Response.SendFileAsync(file, context.RequestAborted);
                return;
            }
        }

        await next(context);
    }
}
