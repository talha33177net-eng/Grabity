# Grabity

Online store for Grabity: a customer storefront plus an admin panel for running the business day to day.
Almost everything customers see (products, prices, banners, homepage sections, delivery charges, payment
options, policy pages, contact details, brand colour) is managed from the admin panel; nothing is hard-coded.

| Part | Stack |
| --- | --- |
| API + hosting | ASP.NET Core 10 (Web API), EF Core 10, ASP.NET Core Identity (cookie sign-in) |
| Database | Microsoft SQL Server (any edition, including Express) |
| Storefront + admin | React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, React Router |

In production a single ASP.NET Core app serves the API, the uploaded images and the built React app, so there
is only one thing to deploy.

## Project layout

```
Grabity.slnx
backend/Grabity.Api/        ASP.NET Core app
  Controllers/Store/        public API (catalog, cart pricing, checkout, accounts, reviews...)
  Controllers/Admin/        admin API (orders, products, customers, marketing, settings, reports)
  Domain/                   entities
  Data/                     DbContext, migrations, seeding (Data/Seed)
  Services/                 pricing, orders, product queries, media, SEO rendering...
  SeedData/media/           demo product/banner artwork (used only when demo data is enabled)
  uploads/                  uploaded images (created at runtime, not in git)
  App_Data/                 sign-in encryption keys (created at runtime, not in git)
  wwwroot/                  built storefront (output of `npm run build`, not in git)
frontend/                   React app (storefront at /, admin panel at /admin)
```

## Running it locally

Requirements: .NET 10 SDK, Node.js 20.19+ (or 22.12+), and a SQL Server instance.

1. **Database connection.** `backend/Grabity.Api/appsettings.json` points at the `TALHA` instance on the
   development PC:
   `Data Source=DESKTOP-TBC9DN6\TALHA;Initial Catalog=GrabityDb;Integrated Security=True;...`.
   On another machine, override `ConnectionStrings:Default` in `appsettings.Local.json` (e.g.
   `Server=.;Database=GrabityDb;Trusted_Connection=True;TrustServerCertificate=True` for the default
   instance). The database is created and migrated automatically on first start.

