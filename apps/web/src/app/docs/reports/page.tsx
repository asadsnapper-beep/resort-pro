import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'why-reports-matter',       label: '1. Why reports matter' },
  { id: 'revenue-report',           label: '2. Revenue report' },
  { id: 'occupancy-report',         label: '3. Occupancy report' },
  { id: 'booking-sources-report',   label: '4. Booking sources' },
  { id: 'guest-analytics',          label: '5. Guest analytics' },
  { id: 'exporting-reports',        label: '6. Exporting reports' },
  { id: 'faq',                      label: '7. FAQ' },
];

export default function ReportsPage() {
  return (
    <DocLayout
      title="Reports & Analytics"
      description="Understand your resort's financial performance, occupancy trends, and guest behaviour — all from one place."
      readTime="6 min read"
      tag="Reports"
      tagColor="bg-green-100 text-green-700"
      toc={TOC}
    >
      <h2 id="why-reports-matter">1. Why reports matter</h2>
      <p>
        Running a resort without reports is like driving without a speedometer. Reports tell you how much money you are
        making, which rooms are most popular, where your guests are coming from, and when your busy and slow seasons are.
        ResortPro generates these reports automatically — you don't need to enter anything extra.
      </p>
      <div className="info-box">
        <strong>Tip:</strong> Check your reports every Monday morning. A 10-minute weekly review is enough to spot trends and make better decisions for the week ahead.
      </div>

      <h2 id="revenue-report">2. Revenue report</h2>
      <p>
        Go to <strong>Dashboard → Reports → Revenue</strong>. The revenue report shows your total income broken down by time period.
      </p>
      <table>
        <thead><tr><th>View</th><th>What it shows</th></tr></thead>
        <tbody>
          <tr><td><strong>Today</strong></td><td>All revenue collected today — rooms, food, packages</td></tr>
          <tr><td><strong>This Week</strong></td><td>7-day rolling total with a daily bar chart</td></tr>
          <tr><td><strong>This Month</strong></td><td>Month-to-date total vs. the same month last year</td></tr>
          <tr><td><strong>Custom Range</strong></td><td>Pick any start and end date to see revenue for that period</td></tr>
        </tbody>
      </table>
      <p>
        The chart breaks revenue into categories: <strong>Room Revenue</strong>, <strong>Food & Beverage</strong>,
        <strong>Packages</strong>, and <strong>Other</strong>. This tells you which part of your business is
        growing or shrinking.
      </p>

      <h2 id="occupancy-report">3. Occupancy report</h2>
      <p>
        The occupancy report answers: <em>"How full was my resort?"</em> It uses three hotel industry metrics:
      </p>
      <table>
        <thead><tr><th>Metric</th><th>What it means</th><th>Example</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>Occupancy Rate</strong></td>
            <td>% of rooms that were occupied on a given night</td>
            <td>12 out of 20 rooms = 60%</td>
          </tr>
          <tr>
            <td><strong>ADR</strong> (Average Daily Rate)</td>
            <td>Average price you charged per occupied room</td>
            <td>Total room revenue ÷ rooms sold = ৳4,500</td>
          </tr>
          <tr>
            <td><strong>RevPAR</strong> (Revenue Per Available Room)</td>
            <td>ADR × Occupancy Rate — your overall revenue efficiency</td>
            <td>৳4,500 × 60% = ৳2,700</td>
          </tr>
        </tbody>
      </table>
      <div className="info-box">
        <strong>Goal:</strong> A healthy resort typically targets 70%+ occupancy during peak season and 40%+ during off-season. Use these benchmarks to set your own goals.
      </div>

      <h2 id="booking-sources-report">4. Booking sources report</h2>
      <p>
        This report shows <em>where</em> your bookings are coming from. Sources include:
      </p>
      <ul>
        <li><strong>Direct</strong> — booked on your ResortPro website or booking widget</li>
        <li><strong>Walk-in</strong> — created manually at the front desk</li>
        <li><strong>Phone</strong> — called and booked by staff</li>
        <li><strong>OTA</strong> — came via Airbnb, Booking.com, or another channel</li>
        <li><strong>Group</strong> — part of a group booking</li>
      </ul>
      <p>
        More direct bookings = more profit, because you pay zero commission. If most bookings are coming from OTAs,
        consider promoting your website widget to encourage guests to book directly next time.
      </p>

      <h2 id="guest-analytics">5. Guest analytics</h2>
      <p>
        The guest analytics section shows:
      </p>
      <ul>
        <li><strong>New vs. returning guests</strong> — how many guests are coming back</li>
        <li><strong>Average length of stay</strong> — how many nights guests typically stay</li>
        <li><strong>Top nationalities</strong> — where your guests are travelling from</li>
        <li><strong>Peak booking lead time</strong> — how far in advance guests typically book</li>
      </ul>
      <p>
        Use this data to focus your marketing. If 70% of guests are local, run local promotions. If guests book
        only 2–3 days in advance, early-bird discounts may not work well for you.
      </p>

      <h2 id="exporting-reports">6. Exporting reports</h2>
      <p>
        Every report can be exported. Click the <strong>Export</strong> button (top-right of the report page) and choose:
      </p>
      <ul>
        <li><strong>CSV</strong> — opens in Excel or Google Sheets for custom analysis</li>
        <li><strong>PDF</strong> — formatted report you can print or email to your accountant</li>
      </ul>
      <blockquote>
        <strong>Note:</strong> Only Owner and Manager roles can access the Reports section. Receptionists and other staff cannot view financial reports.
      </blockquote>

      <h2 id="faq">7. FAQ</h2>
      <h3>How far back does report data go?</h3>
      <p>Reports include all historical data from the day you started using ResortPro. There is no time limit.</p>

      <h3>Why is my revenue showing as ৳0 for some days?</h3>
      <p>This usually means no bookings were checked out on that day, or no payments were recorded. Check if bookings for that period have been marked as paid.</p>

      <h3>Can I share a report with my accountant?</h3>
      <p>Yes — export it as a PDF or CSV and send the file. You can also invite your accountant as a <strong>Partner</strong> role so they can view analytics directly in the dashboard.</p>

      <h3>Can I schedule automatic report emails?</h3>
      <p>Automatic report emails are on our roadmap. For now, export manually and set a calendar reminder for yourself.</p>
    </DocLayout>
  );
}
