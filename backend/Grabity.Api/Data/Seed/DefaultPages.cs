namespace Grabity.Api.Data.Seed;

/// <summary>Starter CMS pages. Store owners are expected to edit these from the admin panel.</summary>
internal static class DefaultPages
{
    public static IEnumerable<Page> All()
    {
        var order = 0;
        Page P(string title, string slug, FooterGroup group, string content) => new()
        {
            Title = title,
            Slug = slug,
            FooterGroup = group,
            SortOrder = order++,
            Content = content,
        };

        yield return P("About Us", "about-us", FooterGroup.About, """
            <h2>Gadgets you can trust, prices you'll love</h2>
            <p>Grabity is a Bangladeshi gadget store built on a simple promise: every product we sell is 100% authentic, fairly priced and backed by real after-sales support.</p>
            <p>From the latest smartphones and earbuds to power banks, chargers and smart home gadgets, we hand-pick products from trusted brands and official distributors so you never have to worry about fakes.</p>
            <h3>Why customers choose us</h3>
            <ul>
              <li><strong>Authentic products</strong> sourced from official distributors and verified importers.</li>
              <li><strong>Fast delivery</strong> inside Dhaka within 24 hours and nationwide in 3–5 days.</li>
              <li><strong>Cash on delivery</strong> everywhere, plus bKash and Nagad.</li>
              <li><strong>Warranty support</strong> handled by our own service team.</li>
            </ul>
            """);
        yield return P("Contact Us", "contact-us", FooterGroup.About, """
            <h2>We're here to help</h2>
            <p>Have a question about a product or an order? Reach us any way you like:</p>
            <ul>
              <li><strong>Phone:</strong> +880 1700-000000</li>
              <li><strong>WhatsApp:</strong> +880 1700-000000</li>
              <li><strong>Email:</strong> support@grabity.com.bd</li>
              <li><strong>Store:</strong> Level 4, Example Tower, Dhaka 1205</li>
            </ul>
            <p>Our team is available Saturday to Thursday, 10am to 8pm.</p>
            """);
        yield return P("Terms of Service", "terms-of-service", FooterGroup.About, """
            <h2>Terms of Service</h2>
            <p>By placing an order on Grabity you agree to these terms. Prices and availability may change without notice. We reserve the right to cancel orders that cannot be verified or that contain pricing errors; any advance payment will be refunded in full.</p>
            <p>Product images are for illustration. Specifications are provided by manufacturers and may vary slightly by batch or region.</p>
            """);

        yield return P("Delivery Policy", "delivery-policy", FooterGroup.Policy, """
            <h2>Delivery Policy</h2>
            <ul>
              <li><strong>Inside Dhaka:</strong> 1–2 working days, delivery charge ৳70.</li>
              <li><strong>Dhaka sub areas:</strong> 2–3 working days, delivery charge ৳120.</li>
              <li><strong>Outside Dhaka:</strong> 3–5 working days via courier, delivery charge ৳130.</li>
            </ul>
            <p>Delivery is free on orders over the free-delivery amount shown in your cart. Please check your parcel in front of the delivery person before paying.</p>
            """);
        yield return P("Return Policy", "return-policy", FooterGroup.Policy, """
            <h2>Return Policy</h2>
            <p>If you receive a damaged, defective or wrong product, contact us within <strong>3 days</strong> of delivery. The product must be unused, with the original box, accessories and invoice.</p>
            <p>Returns are not accepted for change of mind on opened products, or for products with physical or liquid damage.</p>
            """);
        yield return P("Refund Policy", "refund-policy", FooterGroup.Policy, """
            <h2>Refund Policy</h2>
            <p>Approved refunds are processed within <strong>7 working days</strong> to the original payment method (bKash/Nagad/bank). Cash on delivery refunds are sent by bKash or bank transfer.</p>
            """);
        yield return P("Warranty Policy", "warranty-policy", FooterGroup.Policy, """
            <h2>Warranty Policy</h2>
            <p>Warranty periods are shown on each product page. Warranty covers manufacturing defects only and does not cover physical damage, liquid damage, burn marks or unauthorised repairs.</p>
            <p>To claim warranty, bring the product with the invoice to our store or contact our support team.</p>
            """);
        yield return P("Privacy Policy", "privacy-policy", FooterGroup.Policy, """
            <h2>Privacy Policy</h2>
            <p>We collect your name, phone number, email and address only to process and deliver your orders and to provide support. We never sell your personal information. Payment details are handled by the payment provider and are not stored by us.</p>
            """);

        yield return P("How to Order", "how-to-order", FooterGroup.Help, """
            <h2>How to Order</h2>
            <ol>
              <li>Find the product you want and choose its options (color, storage, warranty).</li>
              <li>Click <strong>Add to cart</strong> or <strong>Buy now</strong>.</li>
              <li>At checkout, enter your name, phone number and delivery address.</li>
              <li>Choose a delivery area and a payment method, then place your order.</li>
              <li>Our team will call you to confirm. You can track your order any time from <a href="/track-order">Track Order</a>.</li>
            </ol>
            """);
        yield return P("Payment Methods", "payment-methods", FooterGroup.Help, """
            <h2>Payment Methods</h2>
            <ul>
              <li><strong>Cash on Delivery</strong> – pay when you receive your order.</li>
              <li><strong>bKash / Nagad</strong> – send money and enter your transaction ID at checkout.</li>
              <li><strong>Bank Transfer</strong> – available for corporate and high-value orders.</li>
            </ul>
            """);
        yield return P("FAQ", "faq", FooterGroup.Help, """
            <h2>Frequently Asked Questions</h2>
            <h3>Are your products original?</h3>
            <p>Yes. Every product is sourced from official distributors or verified importers.</p>
            <h3>Can I check the product before paying?</h3>
            <p>Yes. For cash on delivery orders you can check the parcel in front of the delivery person.</p>
            <h3>How long does delivery take?</h3>
            <p>1–2 days inside Dhaka and 3–5 days elsewhere in Bangladesh.</p>
            <h3>Do you offer warranty?</h3>
            <p>Yes. Warranty details are listed on every product page.</p>
            """);
    }
}