2. **Start the API** (http://localhost:5080):

   ```
   cd backend/Grabity.Api
   dotnet watch run --launch-profile http
   ```

   In Development it seeds a demo store (59 products, categories, brands, banners, blog posts, coupons,
   customers, orders and reviews) the first time it runs against an empty database.

3. **Start the frontend** (http://localhost:5173, proxies `/api` and `/uploads` to the API):

   ```
   cd frontend
   npm install
   npm run dev
   ```

4. Open http://localhost:5173 for the store and http://localhost:5173/admin for the admin panel.
   Development admin login: `admin@grabity.local` / `Admin@12345`
   (set in `appsettings.Development.json`). Demo customers use the password `Customer@123`.

API reference (Development only): http://localhost:5080/api/docs

**Starting over with fresh demo data:** stop the API, run `dotnet ef database drop --force` in
`backend/Grabity.Api` (install the tool once with `dotnet tool install --global dotnet-ef`), then start the
API again.

## Configuration

Settings are read from `appsettings.json`, then `appsettings.{Environment}.json`, then environment
variables, then `appsettings.Local.json` (optional, git-ignored, never published, meant for server secrets).

| Key | Default | Purpose |
| --- | --- | --- |
| `ConnectionStrings:Default` | local `GrabityDb` | SQL Server connection |
| `Database:MigrateOnStartup` | `true` | apply EF migrations when the app starts |
| `Seed:DemoData` | `false` (`true` in Development) | seed the demo store into an empty database |
| `Seed:AdminEmail` / `Seed:AdminName` | `admin@grabity.local` / `Store Admin` | first admin account |
| `Seed:AdminPassword` | not set | password for the first admin; if not set, a random one is generated and written to the log once |
| `Media:Root` | `uploads` | where uploaded images are stored; may be an absolute path outside the app folder |
| `Hosting:RedirectToHttps` | `false` | turn on when the app itself terminates HTTPS; leave off behind a proxy that already does |

Business settings (store name, logo, colours, contact numbers, WhatsApp/Messenger ordering, free-delivery
threshold, minimum order, SEO, Google Analytics / Facebook Pixel IDs, footer text) are **not** in these files;
they are edited in the admin panel under Store settings.

## Deploying to production

1. Build the storefront into the API's `wwwroot`:

   ```
   cd frontend
   npm ci
   npm run build
   ```

2. Publish the app:

   ```
   cd backend/Grabity.Api
   dotnet publish -c Release -o ../../publish
   ```

3. On the server (Windows + IIS with the ASP.NET Core 10 Hosting Bundle, or Linux behind Nginx/Caddy):
   - copy the `publish` folder to the site folder;
   - create `appsettings.Local.json` next to `Grabity.Api.dll` with the production connection string and
     `Seed:AdminPassword` (or set `ConnectionStrings__Default` etc. as environment variables);
   - give the app's user write access to the site folder (it creates `uploads/` and `App_Data/`);
   - serve it over HTTPS. IIS, or a reverse proxy on the same machine (Nginx/Caddy), works out of the box;
     a proxy on another machine must be added to the trusted proxies in `Program.cs`.

4. Start the site and sign in at `/admin`. Change the admin password from the account page
   (`/account/settings`).

**Back up** the database, the `uploads/` folder (all product and banner images) and `App_Data/` (without the
keys in it, everyone gets signed out). When redeploying, copy the new build over the old one without deleting
those folders, or set `Media:Root` to a folder outside the site. `uploads/.cache` (resized copies of the images)
can be left out of backups; missing sizes are made again in the background when the app starts.

### Speed

The site is built to load quickly on phones over mobile data:

- Each storefront page arrives with the data it starts with (settings, menu, homepage, product, category
  listing) already embedded, plus hints that start downloading its main image and page code straight away.
- Uploaded photos are stored as WebP, and the sizes the storefront shows are made at upload time, so no
  shopper waits for a resize. Images, scripts and styles are cached by browsers for a year.
- `npm run build` writes Brotli/gzip-compressed copies of the scripts and styles, plus `vite-manifest.json`;
  deploy them together with the rest of `wwwroot`.

For the best results when the site is live:

- **Host it close to your customers.** A server in Singapore or Mumbai is much closer to Bangladesh than one in
  Europe or the US, and every request crosses that distance.
- **Put Cloudflare (free plan) in front of it.** It has servers in Dhaka that keep copies of the images, scripts
  and styles, and it serves everything over HTTP/2 or HTTP/3. Keep its default caching; the site already marks
  what can be cached.
- **Upload good photos, not huge ones.** Anything up to 10 MB is accepted and shrunk automatically, but a clean
  1500–2000 px product photo on a plain background looks best and keeps uploads quick.

### First things to set up in the admin panel

1. **Store settings**: name, logo, favicon, brand colour, phone, WhatsApp number, address, social links,
   announcement bar, free-delivery threshold, SEO texts.
2. **Delivery**: zones and charges (Inside Dhaka, Dhaka sub-areas, Outside Dhaka, store pick-up).
3. **Payments**: Cash on Delivery, and your real bKash / Nagad numbers and fees.
4. **Categories, Brands, Products**: products have up to three options (e.g. Colour, Storage) with a
   price, stock and image per variant.
5. **Banners & popup** and **Homepage** sections.
6. **Pages**: review the policy pages (delivery, return, refund, warranty, privacy) for your business.
7. **Staff**: add Manager accounts for your team. Managers handle orders, products, customers and
   marketing; only Admins can manage staff, change store settings, reset customer passwords and delete
   orders.

## What's included

**Storefront**: homepage built from admin-managed sections; mega menu and mobile menu; search with
suggestions; category, brand, offer and search pages with filters (brand, price, stock) and sorting; product
pages with variants, gallery, specifications, FAQ, reviews and related products; WhatsApp/Messenger ordering;
cart drawer with free-delivery progress; one-page guest checkout with delivery zones, coupons, Cash on
Delivery and bKash/Nagad (customer enters the transaction ID); order tracking by order number + phone;
customer accounts with order history, saved address and reviews; blog and CMS pages; newsletter sign-up;
SEO tags, structured data and sitemap rendered by the server; mobile bottom navigation.

**Admin panel**: dashboard; orders (status workflow with stock handling, payment verification, notes,
courier/tracking code, printable invoice, manual orders for phone/Facebook sales, delivery history per phone
number to spot fake orders); products (variants, bulk actions, duplicate, rich-text descriptions, SEO);
categories and brands; customers; review moderation; coupons; banners and popup; homepage builder; blog and
pages; store, delivery and payment settings; staff roles; newsletter subscribers; sales reports (revenue,
profit when cost prices are entered, top products, breakdowns).

**Email** (Admin panel → Settings → Email): SMTP account (Gmail, Outlook, Zoho or any server; the password is
stored encrypted), test send, on/off switch per email type, previews and an email log. Emails go into an
outbox table (`EmailMessages`) and a background worker sends them, retrying failures (1 min → 3 h, 6 tries),
so checkout never waits on the mail server. Templates are Razor components in `Emails/Templates`.

| When | Who gets it |
| --- | --- |
| Order placed (website, or entered by staff) | Customer (if they gave an email); website orders also alert staff, plus a low-stock alert when an order takes a product to the low-stock level |
| Order confirmed / shipped / delivered / cancelled / returned | Customer. Sent 2 minutes later, and skipped if the status was changed back in the meantime |
| Payment verified or advance received / refunded | Customer |
| Account created, password changed or reset by staff | Customer |
| "Forgot password?" | Reset link valid for 2 hours (at most 3 requests per hour per account) |
| Newsletter subscription | Subscriber, with an unsubscribe link |
| Staff member added | The new staff member; new reviews waiting for approval alert staff |

Addresses at placeholder domains (example.com, *.local, *.test) are logged as skipped, not sent. Set the
**Website address** in Settings → Email in production so links and product images in emails point at the live site.

## Not included yet

- Online payment gateway (bKash checkout API, SSLCommerz): payments are verified manually from the
  transaction ID today.
- SMS notifications for order updates.
- Courier integration (Pathao, Steadfast, RedX): courier name and tracking code are entered by hand.
