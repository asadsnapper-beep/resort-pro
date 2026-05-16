import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'analytics-overview',    label: '1. Analytics overview' },
  { id: 'key-metrics',           label: '2. Key metrics explained' },
  { id: 'booking-trends',        label: '3. Booking trends chart' },
  { id: 'top-performing-rooms',  label: '4. Top-performing rooms' },
  { id: 'revenue-by-source',     label: '5. Revenue by source' },
  { id: 'setting-goals',         label: '6. Setting performance goals' },
  { id: 'faq',                   label: '7. FAQ' },
];

export default function AnalyticsPage() {
  return (
    <DocLayout
      title="Analytics Dashboard"
      description="Monitor your resort's live performance with real-time metrics, trend charts, and room-by-room breakdowns."
      readTime="5 min read"
      tag="Analytics"
      tagColor="bg-indigo-100 text-indigo-700"
      toc={TOC}
    >
      <h2 id="analytics-overview">1. Analytics overview</h2>
      <p>
        The Analytics dashboard is your live view of how your resort is performing right now.
        Unlike the Reports page (which shows historical data), Analytics gives you a real-time snapshot —
        how many rooms are occupied today, how much revenue has come in this week, and what the current
        occupancy rate is.
      </p>
      <p>
        Go to <strong>Dashboard → Analytics</strong> to see your metrics.
      </p>
      <div className="info-box">
        <strong>Analytics vs Reports:</strong> Analytics = live, current-day view. Reports = historical analysis for any date range. Use Analytics for daily operations; use Reports for planning and accounting.
      </div>

      <h2 id="key-metrics">2. Key metrics explained</h2>
      <table>
        <thead>
          <tr><th>Metric</th><th>What it means</th><th>How to improve it</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Occupancy Rate</strong></td>
            <td>% of your rooms that are occupied right now (or tonight)</td>
            <td>Better marketing, competitive pricing, OTA visibility</td>
          </tr>
          <tr>
            <td><strong>ADR</strong><br /><small>Average Daily Rate</small></td>
            <td>Average price you charged per occupied room today</td>
            <td>Upsell to higher room types, reduce heavy discounts</td>
          </tr>
          <tr>
            <td><strong>RevPAR</strong><br /><small>Revenue Per Available Room</small></td>
            <td>ADR × Occupancy Rate — combines price and volume</td>
            <td>The key number to optimise — balance price and occupancy</td>
          </tr>
          <tr>
            <td><strong>Total Revenue (Today)</strong></td>
            <td>All income recorded today — rooms, food, packages</td>
            <td>Add revenue streams (restaurant, packages, activities)</td>
          </tr>
          <tr>
            <td><strong>Arrivals Today</strong></td>
            <td>Number of guests checking in today</td>
            <td>Informational — helps front desk prepare</td>
          </tr>
          <tr>
            <td><strong>Departures Today</strong></td>
            <td>Number of guests checking out today</td>
            <td>Informational — helps housekeeping plan their day</td>
          </tr>
          <tr>
            <td><strong>Pending Check-ins</strong></td>
            <td>Confirmed bookings for today that haven't checked in yet</td>
            <td>Use for follow-up calls to guests running late</td>
          </tr>
        </tbody>
      </table>

      <h2 id="booking-trends">3. Booking trends chart</h2>
      <p>
        The booking trends chart shows your reservation volume over the last 30 days, broken down by:
      </p>
      <ul>
        <li><strong>New bookings</strong> — bookings created each day</li>
        <li><strong>Cancellations</strong> — bookings cancelled each day</li>
        <li><strong>Net bookings</strong> — new bookings minus cancellations</li>
      </ul>
      <p>
        Look for patterns: Are most bookings made on certain days of the week? Do you see a cancellation spike after weekends? These patterns help you decide when to run promotions and when to enforce stricter cancellation policies.
      </p>

      <h2 id="top-performing-rooms">4. Top-performing rooms</h2>
      <p>
        The Top Rooms table shows which of your rooms generates the most revenue and has the highest occupancy.
        This helps you understand:
      </p>
      <ul>
        <li>Which room types guests prefer — useful when deciding what to add or renovate</li>
        <li>Which rooms are underperforming and may need better photos or a price adjustment</li>
        <li>Whether premium rooms (suites, villas) are priced high enough relative to their demand</li>
      </ul>

      <h2 id="revenue-by-source">5. Revenue by source</h2>
      <p>
        The revenue breakdown shows how much money came from each part of your business:
      </p>
      <table>
        <thead><tr><th>Source</th><th>What it includes</th></tr></thead>
        <tbody>
          <tr><td><strong>Accommodation</strong></td><td>All room revenue from completed stays and current bookings</td></tr>
          <tr><td><strong>Food & Beverage</strong></td><td>Restaurant orders and in-room dining</td></tr>
          <tr><td><strong>Packages</strong></td><td>Sold packages (honeymoon, family, etc.)</td></tr>
          <tr><td><strong>Extras</strong></td><td>Airport transfers, activity bookings, late check-out fees</td></tr>
        </tbody>
      </table>
      <p>
        Most resorts earn 70–80% from accommodation and 20–30% from F&B and extras. If your F&B revenue is very low,
        it may be worth investing in your restaurant or promoting room service more actively.
      </p>

      <h2 id="setting-goals">6. Setting performance goals</h2>
      <p>
        You can set monthly targets for your key metrics in <strong>Analytics → Goals</strong>. ResortPro will show a progress bar on the dashboard so you can see at a glance how you're tracking.
      </p>
      <p>Suggested starting goals for a new ResortPro user:</p>
      <ul>
        <li><strong>Occupancy Rate:</strong> 65% (peak season), 40% (off-season)</li>
        <li><strong>ADR:</strong> Based on your current room prices — aim to grow by 5–10% per year</li>
        <li><strong>% of direct bookings:</strong> 40%+ (reducing OTA dependency)</li>
        <li><strong>Guest return rate:</strong> 20%+ repeat bookings within 12 months</li>
      </ul>

      <h2 id="faq">7. FAQ</h2>
      <h3>Is the analytics data real-time or does it update periodically?</h3>
      <p>The occupancy numbers and today's revenue update in real-time as bookings are created or payments are recorded. The trend charts and graphs refresh every 15 minutes.</p>

      <h3>Can I set up a daily summary email with my key metrics?</h3>
      <p>Yes — go to <strong>Settings → Notifications</strong> and enable <strong>Daily Performance Summary</strong>. You'll receive an email every morning with yesterday's key metrics.</p>

      <h3>Who can see analytics?</h3>
      <p>Owner, Manager, and Partner roles can see analytics. Partners have read-only access. Receptionists, Marketers, and Staff cannot see financial analytics by default.</p>
    </DocLayout>
  );
}
