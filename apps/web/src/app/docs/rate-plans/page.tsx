import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'what-are-rate-plans',   label: '1. What are rate plans' },
  { id: 'creating-a-rate-plan',  label: '2. Creating a rate plan' },
  { id: 'seasonal-pricing',      label: '3. Seasonal pricing' },
  { id: 'linking-to-rooms',      label: '4. Linking rate plans to rooms' },
  { id: 'yield-management',      label: '5. Yield management tips' },
  { id: 'faq',                   label: '6. FAQ' },
];

export default function RatePlansPage() {
  return (
    <DocLayout
      title="Rate Plans"
      description="Set up flexible pricing rules — seasonal rates, meal plans, minimum stays, and advance booking discounts — all without a spreadsheet."
      readTime="6 min read"
      tag="Pricing"
      tagColor="bg-amber-100 text-amber-700"
      toc={TOC}
    >

      {/* ── 1. What are rate plans ────────────────────────────────────── */}
      <h2 id="what-are-rate-plans">1. What are rate plans</h2>
      <p>
        A <strong>rate plan</strong> is a pricing rule that determines how much a guest pays for a room,
        and under what conditions. Instead of having a single fixed price per room, rate plans let you
        create flexible pricing based on meal inclusions, season, length of stay, and booking timing.
      </p>
      <p>Examples of rate plans you might set up:</p>
      <ul>
        <li><strong>Room Only (RO)</strong> — No meals included, base price only.</li>
        <li><strong>Bed &amp; Breakfast (BB)</strong> — Room plus breakfast; slightly higher rate.</li>
        <li><strong>Half Board (HB)</strong> — Room, breakfast, and dinner.</li>
        <li><strong>Full Board (FB)</strong> — Room plus all three meals.</li>
        <li><strong>All Inclusive (AI)</strong> — Room, all meals, drinks, and activities.</li>
        <li><strong>Early Bird</strong> — 15% discount for bookings made 30+ days in advance.</li>
        <li><strong>Weekend Rate</strong> — Higher price for Friday/Saturday nights.</li>
      </ul>
      <div className="info-box">
        <strong>Why this matters:</strong> Rate plans are the key to maximising your revenue without
        manually adjusting prices every day. Set them up once, and they work automatically.
      </div>

      {/* ── 2. Creating a rate plan ───────────────────────────────────── */}
      <h2 id="creating-a-rate-plan">2. Creating a rate plan</h2>
      <ol>
        <li>Go to <strong>Rate Plans</strong> in the sidebar.</li>
        <li>Click <strong>"Add Rate Plan"</strong>.</li>
        <li>Fill in the fields described below.</li>
        <li>Click <strong>"Save Rate Plan"</strong>.</li>
      </ol>

      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Description</th>
            <th>Example</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Name</strong></td>
            <td>Short name for this rate plan</td>
            <td>Bed &amp; Breakfast</td>
          </tr>
          <tr>
            <td><strong>Base Rate</strong></td>
            <td>Nightly price for this plan (can be a fixed amount or a percentage markup over the room's base price)</td>
            <td>৳ 6,500 / night or +15%</td>
          </tr>
          <tr>
            <td><strong>Meal Plan</strong></td>
            <td>What meals are included (Room Only, B&amp;B, Half Board, Full Board, All Inclusive)</td>
            <td>Breakfast only</td>
          </tr>
          <tr>
            <td><strong>Minimum Stay</strong></td>
            <td>Minimum number of nights required to use this rate</td>
            <td>2 nights</td>
          </tr>
          <tr>
            <td><strong>Maximum Stay</strong></td>
            <td>Optional maximum stay (leave blank for no limit)</td>
            <td>14 nights</td>
          </tr>
          <tr>
            <td><strong>Advance Booking</strong></td>
            <td>Minimum days in advance the booking must be made to qualify</td>
            <td>7 days in advance</td>
          </tr>
          <tr>
            <td><strong>Discount</strong></td>
            <td>Percentage discount applied on top of the base rate</td>
            <td>10% off</td>
          </tr>
          <tr>
            <td><strong>Cancellation Policy</strong></td>
            <td>How many days before check-in cancellation is free; penalty after that</td>
            <td>Free until 48 hours before; 1 night charge after</td>
          </tr>
          <tr>
            <td><strong>Valid Dates</strong></td>
            <td>Date range when this rate plan is active (leave blank for year-round)</td>
            <td>1 Jun – 31 Aug 2026</td>
          </tr>
        </tbody>
      </table>

      {/* ── 3. Seasonal pricing ───────────────────────────────────────── */}
      <h2 id="seasonal-pricing">3. Seasonal pricing</h2>
      <p>
        Hotels and resorts typically have different prices for peak season, off-season, and shoulder season.
        The easiest way to manage this is to create separate rate plans for each season:
      </p>
      <ul>
        <li><strong>Peak Season Rate</strong> — December to January, school holidays; highest prices.</li>
        <li><strong>Shoulder Season Rate</strong> — March to May, September to November; mid-range prices.</li>
        <li><strong>Off-Season Rate</strong> — June to August; lowest prices to attract bookings.</li>
      </ul>
      <p>
        Set the <strong>Valid Dates</strong> field on each rate plan to the relevant season dates.
        ResortPro automatically applies the correct rate plan when a guest books for dates that fall
        within that season.
      </p>
      <blockquote>
        <strong>Note:</strong> If two rate plans are valid for the same dates, the system uses the one
        with the lower price for direct website bookings, and the one you manually select when creating
        a booking from the dashboard.
      </blockquote>

      {/* ── 4. Linking to rooms ───────────────────────────────────────── */}
      <h2 id="linking-to-rooms">4. How rate plans link to rooms</h2>
      <p>
        A rate plan can apply to all rooms, specific room types, or individual rooms. When creating
        or editing a rate plan, you will see a section called <strong>Applicable Rooms</strong>.
      </p>
      <ul>
        <li>Choose <strong>All Rooms</strong> to apply the rate plan across your entire property.</li>
        <li>Choose <strong>By Room Type</strong> to apply it only to Suites, Villas, etc.</li>
        <li>Choose <strong>Specific Rooms</strong> to apply it to individual rooms you select.</li>
      </ul>
      <p>
        When a receptionist or guest selects a room for a booking, ResortPro shows all available rate
        plans for that room, and the booker chooses which one applies.
      </p>

      {/* ── 5. Yield management tips ──────────────────────────────────── */}
      <h2 id="yield-management">5. Yield management tips</h2>
      <p>
        <strong>Yield management</strong> (also called revenue management) is the practice of adjusting
        prices based on demand to maximise revenue. Here are practical tips:
      </p>
      <ul>
        <li>
          <strong>Increase prices for high-demand dates</strong> — Create a special rate plan for
          national holidays, festivals, and local events with a higher base rate.
        </li>
        <li>
          <strong>Offer early bird discounts</strong> — Reward guests who book 30+ days in advance
          with a 10–15% discount. This helps you fill rooms earlier and plan staffing.
        </li>
        <li>
          <strong>Add minimum stay requirements on peak weekends</strong> — Set a 2-night minimum
          on Saturday nights to prevent single-night gaps that are hard to fill.
        </li>
        <li>
          <strong>Use last-minute deals</strong> — If a room is still empty 3 days before the date,
          create a short-lived rate plan with a 20% discount to fill it.
        </li>
        <li>
          <strong>Track your occupancy rate in Reports</strong> — If occupancy is consistently above
          90%, your prices may be too low. If it's below 60%, consider targeted discounts.
        </li>
      </ul>
      <div className="info-box">
        <strong>Tip:</strong> Check the <a href="/docs/reports" className="text-[#1a6b5e] underline">Reports page</a> monthly
        to see your ADR (Average Daily Rate) and RevPAR. These numbers tell you whether your rate
        plans are working.
      </div>

      {/* ── 6. FAQ ───────────────────────────────────────────────────── */}
      <h2 id="faq">6. Frequently asked questions</h2>

      <h3>How many rate plans can I create?</h3>
      <p>
        There is no hard limit on the number of rate plans. Create as many as you need — one per
        season, one per meal plan, one for corporate guests, etc.
      </p>

      <h3>Can I set different prices for weekdays vs weekends?</h3>
      <p>
        Yes. Create a "Weekend Rate" plan and use the <strong>Day of Week</strong> setting to apply
        it only on Friday and Saturday nights.
      </p>

      <h3>What happens if I change a rate plan — does it affect existing bookings?</h3>
      <p>
        No. Existing bookings keep the price they were originally booked at. Changes only affect
        new bookings made after the update.
      </p>

      <h3>Can I have a non-refundable rate?</h3>
      <p>
        Yes. Set the <strong>Cancellation Policy</strong> to "Non-refundable" — this means no refund
        is given if the guest cancels, regardless of how far in advance. Non-refundable rates are
        typically priced 10–20% lower to attract the right guests.
      </p>

    </DocLayout>
  );
}
