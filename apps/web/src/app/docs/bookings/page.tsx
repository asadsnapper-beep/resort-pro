import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'what-is-bookings',         label: '1. The Bookings page' },
  { id: 'creating-a-new-booking',   label: '2. Creating a new booking' },
  { id: 'check-in-and-check-out',   label: '3. Check-in and check-out' },
  { id: 'booking-statuses',         label: '4. Booking statuses explained' },
  { id: 'modifying-cancelling',     label: '5. Modifying or cancelling' },
  { id: 'group-bookings',           label: '6. Group bookings' },
  { id: 'faq',                      label: '7. FAQ' },
];

export default function BookingsPage() {
  return (
    <DocLayout
      title="Managing Bookings"
      description="Create, manage, and track every reservation — from the first booking to final check-out."
      readTime="7 min read"
      tag="Bookings"
      tagColor="bg-blue-100 text-blue-700"
      toc={TOC}
    >

      {/* ── 1. What is the Bookings page ──────────────────────────────── */}
      <h2 id="what-is-bookings">1. The Bookings page</h2>
      <p>
        The <strong>Bookings</strong> page is where every reservation lives. Whether a guest books
        directly through your website, calls the front desk, or books via a channel like Airbnb,
        all bookings end up here.
      </p>
      <p>
        From this page you can create new reservations, check guests in and out, view booking details,
        print confirmation letters, and track the status of every stay.
      </p>
      <div className="info-box">
        <strong>Quick access:</strong> Use the search bar to find any booking by guest name, booking ID,
        or room number. Use the date picker and status filters to narrow the list.
      </div>

      {/* ── 2. Creating a new booking ─────────────────────────────────── */}
      <h2 id="creating-a-new-booking">2. Creating a new booking</h2>
      <p>
        To create a booking manually (for a walk-in guest or a phone/email reservation):
      </p>
      <ol>
        <li>Go to <strong>Bookings</strong> in the sidebar.</li>
        <li>Click <strong>"New Booking"</strong> in the top-right corner.</li>
        <li>Fill in the booking details (see below).</li>
        <li>Click <strong>"Confirm Booking"</strong>.</li>
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
            <td><strong>Guest Name</strong></td>
            <td>Start typing to search existing guests, or enter a new name to create a new guest profile automatically.</td>
          </tr>
          <tr>
            <td><strong>Room</strong></td>
            <td>Select from available rooms for the chosen dates. Rooms already booked for those dates are grayed out.</td>
          </tr>
          <tr>
            <td><strong>Check-in Date</strong></td>
            <td>The date and expected time of arrival.</td>
          </tr>
          <tr>
            <td><strong>Check-out Date</strong></td>
            <td>The date of departure. The system calculates the number of nights automatically.</td>
          </tr>
          <tr>
            <td><strong>Adults / Children</strong></td>
            <td>Number of adults and children staying. Must not exceed the room's capacity.</td>
          </tr>
          <tr>
            <td><strong>Rate Plan</strong></td>
            <td>Choose a rate plan (e.g. Bed &amp; Breakfast, Room Only). This sets the nightly price.</td>
          </tr>
          <tr>
            <td><strong>Special Requests</strong></td>
            <td>Any guest requests — extra bed, flowers on arrival, dietary needs, etc.</td>
          </tr>
          <tr>
            <td><strong>Source</strong></td>
            <td>Where did this booking come from? (Direct, Airbnb, Booking.com, Walk-in, Phone, etc.)</td>
          </tr>
        </tbody>
      </table>

      <p>
        Once confirmed, the booking appears in the list with a <strong>Confirmed</strong> status,
        the room is blocked in the calendar, and an optional confirmation email can be sent to the guest.
      </p>
      <div className="info-box">
        <strong>Tip:</strong> If the guest already exists in your system (from a previous stay),
        their profile is linked automatically — saving you time and keeping their stay history intact.
      </div>

      {/* ── 3. Check-in and check-out ─────────────────────────────────── */}
      <h2 id="check-in-and-check-out">3. Check-in and check-out process</h2>

      <h3>Checking a guest in</h3>
      <ol>
        <li>Find the booking in the <strong>Bookings</strong> list (use the "Today" filter for quick access).</li>
        <li>Click on the booking to open the detail sheet.</li>
        <li>Review the guest details and confirm the room is ready.</li>
        <li>Click <strong>"Check In"</strong>.</li>
        <li>The status changes to <strong>Checked In</strong> and the room status changes to <strong>Occupied</strong>.</li>
      </ol>
      <blockquote>
        <strong>Note:</strong> You can only check in on or after the booking's check-in date.
        If a guest arrives early, use the <strong>Early Check-In</strong> option which logs the actual
        arrival time separately.
      </blockquote>

      <h3>Checking a guest out</h3>
      <ol>
        <li>Find the booking (use the "Today's Check-outs" filter).</li>
        <li>Click on the booking to open the detail sheet.</li>
        <li>Review the folio — add any extra charges (room service, late check-out fee, mini-bar).</li>
        <li>Click <strong>"Check Out"</strong>.</li>
        <li>Select the payment method and mark payment as received.</li>
        <li>The status changes to <strong>Checked Out</strong> and the room goes to <strong>Housekeeping</strong> status.</li>
      </ol>
      <div className="info-box">
        <strong>Tip:</strong> After check-out, a housekeeping task is automatically created for the room
        so your cleaning team is notified immediately.
      </div>

      {/* ── 4. Booking statuses ───────────────────────────────────────── */}
      <h2 id="booking-statuses">4. Booking statuses explained</h2>

      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>What it means</th>
            <th>Color</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Confirmed</strong></td>
            <td>Booking is made and the room is reserved. Guest has not yet arrived.</td>
            <td>Green</td>
          </tr>
          <tr>
            <td><strong>Checked In</strong></td>
            <td>Guest has arrived and is currently staying in the room.</td>
            <td>Blue</td>
          </tr>
          <tr>
            <td><strong>Checked Out</strong></td>
            <td>Guest has left. Stay is complete.</td>
            <td>Gray</td>
          </tr>
          <tr>
            <td><strong>Cancelled</strong></td>
            <td>Booking was cancelled before the stay. Room is freed up.</td>
            <td>Red</td>
          </tr>
          <tr>
            <td><strong>No Show</strong></td>
            <td>Guest did not arrive and did not cancel. Use this to free the room and record the event.</td>
            <td>Amber</td>
          </tr>
        </tbody>
      </table>

      {/* ── 5. Modifying or cancelling ────────────────────────────────── */}
      <h2 id="modifying-cancelling">5. Modifying or cancelling a booking</h2>

      <h3>Modifying a booking</h3>
      <p>You can modify any booking that is in <strong>Confirmed</strong> status:</p>
      <ol>
        <li>Open the booking detail sheet.</li>
        <li>Click <strong>"Edit Booking"</strong>.</li>
        <li>Change dates, room, guest count, or rate plan as needed.</li>
        <li>Click <strong>"Save Changes"</strong>.</li>
      </ol>
      <p>The system recalculates the total and updates the calendar automatically.</p>

      <h3>Cancelling a booking</h3>
      <ol>
        <li>Open the booking detail sheet.</li>
        <li>Click <strong>"Cancel Booking"</strong> (bottom of the panel).</li>
        <li>Select a cancellation reason.</li>
        <li>Choose whether to issue a refund or apply a cancellation fee.</li>
        <li>Click <strong>"Confirm Cancellation"</strong>.</li>
      </ol>
      <blockquote>
        <strong>Note:</strong> Cancelling a <strong>Checked In</strong> booking requires Manager or Owner
        permission. Contact your manager if you need to cancel an in-progress stay.
      </blockquote>

      {/* ── 6. Group bookings ─────────────────────────────────────────── */}
      <h2 id="group-bookings">6. Group bookings</h2>
      <p>
        When a group of people books multiple rooms under one name (a wedding party, corporate retreat,
        school trip), use the <strong>Group Bookings</strong> feature instead of creating individual bookings.
      </p>
      <p>
        Group bookings let you manage all rooms under a single booking reference, apply group discounts,
        and choose between a master bill (one invoice for the whole group) or individual bills.
      </p>
      <p>
        Go to <strong>Group Bookings</strong> in the sidebar to create and manage group reservations.
        See the <a href="/docs/group-bookings" className="text-[#1a6b5e] underline">Group Bookings guide</a> for
        step-by-step instructions.
      </p>

      {/* ── 7. FAQ ───────────────────────────────────────────────────── */}
      <h2 id="faq">7. Frequently asked questions</h2>

      <h3>Can a guest book two rooms in one booking?</h3>
      <p>
        For multi-room reservations under one name, use <strong>Group Bookings</strong>. Standard bookings
        cover one room at a time.
      </p>

      <h3>Can I add extra charges after check-in?</h3>
      <p>
        Yes. Open the booking detail sheet while the guest is <strong>Checked In</strong> and click
        <strong> Add Charge</strong>. Add room service, minibar, laundry, or any custom charge.
        These appear on the final invoice at check-out.
      </p>

      <h3>Can I move a guest to a different room mid-stay?</h3>
      <p>
        Yes. Open the booking, click <strong>Edit Booking</strong>, and change the room. The system
        updates the calendar and notifies housekeeping automatically.
      </p>

      <h3>Does ResortPro send booking confirmation emails to guests?</h3>
      <p>
        Yes. When you create or confirm a booking, ResortPro can automatically send a confirmation
        email to the guest. You can configure the email template under <strong>Settings → Email Notifications</strong>.
      </p>

      <h3>What happens to the calendar when a booking is cancelled?</h3>
      <p>
        The room is released immediately and becomes available for new bookings. The cancelled booking
        remains in the list (marked Cancelled) so you have a full record.
      </p>

    </DocLayout>
  );
}
