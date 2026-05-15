# ResortPro Embed Widget — Resort Owner Guide

> **Who is this for?**
> You already use ResortPro to manage your hotel or resort. Now you want to show your room listings, booking form, restaurant menu, or availability calendar **directly on your own website** — your WordPress site, Wix page, or any custom website — without rebuilding anything from scratch.

---

## Table of Contents

1. [How it works — the big picture](#1-how-it-works)
2. [Step 1 — Find your Resort Slug](#2-find-your-resort-slug)
3. [Step 2 — Add the script tag](#3-add-the-script-tag)
4. [Step 3 — Place widgets on your pages](#4-place-widgets-on-your-pages)
5. [Available widgets](#5-available-widgets)
   - [Booking Form](#51-booking-form)
   - [Room Listing](#52-room-listing)
   - [Availability Calendar](#53-availability-calendar)
   - [Food Menu & Order](#54-food-menu--order)
   - [Floating CTA Button](#55-floating-cta-button)
6. [Customize colors and currency](#6-customize-colors-and-currency)
7. [WordPress Plugin](#7-wordpress-plugin)
   - [Install the plugin](#71-install-the-plugin)
   - [Configure your slug](#72-configure-your-slug)
   - [Use shortcodes](#73-use-shortcodes)
   - [Use Gutenberg blocks](#74-use-gutenberg-blocks)
8. [Payment gateways on your website](#8-payment-gateways-on-your-website)
9. [Connecting your website to ResortPro](#9-what-happens-in-resortpro-when-a-guest-books)
10. [Troubleshooting](#10-troubleshooting)
11. [Quick reference — all snippets](#11-quick-reference)

---

## 1. How it works

ResortPro provides a **small JavaScript file** (called the embed script) that you load on your website **once**. After that, you drop simple HTML tags wherever you want a widget to appear — and the widgets load automatically, connected live to your ResortPro account.

```
Your website  →  <script src="cdn.resortpro.app/embed.js">
                      ↓
                 Reads your data from ResortPro
                      ↓
                 Renders booking form / rooms / menu / calendar
                      ↓
                 Guest books → appears in your ResortPro dashboard
```

No server setup. No coding skills required. Works on **any website builder** that lets you add custom HTML.

---

## 2. Find your Resort Slug

Your **slug** is a short identifier that connects the widgets to your resort. It looks like `palm-paradise` or `sea-view-hotel`.

**To find it:**
1. Log in to your ResortPro dashboard
2. Go to **Settings → General**
3. Look for the **"Slug"** field — copy that value

> ⚠️ Keep your slug handy. You will paste it into every widget snippet.

---

## 3. Add the script tag

This is the **only technical step**. You need to add one line of code to your website — once — and all widgets will work.

```html
<script src="https://cdn.resortpro.app/embed.js" defer></script>
```

**Where to put it:**

| Website Builder | How to add it |
|----------------|--------------|
| **WordPress** | Use our plugin (see [Section 7](#7-wordpress-plugin)) — no manual script needed |
| **Wix** | Dashboard → Settings → Custom Code → paste in the `<head>` section |
| **Squarespace** | Settings → Advanced → Code Injection → Header |
| **Webflow** | Project Settings → Custom Code → Head Code |
| **Custom HTML site** | Paste before `</head>` or before `</body>` in your HTML file |
| **Shopify** | Online Store → Themes → Edit Code → `theme.liquid` before `</head>` |

> 💡 You only need to add this script **once** per website. Not once per page — once for the whole site.

---

## 4. Place widgets on your pages

After adding the script tag, you can place widgets anywhere on any page using simple HTML tags.

The format is:
```html
<div data-resortpro="WIDGET_TYPE" data-slug="YOUR_SLUG"></div>
```

**Example** — add a booking form to your homepage:
```html
<div data-resortpro="booking" data-slug="palm-paradise"></div>
```

The widget will render inside that `<div>` automatically when the page loads.

---

## 5. Available Widgets

### 5.1 Booking Form

The most important widget. Shows a complete 4-step booking flow:

**Step 1 →** Guest picks check-in and check-out dates  
**Step 2 →** Available rooms are shown with prices and photos  
**Step 3 →** Guest fills in their name, email, phone, and special requests  
**Step 4 →** Guest pays (bKash / SSL Commerce / Stripe / Manual)  
**Done →** Confirmation number is shown  

```html
<div data-resortpro="booking" data-slug="YOUR_SLUG"></div>
```

**Best placed on:** Homepage, dedicated "Book Now" page, contact page.

---

### 5.2 Room Listing

Shows all your active rooms in a card grid with photos, price per night, amenities, and a "Book Now" button. Clicking a room opens the full booking form.

```html
<div data-resortpro="rooms" data-slug="YOUR_SLUG"></div>
```

**Best placed on:** "Rooms" or "Accommodation" page.

> The room list pulls directly from your ResortPro **Rooms** section. To update room photos, prices, or descriptions, just edit them in ResortPro — the widget updates automatically.

---

### 5.3 Availability Calendar

Shows a monthly calendar where guests can see which dates are available, partially booked, or fully booked — before choosing dates for booking.

```html
<div data-resortpro="calendar" data-slug="YOUR_SLUG"></div>
```

**Color meaning:**
- 🟢 Green — dates are fully available
- 🟡 Yellow — some rooms available, some booked
- 🔴 Red — fully booked, no rooms available

**Best placed on:** Homepage, booking page, or "Check Availability" page.

---

### 5.4 Food Menu & Order

Shows your restaurant menu with categories, item photos, prices, and a cart. Guests can place a food order directly from your website without calling the front desk.

```html
<div data-resortpro="menu" data-slug="YOUR_SLUG"></div>
```

**How it works for the guest:**
1. Browse menu items by category (Breakfast, Lunch, Dinner, Drinks, etc.)
2. Add items to cart
3. Enter name, room number / booking reference
4. Submit order

The order appears instantly in your ResortPro **Food Orders** section.

> 💡 To add or remove menu items, go to **ResortPro → Restaurant → Menu**. Changes reflect on the widget immediately.

**Best placed on:** Restaurant page, in-room dining page, or after check-in confirmation.

---

### 5.5 Floating CTA Button

A "Book Now" button that **sticks to the bottom-right corner** of the screen as visitors scroll your website. When clicked, it opens the full booking form in a popup.

You can also add a **WhatsApp button** next to it so guests can message you directly.

```html
<!-- Basic floating button -->
<div data-resortpro="cta" data-slug="YOUR_SLUG"></div>

<!-- With WhatsApp button -->
<div
  data-resortpro="cta"
  data-slug="YOUR_SLUG"
  data-whatsapp="+8801700000000"
></div>
```

Replace `+8801700000000` with your WhatsApp number (include the country code, no spaces).

**Best placed on:** Every page of your site (add once to your page template/footer).

---

## 6. Customize colors and currency

By default, the widgets use the brand color and currency you have set in **ResortPro → Settings → General**.

You can **override** these per widget using extra HTML attributes:

```html
<div
  data-resortpro="booking"
  data-slug="YOUR_SLUG"
  data-color="#2563eb"
  data-currency="USD"
></div>
```

| Attribute | What it does | Example |
|-----------|-------------|---------|
| `data-color` | Changes the widget's primary color | `#1a6b5e` |
| `data-currency` | Changes the currency shown | `BDT`, `USD`, `EUR` |
| `data-whatsapp` | Adds WhatsApp button (CTA widget only) | `+8801700000000` |

> **Color tip:** Use your hotel's brand color to make the widgets match your website perfectly. You can find your brand color's hex code using tools like [colorpicker.me](https://colorpicker.me).

---

## 7. WordPress Plugin

If your website runs on **WordPress**, use our dedicated plugin instead of manually adding script tags. It gives you:

- Automatic script loading (only on pages with widgets)
- Easy shortcodes for the WordPress editor
- Gutenberg block support (drag-and-drop in the block editor)
- Admin settings page to store your slug once

### 7.1 Install the plugin

**Option A — Download from ResortPro dashboard (recommended):**
1. Go to **Settings → Embed & Widget** in your ResortPro dashboard
2. Click **"Download Plugin (.zip)"**
3. In your WordPress admin, go to **Plugins → Add New → Upload Plugin**
4. Upload the `.zip` file and click **Install Now**
5. Click **Activate Plugin**

**Option B — Manual upload via FTP:**
1. Download the plugin `.zip` from ResortPro dashboard
2. Unzip it
3. Upload the `resortpro-embed` folder to `/wp-content/plugins/` via FTP
4. Go to **WordPress Admin → Plugins** and activate "ResortPro Embed"

---

### 7.2 Configure your slug

After activating the plugin:

1. Go to **WordPress Admin → Settings → ResortPro Embed**
2. Fill in your **Resort Slug** (e.g. `palm-paradise`)
3. Optionally set your **Brand Color** and **WhatsApp number**
4. Click **Save Changes**

You only need to do this once. All shortcodes will use these settings automatically.

---

### 7.3 Use shortcodes

After configuration, add any widget to a page or post using shortcodes:

| Widget | Shortcode |
|--------|----------|
| Booking Form | `[resortpro_booking]` |
| Room Listing | `[resortpro_rooms]` |
| Availability Calendar | `[resortpro_calendar]` |
| Food Menu & Order | `[resortpro_menu]` |
| Floating CTA Button | `[resortpro_cta]` |

**How to use:**
1. Open any WordPress page or post in the editor
2. Type or paste the shortcode anywhere in the content
3. Save/publish the page
4. Visit the page — the widget appears automatically

**Override settings per shortcode:**
```
[resortpro_booking slug="other-resort" color="#e63946"]
[resortpro_cta whatsapp="+8801700000000"]
```

---

### 7.4 Use Gutenberg blocks

If you use the **Block Editor** (Gutenberg):

1. Open a page in the block editor
2. Click the **"+"** button to add a new block
3. Search for **"ResortPro"**
4. Choose the widget you want (Booking Form, Rooms, Calendar, Menu, CTA)
5. The block will appear with settings in the right sidebar
6. Save the page

Each block shows a preview placeholder in the editor. The real widget loads on the live page.

---

## 8. Payment gateways on your website

When a guest completes a booking through the widget, they can pay using the gateways you have enabled in **ResortPro → Settings → Payment Gateways**.

| Gateway | How it works on your website |
|---------|----------------------------|
| **bKash** | Guest clicks "Pay with bKash" → redirected to bKash payment page → returns to your site after payment |
| **SSL Commerce** | Guest clicks "Pay with SSL" → redirected to SSL gateway → returns after payment |
| **Stripe** | Card number form appears directly in the widget — guest pays without leaving your page |
| **Manual / Cash** | Booking is marked as "Pending Payment" — guest pays at the property |

> 💡 **At least one gateway must be enabled** for the booking form's payment step to work. If no gateway is enabled, only the "Pay at Property" option is shown.

**To enable a gateway:**
1. Go to **ResortPro → Settings → Payment Gateways**
2. Toggle on the gateway you want
3. Enter your API credentials (provided by the gateway)
4. Save

---

## 9. What happens in ResortPro when a guest books?

When a guest completes a booking through the widget:

1. **A new booking appears** in your **ResortPro → Bookings** list, marked as `PENDING` (awaiting payment) or `CONFIRMED` (if paid online)
2. **A guest profile is created** (or matched to an existing one) in your **CRM → Guests** list
3. **Payment status updates automatically** — once payment is received via bKash/SSL/Stripe, the booking moves to `CONFIRMED`
4. You can **manage the booking** normally from the dashboard — add notes, check in, check out, etc.

Food orders from the menu widget appear under **ResortPro → Restaurant → Orders**.

---

## 10. Troubleshooting

### Widget not showing up

| Problem | Fix |
|---------|-----|
| White blank space where widget should be | The script tag is missing. Add `<script src="https://cdn.resortpro.app/embed.js" defer></script>` to your page head |
| Error message: "Resort not found" | Check your `data-slug` value — it must match exactly what's in ResortPro Settings |
| Widget shows but rooms are empty | Make sure rooms are marked as **Active** in ResortPro → Rooms |
| Widget shows but menu is empty | Make sure menu items are set to **Available** in ResortPro → Restaurant → Menu |

### Booking form payment step is missing

Go to **ResortPro → Settings → Payment Gateways** and enable at least one gateway. Without a gateway, no payment options appear.

### WhatsApp button not showing

Make sure you include `data-whatsapp="+XXXXXXXXXXX"` with the **full international number** including country code, no spaces, no dashes. For Bangladesh: `+880XXXXXXXXXX`.

### Colors don't match my website

Set `data-color="#XXXXXX"` with your brand hex color. Or go to **ResortPro → Settings → General** and update your **Primary Color** — all widgets will pick it up automatically.

### WordPress shortcode shows raw text like `[resortpro_booking]`

The plugin is not activated. Go to **WordPress Admin → Plugins** and check that **ResortPro Embed** is active.

### Payment succeeds but booking stays "Pending"

This can happen if the browser was closed before the payment callback completed. In this case, contact your payment gateway to verify the transaction, then manually update the booking status in **ResortPro → Bookings → Edit Booking**.

---

## 11. Quick Reference

Copy any snippet below. Replace `YOUR_SLUG` with your actual resort slug.

**Script tag (add once to every page):**
```html
<script src="https://cdn.resortpro.app/embed.js" defer></script>
```

**Booking Form:**
```html
<div data-resortpro="booking" data-slug="YOUR_SLUG"></div>
```

**Room Listing:**
```html
<div data-resortpro="rooms" data-slug="YOUR_SLUG"></div>
```

**Availability Calendar:**
```html
<div data-resortpro="calendar" data-slug="YOUR_SLUG"></div>
```

**Food Menu & Order:**
```html
<div data-resortpro="menu" data-slug="YOUR_SLUG"></div>
```

**Floating CTA + WhatsApp:**
```html
<div
  data-resortpro="cta"
  data-slug="YOUR_SLUG"
  data-whatsapp="+8801700000000"
></div>
```

**All widgets with custom color:**
```html
<div data-resortpro="booking"  data-slug="YOUR_SLUG" data-color="#1a6b5e"></div>
<div data-resortpro="rooms"    data-slug="YOUR_SLUG" data-color="#1a6b5e"></div>
<div data-resortpro="calendar" data-slug="YOUR_SLUG" data-color="#1a6b5e"></div>
<div data-resortpro="menu"     data-slug="YOUR_SLUG" data-color="#1a6b5e"></div>
<div data-resortpro="cta"      data-slug="YOUR_SLUG" data-color="#1a6b5e" data-whatsapp="+8801700000000"></div>
```

**WordPress shortcodes:**
```
[resortpro_booking]
[resortpro_rooms]
[resortpro_calendar]
[resortpro_menu]
[resortpro_cta]
```

---

> **Need help?** Contact ResortPro support at [support@resortpro.app](mailto:support@resortpro.app) or open a ticket from your dashboard under **Help → Support**.
