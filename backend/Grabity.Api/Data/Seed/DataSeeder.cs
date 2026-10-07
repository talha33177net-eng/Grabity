using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;

namespace Grabity.Api.Data.Seed;

/// <summary>
/// Applies migrations and creates the data every store needs (roles, first admin, settings,
/// delivery/payment options, policy pages). Demo catalog data is optional (Seed:DemoData).
/// </summary>
public class DataSeeder(
    AppDbContext db,
    UserManager<AppUser> users,
    RoleManager<AppRole> roles,
    SettingsService settings,
    MediaStorage media,
    IConfiguration config,
    IWebHostEnvironment env,
    ILogger<DataSeeder> logger)
{
    public async Task SeedAsync()
    {
        if (config.GetValue("Database:MigrateOnStartup", true))
            await db.Database.MigrateAsync();

        foreach (var role in Roles.All)
            if (!await roles.RoleExistsAsync(role))
                await roles.CreateAsync(new AppRole(role));

        await SeedAdminAsync();

        if (!await db.Settings.AnyAsync()) await settings.SaveAsync(DefaultSettings());
        if (!await db.ShippingMethods.AnyAsync()) await SeedShippingAsync();
        if (!await db.PaymentMethods.AnyAsync()) await SeedPaymentsAsync();
        if (!await db.Pages.AnyAsync()) await SeedPagesAsync();

        if (config.GetValue("Seed:DemoData", false) && !await db.Products.AnyAsync())
        {
            logger.LogInformation("Seeding demo catalog...");
            // All or nothing: an interrupted run must not leave half a catalog behind for the next start to trip over.
            await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync();
                await new DemoCatalog(db, users, media, env, logger).SeedAsync();
                await transaction.CommitAsync();
            });
        }
    }

    private async Task SeedAdminAsync()
    {
        if ((await users.GetUsersInRoleAsync(Roles.Admin)).Count > 0) return;

        var email = config["Seed:AdminEmail"] ?? "admin@grabity.local";
        var password = config["Seed:AdminPassword"];
        var generated = string.IsNullOrWhiteSpace(password);
        if (generated) password = "Gr@" + Convert.ToHexString(RandomNumberGenerator.GetBytes(6));

        var admin = new AppUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FullName = config["Seed:AdminName"] ?? "Store Admin",
            CreatedAt = DateTime.UtcNow,
        };
        var result = await users.CreateAsync(admin, password!);
        if (!result.Succeeded)
            throw new InvalidOperationException("Could not create the admin user: " + string.Join(" ", result.Errors.Select(e => e.Description)));
        await users.AddToRoleAsync(admin, Roles.Admin);

        if (generated)
            logger.LogWarning("Created admin {Email} with generated password {Password}. Sign in and change it now.", email, password);
        else
            logger.LogInformation("Created admin user {Email}.", email);
    }

    private static StoreSettings DefaultSettings() => new()
    {
        General = new GeneralSettings
        {
            StoreName = "Grabity",
            Tagline = "Authentic gadgets, delivered fast",
            PrimaryColor = "#0ea5e9",
            AnnouncementText = "Free delivery inside Dhaka on orders over ৳10,000 · 100% authentic products",
        },
        Contact = new ContactSettings
        {
            Phone = "+880 1700-000000",
            Email = "support@grabity.com.bd",
            Address = "Level 4, Example Tower, Dhaka 1205, Bangladesh",
            WhatsAppNumber = "8801700000000",
            MessengerUsername = "grabity",
            BusinessHours = "Saturday – Thursday, 10am – 8pm",
        },
        Social = new SocialSettings
        {
            Facebook = "https://facebook.com/",
            Instagram = "https://instagram.com/",
            YouTube = "https://youtube.com/",
            TikTok = "https://tiktok.com/",
        },
        Seo = new SeoSettings
        {
            MetaTitle = "Grabity | Authentic Gadgets & Mobiles in Bangladesh",
            MetaDescription = "Shop authentic smartphones, earbuds, smartwatches, power banks and accessories at the best prices in Bangladesh with fast delivery and official warranty.",
        },
        Checkout = new CheckoutSettings
        {
            FreeShippingThreshold = 10000,
            AllowGuestCheckout = true,
            EnableWhatsAppOrdering = true,
            OrderSuccessMessage = "Thank you for shopping with Grabity! Our team will call you shortly to confirm your order.",
            LowStockThreshold = 5,
        },
        Features =
        [
            new() { Icon = "zap", Title = "Super Fast Delivery", Subtitle = "Inside Dhaka in 24 hours" },
            new() { Icon = "shield-check", Title = "100% Authentic Products", Subtitle = "Official & verified sources" },
            new() { Icon = "badge-percent", Title = "Best Price Deals", Subtitle = "Fair prices, every day" },
            new() { Icon = "wrench", Title = "After-Sales Service", Subtitle = "Warranty support you can trust" },
        ],
        Footer = new FooterSettings
        {
            AboutText = "Grabity brings you authentic gadgets, mobiles and accessories with honest prices, fast nationwide delivery and real after-sales support.",
            CopyrightText = "Grabity. All rights reserved.",
            ShowNewsletter = true,
        },
    };

    private async Task SeedShippingAsync()
    {
        db.ShippingMethods.AddRange(
            new ShippingMethod
            {
                Name = "Inside Dhaka City",
                Cost = 70,
                EstimatedDelivery = "1-2 days",
                Description = "Pay the bill in cash when you receive your products.",
                SortOrder = 1,
            },
            new ShippingMethod
            {
                Name = "Dhaka Sub Area",
                Cost = 120,
                EstimatedDelivery = "2-3 days",
                Description = "Savar, Gazipur, Keraniganj, Narayanganj and nearby areas.",
                SortOrder = 2,
            },
            new ShippingMethod
            {
                Name = "Outside Dhaka",
                Cost = 130,
                EstimatedDelivery = "3-5 days",
                Description = "Nationwide courier delivery. We may ask for a small advance for high-value items.",
                SortOrder = 3,
            },
            new ShippingMethod
            {
                Name = "Store Pick-Up",
                Cost = 0,
                IsPickup = true,
                FreeShippingEligible = false,
                EstimatedDelivery = "Same day",
                Description = "Collect your order from our store once we confirm it is ready.",
                SortOrder = 4,
            });
        await db.SaveChangesAsync();
    }

    private async Task SeedPaymentsAsync()
    {
        db.PaymentMethods.AddRange(
            new PaymentMethod
            {
                Code = "cod",
                Name = "Cash on Delivery",
                Type = PaymentMethodType.CashOnDelivery,
                Instructions = "Pay in cash when the delivery person hands over your order.",
                SortOrder = 1,
            },
            new PaymentMethod
            {
                Code = "bkash",
                Name = "bKash",
                Type = PaymentMethodType.MobileBanking,
                AccountNumber = "01700-000000 (Personal)",
                FeePercent = 1.5m,
                RequiresTransactionId = true,
                Instructions = "Send Money the total amount to our bKash number, then enter the Transaction ID (TrxID) below. Your order is confirmed once we verify the payment.",
                SortOrder = 2,
            },
            new PaymentMethod
            {
                Code = "nagad",
                Name = "Nagad",
                Type = PaymentMethodType.MobileBanking,
                AccountNumber = "01700-000000 (Personal)",
                FeePercent = 1.5m,
                RequiresTransactionId = true,
                Instructions = "Send Money the total amount to our Nagad number, then enter the Transaction ID below.",
                SortOrder = 3,
            },
            new PaymentMethod
            {
                Code = "bank",
                Name = "Bank Transfer",
                Type = PaymentMethodType.BankTransfer,
                Instructions = "Transfer to: Grabity Ltd., Account No. 0000000000000, Example Bank PLC, Gulshan Branch. Send the deposit slip to our WhatsApp.",
                IsActive = false,
                SortOrder = 4,
            });
        await db.SaveChangesAsync();
    }

    private async Task SeedPagesAsync()
    {
        db.Pages.AddRange(DefaultPages.All());
        await db.SaveChangesAsync();
    }
}
