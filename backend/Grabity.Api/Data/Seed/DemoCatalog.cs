using Microsoft.AspNetCore.Identity;

namespace Grabity.Api.Data.Seed;

/// <summary>
/// Sample store content for development and demos: categories, brands, products, banners,
/// homepage sections, blog posts, coupons, customers, orders and reviews.
/// Enabled with Seed:DemoData=true (development only by default).
/// </summary>
internal class DemoCatalog(AppDbContext db, UserManager<AppUser> users, MediaStorage media, IWebHostEnvironment env, ILogger logger)
{
    private const string MediaUrl = "/uploads/demo";
    private readonly Dictionary<string, Category> _categories = new();
    private readonly Dictionary<string, Brand> _brands = new();
    private readonly List<Product> _products = [];
    private readonly Random _random = new(2026);

    public async Task SeedAsync()
    {
        CopyMedia();
        SeedCategories();
        SeedBrands();
        await db.SaveChangesAsync();

        SeedProducts();
        await db.SaveChangesAsync();

        SeedBanners();
        SeedBlog();
        SeedCoupons();
        await db.SaveChangesAsync();

        SeedHomeSections();
        await db.SaveChangesAsync();

        await SeedCustomersAndOrdersAsync();
        await SeedReviewsAsync();
        logger.LogInformation("Demo catalog ready: {Products} products, {Categories} categories.", _products.Count, _categories.Count);
    }

    private static string Img(string path) => $"{MediaUrl}/{path}.svg";

    private void CopyMedia()
    {
        var source = Path.Combine(env.ContentRootPath, "SeedData", "media");
        if (!Directory.Exists(source))
        {
            logger.LogWarning("Demo media folder {Folder} not found; demo images will be missing.", source);
            return;
        }
        var target = Path.Combine(media.Root, "demo");
        foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
        {
            var destination = Path.Combine(target, Path.GetRelativePath(source, file));
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(file, destination, overwrite: true);
        }
    }

    // ---------------------------------------------------------------- categories & brands

    private void SeedCategories()
    {
        var order = 0;
        Category Cat(string name, string slug, string icon, Category? parent = null, bool featured = false, string? description = null)
        {
            var category = new Category
            {
                Name = name,
                Slug = slug,
                Icon = icon,
                Parent = parent,
                IsFeatured = featured,
                SortOrder = order++,
                ImageUrl = Img($"categories/{slug}"),
                Description = description,
                MetaDescription = description ?? $"Shop authentic {name.ToLowerInvariant()} at the best price in Bangladesh from Grabity.",
            };
            db.Categories.Add(category);
            _categories[slug] = category;
            return category;
        }

        var mobiles = Cat("Mobiles & Tablets", "mobiles-tablets", "smartphone", description: "Latest smartphones and tablets from Samsung, Apple, Xiaomi and more.");
        Cat("Smartphones", "smartphones", "smartphone", mobiles, true, "Flagship and budget smartphones with official warranty.");
        Cat("Tablets", "tablets", "tablet", mobiles, true);

        var audio = Cat("Audio", "audio", "headphones", description: "Earbuds, headphones, neckbands and speakers for every budget.");
        Cat("Earbuds", "earbuds", "headphones", audio, true, "True wireless earbuds with ANC, long battery life and clear calls.");
        Cat("Headphones", "headphones", "headphones", audio, true);
        Cat("Neckbands", "neckbands", "headphones", audio, true);
        Cat("Wired Earphones", "wired-earphones", "headphones", audio);
        Cat("Speakers", "speakers", "speaker", audio, true);

        var wearables = Cat("Wearables", "wearables", "watch", description: "Smart watches and fitness bands to keep you on track.");
        Cat("Smart Watches", "smart-watches", "watch", wearables, true);
        Cat("Fitness Bands", "fitness-bands", "activity", wearables);

        var power = Cat("Power & Charging", "power-charging", "battery-charging", description: "Power banks, chargers and cables built for fast, safe charging.");
        Cat("Power Banks", "power-banks", "battery-charging", power, true, "High-capacity power banks with fast charging — perfect for load-shedding.");
        Cat("Chargers & Adapters", "chargers-adapters", "plug-zap", power, true);
        Cat("Cables", "cables", "cable", power, true);
        Cat("Wireless Chargers", "wireless-chargers", "zap", power, true);

        var computer = Cat("Computer Accessories", "computer-accessories", "laptop", description: "Laptops, keyboards, mice and hubs for work and play.");
        Cat("Laptops", "laptops", "laptop", computer, true);
        Cat("Keyboards", "keyboards", "keyboard", computer);
        Cat("Mice", "mice", "mouse", computer);
        Cat("Hubs & Docks", "hubs-docks", "usb", computer, true);

        var gadgets = Cat("Smart Home & Gadgets", "smart-home-gadgets", "house", description: "Routers, trimmers, fans and clever everyday gadgets.");
        Cat("Smart Gadgets", "smart-gadgets", "sparkles", gadgets);
        Cat("Trimmers & Grooming", "trimmers", "scissors", gadgets, true);
        Cat("Rechargeable Fans", "rechargeable-fans", "fan", gadgets, true);
        Cat("Routers", "routers", "router", gadgets, true);

        var protection = Cat("Cases & Protection", "cases-protection", "shield");
        Cat("Phone Cases", "phone-cases", "shield", protection);
    }

    private void SeedBrands()
    {
        var order = 0;
        foreach (var (name, slug, logo, featured) in new[]
                 {
                     ("Apple", "apple", "apple", true), ("Samsung", "samsung", "samsung", true), ("Xiaomi", "xiaomi", "xiaomi", true),
                     ("Anker", "anker", "anker", true), ("Baseus", "baseus", "baseus", true), ("JBL", "jbl", "jbl", true),
                     ("QCY", "qcy", "qcy", true), ("Amazfit", "amazfit", "amazfit", true), ("Ugreen", "ugreen", "ugreen", true),
                     ("Haylou", "haylou", "haylou", true), ("Realme", "realme", "realme", true), ("OnePlus", "oneplus", "oneplus", true),
                     ("Sony", "sony", "sony", true), ("Logitech", "logitech", "logitech", true), ("TP-Link", "tp-link", "tplink", false),
                     ("Philips", "philips", "philips", false),
                 })
        {
            var brand = new Brand
            {
                Name = name,
                Slug = slug,
                LogoUrl = Img($"brands/{logo}"),
                IsFeatured = featured,
                SortOrder = order++,
                Description = $"Shop original {name} products in Bangladesh with warranty and fast delivery.",
            };
            db.Brands.Add(brand);
            _brands[slug] = brand;
        }
    }

    // ---------------------------------------------------------------- products

    private static readonly Dictionary<string, string> Intros = new()
    {
        ["smartphones"] = "The {0} combines a stunning display, all-day battery and a camera system that makes every shot look great. Fast, smooth and built to last, it is ready for gaming, streaming and everything in between.",
        ["tablets"] = "The {0} is a versatile tablet for study, work and entertainment, with a bright display, powerful chip and long battery life.",
        ["laptops"] = "The {0} is light enough to carry everywhere and powerful enough for serious work, with excellent battery life and a beautiful display.",
        ["earbuds"] = "Enjoy immersive sound wherever you go with the {0}. Active noise cancellation, clear calls and a pocket-friendly charging case make it a perfect everyday companion.",
        ["headphones"] = "The {0} delivers rich, detailed sound with comfortable cushions for long listening sessions and smart noise cancellation for focus anywhere.",
        ["neckbands"] = "The {0} is a comfortable, lightweight neckband with long battery life, magnetic earbuds and clear calls for your daily commute and workouts.",
        ["wired-earphones"] = "The {0} offers dependable wired sound with an in-line microphone and a tangle-resistant cable.",
        ["speakers"] = "Take the party anywhere with the {0}. Big sound, deep bass and a rugged, water-resistant design.",
        ["smart-watches"] = "The {0} tracks your health, workouts and sleep, and keeps you connected with notifications and calls on your wrist.",
        ["fitness-bands"] = "The {0} is a slim fitness band with heart-rate tracking, sleep monitoring and a battery that lasts for weeks.",
        ["power-banks"] = "Stay charged through long days and load-shedding with the {0}. High capacity, fast charging and multiple protections keep your devices safe.",
        ["chargers-adapters"] = "The {0} charges your phone, tablet and laptop faster with advanced GaN technology in a compact, travel-friendly design.",
        ["cables"] = "The {0} is a durable, fast-charging cable built to survive daily bending and travel.",
        ["wireless-chargers"] = "Drop your phone and go. The {0} offers safe, cable-free fast charging for Qi-compatible devices.",
        ["keyboards"] = "The {0} gives you a comfortable, quiet typing experience and connects easily to your computer, tablet or phone.",
        ["mice"] = "The {0} is precise, comfortable and reliable, made for long hours of work and browsing.",
        ["hubs-docks"] = "Expand your laptop's ports with the {0}: HDMI, USB, card readers and pass-through charging in one compact hub.",
        ["trimmers"] = "The {0} delivers a clean, precise trim with self-sharpening blades and a long-lasting rechargeable battery.",
        ["rechargeable-fans"] = "Beat the heat with the {0}, a portable rechargeable fan with multiple speeds that keeps running during power cuts.",
        ["routers"] = "The {0} delivers fast, stable Wi-Fi coverage for your home with easy setup from your phone.",
        ["smart-gadgets"] = "The {0} helps you keep track of your keys, bags and more with precise location finding.",
        ["phone-cases"] = "Protect your phone in style with the {0}: slim, shock-absorbing and fully compatible with wireless charging.",
    };

