import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'inventory-overview',  label: '1. Overview' },
  { id: 'adding-items',        label: '2. Adding inventory items' },
  { id: 'categories',          label: '3. Categories' },
  { id: 'low-stock-alerts',    label: '4. Low-stock alerts' },
  { id: 'recording-usage',     label: '5. Recording usage' },
  { id: 'faq',                 label: '6. FAQ' },
];

export default function InventoryPage() {
  return (
    <DocLayout
      title="Inventory Management"
      description="Track your supplies — from housekeeping chemicals to kitchen ingredients — and never run out of something important again."
      readTime="5 min read"
      tag="Inventory"
      tagColor="bg-orange-100 text-orange-700"
      toc={TOC}
    >
      <h2 id="inventory-overview">1. Overview</h2>
      <p>
        The ResortPro inventory module helps you track the physical supplies your resort uses every day.
        Instead of counting items manually or keeping spreadsheets, you can log all your stock in one place
        and get alerts when something is running low.
      </p>
      <p>
        Go to <strong>Dashboard → Inventory</strong> to see your current stock levels, add new items, and
        record usage.
      </p>
      <div className="info-box">
        <strong>Who should use this:</strong> Inventory is typically managed by your General Manager, Housekeeping Supervisor, or Kitchen Manager. Staff with the "Manager" or "Staff" role can update inventory levels.
      </div>

      <h2 id="adding-items">2. Adding inventory items</h2>
      <ol>
        <li>Go to <strong>Inventory → Add Item</strong>.</li>
        <li>Enter the <strong>Item Name</strong> (e.g., "Toilet Roll", "Coffee Sachet", "Detergent — 5L").</li>
        <li>Choose a <strong>Category</strong> (see below).</li>
        <li>Set the <strong>Unit</strong> — how you measure this item (pieces, litres, kg, boxes, rolls).</li>
        <li>Enter the <strong>Current Quantity</strong> — how many you have right now.</li>
        <li>Set the <strong>Reorder Level</strong> — the quantity at which you want to be alerted to restock (e.g., alert me when toilet rolls drop below 50).</li>
        <li>Optionally add a <strong>Supplier Name</strong> and <strong>Cost per Unit</strong> for cost tracking.</li>
        <li>Click <strong>Save</strong>.</li>
      </ol>

      <h2 id="categories">3. Categories</h2>
      <p>Use categories to organise your inventory by department:</p>
      <table>
        <thead><tr><th>Category</th><th>Examples</th></tr></thead>
        <tbody>
          <tr><td><strong>Housekeeping</strong></td><td>Towels, bedsheets, cleaning chemicals, toilet roll, soap, shampoo, room amenities</td></tr>
          <tr><td><strong>Kitchen</strong></td><td>Rice, oil, spices, vegetables, dairy products, packaged goods, coffee, tea</td></tr>
          <tr><td><strong>Bar</strong></td><td>Soft drinks, water, juice, beer, spirits, wine, garnishes</td></tr>
          <tr><td><strong>Maintenance</strong></td><td>Light bulbs, batteries, paint, tools, plumbing supplies, electrical parts</td></tr>
          <tr><td><strong>General</strong></td><td>Stationery, printer paper, pens, welcome cards, packaging, bags</td></tr>
        </tbody>
      </table>

      <h2 id="low-stock-alerts">4. Low-stock alerts</h2>
      <p>
        When any item's quantity drops to or below its <strong>Reorder Level</strong>, ResortPro will:
      </p>
      <ul>
        <li>Show a red alert badge on the Inventory menu item in your sidebar.</li>
        <li>List the item on the <strong>Low Stock</strong> tab at the top of the Inventory page.</li>
        <li>Send an email notification to the Owner and Manager (if email notifications are enabled in Settings).</li>
      </ul>
      <p>
        When you restock, simply open the item and update the quantity. The alert will clear automatically once the quantity is above the reorder level.
      </p>
      <blockquote>
        <strong>Tip:</strong> Set your reorder level to the amount you use in 5–7 days. This gives you enough time to place an order and receive it before you run out.
      </blockquote>

      <h2 id="recording-usage">5. Recording usage</h2>
      <p>
        There are two ways to reduce inventory quantities:
      </p>
      <ul>
        <li>
          <strong>Manual update:</strong> Open an item and click <strong>Record Usage</strong>. Enter the quantity used and the reason (e.g., "20 rolls used for rooms 101–110"). The system logs who recorded it and when.
        </li>
        <li>
          <strong>Linked to food orders:</strong> If you set up kitchen ingredients as inventory items and link them to your menu items, the system can automatically deduct ingredients when a food order is completed. This requires setting up the recipe link in the menu item settings.
        </li>
      </ul>
      <p>
        Every usage is logged with a timestamp, so you can see a full history of who used what and when.
      </p>

      <h2 id="faq">6. FAQ</h2>
      <h3>Can I generate a purchase order from the inventory system?</h3>
      <p>Automatic purchase orders are on the roadmap. For now, use the export function to download a list of low-stock items and send it to your suppliers manually.</p>

      <h3>Can I track the cost of inventory used?</h3>
      <p>Yes — if you add a <strong>Cost per Unit</strong> when creating an item, the system will calculate the total cost of each usage record. You can view total inventory cost in the <strong>Reports</strong> section.</p>

      <h3>Who can see and edit inventory?</h3>
      <p>Manager and Owner roles have full access. Staff with specific inventory permissions can record usage. Partners and Receptionists cannot access inventory by default.</p>
    </DocLayout>
  );
}
