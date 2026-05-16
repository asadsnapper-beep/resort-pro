import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'loyalty-overview',       label: '1. Programme overview' },
  { id: 'how-guests-earn-points', label: '2. How guests earn points' },
  { id: 'point-redemption',       label: '3. Redeeming points' },
  { id: 'membership-tiers',       label: '4. Membership tiers' },
  { id: 'guest-loyalty-balance',  label: '5. Viewing a guest\'s balance' },
  { id: 'promoting-loyalty',      label: '6. Promoting the programme' },
  { id: 'faq',                    label: '7. FAQ' },
];

export default function LoyaltyPage() {
  return (
    <DocLayout
      title="Loyalty Programme"
      description="Reward your returning guests with points, perks, and membership tiers — and turn one-time visitors into lifelong regulars."
      readTime="5 min read"
      tag="Loyalty"
      tagColor="bg-amber-100 text-amber-700"
      toc={TOC}
    >
      <h2 id="loyalty-overview">1. Programme overview</h2>
      <p>
        The ResortPro loyalty programme lets you reward guests for every stay and every purchase. Guests earn
        <strong> points</strong> automatically and can redeem them for discounts, free nights, or other rewards.
        The more they visit, the higher their membership tier — and the better the perks.
      </p>
      <p>
        You don't need to manage this manually. ResortPro calculates and assigns points automatically when a booking
        is completed or a payment is recorded.
      </p>
      <div className="info-box">
        <strong>To enable the loyalty programme:</strong> Go to <strong>Settings → Loyalty</strong> and toggle it on. You can customise the points rate, tier thresholds, and reward options.
      </div>

      <h2 id="how-guests-earn-points">2. How guests earn points</h2>
      <p>
        Guests earn points whenever they spend money at your resort. The default earning rate is <strong>1 point per ৳100 spent</strong> — but you can change this in Settings.
      </p>
      <table>
        <thead><tr><th>Activity</th><th>Points Earned</th></tr></thead>
        <tbody>
          <tr><td>Room booking (per ৳100)</td><td>1 point</td></tr>
          <tr><td>Restaurant / food order (per ৳100)</td><td>1 point</td></tr>
          <tr><td>Package purchase (per ৳100)</td><td>1 point</td></tr>
          <tr><td>First-ever booking bonus</td><td>50 bonus points</td></tr>
          <tr><td>Writing a review</td><td>20 bonus points (manual award)</td></tr>
          <tr><td>Referring a friend</td><td>100 bonus points (manual award)</td></tr>
        </tbody>
      </table>
      <p>
        You can also award points manually — useful for compensating a guest after a complaint or rewarding a
        special occasion. Open the guest's profile and click <strong>Award Points</strong>.
      </p>

      <h2 id="point-redemption">3. Redeeming points</h2>
      <p>
        Guests can redeem their points at the time of booking or check-out. The default redemption rate is
        <strong>100 points = ৳100 discount</strong>. You can adjust this in Settings.
      </p>
      <p>
        To apply a redemption manually: when processing a booking or payment, look for the <strong>Apply Loyalty Points</strong> toggle. Enter the number of points the guest wants to use. The discount is calculated and applied instantly.
      </p>
      <blockquote>
        <strong>Note:</strong> Points must be redeemed by the guest — you cannot redeem on their behalf without their knowledge. Always confirm with the guest first.
      </blockquote>

      <h2 id="membership-tiers">4. Membership tiers</h2>
      <p>
        Tiers are based on the total points a guest has earned (not their current balance). Tiers unlock special
        perks that you define.
      </p>
      <table>
        <thead><tr><th>Tier</th><th>Default points required</th><th>Example perks</th></tr></thead>
        <tbody>
          <tr><td>🥉 <strong>Bronze</strong></td><td>0 points (all members)</td><td>10% off food orders, birthday greeting</td></tr>
          <tr><td>🥈 <strong>Silver</strong></td><td>500 points earned</td><td>Early check-in, room upgrade on availability</td></tr>
          <tr><td>🥇 <strong>Gold</strong></td><td>2,000 points earned</td><td>Free airport transfer, complimentary welcome drink, dedicated support line</td></tr>
        </tbody>
      </table>
      <p>
        Tier thresholds and perks are fully customisable. Go to <strong>Settings → Loyalty → Tiers</strong> to change the names, point requirements, and perk descriptions.
      </p>

      <h2 id="guest-loyalty-balance">5. Viewing a guest's balance</h2>
      <p>
        To check how many points a guest has:
      </p>
      <ol>
        <li>Go to <strong>Dashboard → Guests</strong>.</li>
        <li>Search for the guest by name or email.</li>
        <li>Open their profile — the loyalty balance and tier are shown at the top of their profile card.</li>
        <li>Scroll down to see a full history of points earned and redeemed.</li>
      </ol>
      <p>
        Guests can also check their own points balance on your public website (if the loyalty widget is enabled) or
        by asking at the front desk.
      </p>

      <h2 id="promoting-loyalty">6. Promoting the programme</h2>
      <p>Good loyalty programmes work only if guests know about them. Here's how to promote yours:</p>
      <ul>
        <li><strong>Website widget:</strong> Enable the loyalty programme section on your public website — it shows the tiers and perks automatically.</li>
        <li><strong>Booking confirmation email:</strong> Add a line to your confirmation email: "You've earned X points on this booking! Sign up to track your balance."</li>
        <li><strong>At check-in:</strong> Ask your receptionist to mention the loyalty programme to every new guest and note their points balance on their folio.</li>
        <li><strong>CRM campaign:</strong> Send a one-time campaign to all past guests announcing the programme and their retroactive points.</li>
      </ul>

      <h2 id="faq">7. FAQ</h2>
      <h3>Do points expire?</h3>
      <p>By default, points expire after 12 months of inactivity. You can change or disable expiry in <strong>Settings → Loyalty → Expiry Policy</strong>.</p>

      <h3>Can a guest use points and a coupon code at the same time?</h3>
      <p>Yes — points and coupon codes can be combined in the same booking. The discounts are applied separately.</p>

      <h3>Can I retroactively award points for past bookings?</h3>
      <p>Yes. Open any past booking and click <strong>Award Points</strong> to manually add points for that stay.</p>

      <h3>Is there a mobile app for guests to track their points?</h3>
      <p>Guests can view their points on your public website. A dedicated guest mobile app is on our product roadmap.</p>
    </DocLayout>
  );
}
