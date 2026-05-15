=== ResortPro Embed ===
Contributors:      resortpro
Tags:              hotel, resort, booking, rooms, calendar, shortcode, gutenberg, embed
Requires at least: 5.5
Tested up to:      6.5
Requires PHP:      7.4
Stable tag:        1.0.0
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Add ResortPro booking forms, room listings, availability calendars, food menus, and a floating CTA to any page using shortcodes or Gutenberg blocks.

== Description ==

**ResortPro Embed** is the official WordPress plugin for [ResortPro](https://resortpro.app) — the full-stack SaaS platform for hotel and resort management.

Connect your WordPress site to your ResortPro account in seconds and embed fully branded, interactive widgets anywhere using shortcodes or native Gutenberg blocks. The plugin loads a single lightweight CDN script (`embed.js`) only on pages that contain a widget — no impact on pages that don't use it.

= Available Widgets =

* **Booking Form** — A complete reservation form with date picker, room type selector, and guest details.
* **Room Listings** — A filterable grid of your room inventory with photos, rates, and availability indicators.
* **Availability Calendar** — A month-view calendar showing real-time availability for all room types.
* **Food & Beverage Menu** — A styled menu of your restaurant, bar, or room-service offerings.
* **Floating CTA** — A sticky call-to-action button (with optional WhatsApp link) that follows the visitor as they scroll.

= Shortcodes =

Add any widget to a post, page, or widget area:

    [resortpro_booking]
    [resortpro_rooms]
    [resortpro_calendar]
    [resortpro_menu]
    [resortpro_cta whatsapp="+8801700000000"]

All shortcodes accept optional `slug`, `color`, and `currency` attributes to override the global settings on a per-widget basis.

= Gutenberg Blocks =

Five blocks are available in the block inserter under the **Embed** category:

* ResortPro: Booking Form
* ResortPro: Room Listings
* ResortPro: Availability Calendar
* ResortPro: Food & Beverage Menu
* ResortPro: Floating CTA

Each block has a sidebar panel for per-block `slug`, `color`, and `currency` overrides. The CTA block also exposes a `whatsapp` field.

= Performance =

The CDN script is loaded **only on pages that contain a ResortPro widget** — either via shortcode or Gutenberg block. Pages without widgets load zero additional JavaScript.

= Privacy =

ResortPro widgets are powered by JavaScript loaded from `https://cdn.resortpro.app/embed.js`. Booking transactions are handled directly by ResortPro's servers. Please update your privacy policy to reflect the use of this third-party service.

== Installation ==

= Automatic Installation (recommended) =

1. In your WordPress dashboard go to **Plugins → Add New**.
2. Search for **ResortPro Embed**.
3. Click **Install Now**, then **Activate**.
4. Go to **Settings → ResortPro Embed** and enter your resort slug.

= Manual Installation =

1. Download the plugin `.zip` file.
2. Go to **Plugins → Add New → Upload Plugin** and upload the zip.
3. Activate the plugin through the **Plugins** menu.
4. Go to **Settings → ResortPro Embed** and enter your resort slug.

= After Activation =

1. Navigate to **Settings → ResortPro Embed**.
2. Enter your **Resort Slug** (visible in your ResortPro dashboard under Settings).
3. Optionally set a brand color, currency override, and WhatsApp number.
4. Click **Save Settings**.
5. Add `[resortpro_booking]` (or any other shortcode) to a page.

== Frequently Asked Questions ==

= Where do I find my resort slug? =

Log in to your ResortPro dashboard at [https://resortpro.app/dashboard](https://resortpro.app/dashboard) and go to **Settings → General**. Your slug is listed there.

= Can I use different slugs on different pages? =

Yes. Each shortcode and Gutenberg block accepts a `slug` attribute that overrides the global setting:

    [resortpro_booking slug="beach-resort" color="#0055aa"]

= Will this slow down my site? =

No. The CDN script is injected into the `<footer>` with the `defer` attribute and **only on pages that actually contain a ResortPro widget**. Other pages are completely unaffected.

= Can I change the brand color per widget? =

Yes. Use the `color` attribute in the shortcode, or the **Brand Color** field in the Gutenberg block sidebar.

= Does the floating CTA work without WhatsApp? =

The CTA widget has its own behavior defined in `embed.js`. If no `whatsapp` number is configured, it will fall back to showing a general booking link. Check your ResortPro dashboard for CTA configuration options.

= I added the shortcode but nothing appears. What's wrong? =

1. Confirm your resort slug is saved under **Settings → ResortPro Embed**.
2. Make sure your server can reach `https://cdn.resortpro.app/embed.js` (check for firewall or CSP restrictions).
3. View the page source and look for `data-resortpro` attributes in the HTML — if they are present, the PHP is working and the issue is with the CDN script or your browser.

= Is this plugin compatible with page builders (Elementor, Divi, etc.)? =

Yes. The shortcodes work in any context that renders WordPress shortcodes, including most page builders. Use the **HTML / Raw Code** element in your builder and paste the shortcode.

= Does it support multisite? =

Yes. Each site in a multisite network stores its own `resortpro_settings` option, so different subsites can connect to different resorts.

== Screenshots ==

1. **Settings page** — Enter your resort slug, brand color, currency, and WhatsApp number.
2. **Widget preview** — See all five widgets rendered in the admin, powered by your live slug.
3. **Gutenberg block inserter** — All five ResortPro blocks available under the Embed category.
4. **Block sidebar** — Per-block overrides for slug, color, and currency.
5. **Frontend booking form** — The ResortPro booking widget embedded on a WordPress page.

== Changelog ==

= 1.0.0 =
* Initial release.
* Five shortcodes: `resortpro_booking`, `resortpro_rooms`, `resortpro_calendar`, `resortpro_menu`, `resortpro_cta`.
* Five Gutenberg blocks (server-side rendered) with Inspector Controls for per-block attribute overrides.
* Admin settings page (Settings → ResortPro Embed) using the WordPress Settings API.
* Widget preview section on the admin settings page.
* Connection status panel showing active configuration at a glance.
* Conditional CDN script loading — script injected only on pages with widgets.
* Activation hook sets safe default option values.
* Full escaping and sanitisation throughout (esc_attr, esc_html, sanitize_text_field, sanitize_hex_color).

== Upgrade Notice ==

= 1.0.0 =
Initial release — no upgrade steps required.

== Additional Notes ==

* The plugin does **not** store any guest or booking data locally. All data is managed by the ResortPro platform.
* To completely remove all plugin data on uninstall, create an `uninstall.php` file in the plugin directory that calls `delete_option( 'resortpro_settings' )`.
* For support, visit [https://resortpro.app/support](https://resortpro.app/support) or open an issue on the plugin's GitHub repository.
