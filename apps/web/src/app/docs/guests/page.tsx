import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'guest-profiles-overview',  label: '1. Guest profiles overview' },
  { id: 'what-is-stored',          label: '2. What is stored in a profile' },
  { id: 'adding-a-guest',          label: '3. Adding a guest manually' },
  { id: 'searching-filtering',     label: '4. Searching and filtering guests' },
  { id: 'tagging-vip',             label: '5. Tagging and VIP status' },
  { id: 'exporting',               label: '6. Exporting guest data' },
  { id: 'faq',                     label: '7. FAQ' },
];

export default function GuestsPage() {
  return (
    <DocLayout
      title="Managing Guests"
      description="Build rich guest profiles with booking history, preferences, loyalty points, and notes — all in one place."
      readTime="5 min read"
      tag="Guests"
      tagColor="bg-violet-100 text-violet-700"
      toc={TOC}
    >

      {/* ── 1. Overview ───────────────────────────────────────────────── */}
      <h2 id="guest-profiles-overview">1. Guest profiles overview</h2>
      <p>
        The <strong>Guests</strong> page is your guest directory. Every person who has ever booked
        a stay at your property has a profile here. ResortPro creates guest profiles automatically
        when a booking is made — but you can also add guests manually.
      </p>
      <p>
        Knowing your guests well is the foundation of great hospitality. A guest profile gives you
        instant access to their stay history, preferences, and loyalty status — so you can personalise
        their experience every time they visit.
      </p>
      <div className="info-box">
        <strong>Privacy:</strong> Guest data is stored securely and is only visible to your team.
        Guests can request their data or ask to be removed under GDPR/data protection rules —
        see the <a href="/docs/crm#gdpr-and-unsubscribe" className="text-[#1a6b5e] underline">CRM guide</a> for details.
      </div>

      {/* ── 2. What is stored ─────────────────────────────────────────── */}
      <h2 id="what-is-stored">2. What is stored in a guest profile</h2>

      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Contact info</strong></td>
            <td>Full name, email address, phone number, nationality, date of birth</td>
          </tr>
          <tr>
            <td><strong>Booking history</strong></td>
            <td>Every past, current, and upcoming stay — room, dates, total spend</td>
          </tr>
          <tr>
            <td><strong>Preferences</strong></td>
            <td>Pillow type, dietary restrictions, preferred room floor, special occasions</td>
          </tr>
          <tr>
            <td><strong>Notes</strong></td>
            <td>Free-text notes added by your team (e.g. "Celebrates anniversary in March")</td>
          </tr>
          <tr>
            <td><strong>Loyalty points</strong></td>
            <td>Current points balance, tier (Bronze / Silver / Gold), point history</td>
          </tr>
          <tr>
            <td><strong>Tags</strong></td>
            <td>Custom labels like "VIP", "Corporate", "Repeat Guest", "Influencer"</td>
          </tr>
          <tr>
            <td><strong>Source</strong></td>
            <td>Where the guest originally came from (Direct, Airbnb, Booking.com, etc.)</td>
          </tr>
          <tr>
            <td><strong>Communication history</strong></td>
            <td>Emails sent to this guest via the CRM module</td>
          </tr>
        </tbody>
      </table>

      {/* ── 3. Adding a guest manually ────────────────────────────────── */}
      <h2 id="adding-a-guest">3. Adding a guest manually</h2>
      <p>
        When a guest calls to book and is not in the system yet, you can add them manually:
      </p>
      <ol>
        <li>Go to <strong>Guests</strong> in the sidebar.</li>
        <li>Click <strong>"Add Guest"</strong> in the top-right corner.</li>
        <li>Enter their name, email, and phone number.</li>
        <li>Optionally fill in nationality, date of birth, and preferences.</li>
        <li>Click <strong>"Save Guest"</strong>.</li>
      </ol>
      <p>
        The new guest profile is now available to link when creating a booking.
      </p>
      <div className="info-box">
        <strong>Tip:</strong> You do not need to add guests manually before booking. When you create
        a new booking and type a name that doesn't exist, ResortPro creates a new guest profile
        automatically from the booking details.
      </div>

      {/* ── 4. Searching and filtering ────────────────────────────────── */}
      <h2 id="searching-filtering">4. Searching and filtering guests</h2>
      <p>
        The Guests page has a powerful search and filter system to help you find anyone quickly:
      </p>
      <ul>
        <li><strong>Search bar:</strong> Search by name, email address, or phone number.</li>
        <li><strong>Filter by tag:</strong> Show only VIPs, Corporate guests, etc.</li>
        <li><strong>Filter by source:</strong> Show guests who came from Airbnb, Booking.com, Direct, etc.</li>
        <li><strong>Filter by loyalty tier:</strong> Show Bronze, Silver, or Gold members.</li>
        <li><strong>Filter by stay date:</strong> Show guests who stayed in a specific date range.</li>
        <li><strong>Sort:</strong> Sort by name, total spend, number of stays, or last visit date.</li>
      </ul>

      {/* ── 5. Tagging and VIP status ─────────────────────────────────── */}
      <h2 id="tagging-vip">5. Tagging and VIP status</h2>
      <p>
        Tags help you segment and identify guests at a glance. You can create custom tags for
        your property.
      </p>
      <h3>Common tags</h3>
      <ul>
        <li><strong>VIP</strong> — High-value guests who deserve extra attention</li>
        <li><strong>Corporate</strong> — Business travellers on company accounts</li>
        <li><strong>Repeat Guest</strong> — Guests who have stayed more than 3 times</li>
        <li><strong>Honeymoon</strong> — Couples on their honeymoon stay</li>
        <li><strong>Influencer</strong> — Social media guests offering coverage</li>
        <li><strong>Complimentary</strong> — Guests staying on a complimentary basis</li>
      </ul>

      <h3>How to add a tag</h3>
      <ol>
        <li>Open the guest profile by clicking their name.</li>
        <li>Click <strong>"Add Tag"</strong> in the tags section.</li>
        <li>Select an existing tag or type a new one.</li>
        <li>Click <strong>Save</strong>.</li>
      </ol>
      <p>
        To mark a guest as <strong>VIP</strong>, click the star icon at the top of their profile.
        VIP guests get a gold star badge that appears anywhere their name shows up in the system
        — booking lists, housekeeping tasks, and the front desk view.
      </p>

      {/* ── 6. Exporting guest data ───────────────────────────────────── */}
      <h2 id="exporting">6. Exporting guest data</h2>
      <p>
        You can export your guest list to a CSV file for use in external tools or for record-keeping:
      </p>
      <ol>
        <li>Go to <strong>Guests</strong> in the sidebar.</li>
        <li>Apply any filters you want (e.g. only VIP guests, or guests from the last 6 months).</li>
        <li>Click <strong>"Export"</strong> in the top-right corner.</li>
        <li>Choose whether to export all fields or just basic contact info.</li>
        <li>Click <strong>"Download CSV"</strong>.</li>
      </ol>
      <blockquote>
        <strong>Note:</strong> Only <strong>Owner</strong> and <strong>Manager</strong> roles can export
        guest data. Exportable data includes names, emails, and booking history — but not payment details.
      </blockquote>

      {/* ── 7. FAQ ───────────────────────────────────────────────────── */}
      <h2 id="faq">7. Frequently asked questions</h2>

      <h3>Can the same email be used for two guest profiles?</h3>
      <p>
        No. Each email address is unique in the system. If a guest books twice with the same email,
        their stays are added to the same profile automatically.
      </p>

      <h3>Can guests update their own profile?</h3>
      <p>
        Not directly — guest portal self-service is on the product roadmap. For now, your team
        updates profiles from the dashboard.
      </p>

      <h3>How do I merge two duplicate guest profiles?</h3>
      <p>
        Open one of the duplicate profiles, click the <strong>Actions</strong> menu (three dots),
        and select <strong>Merge with another guest</strong>. Search for the duplicate and confirm.
        All bookings and points from both profiles are combined.
      </p>

      <h3>Can I delete a guest profile?</h3>
      <p>
        Guests with booking history cannot be deleted — their records are needed for financial reporting.
        To remove a guest's personal data for GDPR compliance, use the
        <strong> Anonymise Guest</strong> option, which replaces personal data with anonymous placeholders
        while keeping the booking record.
      </p>

    </DocLayout>
  );
}
