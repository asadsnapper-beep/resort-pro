import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'why-roles-matter',             label: '1. Why roles matter' },
  { id: 'the-7-roles',                  label: '2. The 7 roles at a glance' },
  { id: 'what-each-role-can-see',       label: '3. What each role can see' },
  { id: 'who-should-get-which-role',    label: '4. Who should get which role' },
  { id: 'how-to-invite-a-team-member',  label: '5. How to invite someone' },
  { id: 'faq',                          label: '6. FAQ' },
];

export default function UserRolesPage() {
  return (
    <DocLayout
      title="User Roles & Permissions"
      description="Control who sees what in your ResortPro dashboard. Learn about every role and how to invite your team."
      readTime="5 min read"
      tag="Account"
      tagColor="bg-violet-100 text-violet-700"
      toc={TOC}
    >

      {/* ── 1. Why roles matter ───────────────────────────────────────── */}
      <h2 id="why-roles-matter">1. Why roles matter</h2>
      <p>
        When you invite someone to your ResortPro account, you choose a <strong>role</strong> for them.
        The role controls exactly which parts of the dashboard they can see and use.
      </p>
      <ul>
        <li>A <strong>Receptionist</strong> should see bookings and guests — but not your revenue reports or billing.</li>
        <li>A <strong>Marketer</strong> needs access to email campaigns and analytics — but not housekeeping tasks.</li>
        <li>A <strong>Developer</strong> helping you set up the website widget only needs the Settings and Website pages.</li>
      </ul>
      <p>
        Roles protect your data and keep the dashboard clean for each team member — they only see what's relevant to their job.
      </p>

      {/* ── 2. The 7 roles ───────────────────────────────────────────── */}
      <h2 id="the-7-roles">2. The 7 roles at a glance</h2>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Best for</th>
            <th>Access level</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>🏆 <strong>Owner</strong></td><td>You — the resort owner</td><td>Everything, including billing</td></tr>
          <tr><td>🛡️ <strong>Manager</strong></td><td>General manager, deputy</td><td>Everything except billing</td></tr>
          <tr><td>🤝 <strong>Partner</strong></td><td>Investor, silent partner</td><td>Read-only analytics &amp; stats</td></tr>
          <tr><td>🛎️ <strong>Receptionist</strong></td><td>Front desk staff</td><td>Bookings, guests, check-in/out</td></tr>
          <tr><td>📣 <strong>Marketer</strong></td><td>Marketing / social media</td><td>CRM, emails, analytics, website</td></tr>
          <tr><td>💻 <strong>Developer</strong></td><td>Web developer, IT person</td><td>Website builder &amp; embed settings</td></tr>
          <tr><td>👤 <strong>Staff</strong></td><td>Housekeeping, restaurant, maintenance</td><td>Operational tasks only</td></tr>
        </tbody>
      </table>
      <div className="info-box">
        <strong>Owner and Manager</strong> are the only two roles that have full dashboard access. All other roles are restricted to what they need for their job.
      </div>

      {/* ── 3. What each role can see ─────────────────────────────────── */}
      <h2 id="what-each-role-can-see">3. What each role can see</h2>

      <h3>🏆 Owner</h3>
      <p>
        The owner has access to every single page, including the <strong>Billing</strong> page (subscription,
        invoices, payment plans). Only one person should have the Owner role — the actual resort owner.
      </p>
      <p>
        <strong>Full access to:</strong> Dashboard, Analytics, Expenses, Reports, Rooms, Rate Plans, Packages,
        Bookings, Calendar, Group Bookings, Channel Sync, Guests, Loyalty, Support, Staff, Housekeeping,
        Maintenance, Restaurant, Orders, Inventory, CRM &amp; Email, Website, Billing, Settings.
      </p>

      <h3>🛡️ Manager</h3>
      <p>
        Same access as Owner <strong>except</strong> the Billing page. Suitable for a General Manager or
        Deputy Manager who runs day-to-day operations.
      </p>
      <p><strong>Cannot see:</strong> Billing (subscription &amp; invoices).</p>

      <h3>🤝 Partner</h3>
      <p>
        A partner (investor, co-owner with no operational role) can log in and see the <strong>Dashboard
        overview</strong> and <strong>Analytics</strong> page — revenue charts, occupancy rates, booking trends. Nothing else.
      </p>
      <p><strong>Can see:</strong> Dashboard, Analytics.</p>
      <p><strong>Cannot see:</strong> Any operational pages (rooms, bookings, guests, staff, etc.)</p>

      <h3>🛎️ Receptionist</h3>
      <p>
        Designed for front desk staff. Receptionists can handle the full guest lifecycle — bookings,
        check-in, check-out, housekeeping requests, and support tickets.
      </p>
      <p><strong>Can see:</strong> Dashboard, Rooms &amp; Villas, Packages, Bookings, Booking Calendar,
        Group Bookings, Guests, Loyalty Program, Support, Housekeeping, F&amp;B Orders.</p>
      <p><strong>Cannot see:</strong> Analytics, Expenses, Reports, Staff, Maintenance, Restaurant menu,
        Inventory, CRM, Website, Billing, Settings.</p>

      <h3>📣 Marketer</h3>
      <p>
        For a marketing or social media team member. They can run email campaigns, manage guest CRM data,
        view analytics, and edit the public website content.
      </p>
      <p><strong>Can see:</strong> Dashboard, Analytics, Guests, CRM &amp; Email, Website.</p>
      <p><strong>Cannot see:</strong> Rooms, Bookings, Housekeeping, Staff, Finances, Billing, Settings.</p>

      <h3>💻 Developer</h3>
      <p>
        For a web developer or IT consultant helping you set up the booking widget on your website.
        They can access the Website builder and Embed settings — nothing else operational.
      </p>
      <p><strong>Can see:</strong> Dashboard, Website, Settings (Embed &amp; integrations).</p>
      <p><strong>Cannot see:</strong> Bookings, Guests, Finances, Staff, or any other operational pages.</p>

      <h3>👤 Staff</h3>
      <p>
        For housekeeping staff, restaurant staff, and maintenance workers. They see only the pages
        relevant to their daily tasks.
      </p>
      <p><strong>Can see:</strong> Dashboard, Housekeeping, Maintenance, Restaurant, F&amp;B Orders, Inventory.</p>
      <p><strong>Cannot see:</strong> Bookings, Guests, Analytics, Staff management, Finances, CRM, Website, Settings.</p>

      {/* ── 4. Who should get which role ─────────────────────────────── */}
      <h2 id="who-should-get-which-role">4. Who should get which role</h2>
      <p>Here are real-world examples to help you decide:</p>
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th>Role to give</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Co-owner, general manager</td><td><strong>Manager</strong></td></tr>
          <tr><td>Investor who wants to check numbers</td><td><strong>Partner</strong></td></tr>
          <tr><td>Front desk agent, night auditor</td><td><strong>Receptionist</strong></td></tr>
          <tr><td>Digital marketing executive</td><td><strong>Marketer</strong></td></tr>
          <tr><td>Web developer setting up the booking widget</td><td><strong>Developer</strong></td></tr>
          <tr><td>Housekeeping supervisor, room attendant</td><td><strong>Staff</strong></td></tr>
          <tr><td>Restaurant waiter, kitchen supervisor</td><td><strong>Staff</strong></td></tr>
          <tr><td>Maintenance technician</td><td><strong>Staff</strong></td></tr>
        </tbody>
      </table>

      {/* ── 5. How to invite ─────────────────────────────────────────── */}
      <h2 id="how-to-invite-a-team-member">5. How to invite a team member</h2>
      <ol>
        <li>Log in to your ResortPro dashboard as <strong>Owner</strong> or <strong>Manager</strong></li>
        <li>Go to <strong>Staff</strong> from the sidebar</li>
        <li>Click <strong>"Invite by Email"</strong> (top right)</li>
        <li>Enter the person's email address</li>
        <li>Choose their role from the grid — each role shows a short description</li>
        <li>Click <strong>"Send Invite"</strong></li>
      </ol>
      <p>
        The person will receive an email with a link to set their password and log in. Their account
        is automatically connected to your resort.
      </p>
      <div className="info-box">
        <strong>Tip:</strong> You can invite as many team members as your plan allows. Check your current limits under <strong>Billing</strong>.
      </div>

      <h3>Changing a role later</h3>
      <ol>
        <li>Go to <strong>Staff</strong> in the sidebar</li>
        <li>Click on the staff member's row to open their detail panel</li>
        <li>Click <strong>Edit</strong>, change the role and save</li>
      </ol>
      <p>The new permissions take effect the next time they log in (or immediately on page refresh).</p>

      <h3>Removing access</h3>
      <ol>
        <li>Go to <strong>Staff</strong> in the sidebar</li>
        <li>Click on the staff member</li>
        <li>Click <strong>Deactivate</strong></li>
      </ol>
      <p>
        Their account is deactivated — they can no longer log in — but their records remain intact.
      </p>

      {/* ── 6. FAQ ───────────────────────────────────────────────────── */}
      <h2 id="faq">6. Frequently asked questions</h2>

      <h3>Can a Receptionist see revenue numbers?</h3>
      <p>
        No. Receptionists can see booking amounts (since they process payments at check-in/check-out)
        but they cannot access the Analytics page, Expenses, or Daily Reports.
      </p>

      <h3>Can a Marketer create or cancel bookings?</h3>
      <p>
        No. Marketers only have access to CRM &amp; Email, Analytics, Guests (read), and Website.
        They cannot create, edit, or cancel bookings.
      </p>

      <h3>Can a Partner change anything?</h3>
      <p>
        No. The Partner role is completely read-only. They can view the Dashboard overview and
        Analytics charts but cannot make any changes.
      </p>

      <h3>Can a Developer see guest data or bookings?</h3>
      <p>
        No. The Developer role only has access to the Website builder and Embed Settings.
        They cannot see any guest, booking, or financial data.
      </p>

      <h3>Can I have more than one Owner?</h3>
      <p>
        Technically yes, but it is recommended to have only one. The Owner role includes Billing
        access, so be careful about who you grant it to.
      </p>

      <h3>What if someone needs both bookings AND CRM access?</h3>
      <p>
        Give them the <strong>Manager</strong> role for full access, or consider whether
        a <strong>Receptionist</strong> (bookings + guests) or <strong>Marketer</strong> (guests + CRM)
        covers their needs.
      </p>

      <h3>Can a Staff member see which guests are staying?</h3>
      <p>
        No. Staff can see housekeeping task assignments (room number + task type) but not the
        full guest profiles or booking details.
      </p>

    </DocLayout>
  );
}
