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
      description="Set up flexible pricing rules — seasonal rates, weekend rates, room-specific pricing, and promo pricing — all without a spreadsheet."
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
        create flexible pricing based on season, day of week, minimum length of stay, and which room
        it applies to.
      </p>
      <p>The rate types you can pick from when creating a plan:</p>
      <ul>
        <li><strong>Standard</strong> — Default year-round rate.</li>
        <li><strong>Seasonal</strong> — Specific date-range pricing (peak/off-season, holidays).</li>
        <li><strong>Weekend</strong> — Friday–Saturday rates.</li>
        <li><strong>Promo</strong> — Highest priority; overrides every other plan when it applies.</li>
        <li><strong>Early Bird</strong> — A discounted plan you create and manage yourself; there's no automatic "30 days before arrival" trigger, so keep it active only while it should apply.</li>
        <li><strong>Last Minute</strong> — Same idea for filling rooms close to the date — you turn it on manually when you want it live.</li>
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
            <td><strong>Rate Type</strong></td>
            <td>Standard, Seasonal, Weekend, Promo, Early Bird, or Last Minute — sets its priority against other plans (see the tie-breaking note below)</td>
            <td>Seasonal</td>
          </tr>
          <tr>
            <td><strong>Plan Name</strong></td>
            <td>Short name for this rate plan</td>
            <td>Peak Season 2026</td>
          </tr>
          <tr>
            <td><strong>Price / Night</strong></td>
            <td>A flat nightly price — not a percentage markup over the room's base price</td>
            <td>৳6,500 / night</td>
          </tr>
          <tr>
            <td><strong>Room (optional)</strong></td>
            <td>Apply to one specific room, or leave blank to apply to every room</td>
            <td>Room #201, or blank for all rooms</td>
          </tr>
          <tr>
            <td><strong>Minimum Nights</strong></td>
            <td>Minimum length of stay required to use this rate (there's no separate maximum-stay field)</td>
            <td>2 nights</td>
          </tr>
          <tr>
            <td><strong>Applies on Days</strong></td>
            <td>Optional — restrict this plan to specific days of the week (e.g. Friday/Saturday for a weekend rate). Leave all days unchecked to apply to every day.</td>
            <td>Fri, Sat</td>
          </tr>
          <tr>
            <td><strong>Start Date / End Date</strong></td>
            <td>Date range when this rate plan is active (leave blank for year-round)</td>
            <td>1 Jun – 31 Aug 2026</td>
          </tr>
        </tbody>
      </table>
      <div className="info-box">
        <strong>Not in this form:</strong> meal-plan inclusions (Room Only/B&amp;B/Half Board etc.), percentage-based pricing, a maximum-stay field, an advance-booking-window rule, and a cancellation policy are not tracked on a rate plan — see the FAQ below for how to handle a non-refundable rate manually.
      </div>

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
        Set the <strong>Start Date</strong>/<strong>End Date</strong> fields on each rate plan to the
        relevant season dates. ResortPro automatically resolves and applies the correct rate — for
        bookings made from the dashboard, a walk-in, or your public website alike — whenever a stay
        falls within that range. There's nothing for staff or the guest to manually pick.
      </p>
      <blockquote>
        <strong>Note — tie-breaking order:</strong> if more than one active plan could apply to the
        same night, ResortPro picks by <strong>Rate Type priority</strong>: Promo &gt; Seasonal &gt;
        Weekend &gt; Early Bird &gt; Last Minute &gt; Standard. If two plans of the same type both
        match, a plan tied to that specific room wins over one that applies to all rooms. Price is not
        part of the tie-break.
      </blockquote>

      {/* ── 4. Linking to rooms ───────────────────────────────────────── */}
      <h2 id="linking-to-rooms">4. How rate plans link to rooms</h2>
      <p>
        A rate plan's <strong>Room</strong> field is either one specific room, or left blank to apply
        to every room in your property. There's no room-type or multi-room picker yet — for now, a
        plan meant for "all Villas" needs one rate plan per villa room (or set it up as a single
        property-wide plan if the price is the same across room types).
      </p>
      <p>
        Rate resolution happens automatically on the server whenever a booking is created or modified
        — the applicable plan (if any) is used without anyone needing to select it.
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
          <strong>Offer early bird discounts</strong> — Create an "Early Bird" plan with a 10–15%
          lower price for a future date range, and turn it on well ahead of time. There's no automatic
          "only if booked 30+ days out" check, so it applies to anyone who books while it's active —
          plan the on/off dates accordingly.
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
        There's no automated "non-refundable" flag on a rate plan yet — you'll need to enforce it
        manually. Name the plan clearly (e.g. "Non-Refundable Rate") and price it 10–20% lower to
        attract the right guests. When a guest with that rate cancels, use the{' '}
        <strong>Cancel Booking</strong> flow's cancellation-fee field and set it to the full amount
        paid, so nothing gets refunded.
      </p>

    </DocLayout>
  );
}
