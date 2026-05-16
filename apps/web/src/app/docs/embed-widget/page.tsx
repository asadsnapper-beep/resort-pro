import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'how-it-works',             label: '1. How it works' },
  { id: 'find-your-slug',           label: '2. Find your resort slug' },
  { id: 'add-the-script-tag',       label: '3. Add the script tag' },
  { id: 'place-widgets',            label: '4. Place widgets on pages' },
  { id: 'available-widgets',        label: '5. Available widgets' },
  { id: 'customize',                label: '6. Customize colors & currency' },
  { id: 'wordpress-plugin',         label: '7. WordPress plugin' },
  { id: 'embed-access',             label: '8. Who can access embed settings' },
  { id: 'payment-gateways',         label: '9. Payment gateways' },
  { id: 'what-happens-in-dashboard',label: '10. What happens in ResortPro' },
  { id: 'troubleshooting',          label: '11. Troubleshooting' },
  { id: 'quick-reference',          label: '12. Quick reference' },
];

export default function EmbedWidgetPage() {
  return (
    <DocLayout
      title="Embed Widget Guide"
      description="Add a live booking form, room listing, availability calendar, and food menu to any website — no coding skills required."
      readTime="8 min read"
      tag="Integration"
      tagColor="bg-blue-100 text-blue-700"
      toc={TOC}
    >

      {/* ── 1. How it works ───────────────────────────────────────────── */}
      <h2 id="how-it-works">1. How it works</h2>
      <p>
        ResortPro provides a <strong>small JavaScript file</strong> (the embed script) that you load on
        your website <strong>once</strong>. After that, you drop simple HTML tags wherever you want a
        widget to appear — and the widgets load automatically, connected live to your ResortPro account.
      </p>
      <pre>{`Your website  →  <script src="cdn.resortpro.app/embed.js">
                      ↓
                 Reads your data from ResortPro
                      ↓
                 Renders booking form / rooms / menu / calendar
                      ↓
                 Guest books → appears in your dashboard`}</pre>
      <p>
        No server setup. No coding skills required. Works on <strong>any website builder</strong> that
        lets you add custom HTML.
      </p>

      {/* ── 2. Find slug ─────────────────────────────────────────────── */}
      <h2 id="find-your-slug">2. Find your resort slug</h2>
      <p>
        Your <strong>slug</strong> is a short identifier that connects the widgets to your resort.
        It looks like <code>palm-paradise</code> or <code>sea-view-hotel</code>.
      </p>
      <p><strong>To find it:</strong></p>
      <ol>
        <li>Log in to your ResortPro dashboard</li>
        <li>Go to <strong>Settings → General</strong></li>
        <li>Look for the <strong>"Slug"</strong> field — copy that value</li>
      </ol>
      <blockquote>⚠️ Keep your slug handy. You will paste it into every widget snippet.</blockquote>

      {/* ── 3. Script tag ─────────────────────────────────────────────── */}
      <h2 id="add-the-script-tag">3. Add the script tag</h2>
      <p>
        This is the <strong>only technical step</strong>. You need to add one line of code to your
        website — once — and all widgets will work.
      </p>
      <pre>{`<script src="https://cdn.resortpro.app/embed.js" defer></script>`}</pre>
      <p><strong>Where to put it:</strong></p>
      <table>
        <thead><tr><th>Website Builder</th><th>How to add it</th></tr></thead>
        <tbody>
          <tr><td><strong>WordPress</strong></td><td>Use our plugin (see Section 7) — no manual script needed</td></tr>
          <tr><td><strong>Wix</strong></td><td>Dashboard → Settings → Custom Code → paste in the &lt;head&gt; section</td></tr>
          <tr><td><strong>Squarespace</strong></td><td>Settings → Advanced → Code Injection → Header</td></tr>
          <tr><td><strong>Webflow</strong></td><td>Project Settings → Custom Code → Head Code</td></tr>
          <tr><td><strong>Custom HTML site</strong></td><td>Paste before &lt;/head&gt; or &lt;/body&gt; in your HTML file</td></tr>
          <tr><td><strong>Shopify</strong></td><td>Online Store → Themes → Edit Code → theme.liquid before &lt;/head&gt;</td></tr>
        </tbody>
      </table>
      <div className="info-box">
        💡 You only need to add this script <strong>once</strong> per website. Not once per page — once for the whole site.
      </div>

      {/* ── 4. Place widgets ──────────────────────────────────────────── */}
      <h2 id="place-widgets">4. Place widgets on your pages</h2>
      <p>
        After adding the script tag, you can place widgets anywhere on any page using simple HTML tags.
      </p>
      <pre>{`<div data-resortpro="WIDGET_TYPE" data-slug="YOUR_SLUG"></div>`}</pre>
      <p><strong>Example</strong> — add a booking form to your homepage:</p>
      <pre>{`<div data-resortpro="booking" data-slug="palm-paradise"></div>`}</pre>
      <p>The widget will render inside that <code>&lt;div&gt;</code> automatically when the page loads.</p>

      {/* ── 5. Available widgets ──────────────────────────────────────── */}
      <h2 id="available-widgets">5. Available widgets</h2>

      <h3>5.1 Booking Form</h3>
      <p>The most important widget. Shows a complete 4-step booking flow:</p>
      <ul>
        <li><strong>Step 1 →</strong> Guest picks check-in and check-out dates</li>
        <li><strong>Step 2 →</strong> Available rooms shown with prices and photos</li>
        <li><strong>Step 3 →</strong> Guest fills in name, email, phone, special requests</li>
        <li><strong>Step 4 →</strong> Guest pays (bKash / SSL Commerce / Stripe / Manual)</li>
        <li><strong>Done →</strong> Confirmation number is shown</li>
      </ul>
      <pre>{`<div data-resortpro="booking" data-slug="YOUR_SLUG"></div>`}</pre>
      <p><strong>Best placed on:</strong> Homepage, dedicated "Book Now" page, contact page.</p>

      <h3>5.2 Room Listing</h3>
      <p>
        Shows all your active rooms in a card grid with photos, price per night, amenities, and a
        "Book Now" button. Clicking a room opens the full booking form.
      </p>
      <pre>{`<div data-resortpro="rooms" data-slug="YOUR_SLUG"></div>`}</pre>
      <div className="info-box">
        The room list pulls directly from your ResortPro <strong>Rooms</strong> section. To update room
        photos, prices, or descriptions, just edit them in ResortPro — the widget updates automatically.
      </div>

      <h3>5.3 Availability Calendar</h3>
      <p>
        Shows a monthly calendar where guests can see which dates are available, partially booked,
        or fully booked — before choosing dates for booking.
      </p>
      <pre>{`<div data-resortpro="calendar" data-slug="YOUR_SLUG"></div>`}</pre>
      <ul>
        <li>🟢 <strong>Green</strong> — dates are fully available</li>
        <li>🟡 <strong>Yellow</strong> — some rooms available, some booked</li>
        <li>🔴 <strong>Red</strong> — fully booked, no rooms available</li>
      </ul>

      <h3>5.4 Food Menu & Order</h3>
      <p>
        Shows your restaurant menu with categories, item photos, prices, and a cart. Guests can
        place a food order directly from your website without calling the front desk.
      </p>
      <pre>{`<div data-resortpro="menu" data-slug="YOUR_SLUG"></div>`}</pre>
      <p>The order appears instantly in your ResortPro <strong>Food Orders</strong> section.</p>

      <h3>5.5 Floating CTA Button</h3>
      <p>
        A "Book Now" button that <strong>sticks to the bottom-right corner</strong> of the screen
        as visitors scroll. You can also add a <strong>WhatsApp button</strong> next to it.
      </p>
      <pre>{`<!-- Basic floating button -->
<div data-resortpro="cta" data-slug="YOUR_SLUG"></div>

<!-- With WhatsApp button -->
<div
  data-resortpro="cta"
  data-slug="YOUR_SLUG"
  data-whatsapp="+8801700000000"
></div>`}</pre>
      <p>Replace <code>+8801700000000</code> with your WhatsApp number (include the country code, no spaces).</p>

      {/* ── 6. Customize ─────────────────────────────────────────────── */}
      <h2 id="customize">6. Customize colors and currency</h2>
      <p>
        By default, the widgets use the brand color and currency you have set in
        <strong> ResortPro → Settings → General</strong>. You can override these per widget:
      </p>
      <pre>{`<div
  data-resortpro="booking"
  data-slug="YOUR_SLUG"
  data-color="#2563eb"
  data-currency="USD"
></div>`}</pre>
      <table>
        <thead><tr><th>Attribute</th><th>What it does</th><th>Example</th></tr></thead>
        <tbody>
          <tr><td><code>data-color</code></td><td>Changes the widget's primary color</td><td><code>#1a6b5e</code></td></tr>
          <tr><td><code>data-currency</code></td><td>Changes the currency shown</td><td><code>BDT</code>, <code>USD</code></td></tr>
          <tr><td><code>data-whatsapp</code></td><td>Adds WhatsApp button (CTA only)</td><td><code>+8801700000000</code></td></tr>
        </tbody>
      </table>

      {/* ── 7. WordPress ─────────────────────────────────────────────── */}
      <h2 id="wordpress-plugin">7. WordPress plugin</h2>
      <p>If your website runs on <strong>WordPress</strong>, use our dedicated plugin instead of manually adding script tags.</p>

      <h3>7.1 Install the plugin</h3>
      <p><strong>Option A — Download from ResortPro dashboard (recommended):</strong></p>
      <ol>
        <li>Go to <strong>Settings → Embed &amp; Widget</strong> in your ResortPro dashboard</li>
        <li>Click <strong>"Download Plugin (.zip)"</strong></li>
        <li>In WordPress admin, go to <strong>Plugins → Add New → Upload Plugin</strong></li>
        <li>Upload the <code>.zip</code> file and click <strong>Install Now</strong></li>
        <li>Click <strong>Activate Plugin</strong></li>
      </ol>

      <h3>7.2 Configure your slug</h3>
      <ol>
        <li>Go to <strong>WordPress Admin → Settings → ResortPro Embed</strong></li>
        <li>Fill in your <strong>Resort Slug</strong> (e.g. <code>palm-paradise</code>)</li>
        <li>Optionally set your <strong>Brand Color</strong> and <strong>WhatsApp number</strong></li>
        <li>Click <strong>Save Changes</strong></li>
      </ol>

      <h3>7.3 Use shortcodes</h3>
      <table>
        <thead><tr><th>Widget</th><th>Shortcode</th></tr></thead>
        <tbody>
          <tr><td>Booking Form</td><td><code>[resortpro_booking]</code></td></tr>
          <tr><td>Room Listing</td><td><code>[resortpro_rooms]</code></td></tr>
          <tr><td>Availability Calendar</td><td><code>[resortpro_calendar]</code></td></tr>
          <tr><td>Food Menu &amp; Order</td><td><code>[resortpro_menu]</code></td></tr>
          <tr><td>Floating CTA Button</td><td><code>[resortpro_cta]</code></td></tr>
        </tbody>
      </table>

      <h3>7.4 Use Gutenberg blocks</h3>
      <ol>
        <li>Open a page in the block editor</li>
        <li>Click the <strong>"+"</strong> button to add a new block</li>
        <li>Search for <strong>"ResortPro"</strong></li>
        <li>Choose the widget you want</li>
        <li>Save the page</li>
      </ol>

      {/* ── 8. Who can access embed settings ─────────────────────────── */}
      <h2 id="embed-access">8. Who can access embed settings</h2>
      <p>
        The <strong>Settings → Embed &amp; Widget</strong> page is accessible to:
      </p>
      <table>
        <thead><tr><th>Role</th><th>Can access Embed Settings?</th></tr></thead>
        <tbody>
          <tr><td>🏆 Owner</td><td>✅ Yes</td></tr>
          <tr><td>🛡️ Manager</td><td>✅ Yes</td></tr>
          <tr><td>💻 Developer</td><td>✅ Yes — designed for web developers setting up the widget</td></tr>
          <tr><td>All other roles</td><td>❌ No</td></tr>
        </tbody>
      </table>
      <div className="info-box">
        <strong>Tip:</strong> If you are hiring a web developer to add the booking widget to your website,
        give them the <strong>Developer</strong> role. They will only see the Website and Settings pages —
        nothing else (no bookings, guests, or financial data).
      </div>

      {/* ── 9. Payment gateways ───────────────────────────────────────── */}
      <h2 id="payment-gateways">9. Payment gateways on your website</h2>
      <p>
        When a guest completes a booking through the widget, they can pay using the gateways you have
        enabled in <strong>ResortPro → Settings → Payment Gateways</strong>.
      </p>
      <table>
        <thead><tr><th>Gateway</th><th>How it works on your website</th></tr></thead>
        <tbody>
          <tr><td><strong>bKash</strong></td><td>Guest clicks "Pay with bKash" → redirected to bKash payment page → returns after payment</td></tr>
          <tr><td><strong>SSL Commerce</strong></td><td>Guest clicks "Pay with SSL" → redirected to SSL gateway → returns after payment</td></tr>
          <tr><td><strong>Stripe</strong></td><td>Card number form appears directly in the widget — guest pays without leaving your page</td></tr>
          <tr><td><strong>Manual / Cash</strong></td><td>Booking marked as "Pending Payment" — guest pays at the property</td></tr>
        </tbody>
      </table>
      <blockquote>
        💡 <strong>At least one gateway must be enabled</strong> for the booking form's payment step to work.
        If no gateway is enabled, only the "Pay at Property" option is shown.
      </blockquote>

      {/* ── 10. What happens in ResortPro ─────────────────────────────── */}
      <h2 id="what-happens-in-dashboard">10. What happens in ResortPro when a guest books</h2>
      <ol>
        <li>A new booking appears in your <strong>ResortPro → Bookings</strong> list, marked as <code>PENDING</code> (awaiting payment) or <code>CONFIRMED</code> (if paid online)</li>
        <li>A guest profile is created (or matched to an existing one) in your <strong>CRM → Guests</strong> list</li>
        <li>Payment status updates automatically — once payment is received, the booking moves to <code>CONFIRMED</code></li>
        <li>You can manage the booking normally from the dashboard — add notes, check in, check out, etc.</li>
      </ol>
      <p>Food orders from the menu widget appear under <strong>ResortPro → Restaurant → Orders</strong>.</p>

      {/* ── 11. Troubleshooting ───────────────────────────────────────── */}
      <h2 id="troubleshooting">11. Troubleshooting</h2>
      <table>
        <thead><tr><th>Problem</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>White blank space where widget should be</td><td>The script tag is missing. Add it to your page head.</td></tr>
          <tr><td>Error: "Resort not found"</td><td>Check your <code>data-slug</code> value — it must match exactly what's in ResortPro Settings</td></tr>
          <tr><td>Widget shows but rooms are empty</td><td>Make sure rooms are marked as <strong>Active</strong> in ResortPro → Rooms</td></tr>
          <tr><td>Widget shows but menu is empty</td><td>Make sure menu items are set to <strong>Available</strong> in ResortPro → Restaurant → Menu</td></tr>
          <tr><td>Payment step is missing</td><td>Go to Settings → Payment Gateways and enable at least one gateway</td></tr>
          <tr><td>WordPress shortcode shows raw text</td><td>The plugin is not activated. Go to Plugins and activate <strong>ResortPro Embed</strong></td></tr>
          <tr><td>Payment succeeds but booking stays "Pending"</td><td>Browser was closed before callback completed. Manually update the booking status in ResortPro → Bookings</td></tr>
        </tbody>
      </table>

      {/* ── 12. Quick reference ───────────────────────────────────────── */}
      <h2 id="quick-reference">12. Quick reference — all snippets</h2>
      <p>Copy any snippet below. Replace <code>YOUR_SLUG</code> with your actual resort slug.</p>

      <h3>Script tag (add once to every page)</h3>
      <pre>{`<script src="https://cdn.resortpro.app/embed.js" defer></script>`}</pre>

      <h3>All widgets</h3>
      <pre>{`<!-- Booking Form -->
<div data-resortpro="booking"  data-slug="YOUR_SLUG"></div>

<!-- Room Listing -->
<div data-resortpro="rooms"    data-slug="YOUR_SLUG"></div>

<!-- Availability Calendar -->
<div data-resortpro="calendar" data-slug="YOUR_SLUG"></div>

<!-- Food Menu & Order -->
<div data-resortpro="menu"     data-slug="YOUR_SLUG"></div>

<!-- Floating CTA + WhatsApp -->
<div data-resortpro="cta" data-slug="YOUR_SLUG" data-whatsapp="+8801700000000"></div>`}</pre>

      <h3>WordPress shortcodes</h3>
      <pre>{`[resortpro_booking]
[resortpro_rooms]
[resortpro_calendar]
[resortpro_menu]
[resortpro_cta]`}</pre>

    </DocLayout>
  );
}
