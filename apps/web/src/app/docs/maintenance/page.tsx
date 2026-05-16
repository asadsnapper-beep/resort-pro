import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'maintenance-overview',  label: '1. Overview' },
  { id: 'logging-an-issue',      label: '2. Logging a maintenance issue' },
  { id: 'priority-levels',       label: '3. Priority levels' },
  { id: 'assigning-to-staff',    label: '4. Assigning to staff' },
  { id: 'tracking-resolution',   label: '5. Tracking resolution' },
  { id: 'faq',                   label: '6. FAQ' },
];

export default function MaintenancePage() {
  return (
    <DocLayout
      title="Maintenance Management"
      description="Log, assign, and track every repair and maintenance task in your resort — from a dripping tap to a full room renovation."
      readTime="4 min read"
      tag="Maintenance"
      tagColor="bg-sky-100 text-sky-700"
      toc={TOC}
    >
      <h2 id="maintenance-overview">1. Overview</h2>
      <p>
        The maintenance module gives you a central place to track all repairs, inspections, and upkeep tasks
        at your resort. Instead of relying on WhatsApp messages or verbal requests that get forgotten, every
        issue is logged, assigned, and tracked until it is resolved.
      </p>
      <p>
        Go to <strong>Dashboard → Maintenance</strong> to see all open and completed tasks.
      </p>
      <div className="info-box">
        <strong>Who uses this:</strong> Managers log issues, Staff resolve them. Owners can see a full overview of what is broken and what has been fixed.
      </div>

      <h2 id="logging-an-issue">2. Logging a maintenance issue</h2>
      <ol>
        <li>Go to <strong>Maintenance → New Task</strong>.</li>
        <li>Select the <strong>Location</strong> — choose a room number or a common area (Pool, Restaurant, Lobby, Garden, etc.).</li>
        <li>Write a clear <strong>Description</strong> of the problem. Be specific: "Bathroom tap in Room 204 is dripping constantly" is better than "tap problem".</li>
        <li>Set the <strong>Priority</strong> (see below).</li>
        <li>Upload a <strong>Photo</strong> if helpful — a photo of a broken lock or a leak is worth a thousand words.</li>
        <li>Assign it to a <strong>Staff Member</strong> (optional at this stage — you can assign later).</li>
        <li>Click <strong>Create Task</strong>.</li>
      </ol>
      <p>
        The assigned staff member will receive a notification immediately.
      </p>

      <h2 id="priority-levels">3. Priority levels</h2>
      <table>
        <thead><tr><th>Priority</th><th>When to use</th><th>Target response time</th></tr></thead>
        <tbody>
          <tr>
            <td>🟢 <strong>Low</strong></td>
            <td>Minor cosmetic issues, planned improvements — no impact on guests</td>
            <td>Within 7 days</td>
          </tr>
          <tr>
            <td>🟡 <strong>Medium</strong></td>
            <td>Issues that are inconvenient but the room/area can still be used</td>
            <td>Within 48 hours</td>
          </tr>
          <tr>
            <td>🟠 <strong>High</strong></td>
            <td>Issues that affect a guest's comfort — must be resolved before the next check-in</td>
            <td>Within 24 hours</td>
          </tr>
          <tr>
            <td>🔴 <strong>Urgent</strong></td>
            <td>Safety hazard, water leak, power failure, or similar emergency</td>
            <td>Immediately</td>
          </tr>
        </tbody>
      </table>
      <blockquote>
        <strong>Important:</strong> If you log a task as Urgent, the Owner and Manager receive an immediate push notification and email. Use this priority only for genuine emergencies.
      </blockquote>

      <h2 id="assigning-to-staff">4. Assigning to staff</h2>
      <p>
        You can assign a task to any staff member with a ResortPro account. Only staff with the
        <strong> Staff</strong> or <strong>Manager</strong> role are shown in the assignment dropdown.
      </p>
      <p>
        When a task is assigned:
      </p>
      <ul>
        <li>The staff member receives an in-app notification and (optionally) an email.</li>
        <li>The task appears in their personal task list when they log in.</li>
        <li>They can update the status and add notes as they work on it.</li>
      </ul>
      <p>
        You can also leave a task unassigned and let a Manager pick it up later.
      </p>

      <h2 id="tracking-resolution">5. Tracking resolution</h2>
      <p>Tasks move through these statuses:</p>
      <table>
        <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><td><strong>Open</strong></td><td>Logged but not yet started</td></tr>
          <tr><td><strong>In Progress</strong></td><td>Staff member has started working on it</td></tr>
          <tr><td><strong>Waiting for Parts</strong></td><td>Work is paused until a spare part or supplier arrives</td></tr>
          <tr><td><strong>Done</strong></td><td>Issue is resolved — the task is closed</td></tr>
          <tr><td><strong>Cancelled</strong></td><td>Task was logged by mistake or is no longer needed</td></tr>
        </tbody>
      </table>
      <p>
        Staff update the status themselves as they work. Managers can also update it at any time.
        When a task is marked <strong>Done</strong>, the Owner and Manager are notified.
      </p>

      <h2 id="faq">6. FAQ</h2>
      <h3>Can guests report maintenance issues directly?</h3>
      <p>Guests can report issues through the support ticket system (from your website or widget). When a support ticket is related to a maintenance issue, your staff can convert it into a maintenance task with one click.</p>

      <h3>How do I put a room out of service for repairs?</h3>
      <p>Go to <strong>Rooms</strong>, open the room, and change its status to <strong>Maintenance</strong>. This blocks the room from being booked. Don't forget to change the status back to <strong>Available</strong> when repairs are complete.</p>

      <h3>Can I see maintenance history for a specific room?</h3>
      <p>Yes — open a room from the Rooms page and click the <strong>Maintenance History</strong> tab. You'll see all past tasks for that room, including dates, who resolved them, and any notes.</p>
    </DocLayout>
  );
}
