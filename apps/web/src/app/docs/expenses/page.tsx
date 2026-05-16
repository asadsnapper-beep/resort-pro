import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'expenses-overview',   label: '1. Overview' },
  { id: 'logging-an-expense',  label: '2. Logging an expense' },
  { id: 'categories',          label: '3. Expense categories' },
  { id: 'monthly-summary',     label: '4. Monthly summary' },
  { id: 'budgeting-tips',      label: '5. Budgeting tips' },
  { id: 'faq',                 label: '6. FAQ' },
];

export default function ExpensesPage() {
  return (
    <DocLayout
      title="Expense Tracking"
      description="Record every cost your resort incurs — from supplier payments to staff meals — and get a clear picture of where your money goes."
      readTime="4 min read"
      tag="Finance"
      tagColor="bg-green-100 text-green-700"
      toc={TOC}
    >
      <h2 id="expenses-overview">1. Overview</h2>
      <p>
        The expenses module is your digital record book for all money going <em>out</em> of your resort.
        Combined with the revenue reports (money coming <em>in</em>), it gives you a complete picture of your
        resort's profitability.
      </p>
      <p>
        Go to <strong>Dashboard → Expenses</strong> to log and review expenses.
      </p>
      <div className="info-box">
        <strong>Good habit:</strong> Log expenses as they happen — or at the end of each day. Trying to remember two weeks of expenses on the last day of the month leads to missed entries and inaccurate books.
      </div>

      <h2 id="logging-an-expense">2. Logging an expense</h2>
      <ol>
        <li>Go to <strong>Expenses → Add Expense</strong>.</li>
        <li>Enter the <strong>Amount</strong> (in your local currency).</li>
        <li>Select the <strong>Date</strong> the expense occurred.</li>
        <li>Choose a <strong>Category</strong> (see below).</li>
        <li>Enter the <strong>Vendor / Supplier Name</strong> — who you paid (e.g., "Fresh Mart Dhaka", "City Power Supply").</li>
        <li>Write a short <strong>Description</strong> — be specific enough that you'll understand it in 3 months: "Monthly electricity bill — August 2026" is better than "electricity".</li>
        <li>Upload a <strong>Receipt Photo</strong> — take a photo with your phone and upload it. This is crucial for accounting and tax purposes.</li>
        <li>Click <strong>Save Expense</strong>.</li>
      </ol>

      <h2 id="categories">3. Expense categories</h2>
      <table>
        <thead><tr><th>Category</th><th>Examples</th></tr></thead>
        <tbody>
          <tr><td><strong>Utilities</strong></td><td>Electricity, water, gas, internet, phone</td></tr>
          <tr><td><strong>Food & Beverage</strong></td><td>Kitchen supplies, grocery purchases, restaurant ingredients</td></tr>
          <tr><td><strong>Staff</strong></td><td>Salaries, wages, staff meals, uniforms</td></tr>
          <tr><td><strong>Maintenance</strong></td><td>Repairs, spare parts, plumber / electrician fees</td></tr>
          <tr><td><strong>Marketing</strong></td><td>OTA commissions, Facebook ads, printed flyers, photography</td></tr>
          <tr><td><strong>Supplies</strong></td><td>Toiletries, stationery, cleaning products, linen</td></tr>
          <tr><td><strong>Admin</strong></td><td>Accounting fees, legal fees, software subscriptions, bank charges</td></tr>
          <tr><td><strong>Other</strong></td><td>Anything that doesn't fit the above categories</td></tr>
        </tbody>
      </table>

      <h2 id="monthly-summary">4. Monthly summary</h2>
      <p>
        Go to <strong>Expenses → Summary</strong> to see a breakdown of your spending by month and by category.
        The summary shows:
      </p>
      <ul>
        <li>Total expenses for the selected month</li>
        <li>A pie chart breaking down spending by category</li>
        <li>A comparison with the previous month</li>
        <li>Your top 5 vendors by spend</li>
      </ul>
      <p>
        You can cross-reference this with the <strong>Revenue Report</strong> to calculate your <strong>Net Profit</strong>:
        <code>Revenue − Expenses = Net Profit</code>
      </p>

      <h2 id="budgeting-tips">5. Budgeting tips</h2>
      <ul>
        <li>
          <strong>Set category budgets.</strong> In <strong>Expenses → Settings</strong>, you can set a monthly budget for each category. ResortPro will warn you when you are approaching or over budget.
        </li>
        <li>
          <strong>Review the top 3 expense categories every month.</strong> For most resorts, Utilities, Staff, and Food & Beverage are the biggest costs. Small reductions in these categories add up significantly over a year.
        </li>
        <li>
          <strong>Separate capital from operating expenses.</strong> Use the "Other" category for large one-off costs (e.g., buying a new generator) and note them clearly so they don't distort your monthly comparisons.
        </li>
        <li>
          <strong>Keep all receipts.</strong> Even if your accountant doesn't ask for them now, you may need them for tax audits. The photo upload feature means you'll never lose a receipt again.
        </li>
      </ul>

      <h2 id="faq">6. FAQ</h2>
      <h3>Can I export expenses for my accountant?</h3>
      <p>Yes. Go to <strong>Expenses → Export</strong> and download a CSV or PDF for any date range. The export includes the amount, date, category, vendor, description, and a link to the receipt photo.</p>

      <h3>Can multiple staff members log expenses?</h3>
      <p>Yes — anyone with Manager or Owner role access can log expenses. This is useful if your F&B manager, housekeeping supervisor, and reception team all track their own department expenses.</p>

      <h3>Can I edit or delete an expense after saving it?</h3>
      <p>Yes — open any expense and click <strong>Edit</strong>. Any changes are logged with a timestamp for audit purposes. Only Owners and Managers can delete expenses.</p>
    </DocLayout>
  );
}
