import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'what-are-group-bookings',  label: '1. What are group bookings?' },
  { id: 'creating-a-group-booking', label: '2. Creating a group booking' },
  { id: 'group-billing',            label: '3. Group billing options' },
  { id: 'group-checkin',            label: '4. Managing group check-in' },
  { id: 'group-discounts',          label: '5. Discounts for groups' },
  { id: 'faq',                      label: '6. FAQ' },
];

export default function GroupBookingsPage() {
  return (
    <DocLayout
      title="Group Bookings"
      description="Handle wedding parties, corporate retreats, tour groups, and family reunions — all under one group reservation."
      readTime="5 min read"
      tag="Groups"
      tagColor="bg-violet-100 text-violet-700"
      toc={TOC}
    >
      <h2 id="what-are-group-bookings">1. What are group bookings?</h2>
      <p>
        A <strong>group booking</strong> is a single reservation that covers multiple rooms for the same dates,
        all linked to one organiser or event. Instead of creating 10 separate bookings for a wedding party,
        you create one group booking that includes all 10 rooms.
      </p>
      <p>
        Group bookings in ResortPro let you:
      </p>
      <ul>
        <li>Manage all rooms under one reservation record</li>
        <li>Bill the group organiser for everything at once, or bill each guest individually</li>
        <li>Check in all group members with a single action</li>
        <li>Apply a group discount across all rooms</li>
      </ul>

      <h2 id="creating-a-group-booking">2. Creating a group booking</h2>
      <ol>
        <li>Go to <strong>Dashboard → Group Bookings → New Group Booking</strong>.</li>
        <li>Enter a <strong>Group Name</strong> — e.g., "Ahmed Wedding Party" or "Dhaka Corporate Retreat 2026".</li>
        <li>Enter the <strong>Organiser's Name, Email, and Phone</strong> — this is your main contact person.</li>
        <li>Set the <strong>Check-in and Check-out Dates</strong> for the group (all rooms use the same dates).</li>
        <li>Click <strong>Add Rooms</strong> and select all the rooms the group needs. You can add as many rooms as are available for those dates.</li>
        <li>For each room, you can optionally assign a guest name (e.g., which wedding guest is in which room).</li>
        <li>Add any <strong>Special Requirements</strong> — airport transfers, welcome decorations, dietary needs, conference room booking.</li>
        <li>Choose the <strong>Billing Method</strong> (see below).</li>
        <li>Click <strong>Confirm Group Booking</strong>.</li>
      </ol>
      <div className="info-box">
        <strong>Tip:</strong> For large groups (10+ rooms), call or email the organiser first to agree on all details before creating the booking. It is much easier to get everything right upfront than to make many changes later.
      </div>

      <h2 id="group-billing">3. Group billing options</h2>
      <table>
        <thead><tr><th>Option</th><th>How it works</th><th>Best for</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>Master Bill</strong></td>
            <td>All rooms and extras are billed to one invoice for the organiser to pay</td>
            <td>Corporate stays, weddings where one person pays</td>
          </tr>
          <tr>
            <td><strong>Split Bill</strong></td>
            <td>Each guest pays for their own room and extras separately</td>
            <td>Tour groups, family reunions where each person pays for themselves</td>
          </tr>
          <tr>
            <td><strong>Hybrid</strong></td>
            <td>Organiser pays for rooms; individual guests pay for their own extras (food, minibar)</td>
            <td>Corporate retreats where the company covers accommodation but not personal expenses</td>
          </tr>
        </tbody>
      </table>

      <h2 id="group-checkin">4. Managing group check-in</h2>
      <p>
        When the group arrives, you have two options:
      </p>
      <ul>
        <li>
          <strong>Bulk check-in:</strong> Open the group booking and click <strong>Check In All</strong>. This marks all rooms in the group as checked in simultaneously. Use this for groups where you have already verified all guests' details.
        </li>
        <li>
          <strong>Individual check-in:</strong> Check in each room one by one from within the group booking. Use this if guests are arriving at different times throughout the day.
        </li>
      </ul>
      <p>
        Each room in the group booking also appears on the main calendar and bookings list, so your receptionist
        can see the full picture at all times.
      </p>

      <h2 id="group-discounts">5. Discounts for groups</h2>
      <p>
        You can apply a percentage discount or a fixed amount discount to the entire group booking:
      </p>
      <ol>
        <li>Open the group booking.</li>
        <li>Click <strong>Apply Discount</strong>.</li>
        <li>Choose <strong>Percentage</strong> (e.g., 15% off) or <strong>Fixed Amount</strong> (e.g., ৳5,000 off total).</li>
        <li>Add a reason (internal note, e.g., "Loyalty discount for returning corporate client").</li>
        <li>Click <strong>Apply</strong>. The discount is shown on the invoice.</li>
      </ol>
      <blockquote>
        <strong>Note:</strong> Only the Owner and Manager roles can apply discounts to bookings. Receptionists need to ask a manager to apply discounts.
      </blockquote>

      <h2 id="faq">6. FAQ</h2>
      <h3>What is the minimum number of rooms for a group booking?</h3>
      <p>There is no minimum — even 2 rooms can be grouped together if it makes billing or management easier. Group bookings are just a convenience tool.</p>

      <h3>Can I add more rooms to a group booking after it has been confirmed?</h3>
      <p>Yes — open the group booking and click <strong>Add Room</strong>. The new room is immediately part of the group.</p>

      <h3>Can I split a group booking if some guests check out early?</h3>
      <p>Yes. You can check out individual rooms from a group booking independently. The remaining rooms stay in the group.</p>

      <h3>How do I send one invoice to the group organiser?</h3>
      <p>Open the group booking, click <strong>Generate Invoice</strong>, and choose <strong>Master Invoice</strong>. This creates a single PDF invoice covering all rooms and extras that you can email to the organiser.</p>
    </DocLayout>
  );
}