    private Product Add(string name, string category, string? brand, decimal price, decimal? compare, int stock, string image,
        string[] highlights, string? warranty = null, string? badge = null)
    {
        var product = new Product
        {
            Name = name,
            Slug = Slug.Create(name),
            Sku = $"GR-{1001 + _products.Count}",
            Category = _categories[category],
            Brand = brand is null ? null : _brands[brand],
            ShortDescription = "<ul>" + string.Concat(highlights.Select(h =>
            {
                var parts = h.Split('|');
                return $"<li><strong>{parts[0]}</strong> – {parts[1]}</li>";
            })) + "</ul>",
            Description = BuildDescription(name, category, highlights),
            WarrantyInfo = warranty,
            Badge = badge,
            Images = [new ProductImage { Url = Img($"products/{image}"), SortOrder = 0 }],
            Variants = [new ProductVariant { Price = price, CompareAtPrice = compare, StockQuantity = stock }],
            Tags = string.Join(", ", new[] { _categories[category].Name, brand }.Where(t => t is not null)),
            CreatedAt = DateTime.UtcNow.AddHours(-(_products.Count * 11) - 2),
            MetaDescription = $"Buy {name} at the best price in Bangladesh. 100% authentic with warranty and fast delivery from Grabity.",
        };
        product.Specifications =
        [
            new() { Name = "Brand", Value = product.Brand?.Name ?? "Generic" },
            new() { Name = "Model", Value = name },
        ];
        if (warranty is not null) product.Specifications.Add(new() { Name = "Warranty", Value = warranty });
        _products.Add(product);
        db.Products.Add(product);
        return product;
    }

    private static string BuildDescription(string name, string category, string[] highlights)
    {
        var intro = string.Format(Intros.GetValueOrDefault(category, "The {0} is a great pick for everyday use."), name);
        var features = string.Concat(highlights.Select(h =>
        {
            var parts = h.Split('|');
            return $"<li><strong>{parts[0]}:</strong> {parts[1]}</li>";
        }));
        return $"""
            <h2>{name}</h2>
            <p>{intro}</p>
            <h3>Key features</h3>
            <ul>{features}</ul>
            <h3>Why buy from Grabity?</h3>
            <p>Every product at Grabity is 100% authentic and sourced from official distributors or verified importers. Enjoy fast delivery across Bangladesh, cash on delivery and reliable after-sales support.</p>
            """;
    }

    private static ProductOption Opt(string name, params string[] values) => new() { Name = name, Values = values.ToList() };

    private static ProductVariant V(decimal price, decimal? compare, int stock, string? o1, string? o2 = null, string? image = null) => new()
    {
        Price = price,
        CompareAtPrice = compare,
        StockQuantity = stock,
        Option1 = o1,
        Option2 = o2,
        ImageUrl = image is null ? null : Img($"products/{image}"),
    };

    private static void Variants(Product product, ProductOption[] options, params ProductVariant[] variants)
    {
        product.Options = options.ToList();
        product.Variants = variants.ToList();
        var images = variants.Select(v => v.ImageUrl).OfType<string>().Distinct().ToList();
        if (images.Count > 0)
            product.Images = images.Select((url, i) => new ProductImage { Url = url, SortOrder = i }).ToList();
    }

    private static void Specs(Product product, params (string Name, string Value)[] specs)
    {
        var brand = product.Specifications.First();
        product.Specifications = [brand, .. specs.Select(s => new ProductSpecification { Name = s.Name, Value = s.Value })];
        if (product.WarrantyInfo is not null) product.Specifications.Add(new() { Name = "Warranty", Value = product.WarrantyInfo });
    }

    private static void Faqs(Product product, params (string Question, string Answer)[] faqs) =>
        product.Faqs = faqs.Select(f => new ProductFaq { Question = f.Question, Answer = f.Answer }).ToList();

