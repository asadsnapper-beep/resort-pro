import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'settings-overview',        label: '1. Settings overview' },
  { id: 'property-information',     label: '2. Property information' },
  { id: 'branding',                 label: '3. Branding & theme' },
  { id: 'email-notifications',      label: '4. Email notifications' },
  { id: 'payment-gateway-setup',    label: '5. Payment gateways' },
  { id: 'integrations',             label: '6. Integrations' },
  { id: 'faq',                      label: '7. FAQ' },
];

export default function SettingsPage() {
  return (
    <DocLayout
      title="Dashboard Settings"
      description="Configure your resort's information, branding, email notifications, and payment gateways — all from the Settings page."
      readTime="5 min read"
      tag="Settings"
      tagColor="bg-gray-100 text-gray-700"
      toc={TOC}
    >
      <h2 id="settings-overview">1. Settings overview</h2>
      <p>
        The Settings page is where you configure everything about how ResortPro works for your property.
        Think of it as the control centre for your account. Go to <strong>Dashboard → Settings</strong>.
      </p>
      <p>
        Settings is divided into several tabs:
      </p>
      <ul>
        <li><strong>Property</strong> — name, address, contact details, check-in/check-out times</li>
        <li><strong>Branding</strong> — logo, theme colours</li>
        <li><strong>Notifications</strong> — which emails get sent and to whom</li>
        <li><strong>Payments</strong> — connect payment gateways</li>
        <li><strong>Integrations</strong> — connect external tools</li>
      </ul>
      <blockquote>
        <strong>Important:</strong> Only the Owner role can access and change Settings. Managers can view settings but cannot save changes to sensitive sections like payments and billing.
      </blockquote>

      <h2 id="property-information">2. Property information</h2>
      <p>
        Fill in your resort's details completely and accurately. This information is used across the platform —
        on invoices, on your public website, in booking confirmation emails, and on your booking widget.
      </p>
      <table>
        <thead><tr><th>Field</th><th>Where it appears</th></tr></thead>
        <tbody>
          <tr><td><strong>Resort Name</strong></td><td>Invoices, website header, booking confirmations</td></tr>
          <tr><td><strong>Address</strong></td><td>Website contact page, Google Maps widget, invoices</td></tr>
          <tr><td><strong>Phone Number</strong></td><td>Website, booking confirmation, guest receipts</td></tr>
          <tr><td><strong>Email Address</strong></td><td>Booking confirmations sent from this address</td></tr>
          <tr><td><strong>Check-in Time</strong></td><td>Booking confirmations, pre-arrival emails</td></tr>
          <tr><td><strong>Check-out Time</strong></td><td>Booking confirmations, pre-arrival emails</td></tr>
        </tbody>
      </table>
      <div className="info-box">
        <strong>Tip:</strong> Always keep your phone number and email updated. Guests use these to contact you before arriving. An outdated number creates a poor first impression.
      </div>

      <h2 id="branding">3. Branding & theme</h2>
      <p>
        Your branding settings control how your resort looks across the platform — your website, emails, and invoices.
      </p>
      <ul>
        <li>
          <strong>Logo:</strong> Upload a PNG or SVG of your resort's logo (recommended: 400×200px, transparent background).
          It appears in the top-left of your website, in emails, and on invoices.
        </li>
        <li>
          <strong>Primary Colour:</strong> Choose your brand colour (e.g., deep green, navy, terracotta). This colour is used for buttons, links, and highlights across your website and emails.
        </li>
        <li>
          <strong>Theme:</strong> Choose from the available ResortPro website themes (e.g., Classic, Modern, Tropical). Each theme changes the layout and typography of your public website.
        </li>
      </ul>

      <h2 id="email-notifications">4. Email notifications</h2>
      <p>
        Control which automated emails are sent and to which address. Go to <strong>Settings → Notifications</strong>.
      </p>
      <table>
        <thead><tr><th>Notification</th><th>Who receives it</th><th>Can be toggled</th></tr></thead>
        <tbody>
          <tr><td>New booking created</td><td>Owner / Manager email</td><td>Yes</td></tr>
          <tr><td>Booking confirmation</td><td>Guest</td><td>No (always sent)</td></tr>
          <tr><td>Check-in reminder</td><td>Guest, 2 days before arrival</td><td>Yes</td></tr>
          <tr><td>Check-out reminder</td><td>Guest, day of check-out</td><td>Yes</td></tr>
          <tr><td>Booking cancellation</td><td>Owner + Guest</td><td>Yes</td></tr>
          <tr><td>Low stock alert</td><td>Owner / Manager email</td><td>Yes</td></tr>
          <tr><td>Support ticket received</td><td>Owner / Manager email</td><td>Yes</td></tr>
          <tr><td>Payment received</td><td>Owner email</td><td>Yes</td></tr>
        </tbody>
      </table>

      <h2 id="payment-gateway-setup">5. Payment gateways</h2>
      <p>
        ResortPro supports three payment methods for collecting money from guests online:
      </p>
      <table>
        <thead><tr><th>Gateway</th><th>Best for</th><th>What you need</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>Stripe</strong></td>
            <td>International credit/debit cards (Visa, Mastercard)</td>
            <td>Stripe account + publishable key + secret key</td>
          </tr>
          <tr>
            <td><strong>bKash</strong></td>
            <td>Local Bangladesh mobile payments</td>
            <td>bKash merchant account + app key + app secret</td>
          </tr>
          <tr>
            <td><strong>SSLCommerz</strong></td>
            <td>All Bangladesh bank cards + mobile banking</td>
            <td>SSLCommerz merchant ID + store password</td>
          </tr>
        </tbody>
      </table>
      <p>
        To connect a gateway: go to <strong>Settings → Payments</strong>, choose the gateway, enter your credentials, and save. You can enable multiple gateways and guests will see all available options at checkout.
      </p>
      <blockquote>
        <strong>Security note:</strong> Your payment credentials are encrypted and stored securely. ResortPro never stores card numbers — payments are processed directly by the gateway provider.
      </blockquote>

      <h2 id="integrations">6. Integrations</h2>
      <p>ResortPro connects with several external services:</p>
      <ul>
        <li><strong>Google Calendar:</strong> Sync your bookings to a Google Calendar for personal visibility.</li>
        <li><strong>Airbnb / Booking.com:</strong> Import availability via iCal to prevent double-bookings.</li>
        <li><strong>Custom Domain:</strong> Point your own domain (e.g., myresort.com) to your ResortPro website.</li>
        <li><strong>Email (SMTP):</strong> Send emails from your own domain instead of the default ResortPro email address.</li>
      </ul>

      <h2 id="faq">7. FAQ</h2>
      <h3>Can I have different settings for multiple properties?</h3>
      <p>Yes — each property (tenant account) has its own independent settings. If you run multiple properties, each has its own login and settings.</p>

      <h3>What happens if I change my check-in time in settings?</h3>
      <p>The updated check-in time is reflected immediately on your website and in all future booking confirmation emails. Existing sent emails are not retroactively updated.</p>

      <h3>I accidentally changed something in settings. Can I undo it?</h3>
      <p>Settings do not have an automatic undo feature, but changes don't take effect until you click Save. If you've already saved and want to revert, simply change the field back to the old value and save again.</p>
    </DocLayout>
  );
}
