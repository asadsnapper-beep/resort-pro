import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'housekeeping-overview', label: '1. Housekeeping module overview' },
  { id: 'automatic-tasks',      label: '2. How tasks are created automatically' },
  { id: 'assigning-tasks',      label: '3. Assigning tasks to staff' },
  { id: 'task-statuses',        label: '4. Task statuses explained' },
  { id: 'manual-tasks',         label: '5. Creating manual tasks' },
  { id: 'priority-levels',      label: '6. Priority levels' },
  { id: 'faq',                  label: '7. FAQ' },
];

export default function HousekeepingPage() {
  return (
    <DocLayout
      title="Housekeeping"
      description="Manage room cleaning, inspections, and deep cleans — track every task from assignment to completion."
      readTime="5 min read"
      tag="Housekeeping"
      tagColor="bg-teal-100 text-teal-700"
      toc={TOC}
    >

      {/* ── 1. Overview ───────────────────────────────────────────────── */}
      <h2 id="housekeeping-overview">1. Housekeeping module overview</h2>
      <p>
        The <strong>Housekeeping</strong> module keeps your rooms clean and ready by tracking every
        cleaning task. It works alongside the bookings system — when a guest checks out, a cleaning
        task is automatically created so nothing slips through.
      </p>
      <p>Key benefits:</p>
      <ul>
        <li>No more manual spreadsheets or paper checklists</li>
        <li>Housekeeping staff see their assigned tasks on any device</li>
        <li>Managers can see live task progress across all rooms</li>
        <li>Rooms are only marked Available after cleaning is confirmed</li>
      </ul>
      <div className="info-box">
        <strong>Tip:</strong> Housekeeping staff should log in with the <strong>Staff</strong> role —
        they will see only the Housekeeping page with their assigned tasks, keeping the interface
        clean and simple.
      </div>

      {/* ── 2. Automatic tasks ────────────────────────────────────────── */}
      <h2 id="automatic-tasks">2. How tasks are created automatically</h2>
      <p>
        ResortPro creates housekeeping tasks automatically in two situations:
      </p>
      <ul>
        <li>
          <strong>After check-out:</strong> When a guest checks out, a "Post-Checkout Clean" task
          is created for that room immediately. The room status changes to "Needs Cleaning" and it
          cannot be booked again until the task is marked Done.
        </li>
        <li>
          <strong>Daily refresh for in-house guests:</strong> For rooms with guests staying multiple
          nights, a "Daily Service" task is created each morning so the room is serviced while the
          guest is away.
        </li>
      </ul>
      <p>
        Both types of automatic tasks appear in the <strong>Housekeeping</strong> task list and are
        ready to be assigned to staff.
      </p>

      {/* ── 3. Assigning tasks ────────────────────────────────────────── */}
      <h2 id="assigning-tasks">3. Assigning tasks to staff</h2>
      <p>
        By default, new tasks are <strong>unassigned</strong>. A manager assigns them to specific
        staff members:
      </p>
      <ol>
        <li>Go to <strong>Housekeeping</strong> in the sidebar.</li>
        <li>Find an unassigned task in the task list (shown in the "Unassigned" column).</li>
        <li>Click on the task to open the detail panel.</li>
        <li>Click <strong>"Assign to Staff"</strong> and select a team member.</li>
        <li>Click <strong>Confirm</strong>.</li>
      </ol>
      <p>
        The assigned staff member will see this task on their Housekeeping page when they log in.
        If your team uses the ResortPro mobile PWA, they receive a push notification.
      </p>

      <h3>Bulk assignment</h3>
      <p>
        In the morning, you can assign all the day's tasks at once:
      </p>
      <ol>
        <li>Go to <strong>Housekeeping → Today's Tasks</strong>.</li>
        <li>Click <strong>"Assign All"</strong>.</li>
        <li>Drag tasks to staff members in the assignment grid, or use the auto-assign feature which distributes tasks evenly.</li>
        <li>Click <strong>Save Assignments</strong>.</li>
      </ol>

      {/* ── 4. Task statuses ──────────────────────────────────────────── */}
      <h2 id="task-statuses">4. Task statuses explained</h2>

      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Meaning</th>
            <th>Who updates it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Pending</strong></td>
            <td>Task created but not yet started</td>
            <td>System creates; manager assigns</td>
          </tr>
          <tr>
            <td><strong>In Progress</strong></td>
            <td>Staff member has started cleaning the room</td>
            <td>Staff member taps "Start" on their device</td>
          </tr>
          <tr>
            <td><strong>Done</strong></td>
            <td>Room is cleaned and ready for the next guest</td>
            <td>Staff member taps "Done"; room becomes Available</td>
          </tr>
          <tr>
            <td><strong>Skipped</strong></td>
            <td>Guest declined housekeeping for this visit (Do Not Disturb)</td>
            <td>Manager or receptionist marks it skipped</td>
          </tr>
          <tr>
            <td><strong>Needs Inspection</strong></td>
            <td>Cleaning done; supervisor needs to inspect before marking Available</td>
            <td>Optional — enabled per property in Settings</td>
          </tr>
        </tbody>
      </table>
      <blockquote>
        <strong>Note:</strong> When a task is marked <strong>Done</strong>, the room's status automatically
        changes to <strong>Available</strong> and it can be assigned to the next booking.
      </blockquote>

      {/* ── 5. Manual tasks ───────────────────────────────────────────── */}
      <h2 id="manual-tasks">5. Creating manual tasks</h2>
      <p>
        You can create housekeeping tasks manually for situations that aren't triggered by check-outs:
      </p>
      <ul>
        <li>Deep clean (quarterly or before VIP arrivals)</li>
        <li>Linen change only</li>
        <li>Inspection after maintenance work</li>
        <li>Turndown service in the evening</li>
        <li>Pre-arrival room set-up for a special occasion</li>
      </ul>

      <h3>How to create a manual task</h3>
      <ol>
        <li>Go to <strong>Housekeeping</strong> in the sidebar.</li>
        <li>Click <strong>"Add Task"</strong> in the top-right corner.</li>
        <li>Select the room or area (common areas like lobby, pool, gym can also be assigned).</li>
        <li>Choose the task type (Regular Clean, Deep Clean, Inspection, Set-Up, Turndown, Custom).</li>
        <li>Set the due date and priority level.</li>
        <li>Add notes or a checklist for the staff member.</li>
        <li>Assign to a staff member.</li>
        <li>Click <strong>Save Task</strong>.</li>
      </ol>

      {/* ── 6. Priority levels ────────────────────────────────────────── */}
      <h2 id="priority-levels">6. Priority levels</h2>
      <p>
        Each task has a priority level that helps staff understand what to clean first:
      </p>

      <table>
        <thead>
          <tr>
            <th>Priority</th>
            <th>When to use</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Low</strong></td>
            <td>No guest expected soon; can be done later in the day</td>
          </tr>
          <tr>
            <td><strong>Normal</strong></td>
            <td>Standard priority — most daily tasks</td>
          </tr>
          <tr>
            <td><strong>High</strong></td>
            <td>New guest checking in within the next few hours</td>
          </tr>
          <tr>
            <td><strong>Urgent</strong></td>
            <td>Guest is waiting to check in right now — clean immediately</td>
          </tr>
        </tbody>
      </table>
      <div className="info-box">
        <strong>Tip:</strong> ResortPro automatically sets priority to <strong>High</strong> when a
        room is cleaned after a check-out and there is another booking arriving the same day.
        It sets <strong>Urgent</strong> if the new guest is already in the lobby.
      </div>

      {/* ── 7. FAQ ───────────────────────────────────────────────────── */}
      <h2 id="faq">7. Frequently asked questions</h2>

      <h3>Can housekeeping staff see which guest is checking in?</h3>
      <p>
        No. For privacy, housekeeping staff only see the room number and task type — not the guest's
        name or booking details.
      </p>

      <h3>Can I attach a cleaning checklist to a task?</h3>
      <p>
        Yes. When creating or editing a task, click <strong>Add Checklist</strong> and add steps
        (e.g. "Change bedsheets", "Restock minibar", "Check bathroom tiles"). Staff tick off each
        step as they complete it.
      </p>

      <h3>What happens if a staff member doesn't complete a task?</h3>
      <p>
        Overdue tasks (past their due date) are highlighted in red in the manager's view. You can
        reassign them to another staff member by opening the task and clicking <strong>Reassign</strong>.
      </p>

      <h3>Can housekeeping manage common areas, not just rooms?</h3>
      <p>
        Yes. You can create tasks for any area — lobby, pool deck, gym, reception, restaurant, gardens —
        by selecting "Common Area" when creating a manual task.
      </p>

    </DocLayout>
  );
}