    private void SeedProducts()
    {
        const string official = "1 Year Official Warranty";

        // ---- Smartphones
        var s25 = Add("Samsung Galaxy S25 Ultra 5G", "smartphones", "samsung", 154999, 159999, 0, "phone-black",
            ["6.9\" Dynamic AMOLED 2X|120Hz display with 2600 nits peak brightness", "Snapdragon 8 Elite|The fastest Galaxy chip yet",
             "200MP quad camera|Pro-grade zoom up to 100x", "Built-in S Pen|Note, sketch and edit on the go"], official, "Official Warranty");
        Variants(s25, [Opt("Color", "Titanium Black", "Titanium Silverblue", "Titanium Gray"), Opt("Storage", "12/256GB", "12/512GB")],
            V(154999, 159999, 6, "Titanium Black", "12/256GB", "phone-black"), V(174999, 179999, 3, "Titanium Black", "12/512GB", "phone-black"),
            V(154999, 159999, 4, "Titanium Silverblue", "12/256GB", "phone-blue"), V(174999, 179999, 0, "Titanium Silverblue", "12/512GB", "phone-blue"),
            V(154999, 159999, 5, "Titanium Gray", "12/256GB", "phone-silver"), V(174999, 179999, 2, "Titanium Gray", "12/512GB", "phone-silver"));
        Specs(s25, ("Display", "6.9 inch Dynamic AMOLED 2X, 120Hz, QHD+"), ("Processor", "Snapdragon 8 Elite for Galaxy"),
            ("Memory", "12GB RAM, 256GB / 512GB storage"), ("Main Camera", "200MP wide + 50MP ultra-wide + 50MP 5x + 10MP 3x"),
            ("Selfie Camera", "12MP"), ("Battery", "5000mAh, 45W wired, 15W wireless"), ("OS", "Android 15, One UI 7"),
            ("Other Features", "S Pen, IP68, Wi-Fi 7, Titanium frame"));
        Faqs(s25, ("Does the Galaxy S25 Ultra come with a charger?", "No, the box includes a USB-C cable only. We recommend a 45W PD charger for the fastest charging."),
            ("Is this the official Bangladesh variant?", "Yes. It comes with 1 year official Samsung Bangladesh warranty."));
        s25.IsFeatured = true;

        var iphone = Add("Apple iPhone 16 Pro", "smartphones", "apple", 139999, 144999, 0, "phone-black",
            ["A18 Pro chip|Console-level gaming and Apple Intelligence", "Camera Control|Quick access to camera tools",
             "48MP Fusion camera|4K 120fps Dolby Vision video", "Titanium design|Lighter and stronger"], "1 Year Apple Warranty");
        Variants(iphone, [Opt("Color", "Black Titanium", "Natural Titanium", "Desert Titanium"), Opt("Storage", "128GB", "256GB", "512GB")],
            V(139999, 144999, 4, "Black Titanium", "128GB", "phone-black"), V(154999, 159999, 3, "Black Titanium", "256GB", "phone-black"),
            V(179999, 184999, 1, "Black Titanium", "512GB", "phone-black"), V(139999, 144999, 2, "Natural Titanium", "128GB", "phone-silver"),
            V(154999, 159999, 5, "Natural Titanium", "256GB", "phone-silver"), V(179999, 184999, 0, "Natural Titanium", "512GB", "phone-silver"),
            V(139999, 144999, 3, "Desert Titanium", "128GB", "phone-gold"), V(154999, 159999, 2, "Desert Titanium", "256GB", "phone-gold"),
            V(179999, 184999, 1, "Desert Titanium", "512GB", "phone-gold"));
        Specs(iphone, ("Display", "6.3 inch Super Retina XDR OLED, ProMotion 120Hz"), ("Chip", "A18 Pro"),
            ("Main Camera", "48MP Fusion + 48MP Ultra Wide + 12MP 5x Telephoto"), ("Battery", "Up to 27 hours video playback"),
            ("Connector", "USB-C (USB 3)"), ("Other Features", "Camera Control, Action button, IP68"));
        iphone.IsFeatured = true;

        var note14 = Add("Xiaomi Redmi Note 14 Pro 5G", "smartphones", "xiaomi", 33999, 35999, 0, "phone-black",
            ["1.5K AMOLED display|120Hz with Gorilla Glass Victus 2", "200MP main camera|With OIS for sharp night shots",
             "45W HyperCharge|Full charge in about an hour", "IP68 rated|Dust and water resistant"], official, "Official Warranty");
        Variants(note14, [Opt("Color", "Midnight Black", "Ocean Blue", "Aurora Purple"), Opt("Storage", "8/256GB", "12/512GB")],
            V(33999, 35999, 12, "Midnight Black", "8/256GB", "phone-black"), V(38999, 40999, 6, "Midnight Black", "12/512GB", "phone-black"),
            V(33999, 35999, 9, "Ocean Blue", "8/256GB", "phone-blue"), V(38999, 40999, 4, "Ocean Blue", "12/512GB", "phone-blue"),
            V(33999, 35999, 7, "Aurora Purple", "8/256GB", "phone-purple"), V(38999, 40999, 3, "Aurora Purple", "12/512GB", "phone-purple"));
        Specs(note14, ("Display", "6.67 inch 1.5K AMOLED, 120Hz"), ("Processor", "MediaTek Dimensity 7300 Ultra"),
            ("Main Camera", "200MP OIS + 8MP ultra-wide + 2MP macro"), ("Battery", "5110mAh, 45W"), ("OS", "Android 14, HyperOS"));
        note14.IsFeatured = true;

        var realme = Add("Realme 14 Pro+ 5G", "smartphones", "realme", 45999, 47999, 0, "phone-silver",
            ["Cold-sensitive color change|Back panel shifts color in the cold", "50MP periscope camera|3x optical zoom",
             "80W charging|Fast top-ups in minutes", "6000mAh battery|Two days of normal use"], official, "Official Warranty");
        Variants(realme, [Opt("Color", "Pearl White", "Suede Grey")],
            V(45999, 47999, 8, "Pearl White", image: "phone-silver"), V(45999, 47999, 5, "Suede Grey", image: "phone-navy"));

        var nord = Add("OnePlus Nord 5", "smartphones", "oneplus", 49999, 52000, 0, "phone-teal",
            ["Snapdragon 8s Gen 3|Flagship-level performance", "144Hz AMOLED|Ultra smooth scrolling",
             "80W SUPERVOOC|Day's power in 15 minutes", "6800mAh battery|Big battery, slim design"], official);
        Variants(nord, [Opt("Color", "Dry Ice", "Marble Sands")],
            V(49999, 52000, 6, "Dry Ice", image: "phone-teal"), V(49999, 52000, 4, "Marble Sands", image: "phone-pink"));

        var a56 = Add("Samsung Galaxy A56 5G", "smartphones", "samsung", 44999, null, 0, "phone-black",
            ["6.7\" Super AMOLED|120Hz, 1900 nits", "Exynos 1580|Smooth everyday performance", "50MP OIS camera|Clear photos day and night",
             "6 years of updates|OS and security updates"], official, "Official Warranty");
        Variants(a56, [Opt("Color", "Awesome Graphite", "Awesome Pink"), Opt("Storage", "8/128GB", "8/256GB")],
            V(44999, null, 10, "Awesome Graphite", "8/128GB", "phone-black"), V(49999, null, 6, "Awesome Graphite", "8/256GB", "phone-black"),
            V(44999, null, 5, "Awesome Pink", "8/128GB", "phone-pink"), V(49999, null, 3, "Awesome Pink", "8/256GB", "phone-pink"));

        var poco = Add("Xiaomi Poco X7 Pro 5G", "smartphones", "xiaomi", 37999, null, 0, "phone-green",
            ["Dimensity 8400 Ultra|Built for gaming", "6550mAh battery|90W HyperCharge", "1.5K 120Hz display|3200 nits peak", "IP68|Dust and water resistant"],
            official, "Pre-order");
        poco.IsPreOrder = true;

        // ---- Tablets
        var ipadAir = Add("Apple iPad Air 11-inch M3", "tablets", "apple", 84999, 89999, 0, "tablet-graphite",
            ["Apple M3 chip|Desktop-class performance", "11\" Liquid Retina|True Tone and P3 wide color",
             "Apple Pencil Pro support|Draw and take notes", "All-day battery|Up to 10 hours"], "1 Year Apple Warranty");
        Variants(ipadAir, [Opt("Color", "Space Gray", "Blue"), Opt("Storage", "128GB Wi-Fi", "256GB Wi-Fi")],
            V(84999, 89999, 4, "Space Gray", "128GB Wi-Fi", "tablet-graphite"), V(99999, 104999, 2, "Space Gray", "256GB Wi-Fi", "tablet-graphite"),
            V(84999, 89999, 3, "Blue", "128GB Wi-Fi", "tablet-blue"), V(99999, 104999, 1, "Blue", "256GB Wi-Fi", "tablet-blue"));

        var ipadPro = Add("Apple iPad Pro 13-inch M4", "tablets", "apple", 199999, null, 2, "tablet-silver",
            ["Ultra Retina XDR|Tandem OLED display", "Apple M4|Outrageous performance", "Thinnest Apple product|Just 5.1mm", "Pro cameras|LiDAR and ProRes video"],
            "1 Year Apple Warranty");
        ipadPro.HidePrice = true;

        Add("Samsung Galaxy Tab S10 FE", "tablets", "samsung", 52999, 55999, 7, "tablet-graphite",
            ["10.9\" 90Hz display|Vision Booster for outdoor use", "S Pen included|Write and draw naturally", "IP68|Water and dust resistant",
             "8000mAh battery|45W fast charging"], official, "Official Warranty");
        Add("Xiaomi Pad 7", "tablets", "xiaomi", 38999, null, 9, "tablet-blue",
            ["11.2\" 3.2K display|144Hz, Dolby Vision", "Snapdragon 7+ Gen 3|Smooth multitasking", "8850mAh battery|45W charging",
             "Quad speakers|Dolby Atmos"], official);

        // ---- Laptops
        var macbook = Add("Apple MacBook Air 13-inch M4", "laptops", "apple", 149999, 154999, 0, "laptop-graphite",
            ["Apple M4 chip|10-core CPU and GPU", "Up to 18 hours battery|Work all day unplugged", "13.6\" Liquid Retina|500 nits brightness",
             "Silent fanless design|Just 1.24 kg"], "1 Year Apple Warranty");
        Variants(macbook, [Opt("Color", "Midnight", "Silver"), Opt("Memory", "16GB / 256GB", "16GB / 512GB")],
            V(149999, 154999, 3, "Midnight", "16GB / 256GB", "laptop-graphite"), V(174999, 179999, 2, "Midnight", "16GB / 512GB", "laptop-graphite"),
            V(149999, 154999, 4, "Silver", "16GB / 256GB", "laptop-silver"), V(174999, 179999, 1, "Silver", "16GB / 512GB", "laptop-silver"));
        Specs(macbook, ("Chip", "Apple M4, 10-core CPU, 8/10-core GPU"), ("Display", "13.6 inch Liquid Retina, 2560 x 1664"),
            ("Memory", "16GB unified memory"), ("Battery", "Up to 18 hours video playback"), ("Ports", "2x Thunderbolt 4, MagSafe 3, 3.5mm jack"),
            ("Weight", "1.24 kg"));
        macbook.IsFeatured = true;

        Add("Xiaomi RedmiBook 15", "laptops", "xiaomi", 64999, null, 0, "laptop-silver",
            ["Intel Core i5 11th Gen|Fast everyday performance", "15.6\" Full HD|Anti-glare display", "8GB RAM, 512GB SSD|Quick boot and load times",
             "Windows 11|Ready to use out of the box"], official);

        // ---- Earbuds
        var liberty = Add("Anker Soundcore Liberty 4 NC", "earbuds", "anker", 7999, 9500, 0, "earbuds-black",
            ["Adaptive ANC 2.0|Reduces noise by up to 98.5%", "LDAC Hi-Res audio|Rich, detailed sound", "50 hours playtime|With the charging case",
             "6 mics with AI|Crystal-clear calls"], "18 Months Official Warranty", "Official Warranty");
        Variants(liberty, [Opt("Color", "Black", "White", "Navy Blue")],
            V(7999, 9500, 14, "Black", image: "earbuds-black"), V(7999, 9500, 9, "White", image: "earbuds-white"), V(7999, 9500, 6, "Navy Blue", image: "earbuds-blue"));
        Specs(liberty, ("Bluetooth", "5.3, multipoint connection"), ("Noise Cancellation", "Adaptive ANC 2.0, up to 98.5%"), ("Driver", "11mm"),
            ("Battery", "10h (earbuds) / 50h (with case), 10 min = 4h"), ("Water Resistance", "IPX4"), ("Charging", "USB-C, wireless charging"));
        Faqs(liberty, ("Does it support wireless charging?", "Yes, the case supports Qi wireless charging as well as USB-C."),
            ("Can I connect it to two devices?", "Yes, multipoint lets you stay connected to your phone and laptop at the same time."));
        liberty.IsFeatured = true;

        var qcy = Add("QCY MeloBuds Pro ANC", "earbuds", "qcy", 3450, 3990, 0, "earbuds-black",
            ["46dB hybrid ANC|Block out traffic and chatter", "Hi-Res LDAC|Wireless audio at its best", "40 hours playtime|With charging case",
             "App support|Custom EQ and controls"], "6 Months Warranty");
        Variants(qcy, [Opt("Color", "Black", "White")], V(3450, 3990, 20, "Black", image: "earbuds-black"), V(3450, 3990, 11, "White", image: "earbuds-white"));

        Add("Samsung Galaxy Buds3 Pro", "earbuds", "samsung", 23999, 26999, 6, "earbuds-white",
            ["Intelligent ANC|Adapts to your surroundings", "2-way speakers|Rich bass and crisp highs", "Blade lights|Striking new design",
             "Galaxy AI interpreter|Real-time translation"], official, "Official Warranty");

        var airpods = Add("Apple AirPods Pro (2nd Generation) USB-C", "earbuds", "apple", 27500, 32000, 15, "earbuds-white",
            ["Active Noise Cancellation|Up to 2x more than before", "Adaptive Audio|Blends ANC and transparency", "Personalized Spatial Audio|Immersive sound",
             "USB-C MagSafe case|With speaker and lanyard loop"], "1 Year Apple Warranty");
        Specs(airpods, ("Chip", "Apple H2"), ("Battery", "Up to 6 hours (30 hours with case)"), ("Water Resistance", "IP54 (earbuds and case)"),
            ("Charging", "USB-C, MagSafe, Qi, Apple Watch charger"));
        airpods.IsFeatured = true;

        var haylou = Add("Haylou X1 2023", "earbuds", "haylou", 2190, 2500, 0, "earbuds-black",
            ["Bluetooth 5.3|Stable, low-latency connection", "ENC calls|Clear voice in busy places", "Game mode|65ms low latency", "24 hours playtime|With the case"],
            "6 Months Warranty");
        Variants(haylou, [Opt("Color", "Black", "White", "Green")],
            V(2190, 2500, 30, "Black", image: "earbuds-black"), V(2190, 2500, 18, "White", image: "earbuds-white"), V(2190, 2500, 4, "Green", image: "earbuds-green"));

        var redmiBuds = Add("Xiaomi Redmi Buds 6 Pro", "earbuds", "xiaomi", 6499, null, 0, "earbuds-black",
            ["55dB hybrid ANC|Deep noise cancellation", "Triple drivers|Coaxial design for clarity", "36 hours playtime|Fast charging", "Spatial audio|With head tracking"],
            official);
        Variants(redmiBuds, [Opt("Color", "Black", "Purple")], V(6499, null, 10, "Black", image: "earbuds-black"), V(6499, null, 7, "Purple", image: "earbuds-purple"));

        var wave = Add("JBL Wave Beam 2", "earbuds", "jbl", 6990, 7500, 0, "earbuds-blue",
            ["JBL Deep Bass|Signature punchy sound", "ANC with Smart Ambient|Hear what matters", "40 hours playtime|Speed charge", "IP54|Splash and dust proof"],
            "1 Year Warranty");
        Variants(wave, [Opt("Color", "Black", "Blue", "Purple")],
            V(6990, 7500, 8, "Black", image: "earbuds-black"), V(6990, 7500, 6, "Blue", image: "earbuds-blue"), V(6990, 7500, 5, "Purple", image: "earbuds-purple"));

        // ---- Headphones
        var sony = Add("Sony WH-1000XM5", "headphones", "sony", 41999, 46000, 0, "headphones-black",
            ["Industry-leading ANC|Two processors, eight mics", "30 hours battery|3 min charge = 3 hours", "Ultra comfortable|Lightweight soft-fit leather",
             "Crystal-clear calls|AI noise reduction"], "1 Year Warranty");
        Variants(sony, [Opt("Color", "Black", "Silver")], V(41999, 46000, 5, "Black", image: "headphones-black"), V(41999, 46000, 3, "Silver", image: "headphones-silver"));
        Specs(sony, ("Driver", "30mm"), ("Noise Cancellation", "Auto NC Optimizer, 8 microphones"), ("Battery", "Up to 30 hours (ANC on)"),
            ("Bluetooth", "5.2, LDAC, multipoint"), ("Weight", "250 g"));
        sony.IsFeatured = true;

        var q20i = Add("Anker Soundcore Q20i", "headphones", "anker", 4850, 5400, 0, "headphones-black",
            ["Hybrid ANC|Reduces noise by up to 90%", "40mm drivers|Big bass with BassUp", "60 hours playtime|ANC on 40 hours", "App EQ|22 presets"],
            "18 Months Warranty");
        Variants(q20i, [Opt("Color", "Black", "Blue")], V(4850, 5400, 12, "Black", image: "headphones-black"), V(4850, 5400, 7, "Blue", image: "headphones-navy"));

        var tune = Add("JBL Tune 770NC", "headphones", "jbl", 9990, null, 0, "headphones-navy",
            ["Adaptive Noise Cancelling|With Smart Ambient", "70 hours battery|Wireless freedom", "JBL Pure Bass|Powerful sound", "Foldable|Easy to carry"], "1 Year Warranty");
        Variants(tune, [Opt("Color", "Black", "Blue")], V(9990, null, 6, "Black", image: "headphones-black"), V(9990, null, 4, "Blue", image: "headphones-navy"));

        // ---- Neckbands & wired
        var realmeBuds = Add("Realme Buds Wireless 5 ANC", "neckbands", "realme", 2300, 2500, 0, "neckband-black",
            ["50dB ANC|Enjoy music without distractions", "38 hours playback|10 min charge = 20 hours", "13.6mm driver|Bass Boost+", "IP55|Sweat and water resistant"],
            "1 Year Official Warranty");
        Variants(realmeBuds, [Opt("Color", "Midnight Black", "Deep Sea Blue")],
            V(2300, 2500, 25, "Midnight Black", image: "neckband-black"), V(2300, 2500, 13, "Deep Sea Blue", image: "neckband-blue"));

        Add("OnePlus Bullets Wireless Z3", "neckbands", "oneplus", 2000, 2400, 19, "neckband-blue",
            ["12.4mm driver|Powerful bass", "36 hours playback|Fast charging", "AI call noise cancellation|Clear calls", "IP55|Workout ready"], official);

        var baseusWired = Add("Baseus Encok H19 Wired Earphone", "wired-earphones", "baseus", 590, null, 0, "earphones-black",
            ["6D stereo|Balanced, punchy sound", "In-line mic|Calls and music control", "3.5mm jack|Universal compatibility", "Tangle-resistant cable|Durable design"],
            "3 Months Warranty");
        Variants(baseusWired, [Opt("Color", "Black", "Red")], V(590, null, 40, "Black", image: "earphones-black"), V(590, null, 22, "Red", image: "earphones-red"));

        // ---- Speakers
        var flip = Add("JBL Flip 6 Portable Speaker", "speakers", "jbl", 12500, 13999, 0, "speaker-blue",
            ["Bold JBL Original Pro Sound|Racetrack woofer and tweeter", "IP67|Waterproof and dustproof", "12 hours playtime|Party all day",
             "PartyBoost|Pair multiple speakers"], "1 Year Warranty");
        Variants(flip, [Opt("Color", "Blue", "Red", "Teal", "Black")],
            V(12500, 13999, 6, "Blue", image: "speaker-blue"), V(12500, 13999, 4, "Red", image: "speaker-red"),
            V(12500, 13999, 3, "Teal", image: "speaker-teal"), V(12500, 13999, 8, "Black", image: "speaker-black"));
        Specs(flip, ("Output Power", "20W woofer + 10W tweeter"), ("Battery", "Up to 12 hours"), ("Water Resistance", "IP67"), ("Bluetooth", "5.1"));
        flip.IsFeatured = true;

        Add("Anker Soundcore Motion 300", "speakers", "anker", 8499, 9500, 9, "speaker-black",
            ["30W stereo sound|Hi-Res wireless audio", "SmartTune|Adjusts sound to placement", "13 hours playtime|USB-C charging", "IPX7|Fully waterproof"],
            "18 Months Warranty");
        Add("Xiaomi Mi Portable Bluetooth Speaker 16W", "speakers", "xiaomi", 3290, null, 14, "speaker-teal",
            ["16W stereo|Two full-range drivers", "IPX7|Waterproof", "13 hours playtime|2600mAh battery", "TWS pairing|Pair two speakers"], official);

        // ---- Wearables
        var active2 = Add("Amazfit Active 2", "smart-watches", "amazfit", 15999, 17999, 0, "watch-black",
            ["1.32\" AMOLED|2000 nits, sapphire glass option", "Offline maps & GPS|Dual-band accuracy", "160+ sport modes|Smart recovery tracking",
             "10 days battery|Bluetooth calls"], "1 Year Official Warranty", "Official Warranty");
        Variants(active2, [Opt("Color", "Black", "Cream")], V(15999, 17999, 9, "Black", image: "watch-black"), V(15999, 17999, 5, "Cream", image: "watch-cream"));
        Specs(active2, ("Display", "1.32 inch AMOLED, 2000 nits"), ("Battery", "Up to 10 days typical use"), ("Water Resistance", "5 ATM"),
            ("Sensors", "BioTracker 6.0 PPG, SpO2, GPS"), ("Compatibility", "Android 7.0+ and iOS 15.0+"));
        Faqs(active2, ("Can I take calls on the watch?", "Yes. Pair it with your phone over Bluetooth to answer and make calls from your wrist."),
            ("Is it waterproof?", "It is rated 5 ATM, so it is safe for swimming and showers, but not for diving."));
        active2.IsFeatured = true;

        var watch8 = Add("Samsung Galaxy Watch8 44mm", "smart-watches", "samsung", 32999, 35999, 0, "watch-black",
            ["Antioxidant Index|New health insights", "Bedtime guidance|Smarter sleep coaching", "Gemini on your wrist|Hands-free help", "Sapphire crystal|Tough and bright"],
            official, "Official Warranty");
        Variants(watch8, [Opt("Color", "Graphite", "Silver")], V(32999, 35999, 4, "Graphite", image: "watch-black"), V(32999, 35999, 3, "Silver", image: "watch-cream"));

        var rt3 = Add("Haylou Solar Plus RT3", "smart-watches", "haylou", 3990, 4500, 0, "watch-black",
            ["1.43\" AMOLED|Always-on display", "Bluetooth calling|Talk from your wrist", "100+ sport modes|Heart rate and SpO2", "10 days battery|Magnetic charging"],
            "1 Year Warranty");
        Variants(rt3, [Opt("Color", "Black", "Orange")], V(3990, 4500, 16, "Black", image: "watch-black"), V(3990, 4500, 8, "Orange", image: "watch-orange"));

        var aw10 = Add("Apple Watch Series 10 42mm GPS", "smart-watches", "apple", 49999, null, 0, "watch-black",
            ["Thinnest Apple Watch|Biggest display yet", "Sleep apnea notifications|Advanced health features", "Fast charging|80% in 30 minutes", "Water resistant 50m|Swim-proof"],
            "1 Year Apple Warranty");
        Variants(aw10, [Opt("Color", "Jet Black", "Rose Gold")], V(49999, null, 3, "Jet Black", image: "watch-black"), V(49999, null, 2, "Rose Gold", image: "watch-pink"));

        var band9 = Add("Xiaomi Smart Band 9", "fitness-bands", "xiaomi", 4499, 4999, 0, "band-black",
            ["1.62\" AMOLED|1200 nits brightness", "21 days battery|Charge once a fortnight", "150+ workout modes|Heart rate and SpO2", "5 ATM|Swim-proof"], official);
        Variants(band9, [Opt("Color", "Midnight Black", "Glacier Teal")], V(4499, 4999, 22, "Midnight Black", image: "band-black"), V(4499, 4999, 10, "Glacier Teal", image: "band-teal"));

        // ---- Power banks
        var powercore = Add("Anker PowerCore 20K 30W Power Bank (A1384)", "power-banks", "anker", 4200, 4800, 0, "powerbank-black",
            ["20000mAh|Charge your phone 4+ times", "30W USB-C PD|Fast charge phones and tablets", "Built-in USB-C cable|No cable to carry",
             "Smart display|See remaining battery at a glance"], "18 Months Official Warranty", "Official Warranty");
        Variants(powercore, [Opt("Color", "Black", "Blue")], V(4200, 4800, 18, "Black", image: "powerbank-black"), V(4200, 4800, 11, "Blue", image: "powerbank-blue"));
        Specs(powercore, ("Capacity", "20000mAh / 72Wh"), ("Output", "30W USB-C PD, 22.5W USB-A"), ("Input", "USB-C, 30W"), ("Weight", "395 g"));
        Faqs(powercore, ("Can it charge a laptop?", "It can charge small USB-C laptops and tablets that accept 30W, at a slower speed."),
            ("Is it allowed on flights?", "Yes. At 72Wh it is within the 100Wh airline limit for carry-on luggage."));
        powercore.IsFeatured = true;

        Add("Baseus Blade 20000mAh 100W Power Bank", "power-banks", "baseus", 7990, 8990, 4, "powerbank-black",
            ["100W output|Charges laptops at full speed", "Ultra-slim design|Fits in any bag", "Digital display|Real-time power info", "4 ports|Charge four devices at once"],
            "1 Year Warranty");

        var redmiPb = Add("Xiaomi Redmi Power Bank 20000mAh 18W", "power-banks", "xiaomi", 1990, 2200, 0, "powerbank-black",
            ["20000mAh|Multiple full charges", "18W fast charging|Two-way fast charge", "Dual output|Charge two devices", "12-layer protection|Safe charging"], official);
        Variants(redmiPb, [Opt("Color", "Black", "White")], V(1990, 2200, 35, "Black", image: "powerbank-black"), V(1990, 2200, 20, "White", image: "powerbank-white"));

        Add("Ugreen Nexode 25000mAh 145W Power Bank", "power-banks", "ugreen", 9500, null, 0, "powerbank-blue",
            ["145W total output|Charge a laptop and phone together", "25000mAh|Long-lasting power", "Smart display|Live wattage info", "Airline approved|Under 100Wh"],
            "1 Year Warranty");

        // ---- Chargers
        var nexode = Add("Ugreen Nexode 65W 3-Port GaN Charger", "chargers-adapters", "ugreen", 4590, 5200, 0, "charger-white",
            ["65W GaN II|Charge a laptop at full speed", "3 ports|2x USB-C + 1x USB-A", "Compact|Half the size of a standard charger", "Universal|PD, PPS and QC support"]);
        Variants(nexode, [Opt("Warranty", "6 Months", "1 Year"), Opt("Color", "White", "Black")],
            V(4590, 5200, 14, "6 Months", "White", "charger-white"), V(4590, 5200, 9, "6 Months", "Black", "charger-black"),
            V(4990, 5600, 8, "1 Year", "White", "charger-white"), V(4990, 5600, 5, "1 Year", "Black", "charger-black"));
        Specs(nexode, ("Output", "USB-C1/C2: 65W max, USB-A: 22.5W max"), ("Technology", "GaN II"), ("Input", "100-240V AC"), ("Plug", "BD/UK compatible"));
        nexode.IsFeatured = true;

        var nano = Add("Anker Nano 30W USB-C Charger", "chargers-adapters", "anker", 1850, 2100, 0, "charger-white",
            ["30W fast charging|iPhone 0-50% in 30 minutes", "Tiny design|Smaller than a matchbox", "PowerIQ 3.0|Safe, optimized charging", "Foldable pins|Travel friendly"],
            "18 Months Warranty");
        Variants(nano, [Opt("Color", "White", "Black")], V(1850, 2100, 26, "White", image: "charger-white"), V(1850, 2100, 15, "Black", image: "charger-black"));

        Add("Baseus GaN5 Pro 65W Charger", "chargers-adapters", "baseus", 3290, null, 12, "charger-black",
            ["65W GaN5|Fast and cool", "2C+1A ports|Charge three devices", "Free 100W cable|Included in the box", "Smart power allocation|Safe for every device"], "1 Year Warranty");

        // ---- Cables
        var powerline = Add("Anker PowerLine III USB-C to USB-C 100W Cable", "cables", "anker", 1290, null, 0, "cable-black",
            ["100W charging|Charge laptops at full speed", "Ultra durable|35,000+ bend lifespan", "480Mbps data|Fast file transfer", "Universal|USB-C devices"], "18 Months Warranty");
        Variants(powerline, [Opt("Length", "0.9m", "1.8m"), Opt("Color", "Black", "White")],
            V(1290, null, 30, "0.9m", "Black", "cable-black"), V(1290, null, 18, "0.9m", "White", "cable-white"),
            V(1490, null, 20, "1.8m", "Black", "cable-black"), V(1490, null, 12, "1.8m", "White", "cable-white"));
        Add("Baseus Crystal Shine USB-C to Lightning 20W Cable", "cables", "baseus", 690, 850, 45, "cable-white",
            ["20W PD fast charging|iPhone fast charge", "Braided nylon|Tangle free", "Aluminium shell|Durable connectors", "1.2m length|Comfortable reach"], "3 Months Warranty");
        Add("Ugreen USB-C Braided Cable 60W", "cables", "ugreen", 450, null, 60, "cable-orange",
            ["60W charging|Phones and tablets", "Braided|Built to last", "1m length|Everyday use", "Universal|USB-C devices"], "6 Months Warranty");

        // ---- Wireless chargers
        Add("Anker 313 Wireless Charger Pad", "wireless-chargers", "anker", 1490, 1700, 17, "wireless-black",
            ["10W fast wireless|Qi certified", "Case friendly|Works through 5mm cases", "Slim pad|Bedside friendly", "Safe charging|Temperature control"], "18 Months Warranty");
        Add("Baseus 15W Magnetic Wireless Charger", "wireless-chargers", "baseus", 1990, null, 10, "wireless-white",
            ["15W magnetic|Snap on and charge", "MagSafe compatible|iPhone 12 and newer", "Slim aluminium|Premium build", "USB-C input|Modern connectivity"], "1 Year Warranty");

        // ---- Computer accessories
        var mxKeys = Add("Logitech MX Keys S Wireless Keyboard", "keyboards", "logitech", 13500, null, 0, "keyboard-black",
            ["Spherically-dished keys|Comfortable, quiet typing", "Smart backlighting|Adapts to the room", "Multi-device|Switch between 3 devices", "Up to 10 days battery|USB-C rechargeable"],
            "1 Year Warranty");
        Variants(mxKeys, [Opt("Color", "Graphite", "Pale Grey")], V(13500, null, 5, "Graphite", image: "keyboard-black"), V(13500, null, 3, "Pale Grey", image: "keyboard-white"));
        Add("Logitech K380 Multi-Device Keyboard", "keyboards", "logitech", 3990, 4500, 13, "keyboard-white",
            ["Compact|Take it anywhere", "Easy-Switch|Three devices", "2 year battery|Never think about charging", "Quiet keys|Comfortable typing"], "1 Year Warranty");

        var master = Add("Logitech MX Master 3S", "mice", "logitech", 11999, 12999, 0, "mouse-black",
            ["8K DPI sensor|Tracks on any surface, even glass", "Quiet clicks|90% less click noise", "MagSpeed scroll|1000 lines per second", "USB-C fast charge|70 days per charge"],
            "1 Year Warranty");
        Variants(master, [Opt("Color", "Graphite", "Pale Grey")], V(11999, 12999, 7, "Graphite", image: "mouse-black"), V(11999, 12999, 4, "Pale Grey", image: "mouse-silver"));
        master.IsFeatured = true;
        Add("Logitech M331 Silent Plus Wireless Mouse", "mice", "logitech", 1650, null, 25, "mouse-black",
            ["90% less noise|Silent clicks", "Comfortable shape|Right-handed design", "24 months battery|One AA battery", "Plug and play|USB receiver"], "1 Year Warranty");
        Add("Ugreen 7-in-1 USB-C Hub", "hubs-docks", "ugreen", 3490, 3990, 15, "hub-silver",
            ["4K HDMI|Mirror or extend your screen", "100W PD pass-through|Charge while you work", "SD/TF readers|Import photos fast", "3x USB 3.0|5Gbps transfer"],
            "1 Year Warranty");
        Add("Anker 555 USB-C Hub 8-in-1", "hubs-docks", "anker", 5990, null, 8, "hub-graphite",
            ["4K@60Hz HDMI|Smooth external display", "Ethernet port|Stable wired internet", "100W pass-through|Power delivery", "8 ports|Everything you need"],
            "18 Months Warranty");

        // ---- Gadgets
        Add("Philips BT1230 Beard Trimmer", "trimmers", "philips", 1280, 1899, 21, "trimmer-black",
            ["Self-sharpening blades|Stainless steel", "10 length settings|0.5mm precision", "45 minutes runtime|Cordless use", "Washable head|Easy cleaning"], "2 Years Warranty");
        Add("Philips MG3911 7-in-1 Multigroom Trimmer", "trimmers", "philips", 2600, 2990, 11, "trimmer-navy",
            ["7 tools|Face, hair and body", "Self-sharpening blades|Always sharp", "60 minutes runtime|Cordless", "Skin-friendly|Rounded tips"], "2 Years Warranty");
        var fan = Add("Xiaomi Mijia Handheld Rechargeable Fan", "rechargeable-fans", "xiaomi", 1350, 1600, 0, "fan-teal",
            ["3 speed levels|Strong yet quiet breeze", "Up to 9 hours|Runs through load-shedding", "USB-C charging|Charge from any power bank", "Pocket size|Lightweight"],
            "6 Months Warranty");
        Variants(fan, [Opt("Color", "Teal", "Pink")], V(1350, 1600, 28, "Teal", image: "fan-teal"), V(1350, 1600, 19, "Pink", image: "fan-pink"));
        Add("TP-Link Archer C6 AC1200 Router", "routers", "tp-link", 3350, null, 16, "router-black",
            ["Dual band AC1200|Fast and stable Wi-Fi", "MU-MIMO|Serve multiple devices", "4 antennas|Wide coverage", "Easy setup|Tether app"], "1 Year Warranty");
        Add("Xiaomi Router AX3000T", "routers", "xiaomi", 4690, 4990, 10, "router-white",
            ["Wi-Fi 6 AX3000|Faster speeds, lower latency", "Mesh networking|Expand coverage easily", "Gigabit ports|Wired speed", "Smart app|Control from your phone"], official);
        var airtag = Add("Apple AirTag", "smart-gadgets", "apple", 3990, null, 0, "tag-white",
            ["Precision Finding|Find items nearby", "Find My network|Locate items worldwide", "Replaceable battery|Lasts over a year", "Water resistant|IP67"], "1 Year Apple Warranty");
        Variants(airtag, [Opt("Pack", "1 Pack", "4 Pack")], V(3990, null, 20, "1 Pack"), V(12990, 13990, 6, "4 Pack"));
        var caseP = Add("Baseus Magnetic Clear Case for iPhone 16 Pro", "phone-cases", "baseus", 990, 1290, 0, "case-blue",
            ["MagSafe magnets|Strong magnetic hold", "Anti-yellowing|Stays crystal clear", "Drop protection|Shock-absorbing corners", "Raised edges|Camera and screen protection"],
            "3 Months Warranty");
        Variants(caseP, [Opt("Color", "Blue", "Purple", "Black")],
            V(990, 1290, 24, "Blue", image: "case-blue"), V(990, 1290, 16, "Purple", image: "case-purple"), V(990, 1290, 30, "Black", image: "case-black"));

        foreach (var product in _products)
        {
            var i = 0;
            foreach (var variant in product.Variants)
            {
                variant.SortOrder = i++;
                variant.Sku = product.Variants.Count == 1 ? product.Sku : $"{product.Sku}-{i}";
                variant.CostPrice = Math.Round(variant.Price * 0.82m, 0);
            }
            ProductService.RecalculateAggregates(product);
        }
    }

