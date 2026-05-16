import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'overview',            label: '1. Overview of the Rooms page' },
  { id: 'how-to-add-a-room',  label: '2. How to add a room' },
  { id: 'room-types',         label: '3. Room types explained' },
  { id: 'room-status',        label: '4. Managing room status' },
  { id: 'uploading-photos',   label: '5. Uploading photos' },
  { id: 'faq',                label: '6. FAQ' },
];

export default function RoomsPage() {
  return (
    <DocLayout
      title="Managing Rooms"
      description="Add, edit, and organise every room, villa, or cabin in your property — with photos, amenities, and live status tracking."
      readTime="6 min read"
      tag="Rooms"
      tagColor="bg-green-100 text-green-700"
      toc={TOC}
    >

      {/* ── 1. Overview ───────────────────────────────────────────────── */}
      <h2 id="overview">1. Overview of the Rooms page</h2>
      <p>
        The <strong>Rooms</strong> page is your central inventory of every accommodation unit you manage.
        From here you can add new rooms, update their details, track their live status, and upload photos
        that appear on your public website and booking widget.
      </p>
      <p>
        Each room card shows its name, type, current status, floor, base rate, and thumbnail photo
        at a glance. You can filter by type or status using the tabs at the top, and search by room name
        or number using the search bar.
      </p>
      <div className="info-box">
        <strong>Good to know:</strong> Rooms you create here automatically appear in the booking form,
        calendar, and your public website — so keep your room list up to date.
      </div>

      {/* ── 2. How to add a room ──────────────────────────────────────── */}
      <h2 id="how-to-add-a-room">2. How to add a room</h2>
      <p>Follow these steps to add a new room to your property:</p>
      <ol>
        <li>Go to <strong>Rooms</strong> in the left sidebar.</li>
        <li>Click <strong>"Add Room"</strong> in the top-right corner.</li>
        <li>Fill in the room details (see table below).</li>
        <li>Add amenities by clicking the checkboxes in the amenities panel.</li>
        <li>Upload up to 8 photos in the Photos section.</li>
        <li>Click <strong>"Save Room"</strong>.</li>
      </ol>

      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>What to enter</th>
            <th>Example</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Room Name</strong></td>
            <td>A short, friendly name for this room</td>
            <td>Beachfront Suite 201</td>
          </tr>
          <tr>
            <td><strong>Room Number</strong></td>
            <td>The physical room or villa number</td>
            <td>201</td>
          </tr>
          <tr>
            <td><strong>Type</strong></td>
            <td>Select from Standard, Deluxe, Suite, Villa, or Cabin</td>
            <td>Suite</td>
          </tr>
          <tr>
            <td><strong>Floor</strong></td>
            <td>Which floor the room is on</td>
            <td>2nd Floor</td>
          </tr>
          <tr>
            <td><strong>Capacity</strong></td>
            <td>Max adults and max children</td>
            <td>2 adults, 1 child</td>
          </tr>
          <tr>
            <td><strong>Description</strong></td>
            <td>A short paragraph describing the room for guests</td>
            <td>Spacious suite with ocean view and private balcony</td>
          </tr>
          <tr>
            <td><strong>Base Price</strong></td>
            <td>The nightly rate in your local currency</td>
            <td>৳ 8,500 / night</td>
          </tr>
          <tr>
            <td><strong>Amenities</strong></td>
            <td>Tick all that apply (Wi-Fi, AC, TV, minibar, etc.)</td>
            <td>Wi-Fi, AC, King Bed, Ocean View</td>
          </tr>
        </tbody>
      </table>

      <div className="info-box">
        <strong>Tip:</strong> Write a compelling room description — this text appears directly on your public
        website and booking widget. Mention the view, bed type, and any special features.
      </div>

      {/* ── 3. Room types ─────────────────────────────────────────────── */}
      <h2 id="room-types">3. Room types explained</h2>
      <p>
        ResortPro supports five room types. Choose the one that best describes each accommodation unit.
        Types are used for filtering in the booking form and on your website.
      </p>

      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Best for</th>
            <th>Typical features</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Standard</strong></td>
            <td>Budget-friendly or basic rooms</td>
            <td>Queen/twin beds, essential amenities, smaller size</td>
          </tr>
          <tr>
            <td><strong>Deluxe</strong></td>
            <td>Mid-range rooms with extra comfort</td>
            <td>King bed, upgraded furnishings, better view</td>
          </tr>
          <tr>
            <td><strong>Suite</strong></td>
            <td>Premium rooms with separate living areas</td>
            <td>Living room, premium bath, minibar, extra space</td>
          </tr>
          <tr>
            <td><strong>Villa</strong></td>
            <td>Standalone private villas</td>
            <td>Private pool, garden, full kitchen, multiple bedrooms</td>
          </tr>
          <tr>
            <td><strong>Cabin</strong></td>
            <td>Eco-lodges, treehouse stays, glamping</td>
            <td>Rustic or natural setting, unique experience</td>
          </tr>
        </tbody>
      </table>

      {/* ── 4. Room status ────────────────────────────────────────────── */}
      <h2 id="room-status">4. Managing room status</h2>
      <p>
        Every room has a live <strong>status</strong> that tells your team at a glance whether the room
        is available to book or not. Status updates automatically when a booking is made or completed,
        but you can also change it manually.
      </p>

      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Meaning</th>
            <th>Color</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Available</strong></td>
            <td>Room is clean, ready, and can be booked</td>
            <td>Green</td>
          </tr>
          <tr>
            <td><strong>Occupied</strong></td>
            <td>A guest is currently checked in</td>
            <td>Blue</td>
          </tr>
          <tr>
            <td><strong>Maintenance</strong></td>
            <td>Room is undergoing repairs or servicing</td>
            <td>Amber</td>
          </tr>
          <tr>
            <td><strong>Out of Order</strong></td>
            <td>Room is not usable and cannot be booked</td>
            <td>Red</td>
          </tr>
        </tbody>
      </table>

      <h3>How to change a room status manually</h3>
      <ol>
        <li>Click on the room card to open the detail panel.</li>
        <li>Click the <strong>Status</strong> badge at the top of the panel.</li>
        <li>Select the new status from the dropdown.</li>
        <li>Add an optional note (for example, "Pipe leak — waiting for plumber").</li>
        <li>Click <strong>Save</strong>.</li>
      </ol>
      <blockquote>
        <strong>Note:</strong> Rooms with <strong>Maintenance</strong> or <strong>Out of Order</strong> status
        are automatically hidden from the booking widget so guests cannot book them.
      </blockquote>

      {/* ── 5. Uploading photos ───────────────────────────────────────── */}
      <h2 id="uploading-photos">5. Uploading photos</h2>
      <p>
        Great photos are one of the most effective ways to increase direct bookings. You can upload
        up to <strong>8 photos per room</strong>. The first photo becomes the thumbnail shown on your
        public website and booking widget.
      </p>

      <h3>How to upload photos</h3>
      <ol>
        <li>Open the room detail panel (click any room card).</li>
        <li>Scroll down to the <strong>Photos</strong> section.</li>
        <li>Drag and drop image files from your computer onto the upload area, or click the area to browse.</li>
        <li>Accepted formats: <strong>JPG, PNG, WebP</strong>. Maximum size: 5 MB per image.</li>
        <li>Drag photos in the grid to reorder them — the first one is the main photo.</li>
        <li>Click the × button on any photo to remove it.</li>
        <li>Click <strong>Save</strong> when done.</li>
      </ol>
      <div className="info-box">
        <strong>Photo tips:</strong> Use landscape-orientation photos (wider than tall) for best results.
        Aim for bright, natural light. Include at least one photo of the bedroom, bathroom, and view.
        Minimum recommended resolution: 1200 × 800 pixels.
      </div>

      {/* ── 6. FAQ ───────────────────────────────────────────────────── */}
      <h2 id="faq">6. Frequently asked questions</h2>

      <h3>Can I have two rooms with the same name?</h3>
      <p>
        Yes, but it is not recommended. Room names appear in the booking form and reports — unique names
        make it much easier to track which room is which.
      </p>

      <h3>Can I temporarily disable a room without deleting it?</h3>
      <p>
        Yes. Set the status to <strong>Out of Order</strong>. The room will be hidden from the booking
        widget but all its history and settings are preserved.
      </p>

      <h3>Can I delete a room?</h3>
      <p>
        You can archive a room if it has no active or upcoming bookings. Go to the room detail panel
        and click <strong>Archive Room</strong> at the bottom. Archived rooms are hidden from the dashboard
        but their booking history is retained for reporting.
      </p>

      <h3>Does changing the base price affect existing bookings?</h3>
      <p>
        No. Existing bookings keep the price they were made at. The new base price only applies to
        future bookings.
      </p>

      <h3>How many rooms can I add?</h3>
      <p>
        The number of rooms depends on your ResortPro plan. Check your current limit under
        <strong> Billing → Plan Details</strong>.
      </p>

      <h3>What amenities can I add to a room?</h3>
      <p>
        Common amenities include: Wi-Fi, Air Conditioning, Heating, Private Pool, Minibar, TV, Balcony,
        Ocean View, Garden View, Kitchenette, Bathtub, Safe, Workspace, and more. If you need a custom
        amenity, type it in the custom amenities field.
      </p>

    </DocLayout>
  );
}
