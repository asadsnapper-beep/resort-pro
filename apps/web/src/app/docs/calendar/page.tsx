import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'calendar-overview',    label: '1. The availability calendar' },
  { id: 'reading-the-calendar', label: '2. Reading the calendar' },
  { id: 'blocking-dates',       label: '3. Blocking dates manually' },
  { id: 'syncing-external',     label: '4. Syncing with external calendars' },
  { id: 'channel-connections',  label: '5. Setting up channel connections' },
  { id: 'faq',                  label: '6. FAQ' },
];

export default function CalendarPage() {
  return (
    <DocLayout
      title="Availability Calendar"
      description="Visualise all room availability at a glance, block dates, and sync with Airbnb, Booking.com, and Google Calendar."
      readTime="5 min read"
      tag="Calendar"
      tagColor="bg-sky-100 text-sky-700"
      toc={TOC}
    >

      {/* ── 1. Calendar overview ──────────────────────────────────────── */}
      <h2 id="calendar-overview">1. The availability calendar</h2>
      <p>
        The <strong>Calendar</strong> gives you a bird's-eye view of your entire property's availability
        across days, weeks, or months. It is the fastest way to see which rooms are booked, which are
        free, and which are blocked — without opening individual room records.
      </p>
      <p>
        The calendar is particularly useful for the front desk team during check-in season,
        for planning housekeeping schedules, and for spotting gaps to fill with promotions.
      </p>
      <div className="info-box">
        <strong>Two views available:</strong> Switch between <strong>Room View</strong> (each row is a room,
        columns are dates) and <strong>Month View</strong> (a traditional calendar showing total bookings
        per day). Use Room View for detailed planning; Month View for a quick overview.
      </div>

      {/* ── 2. Reading the calendar ───────────────────────────────────── */}
      <h2 id="reading-the-calendar">2. Reading the calendar</h2>
      <p>
        Each cell in the calendar represents one room on one day. Cells are colour-coded:
      </p>

      <table>
        <thead>
          <tr>
            <th>Colour</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong style={{color:'#16a34a'}}>Green</strong></td>
            <td>Room is available — no booking, no block</td>
          </tr>
          <tr>
            <td><strong style={{color:'#2563eb'}}>Blue</strong></td>
            <td>Room is booked (confirmed reservation)</td>
          </tr>
          <tr>
            <td><strong style={{color:'#9333ea'}}>Purple</strong></td>
            <td>Guest is checked in (currently occupying the room)</td>
          </tr>
          <tr>
            <td><strong style={{color:'#d97706'}}>Amber</strong></td>
            <td>Date is manually blocked (not available for booking)</td>
          </tr>
          <tr>
            <td><strong style={{color:'#dc2626'}}>Red</strong></td>
            <td>Room is under maintenance or out of order</td>
          </tr>
          <tr>
            <td><strong style={{color:'#6b7280'}}>Gray</strong></td>
            <td>Past date</td>
          </tr>
        </tbody>
      </table>

      <p>
        Click on any booked cell to see a summary of that booking — guest name, dates, and status.
        Click <strong>Open Booking</strong> in the popup to go to the full booking detail.
      </p>

      {/* ── 3. Blocking dates ─────────────────────────────────────────── */}
      <h2 id="blocking-dates">3. Blocking dates manually</h2>
      <p>
        Blocking a date prevents a room from being booked — either through your website, the booking
        widget, or by staff. Use this for:
      </p>
      <ul>
        <li>Owner or family use — "Room 101 is reserved for personal use in March"</li>
        <li>Scheduled deep cleaning or refurbishment</li>
        <li>Holding a room for a VIP who is calling back to confirm</li>
        <li>Preventing bookings during a gap between two reservations that's too short to sell</li>
      </ul>

      <h3>How to block a date</h3>
      <ol>
        <li>Go to <strong>Calendar</strong> in the sidebar.</li>
        <li>In Room View, click and drag across the dates you want to block for a specific room.</li>
        <li>A dialog will appear — select <strong>"Block Dates"</strong>.</li>
        <li>Add an optional note (e.g. "Owner stay — personal use").</li>
        <li>Click <strong>"Confirm Block"</strong>.</li>
      </ol>

      <h3>How to unblock dates</h3>
      <ol>
        <li>Click on any blocked (amber) cell in the calendar.</li>
        <li>Click <strong>"Remove Block"</strong> in the popup.</li>
        <li>The dates return to available (green) immediately.</li>
      </ol>
      <blockquote>
        <strong>Note:</strong> Blocked dates are not visible to guests on your website — they simply
        cannot select those dates when trying to book that room.
      </blockquote>

      {/* ── 4. Syncing with external calendars ────────────────────────── */}
      <h2 id="syncing-external">4. Syncing with external calendars</h2>
      <p>
        If you list your rooms on <strong>Airbnb</strong>, <strong>Booking.com</strong>, or other
        platforms, you need to keep availability in sync to avoid double-bookings. ResortPro supports
        two-way iCal synchronisation with any platform that provides an iCal URL.
      </p>

      <h3>How iCal sync works</h3>
      <p>
        iCal (ICS) is an open standard for sharing calendar data. Every time someone books on Airbnb,
        Airbnb updates their iCal feed. ResortPro reads that feed periodically and blocks those dates
        in your calendar automatically — and vice versa.
      </p>

      <h3>Importing from an external calendar (Airbnb → ResortPro)</h3>
      <ol>
        <li>Log in to Airbnb and go to your listing's <strong>Availability settings</strong>.</li>
        <li>Find the <strong>iCal link</strong> for your listing and copy it.</li>
        <li>In ResortPro, go to <strong>Calendar → Sync → Import External Calendar</strong>.</li>
        <li>Select the room this listing corresponds to.</li>
        <li>Paste the Airbnb iCal URL.</li>
        <li>Give it a name (e.g. "Airbnb – Room 201") and click <strong>Save</strong>.</li>
      </ol>

      <h3>Exporting to an external calendar (ResortPro → Airbnb)</h3>
      <ol>
        <li>In ResortPro, go to <strong>Calendar → Sync → Export Links</strong>.</li>
        <li>Copy the iCal export URL for the room you want to sync.</li>
        <li>In Airbnb, go to your listing → Availability → Import Calendar, and paste the URL.</li>
      </ol>
      <div className="info-box">
        <strong>Sync frequency:</strong> External calendars are synced every 2 hours. For immediate
        sync, click <strong>"Sync Now"</strong> on the Calendar Sync page.
      </div>

      {/* ── 5. Channel connections ────────────────────────────────────── */}
      <h2 id="channel-connections">5. Setting up channel connections</h2>
      <p>
        For more advanced integration with Airbnb, Booking.com, and Expedia (including real-time rate
        and availability sync), use the <strong>Channels</strong> module which provides a full channel
        manager.
      </p>
      <p>
        See the <a href="/docs/channels" className="text-[#1a6b5e] underline">Channels guide</a> for
        step-by-step instructions on connecting your listings and keeping everything in sync automatically.
      </p>

      {/* ── 6. FAQ ───────────────────────────────────────────────────── */}
      <h2 id="faq">6. Frequently asked questions</h2>

      <h3>Can I block dates for all rooms at once?</h3>
      <p>
        Yes. In the calendar, click <strong>Block All Rooms</strong> (available in the Actions menu),
        choose the date range, and all rooms will be blocked simultaneously. Useful for property closures
        or renovation periods.
      </p>

      <h3>What happens if I get a double-booking due to a sync delay?</h3>
      <p>
        If a double-booking occurs (rare but possible with iCal's 2-hour sync window), you'll see a
        conflict alert on the calendar. Contact the guest on one platform and offer to cancel or move
        their booking. We recommend enabling real-time sync via the Channels module to minimise this risk.
      </p>

      <h3>Can I print the calendar?</h3>
      <p>
        Yes. Click <strong>Print</strong> (or use Ctrl/Cmd + P) while on the Calendar page. The calendar
        is formatted for A4/letter paper with the room layout preserved.
      </p>

      <h3>Can staff see the calendar?</h3>
      <p>
        Receptionists can view and interact with the calendar. Housekeeping and other Staff roles can
        see it in a read-only view. Managers and Owners have full access.
      </p>

    </DocLayout>
  );
}