    // ---------------------------------------------------------------- content

    private void SeedBanners()
    {
        db.Banners.AddRange(
            new Banner { Title = "Nova X Pro Series", ImageUrl = Img("banners/hero-nova"), LinkUrl = "/category/smartphones", Placement = BannerPlacement.HeroSlider, SortOrder = 1 },
            new Banner { Title = "Mega Audio Fest", ImageUrl = Img("banners/hero-audio"), LinkUrl = "/category/earbuds", Placement = BannerPlacement.HeroSlider, SortOrder = 2 },
            new Banner { Title = "Power Banks", ImageUrl = Img("banners/hero-3"), LinkUrl = "/category/power-banks", Placement = BannerPlacement.HeroSlider, SortOrder = 3 },
            new Banner { Title = "Smart Watches", ImageUrl = Img("banners/side-1"), LinkUrl = "/category/smart-watches", Placement = BannerPlacement.HeroSide, SortOrder = 1 },
            new Banner { Title = "GaN Chargers", ImageUrl = Img("banners/side-2"), LinkUrl = "/category/chargers-adapters", Placement = BannerPlacement.HeroSide, SortOrder = 2 },
            new Banner { Title = "Welcome offer", ImageUrl = Img("banners/popup-welcome"), LinkUrl = "/offers", Placement = BannerPlacement.Popup, SortOrder = 1 });
    }

