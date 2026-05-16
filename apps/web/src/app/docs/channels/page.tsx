import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'channels-overview',       label: '1. Channel manager overview' },
  { id: 'supported-channels',      label: '2. Supported channels' },
  { id: 'connecting-via-ical',     label: '3. Connecting via iCal' },
  { id: 'preventing-double-bookings', label: '4. Preventing double-bookings' },
  { id: 'syncing-availability',    label: '5. Syncing availability' },
  { id: 'rates-per-channel',       label: '6. Managing rates per channel' },
  { id: 'faq',                     label: '7. FAQ' },
];

export default function ChannelsPage() {
  return (
    <DocLayout
      title="Channel Manager"
      description="Connect your resort to Airbnb, Booking.com, and other OTAs — keep availability in sync and stop double-bookings forever."
      readTime="5 min read"
      tag="Channels"
      tagColor="bg-blue-100 text-blue-700"
      toc={TOC}
    >
      <h2 id="channels-overview">1. Channel manager overview</h2>
      <p>
        A <strong>channel manager</strong> connects your ResortPro system to online travel agencies (OTAs)
        like Airbnb and Booking.com. When a room is booked on any channel, your availability is updated
        everywhere automatically — so you never accidentally get two bookings for the same room on the same night.
      </p>
      <p>
        Without a channel manager, you would have to manually log in to each OTA platform and update your calendar
        every time you get a booking — which is slow and error-prone.
      </p>
      <div className="info-box">
        <strong>How ResortPro connects:</strong> ResortPro uses the iCal standard to sync with most OTAs. iCal is a universal calendar format that Airbnb, Booking.com, Vrbo, and many others support. It's free and requires no special integration fees.
      </div>

      <h2 id="supported-channels">2. Supported channels</h2>
      <table>
        <thead><tr><th>Channel</th><th>Connection method</th><th>Sync type</th></tr></thead>
        <tbody>
          <tr><td><strong>Airbnb</strong></td><td>iCal export/import</td><td>Availability (booked/available)</td></tr>
          <tr><td><strong>Booking.com</strong></td><td>iCal export/import</td><td>Availability (booked/available)</td></tr>
          <tr><td><strong>Vrbo / HomeAway</strong></td><td>iCal export/import</td><td>Availability (booked/available)</td></tr>
          <tr><td><strong>Expedia</strong></td><td>iCal export/import</td><td>Availability (booked/available)</td></tr>
          <tr><td><strong>Google Calendar</strong></td><td>iCal export/import</td><td>View bookings in Google Calendar</td></tr>
          <tr><td><strong>Any iCal-compatible OTA</strong></td><td>iCal export/import</td><td>Availability</td></tr>
        </tbody>
      </table>
      <blockquote>
        <strong>Note:</strong> iCal sync updates availability (which dates are blocked). It does not sync rates, room descriptions, or guest information. Rate and content management must be done directly on each OTA platform.
      </blockquote>

      <h2 id="connecting-via-ical">3. Connecting via iCal</h2>
      <p>
        The connection works in two directions: you push your ResortPro calendar <em>to</em> the OTA, and you pull the OTA calendar <em>into</em> ResortPro.
      </p>
      <h3>Step 1 — Export your ResortPro calendar to the OTA</h3>
      <ol>
        <li>Go to <strong>Dashboard → Channels</strong>.</li>
        <li>Click <strong>Add Channel</strong> and choose the OTA (e.g., Airbnb).</li>
        <li>Select which room you want to connect.</li>
        <li>Copy the <strong>ResortPro iCal URL</strong> shown for that room.</li>
        <li>Log in to Airbnb → go to your listing's Availability settings → find "Import Calendar" → paste the ResortPro URL.</li>
        <li>Airbnb will now read your ResortPro bookings and block those dates.</li>
      </ol>
      <h3>Step 2 — Import the OTA calendar into ResortPro</h3>
      <ol>
        <li>In Airbnb, go to your listing's Availability settings → find "Export Calendar" → copy the Airbnb iCal URL.</li>
        <li>Go back to ResortPro → Channels → your connection → paste the <strong>Airbnb iCal URL</strong> into the "Import URL" field.</li>
        <li>Click <strong>Save</strong>. ResortPro will now sync the Airbnb calendar every hour and block dates that are booked on Airbnb.</li>
      </ol>

      <h2 id="preventing-double-bookings">4. Preventing double-bookings</h2>
      <p>
        iCal sync runs automatically every hour. This means there is a small window (up to 60 minutes) where a double-booking could theoretically occur if two guests book the same room on two different channels at the same moment.
      </p>
      <p>
        To minimise this risk:
      </p>
      <ul>
        <li><strong>Keep a small buffer.</strong> In your OTA settings, set a "Preparation Time" or "Buffer" of 1 day between bookings. This gives the sync time to update before the next booking can be confirmed.</li>
        <li><strong>Check your calendar daily.</strong> ResortPro's calendar view shows all bookings from all channels in one place. A quick daily check takes 2 minutes.</li>
        <li><strong>If a double-booking happens,</strong> contact one guest immediately, apologise sincerely, offer a full refund and (if possible) an alternative room. Act fast — guests are understanding if you communicate quickly.</li>
      </ul>

      <h2 id="syncing-availability">5. Syncing availability</h2>
      <p>
        ResortPro automatically syncs with all connected OTAs every hour. You can also trigger a manual sync at any time:
      </p>
      <ol>
        <li>Go to <strong>Channels</strong>.</li>
        <li>Click the <strong>Sync Now</strong> button next to any connection.</li>
        <li>The sync will complete within a few seconds.</li>
      </ol>
      <p>
        The Last Synced timestamp is shown for each connection so you always know how up-to-date your calendars are.
      </p>

      <h2 id="rates-per-channel">6. Managing rates per channel</h2>
      <p>
        ResortPro's iCal connection only syncs availability — not rates. To set your rates on each OTA:
      </p>
      <ul>
        <li>Log in to each OTA platform separately and set your room rates there.</li>
        <li>Many OTAs allow you to set a base rate that adjusts automatically based on demand and season.</li>
        <li>Remember to account for OTA commission (Airbnb: ~3%, Booking.com: 15–20%) when setting your OTA rates — price slightly higher than your direct booking rate so your margin is protected.</li>
      </ul>
      <div className="info-box">
        <strong>Best practice:</strong> Always set your ResortPro direct booking price as the lowest available. OTA guests pay OTA rates (higher, to cover commission). This encourages guests to book directly with you next time.
      </div>

      <h2 id="faq">7. FAQ</h2>
      <h3>How often does the iCal sync update?</h3>
      <p>Every hour automatically. You can also trigger a manual sync any time from the Channels page.</p>

      <h3>Can I connect the same room to multiple OTAs?</h3>
      <p>Yes — you can connect one room to as many OTAs as you like. Each connection is managed separately.</p>

      <h3>Does the sync work for all room types or just specific rooms?</h3>
      <p>Each OTA listing must be connected to a specific room in ResortPro. If you have 3 Deluxe Rooms on Airbnb as 3 separate listings, you set up 3 separate channel connections — one for each room.</p>

      <h3>Can I block dates on all channels at once?</h3>
      <p>Yes — block the dates directly in ResortPro (by creating a booking or blocking on the calendar). Since all OTAs import from ResortPro, they will all pick up the blocked dates within the next sync cycle.</p>
    </DocLayout>
  );
}
