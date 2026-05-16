import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'what-is-crm',              label: '1. What is the CRM?' },
  { id: 'guest-segments',           label: '2. Guest segments' },
  { id: 'sending-email-campaigns',  label: '3. Email campaigns' },
  { id: 'automated-emails',         label: '4. Automated emails' },
  { id: 'guest-notes',              label: '5. Notes & follow-ups' },
  { id: 'gdpr',                     label: '6. GDPR & unsubscribe' },
  { id: 'faq',                      label: '7. FAQ' },
];

export default function CrmPage() {
  return (
    <DocLayout
      title="CRM & Guest Communication"
      description="Stay connected with your guests — send campaigns, automate follow-ups, and build loyalty through personalised communication."
      readTime="6 min read"
      tag="CRM"
      tagColor="bg-pink-100 text-pink-700"
      toc={TOC}
    >
      <h2 id="what-is-crm">1. What is the CRM?</h2>
      <p>
        CRM stands for <strong>Customer Relationship Management</strong>. In ResortPro, it is the tool that helps you
        communicate with your guests — before they arrive, during their stay, and after they leave.
      </p>
      <p>
        Think of it as your guest communication hub: send emails to past guests, set up automatic welcome messages,
        and keep notes about important guests — all in one place.
      </p>
      <div className="info-box">
        <strong>Why it matters:</strong> Guests who receive a pre-arrival email are 30% more likely to upgrade their room or add extras like dinner packages. A simple post-stay thank-you email significantly increases the chance of a return visit.
      </div>

      <h2 id="guest-segments">2. Guest segments</h2>
      <p>
        A <strong>segment</strong> is a group of guests that share something in common. Go to <strong>Dashboard → CRM</strong> to see your segments. ResortPro creates these automatically:
      </p>
      <table>
        <thead><tr><th>Segment</th><th>Who is included</th></tr></thead>
        <tbody>
          <tr><td><strong>All Guests</strong></td><td>Every guest who has ever booked with you</td></tr>
          <tr><td><strong>VIP Guests</strong></td><td>Guests you have marked as VIP in their profile</td></tr>
          <tr><td><strong>Recent Guests</strong></td><td>Checked out in the last 30 days</td></tr>
          <tr><td><strong>Repeat Guests</strong></td><td>Guests with 2 or more completed stays</td></tr>
          <tr><td><strong>Loyalty Members</strong></td><td>Guests enrolled in your loyalty programme</td></tr>
          <tr><td><strong>Upcoming Arrivals</strong></td><td>Guests arriving in the next 7 days</td></tr>
        </tbody>
      </table>
      <p>You can also create <strong>custom segments</strong> by filtering by booking date, nationality, room type, or spending amount.</p>

      <h2 id="sending-email-campaigns">3. Email campaigns</h2>
      <p>
        A campaign is a one-time email you send to a segment of guests. Examples: a seasonal promotion, a new package announcement, or a holiday greeting.
      </p>
      <h3>How to send a campaign</h3>
      <ol>
        <li>Go to <strong>CRM → Campaigns → New Campaign</strong>.</li>
        <li>Give your campaign a name (internal reference only).</li>
        <li>Choose a <strong>segment</strong> — who will receive this email.</li>
        <li>Write your <strong>subject line</strong> (this is what guests see in their inbox).</li>
        <li>Write the <strong>email body</strong> using the built-in editor. Add your resort logo, a photo, and a call-to-action button.</li>
        <li>Click <strong>Send Preview</strong> to test it on your own email first.</li>
        <li>When you are happy, click <strong>Send Campaign</strong>.</li>
      </ol>
      <blockquote>
        <strong>Best practice:</strong> Keep subject lines short (under 50 characters). Subject lines with the guest's name (e.g., "Rafiq, a special offer just for you") get significantly higher open rates.
      </blockquote>

      <h2 id="automated-emails">4. Automated emails</h2>
      <p>
        Automated emails are sent automatically when something happens — no manual work needed. Set them up once and forget them.
      </p>
      <table>
        <thead><tr><th>Trigger</th><th>When it sends</th><th>Suggested content</th></tr></thead>
        <tbody>
          <tr><td><strong>Booking Confirmed</strong></td><td>Immediately after a booking is created</td><td>Confirmation details, check-in instructions, directions</td></tr>
          <tr><td><strong>Pre-Arrival</strong></td><td>2–3 days before check-in</td><td>Weather forecast, what to pack, restaurant menu, upsell packages</td></tr>
          <tr><td><strong>Post-Stay</strong></td><td>1 day after check-out</td><td>Thank-you message, review request, loyalty points update, return discount</td></tr>
          <tr><td><strong>Birthday</strong></td><td>On the guest's birthday</td><td>Birthday greeting, special room rate offer</td></tr>
          <tr><td><strong>Win-Back</strong></td><td>90 days after last stay with no new booking</td><td>"We miss you" offer with a discount code</td></tr>
        </tbody>
      </table>
      <div className="info-box">
        <strong>How to set up:</strong> Go to <strong>CRM → Automations → New Automation</strong>, choose the trigger, write your email, and activate it. That's it — ResortPro handles the rest.
      </div>

      <h2 id="guest-notes">5. Notes & follow-ups</h2>
      <p>
        You can add private notes to any guest's profile — these are only visible to your staff, not the guest.
        Use notes to record important preferences, past complaints, or VIP requests:
      </p>
      <ul>
        <li>"Prefers a quiet room away from the pool."</li>
        <li>"Allergic to shellfish — notify kitchen before every stay."</li>
        <li>"Celebrating anniversary this visit — arrange complimentary flowers."</li>
      </ul>
      <p>
        To add a note: go to <strong>Guests</strong>, open the guest's profile, and click <strong>Add Note</strong>.
      </p>

      <h2 id="gdpr">6. GDPR & unsubscribe</h2>
      <p>
        Every marketing email sent through ResortPro automatically includes an <strong>unsubscribe link</strong> at the bottom.
        When a guest clicks unsubscribe, they are removed from all future campaigns automatically — you don't need to do anything.
      </p>
      <blockquote>
        <strong>Important:</strong> You must never manually add someone back to your mailing list after they have unsubscribed. This is required by GDPR and similar data protection laws. Transactional emails (booking confirmations) are always sent regardless of marketing opt-out status.
      </blockquote>

      <h2 id="faq">7. FAQ</h2>
      <h3>How many emails can I send per month?</h3>
      <p>Email limits depend on your ResortPro plan. Check your current plan limits under <strong>Dashboard → Billing</strong>.</p>

      <h3>Can I use my own email address (e.g., info@myresort.com) as the sender?</h3>
      <p>Yes. Go to <strong>Settings → Email</strong> and add your custom sender domain. You will need to add a few DNS records to verify ownership.</p>

      <h3>What is the difference between a campaign and an automation?</h3>
      <p>A <strong>campaign</strong> is sent once to a list of guests (like a newsletter). An <strong>automation</strong> is triggered automatically by an action (like a booking confirmation) and sends to one guest at a time.</p>
    </DocLayout>
  );
}