    private void SeedBlog()
    {
        var now = DateTime.UtcNow;
        db.BlogPosts.AddRange(
            new BlogPost
            {
                Title = "ANC Earbuds Buying Guide: What Actually Matters",
                Slug = "anc-earbuds-buying-guide",
                Excerpt = "Noise cancellation, codecs, battery and fit — here is how to pick the right ANC earbuds for your budget.",
                CoverImageUrl = Img("blog/anc-earbuds-guide"),
                AuthorName = "Grabity Team",
                IsPublished = true,
                PublishedAt = now.AddDays(-3),
                Content = """
                    <p>Active noise cancellation (ANC) has moved from premium headphones into affordable earbuds. But not all ANC is equal. Here is what to look for.</p>
                    <h2>1. How much noise does it really cancel?</h2>
                    <p>Brands quote numbers like 40dB or 50dB. Higher is better, but fit matters just as much — always try the different ear tips in the box.</p>
                    <h2>2. Codecs and sound quality</h2>
                    <p>If you use an Android phone, LDAC or aptX Adaptive support gives noticeably richer sound. iPhone users get the best results with AAC.</p>
                    <h2>3. Battery life with ANC on</h2>
                    <p>Check the playtime <em>with ANC turned on</em>. Six to eight hours per charge is a good target.</p>
                    <h2>4. Call quality</h2>
                    <p>Look for earbuds with at least four microphones and AI noise reduction if you take a lot of calls on the move.</p>
                    <p>Browse our <a href="/category/earbuds">earbuds collection</a> to compare popular models side by side.</p>
                    """,
            },
            new BlogPost
            {
                Title = "How to Choose the Right Power Bank for Load-Shedding",
                Slug = "power-bank-buying-guide",
                Excerpt = "Capacity, output wattage and safety features explained in plain language.",
                CoverImageUrl = Img("blog/power-bank-buying-guide"),
                AuthorName = "Grabity Team",
                IsPublished = true,
                PublishedAt = now.AddDays(-10),
                Content = """
                    <p>A good power bank keeps your phone, router or fan running through power cuts. Here is how to choose one.</p>
                    <h2>Capacity</h2>
                    <p>10,000mAh charges most phones about twice. 20,000mAh is the sweet spot for load-shedding and travel.</p>
                    <h2>Output power</h2>
                    <p>For fast charging, look for 20W or more over USB-C PD. To charge a laptop you need 65W or higher.</p>
                    <h2>Safety</h2>
                    <p>Buy from trusted brands with over-charge, over-heat and short-circuit protection. Cheap unbranded power banks often overstate their capacity.</p>
                    """,
            },
            new BlogPost
            {
                Title = "7 Smartwatch Features Worth Paying For",
                Slug = "smartwatch-features-worth-paying-for",
                Excerpt = "From AMOLED screens to Bluetooth calling — the features that make a real difference every day.",
                CoverImageUrl = Img("blog/smartwatch-tips"),
                AuthorName = "Grabity Team",
                IsPublished = true,
                PublishedAt = now.AddDays(-18),
                Content = """
                    <p>Smartwatches range from ৳2,000 to well over ৳50,000. These are the features worth paying extra for:</p>
                    <ol>
                      <li><strong>AMOLED display</strong> — bright, sharp and readable outdoors.</li>
                      <li><strong>Accurate GPS</strong> — essential if you run or cycle.</li>
                      <li><strong>Bluetooth calling</strong> — take calls without reaching for your phone.</li>
                      <li><strong>Battery life</strong> — a week or more saves daily charging.</li>
                      <li><strong>Water resistance</strong> — 5 ATM means you can swim with it.</li>
                      <li><strong>Sleep tracking</strong> — useful insights into your rest.</li>
                      <li><strong>App ecosystem</strong> — check that it works well with your phone.</li>
                    </ol>
                    """,
            });
    }

