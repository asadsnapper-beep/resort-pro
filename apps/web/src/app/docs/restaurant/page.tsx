import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'restaurant-overview',  label: '1. Restaurant module overview' },
  { id: 'setting-up-menu',      label: '2. Setting up your menu' },
  { id: 'taking-orders',        label: '3. Taking food orders' },
  { id: 'order-statuses',       label: '4. Order statuses' },
  { id: 'kitchen-queue',        label: '5. Managing the kitchen queue' },
  { id: 'billing-to-room',      label: '6. Billing food orders to a room' },
  { id: 'faq',                  label: '7. FAQ' },
];

export default function RestaurantPage() {
  return (
    <DocLayout
      title="Restaurant & F&B Management"
      description="Set up your menu, take room service and dine-in orders, manage the kitchen queue, and bill directly to guest rooms."
      readTime="6 min read"
      tag="Restaurant"
      tagColor="bg-orange-100 text-orange-700"
      toc={TOC}
    >

      {/* ── 1. Overview ───────────────────────────────────────────────── */}
      <h2 id="restaurant-overview">1. Restaurant module overview</h2>
      <p>
        The <strong>Restaurant</strong> module lets you manage your property's food and beverage (F&amp;B)
        operations entirely from ResortPro. Whether you run a full restaurant, a poolside bar, or just
        room service, this module handles menus, orders, and billing in one place.
      </p>
      <p>Key features:</p>
      <ul>
        <li>Digital menu with categories, photos, and dietary tags</li>
        <li>Order management for room service, dine-in, and takeaway</li>
        <li>Real-time kitchen queue so chefs know what to prepare</li>
        <li>Post food charges directly to a guest's room bill</li>
        <li>Daily F&amp;B revenue included in your reports</li>
      </ul>
      <div className="info-box">
        <strong>Staff access:</strong> Restaurant staff (with the Staff role) can take orders and
        manage the kitchen queue. Managers and Owners can edit the menu and view reports.
      </div>

      {/* ── 2. Setting up menu ────────────────────────────────────────── */}
      <h2 id="setting-up-menu">2. Setting up your menu</h2>
      <p>
        Before taking orders, set up your menu with categories and items:
      </p>

      <h3>Step 1 — Create menu categories</h3>
      <ol>
        <li>Go to <strong>Restaurant → Menu</strong> in the sidebar.</li>
        <li>Click <strong>"Add Category"</strong>.</li>
        <li>Enter a category name (e.g. "Breakfast", "Main Course", "Beverages", "Desserts").</li>
        <li>Set the display order and click <strong>Save</strong>.</li>
      </ol>

      <h3>Step 2 — Add menu items</h3>
      <ol>
        <li>Click on a category to open it, then click <strong>"Add Item"</strong>.</li>
        <li>Fill in the item details:</li>
      </ol>

      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Name</strong></td>
            <td>Name of the dish or drink (e.g. "Club Sandwich")</td>
          </tr>
          <tr>
            <td><strong>Description</strong></td>
            <td>Short description of ingredients or preparation style</td>
          </tr>
          <tr>
            <td><strong>Price</strong></td>
            <td>Price in your local currency</td>
          </tr>
          <tr>
            <td><strong>Photo</strong></td>
            <td>Upload a photo of the dish (shown in room service tablet/app)</td>
          </tr>
          <tr>
            <td><strong>Dietary tags</strong></td>
            <td>Mark as Vegetarian, Vegan, Gluten-Free, Halal, Spicy, Contains Nuts, etc.</td>
          </tr>
          <tr>
            <td><strong>Availability</strong></td>
            <td>Set which hours/days this item is available (e.g. breakfast items only until 11am)</td>
          </tr>
          <tr>
            <td><strong>Active</strong></td>
            <td>Toggle off to temporarily hide the item without deleting it</td>
          </tr>
        </tbody>
      </table>

      {/* ── 3. Taking orders ──────────────────────────────────────────── */}
      <h2 id="taking-orders">3. Taking food orders</h2>
      <p>
        Once your menu is set up, you can take orders from the <strong>Restaurant → Orders</strong> page:
      </p>
      <ol>
        <li>Go to <strong>Restaurant → Orders</strong>.</li>
        <li>Click <strong>"New Order"</strong>.</li>
        <li>Select the order type:</li>
      </ol>

      <table>
        <thead>
          <tr>
            <th>Order Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Room Service</strong></td>
            <td>Food is delivered to a guest's room. Select the room number and the guest is billed to their room.</td>
          </tr>
          <tr>
            <td><strong>Dine-In</strong></td>
            <td>Guest is eating in the restaurant. Assign a table number.</td>
          </tr>
          <tr>
            <td><strong>Takeaway</strong></td>
            <td>Guest is taking food to go. Not linked to a room.</td>
          </tr>
        </tbody>
      </table>

      <ol start={4}>
        <li>Browse the menu and click items to add them to the order.</li>
        <li>Adjust quantities and add special instructions (e.g. "no onions", "extra sauce").</li>
        <li>Click <strong>"Place Order"</strong>.</li>
      </ol>
      <p>The order immediately appears in the kitchen queue.</p>

      {/* ── 4. Order statuses ─────────────────────────────────────────── */}
      <h2 id="order-statuses">4. Order statuses</h2>

      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Pending</strong></td>
            <td>Order placed, waiting for kitchen to start preparing</td>
          </tr>
          <tr>
            <td><strong>Preparing</strong></td>
            <td>Kitchen has acknowledged the order and is cooking</td>
          </tr>
          <tr>
            <td><strong>Ready</strong></td>
            <td>Food is ready for delivery or collection</td>
          </tr>
          <tr>
            <td><strong>Delivered</strong></td>
            <td>Food has been delivered to the room or table</td>
          </tr>
          <tr>
            <td><strong>Cancelled</strong></td>
            <td>Order was cancelled before preparation</td>
          </tr>
        </tbody>
      </table>

      {/* ── 5. Kitchen queue ──────────────────────────────────────────── */}
      <h2 id="kitchen-queue">5. Managing the kitchen queue</h2>
      <p>
        The <strong>Kitchen Queue</strong> (accessible via <strong>Restaurant → Kitchen</strong>) is a
        live board showing all pending and in-progress orders. This page is typically displayed on
        a tablet or monitor in the kitchen.
      </p>
      <p>Kitchen staff can:</p>
      <ul>
        <li>See all incoming orders in real time</li>
        <li>Tap an order to change its status (Pending → Preparing → Ready)</li>
        <li>See how long each order has been waiting (orders waiting over 20 minutes turn amber, over 30 minutes turn red)</li>
        <li>Add kitchen notes to an order</li>
      </ul>
      <div className="info-box">
        <strong>Tip:</strong> The Kitchen Queue page auto-refreshes every 30 seconds. For a real-time
        experience, open it in a browser tab on a kitchen-facing screen. No app download required.
      </div>

      {/* ── 6. Billing to room ────────────────────────────────────────── */}
      <h2 id="billing-to-room">6. Billing food orders to a room</h2>
      <p>
        Room service orders are automatically linked to the guest's room. When a guest checks out,
        all food charges are included in their folio (bill).
      </p>

      <h3>How it works</h3>
      <ol>
        <li>When you place a Room Service order and select a room number, the charge is added to that room's open folio.</li>
        <li>The guest can review all charges during check-out.</li>
        <li>Payment is collected for the full folio (room rate + all food &amp; beverage charges).</li>
      </ol>

      <h3>Adding food charges manually to a room folio</h3>
      <p>
        If a guest had food in the restaurant and you want to bill it to their room:
      </p>
      <ol>
        <li>Complete the restaurant order as <strong>Dine-In</strong>.</li>
        <li>On the order detail, click <strong>"Post to Room"</strong>.</li>
        <li>Search for the guest or enter their room number.</li>
        <li>Click <strong>Confirm</strong> — the charge is added to their room folio.</li>
      </ol>

      {/* ── 7. FAQ ───────────────────────────────────────────────────── */}
      <h2 id="faq">7. Frequently asked questions</h2>

      <h3>Can guests order food from their room themselves?</h3>
      <p>
        Yes, if you embed the food menu widget on your in-room tablet or TV system. See the
        <a href="/docs/embed-widget" className="text-[#1a6b5e] underline"> Embed Widget guide</a> for
        how to set up the food menu widget.
      </p>

      <h3>Can I have multiple menus (breakfast, lunch, dinner)?</h3>
      <p>
        Yes. Use categories with availability time settings to create different menus for different
        times of day. Items outside their availability window are hidden from the ordering interface.
      </p>

      <h3>Can I apply a service charge or tax to food orders?</h3>
      <p>
        Yes. Go to <strong>Settings → Restaurant</strong> and set a default service charge percentage
        and/or tax rate. These are applied automatically to all food orders.
      </p>

      <h3>Can I see a report of daily restaurant revenue?</h3>
      <p>
        Yes. Go to <strong>Reports → F&amp;B Revenue</strong> for a daily, weekly, and monthly
        breakdown of restaurant income by category.
      </p>

    </DocLayout>
  );
}
