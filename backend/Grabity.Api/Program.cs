using System.IO.Compression;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Grabity.Api.Controllers.Admin;
using Grabity.Api.Data.Seed;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.ResponseCompression;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;
// Server-specific overrides (connection string, admin password...) that stay out of source control.
config.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(config.GetConnectionString("Default"), sql => sql.EnableRetryOnFailure(3)));

builder.Services
    .AddIdentity<AppUser, AppRole>(options =>
    {
        options.Password.RequiredLength = 6;
        options.Password.RequireDigit = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.User.RequireUniqueEmail = false; // email is optional for customers; uniqueness is checked in AuthController
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddClaimsPrincipalFactory<AppClaimsFactory>()
    .AddDefaultTokenProviders();

builder.Services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.FromMinutes(5));
// Password reset links in emails stop working after this long.
builder.Services.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = EmailNotifier.ResetLinkLifetime);

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "grabity.auth";
    options.Cookie.HttpOnly = true;
    // The SPA talks to the API on the same site, so Strict costs nothing and blocks cross-site request forgery.
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    options.ExpireTimeSpan = TimeSpan.FromDays(30);
    options.SlidingExpiration = true;
    options.Events.OnRedirectToLogin = ctx =>
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = ctx =>
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "App_Data", "keys")))
    .SetApplicationName("Grabity");

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<AppExceptionHandler>();
builder.Services.AddMemoryCache();
builder.Services.AddOpenApi();
builder.Services.AddResponseCompression(o =>
{
    o.EnableForHttps = true;
    o.Providers.Add<BrotliCompressionProvider>();
    o.Providers.Add<GzipCompressionProvider>();
    o.MimeTypes = ResponseCompressionDefaults.MimeTypes.Append("image/svg+xml");
});
// Pages and API responses are compressed per request; "Optimal" is noticeably smaller than the default "Fastest"
// for little extra CPU. Built scripts and styles are compressed ahead of time (PrecompressedAssetsMiddleware).
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Optimal);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Optimal);
builder.Services.Configure<ForwardedHeadersOptions>(o =>
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    static string ClientKey(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    options.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    options.AddPolicy("orders", ctx => RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    options.AddPolicy("forms", ctx => RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.AddSingleton<HtmlCleaner>();
builder.Services.AddSingleton<MediaStorage>();
builder.Services.AddHostedService<MediaVariantWarmer>();
builder.Services.AddSingleton<CatalogCache>();
builder.Services.AddSingleton<SpaRenderer>();
builder.Services.AddScoped<SettingsService>();
builder.Services.AddScoped<ProductQueries>();
builder.Services.AddScoped<ProductService>();
builder.Services.AddScoped<PricingService>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddScoped<HomeService>();
builder.Services.AddScoped<StorefrontService>();
builder.Services.AddScoped<DataSeeder>();

// Email: events queue rows in EmailMessages, EmailDispatcher sends them in the background.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<EmailSettingsService>();
builder.Services.AddScoped<EmailNotifier>();
builder.Services.AddScoped<EmailComposer>();
builder.Services.AddScoped<EmailRenderer>();
builder.Services.AddSingleton<NewsletterTokens>();
builder.Services.AddSingleton<EmailSignal>();
builder.Services.AddHostedService<EmailDispatcher>();

var app = builder.Build();

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    if (config.GetValue<bool>("Hosting:RedirectToHttps")) app.UseHttpsRedirection();
}
app.UseResponseCompression();

var media = app.Services.GetRequiredService<MediaStorage>();
app.UseMiddleware<ResizedImageMiddleware>();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = media.FileProvider,
    RequestPath = MediaStorage.RequestPath,
    // Uploads get a new random file name every time, so a URL's content never changes.
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable",
});
app.UseMiddleware<PrecompressedAssetsMiddleware>();
app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = new PrecompressedContentTypes(),
    // Vite fingerprints everything under /assets, so it can be cached forever.
    OnPrepareResponse = ctx =>
    {
        PrecompressedContentTypes.Apply(ctx);
        if (ctx.Context.Request.Path.StartsWithSegments("/assets"))
            ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
    },
});

app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference("/api/docs");
}
app.MapGet("/robots.txt", (SpaRenderer spa, HttpContext ctx) => spa.RobotsTxt(ctx));
app.MapGet("/sitemap.xml", (SpaRenderer spa, HttpContext ctx, CancellationToken ct) => spa.SitemapAsync(ctx, ct));
app.MapFallback("/api/{**path}", () => Results.Problem("Endpoint not found.", statusCode: StatusCodes.Status404NotFound));
app.MapFallback((SpaRenderer spa, HttpContext ctx, CancellationToken ct) => spa.RenderAsync(ctx, ct));

await using (var scope = app.Services.CreateAsyncScope())
{
    await scope.ServiceProvider.GetRequiredService<DataSeeder>().SeedAsync();
}

app.Run();