    private void SeedCoupons()
    {
        db.Coupons.AddRange(
            new Coupon { Code = "WELCOME300", Description = "৳300 off your first order over ৳3,000", Type = DiscountType.FixedAmount, Value = 300, MinOrderAmount = 3000, UsageLimitPerCustomer = 1 },
            new Coupon { Code = "SAVE10", Description = "10% off orders over ৳5,000 (max ৳1,500)", Type = DiscountType.Percentage, Value = 10, MinOrderAmount = 5000, MaxDiscountAmount = 1500 },
            new Coupon { Code = "FREESHIP", Description = "Free delivery on orders over ৳2,000", Type = DiscountType.FreeShipping, MinOrderAmount = 2000 });
    }

    private void SeedHomeSections()
    {
        var order = 0;
        void Section(string title, string? subtitle, HomeSectionType type, HomeSectionConfig config) =>
            db.HomeSections.Add(new HomeSection { Title = title, Subtitle = subtitle, Type = type, Config = config, SortOrder = order++ });

        Section("Featured Categories", "Find what you need, faster", HomeSectionType.Categories, new HomeSectionConfig { Limit = 16 });
        Section("New Arrivals", "Fresh gadgets added this month", HomeSectionType.Products, new HomeSectionConfig { Source = ProductSource.Newest, Limit = 12 });
        Section("Top Picks", null, HomeSectionType.ProductTabs, new HomeSectionConfig
        {
            Tabs =
            [
                new HomeSectionTab { Title = "Featured", Source = ProductSource.Featured, Limit = 12 },
                new HomeSectionTab { Title = "Best Selling", Source = ProductSource.BestSelling, Limit = 12 },
                new HomeSectionTab { Title = "Hot Deals", Source = ProductSource.OnSale, Limit = 12 },
            ],
        });
        Section("Earbuds", "Freedom to listen", HomeSectionType.Products,
            new HomeSectionConfig { Source = ProductSource.Category, CategoryId = _categories["earbuds"].Id, Limit = 10 });
        Section("Special Offers", null, HomeSectionType.Banners, new HomeSectionConfig
        {
            Images =
            [
                new SectionImage { ImageUrl = Img("banners/mid-1"), LinkUrl = "/page/contact-us", Alt = "Exchange offer" },
                new SectionImage { ImageUrl = Img("banners/mid-desk"), LinkUrl = "/category/computer-accessories", Alt = "Desk setup essentials" },
            ],
        });
        Section("Smart Watches", "Smart tech on your wrist", HomeSectionType.Products,
            new HomeSectionConfig { Source = ProductSource.Category, CategoryId = _categories["wearables"].Id, Limit = 10 });
        Section("Power Banks", "Stay charged, stay unstoppable", HomeSectionType.Products,
            new HomeSectionConfig { Source = ProductSource.Category, CategoryId = _categories["power-banks"].Id, Limit = 10 });
        Section("Smartphones", "Flagships and best-value phones", HomeSectionType.Products,
            new HomeSectionConfig { Source = ProductSource.Category, CategoryId = _categories["smartphones"].Id, Limit = 10 });
        Section("Shop by Brands", null, HomeSectionType.Brands, new HomeSectionConfig { Limit = 14 });
        Section("Customer Reviews", "See what our customers are saying", HomeSectionType.Reviews, new HomeSectionConfig { Limit = 12 });
        Section("From Our Blog", "Reviews, tips and buying guides", HomeSectionType.Blog, new HomeSectionConfig { Limit = 3 });
        Section("Bangladesh's Trusted Gadget Store", null, HomeSectionType.RichText, new HomeSectionConfig
        {
            Html = """
                <p>Grabity is an online gadget shop in Bangladesh offering 100% authentic smartphones, earbuds, smartwatches, power banks, chargers and accessories from brands like Apple, Samsung, Xiaomi, Anker, JBL and more.</p>
                <p>Order online with cash on delivery or bKash, get fast delivery inside Dhaka and across the country, and enjoy official warranty support on eligible products.</p>
                """,
        });
    }

