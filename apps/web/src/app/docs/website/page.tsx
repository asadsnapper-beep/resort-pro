import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'website-overview',         label: '1. Your free public website' },
  { id: 'customising-homepage',     label: '2. Customising your homepage' },
  { id: 'room-listings',            label: '3. Setting up room listings' },
  { id: 'gallery-testimonials',     label: '4. Gallery and testimonials' },
  { id: 'contact-and-map',          label: '5. Contact information and map' },
  { id: 'custom-domain',            label: '6. Connecting a custom domain' },
  { id: 'faq',                      label: '7. FAQ' },
];

export default function WebsitePage() {
  return (
    <DocLayout
      title="Your Public Website"
      description="Build a beautiful, professional website for your resort — with a live booking form, room gallery, and direct reservations — no coding needed."
      readTime="7 min read"
      tag="Website"
      tagColor="bg-indigo-100 text-indigo-700"
      toc={TOC}
    >

      {/* ── 1. Overview ───────────────────────────────────────────────── */}
      <h2 id="website-overview">1. Your free public website</h2>
      <p>
        Every ResortPro account includes a <strong>free, fully hosted public website</strong> for your
        property. This is not just a simple page — it's a complete multi-section website with your
        branding, room listings, photo gallery, a live booking form, and more.
      </p>
      <p>
        The website works on all devices (phones, tablets, and desktops) and is automatically
        optimised for search engines (SEO) so guests can find you on Google.
      </p>
      <p>Your website includes these sections by default:</p>
      <ul>
        <li>Hero section with a full-width image and booking form</li>
        <li>About section with your story and highlights</li>
        <li>Room listings with photos, amenities, and "Book Now" buttons</li>
        <li>Photo gallery</li>
        <li>Guest testimonials</li>
        <li>Contact information with map</li>
        <li>Footer with links and social media</li>
      </ul>
      <div className="info-box">
        <strong>How to access:</strong> Go to <strong>Website</strong> in the sidebar to edit your website.
        Click <strong>"Preview"</strong> to see how it looks before publishing. Click <strong>"Publish"</strong>
        to make changes live.
      </div>

      {/* ── 2. Customising homepage ───────────────────────────────────── */}
      <h2 id="customising-homepage">2. Customising your homepage</h2>
      <p>
        The homepage is the first thing guests see. Make it count by setting a beautiful hero image
        and a clear, welcoming message.
      </p>

      <h3>Setting the hero image and tagline</h3>
      <ol>
        <li>Go to <strong>Website → Homepage</strong>.</li>
        <li>Click <strong>"Change Hero Image"</strong> and upload a high-quality landscape photo of your property (minimum 1920 × 1080 px recommended).</li>
        <li>Enter your <strong>Main Headline</strong> — a short, welcoming phrase. Example: "Your Perfect Escape in the Hills of Sylhet".</li>
        <li>Enter a <strong>Sub-headline</strong> — one sentence about your property. Example: "A family-run eco-resort with stunning valley views and farm-to-table dining."</li>
        <li>The booking form on the hero section is automatic — it lets guests pick dates and search for available rooms.</li>
      </ol>

      <h3>The About section</h3>
      <ol>
        <li>Click the <strong>About</strong> tab in the Website editor.</li>
        <li>Write 2–4 paragraphs about your property — your story, what makes you special, location highlights.</li>
        <li>Upload a secondary photo (family photo, owner photo, or property overview).</li>
        <li>Add up to 4 <strong>highlight badges</strong> (e.g. "Est. 2010", "Eco-Certified", "Pool Available", "Free Parking").</li>
      </ol>

      <h3>Colour scheme and fonts</h3>
      <p>
        Go to <strong>Website → Branding</strong> to set your brand colours and fonts. Changes apply
        across your entire website instantly. This syncs with the branding you set in
        <strong> Settings → Branding</strong>.
      </p>

      {/* ── 3. Room listings ──────────────────────────────────────────── */}
      <h2 id="room-listings">3. Setting up room listings on the website</h2>
      <p>
        Rooms you add in the <strong>Rooms</strong> module are automatically available to show on
        your website. However, you control which rooms appear publicly.
      </p>

      <h3>How to publish rooms to your website</h3>
      <ol>
        <li>Go to <strong>Website → Rooms</strong>.</li>
        <li>You'll see all your rooms listed. Toggle the <strong>"Show on Website"</strong> switch for each room you want to display publicly.</li>
        <li>Drag rooms up or down to set the display order.</li>
        <li>Click <strong>Publish</strong> to save changes.</li>
      </ol>
      <p>
        Each room listing on the website shows: room name, type, capacity, amenities, photo gallery,
        description, and a <strong>"Book Now"</strong> button that opens the booking widget for that room.
      </p>
      <blockquote>
        <strong>Note:</strong> Rooms with <strong>Out of Order</strong> or <strong>Maintenance</strong> status
        are automatically hidden from your website even if they're toggled on.
      </blockquote>

      {/* ── 4. Gallery and testimonials ───────────────────────────────── */}
      <h2 id="gallery-testimonials">4. Gallery and testimonials</h2>

      <h3>Photo gallery</h3>
      <p>
        A well-curated gallery increases booking conversions significantly. To manage your gallery:
      </p>
      <ol>
        <li>Go to <strong>Website → Gallery</strong>.</li>
        <li>Upload photos by dragging and dropping them onto the upload area.</li>
        <li>You can upload up to 50 photos for the gallery (separate from room photos).</li>
        <li>Add captions to each photo (e.g. "Pool deck at sunset", "Chef's garden").</li>
        <li>Drag to reorder. Click the × to remove a photo.</li>
        <li>Click <strong>Publish</strong>.</li>
      </ol>
      <div className="info-box">
        <strong>Photo tips:</strong> Include a mix of exteriors, rooms, restaurant, pool, and activities.
        Landscape orientation (wider than tall) works best. Hire a photographer for a half-day —
        it is one of the best investments you can make for your property.
      </div>

      <h3>Guest testimonials</h3>
      <ol>
        <li>Go to <strong>Website → Testimonials</strong>.</li>
        <li>Click <strong>"Add Testimonial"</strong>.</li>
        <li>Enter the guest's name, their location (city/country), their review text, and a star rating (1–5).</li>
        <li>Optionally add the guest's photo (with their permission).</li>
        <li>Click <strong>Save</strong>.</li>
      </ol>
      <p>
        Testimonials appear in a scrolling carousel on your homepage. Aim for at least 5–8 testimonials
        to make this section feel credible.
      </p>

      {/* ── 5. Contact and map ────────────────────────────────────────── */}
      <h2 id="contact-and-map">5. Contact information and map</h2>
      <ol>
        <li>Go to <strong>Website → Contact</strong>.</li>
        <li>Enter your property's full address, phone number, email, and WhatsApp number.</li>
        <li>Paste your Google Maps embed URL (get this from Google Maps → Share → Embed a map → Copy HTML and extract just the src URL).</li>
        <li>Add your check-in and check-out times.</li>
        <li>Add directions from the nearest landmark or airport.</li>
        <li>Click <strong>Publish</strong>.</li>
      </ol>
      <p>
        The contact section also shows clickable links for phone calls and WhatsApp chats — perfect
        for mobile visitors.
      </p>

      {/* ── 6. Custom domain ──────────────────────────────────────────── */}
      <h2 id="custom-domain">6. Connecting a custom domain</h2>
      <p>
        By default, your website is available at a resortpro.app subdomain (e.g. <code>yourresort.resortpro.app</code>).
        You can connect your own custom domain (e.g. <code>www.yourresort.com</code>) for a more
        professional appearance.
      </p>

      <h3>Steps to connect your domain</h3>
      <ol>
        <li>Purchase your domain from a domain registrar (GoDaddy, Namecheap, Google Domains, etc.) if you don't already own one.</li>
        <li>Go to <strong>Website → Custom Domain</strong> in ResortPro.</li>
        <li>Enter your domain name (e.g. <code>www.yourresort.com</code>) and click <strong>Connect</strong>.</li>
        <li>ResortPro will show you a set of DNS records to add (CNAME and A records).</li>
        <li>Log in to your domain registrar and add those DNS records in the DNS settings.</li>
        <li>Come back to ResortPro and click <strong>"Verify DNS"</strong>. DNS changes can take up to 48 hours to propagate globally.</li>
        <li>Once verified, your website will be live at your custom domain with a free SSL certificate (HTTPS) enabled automatically.</li>
      </ol>
      <blockquote>
        <strong>Note:</strong> Custom domain support is available on the Standard plan and above.
        If you're on the Starter plan, your site will be on the resortpro.app subdomain.
      </blockquote>

      {/* ── 7. FAQ ───────────────────────────────────────────────────── */}
      <h2 id="faq">7. Frequently asked questions</h2>

      <h3>Do I need any coding skills to build my website?</h3>
      <p>
        None at all. The website builder is entirely visual — point, click, type, and upload.
        No HTML, CSS, or technical knowledge required.
      </p>

      <h3>Does the website booking form work in real time?</h3>
      <p>
        Yes. The booking form on your website checks live availability in ResortPro. Guests can only
        select dates when rooms are actually available.
      </p>

      <h3>Can guests pay through the website?</h3>
      <p>
        Yes, if you have a payment gateway connected (Stripe, bKash, SSLCommerz). Set this up under
        <strong> Settings → Payment Gateways</strong>. Without a gateway, guests can request a booking
        and pay at check-in.
      </p>

      <h3>Is my website mobile-friendly?</h3>
      <p>
        Yes. All ResortPro websites are fully responsive — they automatically adjust to look great on
        phones, tablets, and desktop computers.
      </p>

      <h3>Can I have multiple pages (e.g. a restaurant page, a spa page)?</h3>
      <p>
        Yes. Go to <strong>Website → Pages</strong> to add custom pages to your site. You can add a
        Restaurant page, Spa page, Activities page, or any custom page with a rich text editor.
      </p>

    </DocLayout>
  );
}
