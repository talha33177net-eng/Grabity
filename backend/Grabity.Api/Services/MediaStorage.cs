using System.Collections.Concurrent;
using Grabity.Api.Infrastructure;
using Microsoft.Extensions.FileProviders;
using SkiaSharp;

namespace Grabity.Api.Services;

/// <summary>
/// Stores uploaded images under the media root (served at /uploads) and produces
/// resized WebP copies for <c>/uploads/...?w=480</c> style requests.
/// </summary>
public class MediaStorage
{
    public const string RequestPath = "/uploads";
    private const long MaxUploadBytes = 10 * 1024 * 1024;
    private const int MaxStoredDimension = 2000;
    private const int VariantQuality = 80;
    /// <summary>How far (0-255) a pixel may be from the border colour, or how opaque on a transparent border, and still be cropped.</summary>
    private const int TrimTolerance = 24;
    private static readonly int[] Widths = [64, 96, 128, 160, 240, 320, 400, 480, 640, 800, 960, 1200, 1600];
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    private static readonly string[] ResizableExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    private static readonly string[] Folders = ["products", "categories", "brands", "banners", "blog", "pages", "settings", "misc"];
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Locks = new();

    /// <summary>
    /// Sizes the storefront shows each kind of image at (the widths passed to <c>img()</c>/<c>srcSet()</c> in the
    /// frontend, snapped to <see cref="Widths"/>). They are made when the image is uploaded so no shopper waits
    /// for a resize; any other size is still made on its first request.
    /// </summary>
    private static readonly Dictionary<string, int[]> VariantWidths = new()
    {
        ["products"] = [96, 128, 160, 240, 400, 960],
        ["banners"] = [640, 800, 960, 1200, 1600],
        ["categories"] = [64, 96, 240, 640, 960, 1200, 1600],
        ["brands"] = [240],
        ["blog"] = [400, 640, 1200],
        ["pages"] = [960],
        ["misc"] = [960],
        // Store logo (logoWidths in Logo.tsx; emails ask for 440, which snaps to 480).
        ["settings"] = [240, 480, 960],
    };

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

    /// <param name="trim">Crop away an empty border first (see <see cref="TrimBorder"/>). Animated GIFs are never cropped.</param>
    public async Task<string> SaveImageAsync(IFormFile file, string? folder, bool trim, CancellationToken ct)
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

        using var decoded = DecodeOriented(buffer) ?? throw new AppException("The file is not a valid image.");
        using var trimmed = trim ? TrimBorder(decoded) : null;
        var bitmap = trimmed ?? decoded;
        using var resized = ResizeToFit(bitmap, MaxStoredDimension);
        using var image = SKImage.FromBitmap(resized ?? bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Webp, 85)
            ?? throw new AppException("The image could not be processed.");

        var relative = Path.Combine(relativeDir, name + ".webp");
        await using (var output = File.Create(Path.Combine(Root, relative)))
            data.SaveTo(output);