    // ---------------------------------------------------------------- customers, orders & reviews

    private async Task SeedCustomersAndOrdersAsync()
    {
        var customers = new List<AppUser>();
        foreach (var (name, phone, email, address) in new[]
                 {
                     ("Rahim Uddin", "01711000001", "rahim@example.com", "House 12, Road 5, Dhanmondi, Dhaka"),
                     ("Nusrat Jahan", "01811000002", "nusrat@example.com", "Flat 3B, Block C, Mirpur 10, Dhaka"),
                     ("Tanvir Ahmed", "01911000003", (string?)null, "Agrabad Commercial Area, Chattogram"),
                     ("Sadia Islam", "01611000004", "sadia@example.com", "Zindabazar, Sylhet"),
                 })
        {
            var user = new AppUser
            {
                UserName = phone,
                PhoneNumber = phone,
                Email = email,
                FullName = name,
                Address = address,
                CreatedAt = DateTime.UtcNow.AddDays(-_random.Next(5, 60)),
            };
            var result = await users.CreateAsync(user, "Customer@123");
            if (!result.Succeeded) continue;
            await users.AddToRoleAsync(user, Roles.Customer);
            customers.Add(user);
        }

        var guests = new[]
        {
            ("Arif Hossain", "01722000011", "Uttara Sector 7, Dhaka"), ("Farhana Akter", "01822000012", "Banani Road 11, Dhaka"),
            ("Mahmudul Hasan", "01922000013", "Shaheb Bazar, Rajshahi"), ("Sumaiya Rahman", "01522000014", "Khulna Sadar, Khulna"),
            ("Imran Kabir", "01622000015", "Mohammadpur, Dhaka"), ("Tasnim Chowdhury", "01722000016", "GEC Circle, Chattogram"),
            ("Rakib Hasan", "01822000017", "Savar, Dhaka"), ("Jannatul Ferdous", "01922000018", "Mymensingh Sadar"),
        };

        var shipping = await db.ShippingMethods.OrderBy(s => s.SortOrder).ToListAsync();
        var payments = await db.PaymentMethods.Where(p => p.IsActive).OrderBy(p => p.SortOrder).ToListAsync();
        var buyable = _products.Where(p => !p.HidePrice && !p.IsPreOrder).ToList();

        for (var i = 0; i < 36; i++)
        {
            var daysAgo = _random.Next(0, 30);
            var created = DateTime.UtcNow.AddDays(-daysAgo).AddHours(-_random.Next(0, 12)).AddMinutes(-_random.Next(0, 60));
            var useCustomer = _random.Next(3) == 0 && customers.Count > 0;
            var customer = useCustomer ? customers[_random.Next(customers.Count)] : null;
            var guest = guests[_random.Next(guests.Length)];
            var ship = shipping[_random.Next(Math.Min(3, shipping.Count))];
            var pay = _random.Next(4) == 0 ? payments.First(p => p.Code == "bkash") : payments.First(p => p.Code == "cod");

            var items = new List<OrderItem>();
            foreach (var product in Enumerable.Range(0, _random.Next(1, 4)).Select(_ => buyable[_random.Next(buyable.Count)]).Distinct())
            {
                var variant = product.Variants[_random.Next(product.Variants.Count)];
                var quantity = product.Price < 3000 ? _random.Next(1, 3) : 1;
                items.Add(new OrderItem
                {
                    ProductId = product.Id,
                    VariantId = variant.Id,
                    ProductName = product.Name,
                    ProductSlug = product.Slug,
                    VariantTitle = variant.Title,
                    Sku = variant.Sku,
                    ImageUrl = variant.ImageUrl ?? product.Images.FirstOrDefault()?.Url,
                    UnitPrice = variant.Price,
                    CostPrice = variant.CostPrice,
                    Quantity = quantity,
                    LineTotal = variant.Price * quantity,
                });
            }

            var subtotal = items.Sum(x => x.LineTotal);
            var shippingCost = subtotal >= 10000 && ship.FreeShippingEligible ? 0 : ship.Cost;
            var fee = pay.FeePercent > 0 ? Math.Ceiling((subtotal + shippingCost) * pay.FeePercent / 100m) : 0;
            var status = daysAgo switch
            {
                0 => _random.Next(2) == 0 ? OrderStatus.Pending : OrderStatus.Confirmed,
                1 => new[] { OrderStatus.Confirmed, OrderStatus.Processing, OrderStatus.Pending }[_random.Next(3)],
                <= 3 => new[] { OrderStatus.Processing, OrderStatus.Shipped, OrderStatus.Shipped }[_random.Next(3)],
                _ => _random.Next(10) switch { 0 => OrderStatus.Cancelled, 1 => OrderStatus.Returned, _ => OrderStatus.Delivered },
            };

            var order = new Order
            {
                UserId = customer?.Id,
                CustomerName = customer?.FullName ?? guest.Item1,
                Phone = customer?.PhoneNumber ?? guest.Item2,
                Email = customer?.Email,
                Address = customer?.Address ?? guest.Item3,
                ShippingMethodId = ship.Id,
                ShippingMethodName = ship.Name,
                ShippingCost = shippingCost,
                PaymentMethodCode = pay.Code,
                PaymentMethodName = pay.Name,
                PaymentFee = fee,
                Subtotal = subtotal,
                Total = subtotal + shippingCost + fee,
                Status = status,
                Source = _random.Next(5) == 0 ? OrderSource.Facebook : OrderSource.Website,
                CreatedAt = created,
                UpdatedAt = created,
                Items = items,
                StockDeducted = false,
            };
            if (pay.Code == "bkash")
            {
                order.TransactionId = "DEMO" + _random.Next(100000, 999999);
                order.PaymentStatus = status == OrderStatus.Pending ? PaymentStatus.Verifying : PaymentStatus.Paid;
            }
            if (status == OrderStatus.Delivered) order.PaymentStatus = PaymentStatus.Paid;
            if (order.PaymentStatus == PaymentStatus.Paid) order.PaidAmount = order.Total;

            var history = new List<OrderStatusHistory> { new() { Status = OrderStatus.Pending, Note = "Order placed", ChangedBy = order.CustomerName, CreatedAt = created } };
            var steps = status switch
            {
                OrderStatus.Confirmed => new[] { OrderStatus.Confirmed },
                OrderStatus.Processing => [OrderStatus.Confirmed, OrderStatus.Processing],
                OrderStatus.Shipped => [OrderStatus.Confirmed, OrderStatus.Processing, OrderStatus.Shipped],
                OrderStatus.Delivered => [OrderStatus.Confirmed, OrderStatus.Processing, OrderStatus.Shipped, OrderStatus.Delivered],
                OrderStatus.Cancelled => [OrderStatus.Cancelled],
                OrderStatus.Returned => [OrderStatus.Confirmed, OrderStatus.Shipped, OrderStatus.Delivered, OrderStatus.Returned],
                _ => [],
            };
            var at = created;
            foreach (var step in steps)
            {
                at = at.AddHours(_random.Next(3, 20));
                history.Add(new OrderStatusHistory
                {
                    Status = step,
                    Note = step == OrderStatus.Cancelled ? "Customer did not answer confirmation calls" : null,
                    ChangedBy = "Store Admin",
                    CreatedAt = at > DateTime.UtcNow ? DateTime.UtcNow : at,
                });
            }
            order.StatusHistory = history;
            if (status is OrderStatus.Shipped or OrderStatus.Delivered)
            {
                order.CourierName = _random.Next(2) == 0 ? "Steadfast" : "Pathao";
                order.TrackingCode = "TRK" + _random.Next(10000000, 99999999);
            }
            db.Orders.Add(order);

            if (!Order.IsClosedStatus(status))
                foreach (var item in items)
                    _products.First(p => p.Id == item.ProductId).SoldCount += item.Quantity;
        }

        await db.SaveChangesAsync();
    }

