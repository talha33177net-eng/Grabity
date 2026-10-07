using System.Text.Json;
using Grabity.Api.Domain;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Grabity.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser, AppRole, int>(options)
{
    public const string OrderNumberSequence = "OrderNumbers";

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductReview> ProductReviews => Set<ProductReview>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderStatusHistory> OrderStatusHistory => Set<OrderStatusHistory>();
    public DbSet<ShippingMethod> ShippingMethods => Set<ShippingMethod>();
    public DbSet<PaymentMethod> PaymentMethods => Set<PaymentMethod>();
    public DbSet<Coupon> Coupons => Set<Coupon>();
    public DbSet<Banner> Banners => Set<Banner>();
    public DbSet<HomeSection> HomeSections => Set<HomeSection>();
    public DbSet<BlogPost> BlogPosts => Set<BlogPost>();
    public DbSet<Page> Pages => Set<Page>();
    public DbSet<NewsletterSubscriber> NewsletterSubscribers => Set<NewsletterSubscriber>();
    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<EmailMessage> EmailMessages => Set<EmailMessage>();

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        builder.Properties<decimal>().HavePrecision(18, 2);
        builder.Properties<Enum>().HaveConversion<string>().HaveMaxLength(32);
        builder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.HasSequence<int>(OrderNumberSequence).StartsAt(100001).IncrementsBy(1);

        b.Entity<AppUser>(e =>
        {
            e.Property(u => u.FullName).HasMaxLength(150);
            e.Property(u => u.Address).HasMaxLength(500);
            e.Property(u => u.PhoneNumber).HasMaxLength(20);
            e.HasIndex(u => u.PhoneNumber).IsUnique().HasFilter("[PhoneNumber] IS NOT NULL");
        });

        b.Entity<Category>(e =>
        {
            e.Property(c => c.Name).HasMaxLength(150);
            e.Property(c => c.Slug).HasMaxLength(180);
            e.Property(c => c.Icon).HasMaxLength(50);
            e.Property(c => c.MetaTitle).HasMaxLength(200);
            e.Property(c => c.MetaDescription).HasMaxLength(500);
            e.HasIndex(c => c.Slug).IsUnique();
            e.HasOne(c => c.Parent).WithMany(c => c.Children).HasForeignKey(c => c.ParentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Brand>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(150);
            e.Property(x => x.Slug).HasMaxLength(180);
            e.Property(x => x.MetaTitle).HasMaxLength(200);
            e.Property(x => x.MetaDescription).HasMaxLength(500);
            e.HasIndex(x => x.Slug).IsUnique();
        });

        b.Entity<Product>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(300);
            e.Property(p => p.Slug).HasMaxLength(320);
            e.Property(p => p.Sku).HasMaxLength(100);
            e.Property(p => p.WarrantyInfo).HasMaxLength(300);
            e.Property(p => p.Badge).HasMaxLength(50);
            e.Property(p => p.VideoUrl).HasMaxLength(500);
            e.Property(p => p.Tags).HasMaxLength(1000);
            e.Property(p => p.MetaTitle).HasMaxLength(200);
            e.Property(p => p.MetaDescription).HasMaxLength(500);
            e.Property(p => p.RatingAverage).HasPrecision(3, 2);
            e.Property(p => p.Options).HasJsonConversion();
            e.Property(p => p.Specifications).HasJsonConversion();
            e.Property(p => p.Faqs).HasJsonConversion();
            e.HasIndex(p => p.Slug).IsUnique();
            e.HasIndex(p => p.Sku);
            e.HasIndex(p => new { p.IsActive, p.CategoryId });
            e.HasIndex(p => p.BrandId);
            e.HasIndex(p => p.Price);
            e.HasIndex(p => p.CreatedAt);
            e.HasOne(p => p.Category).WithMany().HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(p => p.Brand).WithMany().HasForeignKey(p => p.BrandId).OnDelete(DeleteBehavior.SetNull);
            e.HasMany(p => p.Images).WithOne().HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(p => p.Variants).WithOne(v => v.Product).HasForeignKey(v => v.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.Ignore(p => p.IsPurchasable);
            e.Ignore(p => p.InStock);
        });

        b.Entity<ProductImage>(e =>
        {
            e.Property(i => i.Url).HasMaxLength(500);
            e.Property(i => i.AltText).HasMaxLength(300);
        });

        b.Entity<ProductVariant>(e =>
        {
            e.Property(v => v.Option1).HasMaxLength(100);
            e.Property(v => v.Option2).HasMaxLength(100);
            e.Property(v => v.Option3).HasMaxLength(100);
            e.Property(v => v.Sku).HasMaxLength(100);
            e.Property(v => v.ImageUrl).HasMaxLength(500);
            e.Ignore(v => v.Title);
        });

        b.Entity<ProductReview>(e =>
        {
            e.Property(r => r.CustomerName).HasMaxLength(150);
            e.Property(r => r.Title).HasMaxLength(200);
            e.Property(r => r.Comment).HasMaxLength(4000);
            e.Property(r => r.AdminReply).HasMaxLength(4000);
            e.HasIndex(r => new { r.ProductId, r.IsApproved });
            e.HasOne(r => r.Product).WithMany().HasForeignKey(r => r.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(r => r.User).WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Order>(e =>
        {
            e.Property(o => o.OrderNumber).HasDefaultValueSql($"NEXT VALUE FOR {OrderNumberSequence}");
            e.HasIndex(o => o.OrderNumber).IsUnique();
            e.Property(o => o.CustomerName).HasMaxLength(150);
            e.Property(o => o.Phone).HasMaxLength(20);
            e.Property(o => o.Email).HasMaxLength(256);
            e.Property(o => o.Address).HasMaxLength(500);
            e.Property(o => o.ShippingMethodName).HasMaxLength(150);
            e.Property(o => o.PaymentMethodCode).HasMaxLength(50);
            e.Property(o => o.PaymentMethodName).HasMaxLength(150);
            e.Property(o => o.CouponCode).HasMaxLength(50);
            e.Property(o => o.TransactionId).HasMaxLength(100);
            e.Property(o => o.PaymentSenderNumber).HasMaxLength(20);
            e.Property(o => o.CustomerNote).HasMaxLength(1000);
            e.Property(o => o.AdminNote).HasMaxLength(2000);
            e.Property(o => o.CourierName).HasMaxLength(100);
            e.Property(o => o.TrackingCode).HasMaxLength(100);
            e.Property(o => o.IpAddress).HasMaxLength(64);
            e.Property(o => o.UserAgent).HasMaxLength(500);
            e.HasIndex(o => o.Phone);
            e.HasIndex(o => o.CreatedAt);
            e.HasIndex(o => new { o.Status, o.CreatedAt });
            e.HasOne(o => o.User).WithMany().HasForeignKey(o => o.UserId).OnDelete(DeleteBehavior.SetNull);
            e.HasMany(o => o.Items).WithOne().HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(o => o.StatusHistory).WithOne().HasForeignKey(h => h.OrderId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<OrderItem>(e =>
        {
            e.Property(i => i.ProductName).HasMaxLength(300);
            e.Property(i => i.ProductSlug).HasMaxLength(320);
            e.Property(i => i.VariantTitle).HasMaxLength(300);
            e.Property(i => i.Sku).HasMaxLength(100);
            e.Property(i => i.ImageUrl).HasMaxLength(500);
            e.HasIndex(i => i.ProductId);
        });

        b.Entity<OrderStatusHistory>(e =>
        {
            e.Property(h => h.Note).HasMaxLength(1000);
            e.Property(h => h.ChangedBy).HasMaxLength(150);
        });

        b.Entity<ShippingMethod>(e =>
        {
            e.Property(s => s.Name).HasMaxLength(150);
            e.Property(s => s.Description).HasMaxLength(1000);
            e.Property(s => s.EstimatedDelivery).HasMaxLength(100);
        });

        b.Entity<PaymentMethod>(e =>
        {
            e.Property(p => p.Code).HasMaxLength(50);
            e.Property(p => p.Name).HasMaxLength(150);
            e.Property(p => p.Instructions).HasMaxLength(2000);
            e.Property(p => p.AccountNumber).HasMaxLength(100);
            e.Property(p => p.LogoUrl).HasMaxLength(500);
            e.Property(p => p.FeePercent).HasPrecision(5, 2);
            e.HasIndex(p => p.Code).IsUnique();
        });

        b.Entity<Coupon>(e =>
        {
            e.Property(c => c.Code).HasMaxLength(50);
            e.Property(c => c.Description).HasMaxLength(300);
            e.HasIndex(c => c.Code).IsUnique();
        });

        b.Entity<Banner>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.ImageUrl).HasMaxLength(500);
            e.Property(x => x.MobileImageUrl).HasMaxLength(500);
            e.Property(x => x.LinkUrl).HasMaxLength(500);
            e.HasIndex(x => new { x.Placement, x.IsActive });
        });

        b.Entity<HomeSection>(e =>
        {
            e.Property(s => s.Title).HasMaxLength(200);
            e.Property(s => s.Subtitle).HasMaxLength(300);
            e.Property(s => s.Config).HasJsonConversion();
        });

        b.Entity<BlogPost>(e =>
        {
            e.Property(p => p.Title).HasMaxLength(300);
            e.Property(p => p.Slug).HasMaxLength(320);
            e.Property(p => p.Excerpt).HasMaxLength(1000);
            e.Property(p => p.CoverImageUrl).HasMaxLength(500);
            e.Property(p => p.AuthorName).HasMaxLength(150);
            e.Property(p => p.MetaTitle).HasMaxLength(200);
            e.Property(p => p.MetaDescription).HasMaxLength(500);
            e.HasIndex(p => p.Slug).IsUnique();
            e.HasIndex(p => new { p.IsPublished, p.PublishedAt });
        });

        b.Entity<Page>(e =>
        {
            e.Property(p => p.Title).HasMaxLength(200);
            e.Property(p => p.Slug).HasMaxLength(220);
            e.Property(p => p.MetaTitle).HasMaxLength(200);
            e.Property(p => p.MetaDescription).HasMaxLength(500);
            e.HasIndex(p => p.Slug).IsUnique();
        });

        b.Entity<NewsletterSubscriber>(e =>
        {
            e.Property(n => n.Email).HasMaxLength(256);
            e.HasIndex(n => n.Email).IsUnique();
        });

        b.Entity<Setting>(e =>
        {
            e.HasKey(s => s.Key);
            e.Property(s => s.Key).HasMaxLength(100);
        });

        b.Entity<EmailMessage>(e =>
        {
            e.Property(m => m.ToAddress).HasMaxLength(256);
            e.Property(m => m.ToName).HasMaxLength(150);
            e.Property(m => m.Subject).HasMaxLength(300);
            e.Property(m => m.DedupeKey).HasMaxLength(200);
            e.Property(m => m.LastError).HasMaxLength(1000);
            e.Property(m => m.Data).HasJsonConversion();
            e.HasIndex(m => new { m.Status, m.NextAttemptAt });
            e.HasIndex(m => m.DedupeKey);
            e.HasIndex(m => m.CreatedAt);
            e.HasIndex(m => m.UserId);
            // The log outlives deleted test orders; the link is just cleared.
            e.HasOne(m => m.Order).WithMany().HasForeignKey(m => m.OrderId).OnDelete(DeleteBehavior.SetNull);
        });
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampTimestamps();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        StampTimestamps();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void StampTimestamps()
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<ITimestamped>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedAt == default) entry.Entity.CreatedAt = now;
                entry.Entity.UpdatedAt = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }
    }
}

internal static class JsonColumnExtensions
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static PropertyBuilder<T> HasJsonConversion<T>(this PropertyBuilder<T> property) where T : class, new()
    {
        property.HasConversion(
            v => Serialize(v),
            v => Deserialize<T>(v),
            new ValueComparer<T>(
                (a, b) => Serialize(a) == Serialize(b),
                v => Serialize(v).GetHashCode(),
                v => Deserialize<T>(Serialize(v))));
        property.HasColumnType("nvarchar(max)");
        return property;
    }

    private static string Serialize<T>(T? value) => JsonSerializer.Serialize(value, Options);

    private static T Deserialize<T>(string? json) where T : class, new() =>
        string.IsNullOrWhiteSpace(json) ? new T() : JsonSerializer.Deserialize<T>(json, Options) ?? new T();
}

/// <summary>
/// Timestamps are always stored in UTC. SQL Server hands them back without a kind, so mark them as UTC
/// on read; the API then serializes them with a trailing "Z" and browsers show the right local time.
/// </summary>
internal sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v,
    v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