        var url = ToUrl(relative);
        if (VariantWidths.TryGetValue(folder, out var widths))
        {
            var stored = resized ?? bitmap;
            foreach (var width in widths.Where(w => w < stored.Width))
                await WriteVariantAsync(stored, width, CachePath(url[RequestPath.Length..], width), ct);
        }
        return url;
    }

    /// <summary>
    /// Makes the storefront sizes that are missing for images already in the media folder (uploaded before sizes
    /// were made at upload time, or after the cache folder was cleared). Returns how many were made.
    /// </summary>
    public async Task<int> CreateMissingVariantsAsync(CancellationToken ct)
    {
        var created = 0;
        foreach (var (folder, widths) in VariantWidths)
        {
            var dir = Path.Combine(Root, folder);
            if (!Directory.Exists(dir)) continue;
            foreach (var file in Directory.EnumerateFiles(dir, "*", SearchOption.AllDirectories))
            {
                ct.ThrowIfCancellationRequested();
                if (!ResizableExtensions.Contains(Path.GetExtension(file).ToLowerInvariant())) continue;
                var relative = "/" + Path.GetRelativePath(Root, file).Replace(Path.DirectorySeparatorChar, '/');
                try
                {
                    var sourceWidth = ReadOrientedWidth(file);
                    var missing = widths.Where(w => w < sourceWidth && !IsFresh(CachePath(relative, w), file)).ToList();
                    if (missing.Count == 0) continue;

                    await using var input = File.OpenRead(file);
                    using var bitmap = DecodeOriented(input);
                    if (bitmap is null) continue;
                    foreach (var width in missing)
                        if (await WriteVariantAsync(bitmap, width, CachePath(relative, width), ct)) created++;
                }
                catch (IOException ex)
                {
                    _logger.LogWarning(ex, "Could not make image sizes for {File}", file);
                }
            }
        }
        return created;
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
        if (!ResizableExtensions.Contains(Path.GetExtension(source).ToLowerInvariant())) return null;

        var width = Widths.FirstOrDefault(w => w >= requestedWidth, Widths[^1]);
        var cachePath = CachePath(relativeRequestPath, width);
        if (IsFresh(cachePath, source)) return cachePath;

        var gate = Locks.GetOrAdd(cachePath, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            if (IsFresh(cachePath, source)) return cachePath;

            await using var input = File.OpenRead(source);
            using var bitmap = DecodeOriented(input);
            return bitmap is not null && await WriteVariantAsync(bitmap, width, cachePath, ct) ? cachePath : null;
        }
        finally
        {
            gate.Release();
        }
    }

    private string CachePath(string relativeRequestPath, int width) =>
        Path.Combine(Root, ".cache", width.ToString(), relativeRequestPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar) + ".webp");

    private static bool IsFresh(string cachePath, string source) =>
        File.Exists(cachePath) && File.GetLastWriteTimeUtc(cachePath) >= File.GetLastWriteTimeUtc(source);

    /// <summary>Encodes a WebP copy of <paramref name="source"/> at most <paramref name="width"/> wide, replacing the cache file atomically.</summary>
    private static async Task<bool> WriteVariantAsync(SKBitmap source, int width, string cachePath, CancellationToken ct)
    {
        using var resized = source.Width > width ? ResizeToWidth(source, width) : null;
        using var image = SKImage.FromBitmap(resized ?? source);
        using var data = image.Encode(SKEncodedImageFormat.Webp, VariantQuality);
        if (data is null) return false;
        Directory.CreateDirectory(Path.GetDirectoryName(cachePath)!);
        var temp = cachePath + "." + Guid.NewGuid().ToString("N") + ".tmp";
        await using (var output = File.Create(temp))
            data.SaveTo(output);
        File.Move(temp, cachePath, overwrite: true);
        return true;
    }

    /// <summary>Image width after EXIF rotation, read from the file header without decoding the pixels.</summary>
    private static int ReadOrientedWidth(string file)
    {
        using var codec = SKCodec.Create(file);
        if (codec is null) return 0;
        return codec.EncodedOrigin is SKEncodedOrigin.RightTop or SKEncodedOrigin.LeftBottom ? codec.Info.Height : codec.Info.Width;
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

    /// <summary>
    /// Crops a plain border off the image: transparent margins, or a solid background (e.g. white) when all four
    /// corners share it. Logos are often exported in the middle of a large empty canvas, which makes them tiny once
    /// fitted to a header's height. Null when there is nothing to crop.
    /// </summary>
    private static SKBitmap? TrimBorder(SKBitmap bitmap)
    {
        using var converted = bitmap.ColorType is SKColorType.Bgra8888 or SKColorType.Rgba8888 ? null : bitmap.Copy(SKColorType.Bgra8888);
        var source = converted ?? bitmap;
        int width = source.Width, height = source.Height, stride = source.RowBytes;
        var pixels = source.GetPixelSpan();

        // Both 8888 layouts keep alpha in the fourth byte; colours are only compared with the same layout.
        var background = pixels[..4].ToArray();
        var transparent = background[3] <= TrimTolerance;
        bool IsBackground(ReadOnlySpan<byte> pixel)
        {
            if (transparent) return pixel[3] <= TrimTolerance;
            for (var i = 0; i < 4; i++)
                if (Math.Abs(pixel[i] - background[i]) > TrimTolerance) return false;
            return true;
        }
        ReadOnlySpan<byte> At(ReadOnlySpan<byte> all, int x, int y) => all.Slice(y * stride + x * 4, 4);

        // A solid colour only counts as a border when every corner has it; otherwise it's probably a photo.
        if (!transparent && !(IsBackground(At(pixels, width - 1, 0)) && IsBackground(At(pixels, 0, height - 1)) && IsBackground(At(pixels, width - 1, height - 1))))
            return null;

        int top = -1, bottom = -1, left = width, right = -1;
        for (var y = 0; y < height; y++)
        {
            var first = 0;
            while (first < width && IsBackground(At(pixels, first, y))) first++;
            if (first == width) continue;
            var last = width - 1;
            while (IsBackground(At(pixels, last, y))) last--;
            if (top < 0) top = y;
            bottom = y;
            left = Math.Min(left, first);
            right = Math.Max(right, last);
        }

        if (top < 0) return null;
        var bounds = new SKRectI(left, top, right + 1, bottom + 1);
        if (bounds.Width == width && bounds.Height == height) return null;
        using var subset = new SKBitmap();
        return bitmap.ExtractSubset(subset, bounds) ? subset.Copy() : null;
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
                context.Response.ContentLength = new FileInfo(file).Length;
                context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
                await context.Response.SendFileAsync(file, context.RequestAborted);
                return;
            }
        }

        await next(context);
    }
}

/// <summary>Once per start, makes the storefront image sizes that don't exist yet (see <see cref="MediaStorage.CreateMissingVariantsAsync"/>).</summary>
public class MediaVariantWarmer(MediaStorage media, ILogger<MediaVariantWarmer> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let startup and the first requests go first.
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        var created = await Task.Run(() => media.CreateMissingVariantsAsync(stoppingToken), stoppingToken);
        if (created > 0) logger.LogInformation("Made {Count} missing image sizes", created);
    }
}