    private async Task SeedReviewsAsync()
    {
        var reviews = new (string Product, string Name, int Rating, string Comment, bool Featured)[]
        {
            ("Anker Soundcore Liberty 4 NC", "Rahim Uddin", 5, "The noise cancellation is amazing for the price. I use them on the bus every day and the traffic noise just disappears. Delivery was next day.", true),
            ("Anker Soundcore Liberty 4 NC", "Nusrat Jahan", 4, "Great sound and the app is easy to use. Case is a bit big but battery lasts forever.", false),
            ("Apple AirPods Pro (2nd Generation) USB-C", "Tanvir Ahmed", 5, "100% original, checked the serial on Apple's website. Packaging was perfect and the team called to confirm before delivery.", true),
            ("Sony WH-1000XM5", "Sadia Islam", 5, "Best headphones I have ever owned. Super comfortable for long work-from-home days.", true),
            ("JBL Flip 6 Portable Speaker", "Arif Hossain", 5, "Loud and clear, took it to Cox's Bazar and it survived sand and splashes. Highly recommended.", true),
            ("Anker PowerCore 20K 30W Power Bank (A1384)", "Farhana Akter", 5, "Life saver during load-shedding. Charges my phone four times and the built-in cable is so handy.", true),
            ("Amazfit Active 2", "Mahmudul Hasan", 4, "Battery easily lasts more than a week. GPS is accurate for my morning runs. Wish there were more watch faces.", true),
            ("Samsung Galaxy S25 Ultra 5G", "Imran Kabir", 5, "Official warranty unit, got it at a better price than other shops. The camera zoom is unreal.", true),
            ("Xiaomi Redmi Note 14 Pro 5G", "Sumaiya Rahman", 4, "Very good phone for the price. Display is bright and the battery lasts a full day of heavy use.", false),
            ("Ugreen Nexode 65W 3-Port GaN Charger", "Rakib Hasan", 5, "Charges my laptop and phone together. Small enough to carry in my pocket.", true),
            ("Logitech MX Master 3S", "Tasnim Chowdhury", 5, "Silent clicks and the scroll wheel is addictive. Perfect for long coding sessions.", true),
            ("Haylou X1 2023", "Jannatul Ferdous", 4, "For this price the sound is really good. Calls are clear too.", false),
            ("QCY MeloBuds Pro ANC", "Rahim Uddin", 4, "ANC works surprisingly well. Good value earbuds.", false),
            ("Xiaomi Mijia Handheld Rechargeable Fan", "Nusrat Jahan", 5, "Runs for hours during power cuts. My kids love the pink one!", true),
            ("Apple MacBook Air 13-inch M4", "Tanvir Ahmed", 5, "Fast, silent and the battery lasts all day. Smooth purchase experience with Grabity.", false),
            ("Realme Buds Wireless 5 ANC", "Arif Hossain", 4, "Good bass and comfortable for workouts.", false),
            ("Baseus Encok H19 Wired Earphone", "Farhana Akter", 3, "Decent sound for the price but the cable is a bit thin.", false),
            ("Xiaomi Smart Band 9", "Imran Kabir", 5, "Charged it once in three weeks. The display is beautiful.", false),
        };

        var now = DateTime.UtcNow;
        var index = 0;
        foreach (var r in reviews)
        {
            var product = _products.FirstOrDefault(p => p.Name == r.Product);
            if (product is null) continue;
            db.ProductReviews.Add(new ProductReview
            {
                ProductId = product.Id,
                CustomerName = r.Name,
                Rating = r.Rating,
                Comment = r.Comment,
                IsApproved = true,
                IsFeatured = r.Featured,
                IsVerifiedPurchase = true,
                CreatedAt = now.AddDays(-index * 2 - 1),
            });
            index++;
        }

        // A couple of reviews waiting for moderation.
        db.ProductReviews.Add(new ProductReview
        {
            ProductId = _products.First(p => p.Name.StartsWith("JBL Wave")).Id,
            CustomerName = "Shafiq Rahman",
            Rating = 4,
            Comment = "Nice bass, the blue colour looks great. Delivery took 3 days to Rajshahi.",
            CreatedAt = now.AddHours(-5),
        });
        db.ProductReviews.Add(new ProductReview
        {
            ProductId = _products.First(p => p.Name.StartsWith("Baseus Blade")).Id,
            CustomerName = "Nabila Haque",
            Rating = 5,
            Comment = "Charges my MacBook at full speed. Very slim!",
            CreatedAt = now.AddHours(-20),
        });
        await db.SaveChangesAsync();

        foreach (var productId in _products.Select(p => p.Id))
            await ProductService.RecalculateRatingAsync(db, productId, CancellationToken.None);
    }
}
