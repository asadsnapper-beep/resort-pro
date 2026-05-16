import { DocLayout } from '../_components/DocLayout';

const TOC = [
  { id: 'what-are-packages',      label: '1. What are packages?' },
  { id: 'creating-a-package',     label: '2. Creating a package' },
  { id: 'package-examples',       label: '3. Package examples' },
  { id: 'linking-to-bookings',    label: '4. Linking to bookings' },
  { id: 'featuring-on-website',   label: '5. Featuring on your website' },
  { id: 'faq',                    label: '6. FAQ' },
];

export default function PackagesPage() {
  return (
    <DocLayout
      title="Packages & Deals"
      description="Create attractive packages — honeymoon getaways, family deals, corporate stays — and boost your average booking value."
      readTime="5 min read"
      tag="Packages"
      tagColor="bg-rose-100 text-rose-700"
      toc={TOC}
    >
      <h2 id="what-are-packages">1. What are packages?</h2>
      <p>
        A <strong>package</strong> is a bundled deal that combines a room stay with extra services — like meals,
        spa treatments, airport transfers, or excursions — at a single attractive price.
      </p>
      <p>
        Packages increase your <strong>average revenue per booking</strong> because guests spend more when extras
        are bundled together at a perceived discount, compared to buying each item separately.
      </p>
      <div className="info-box">
        <strong>Example:</strong> A "Romantic Weekend" package might include 2 nights in a Deluxe Room + breakfast + candlelit dinner + late check-out for ৳12,000 — instead of ৳9,000 (room) + ৳1,500 (breakfast) + ৳2,500 (dinner) + ৳500 (late check-out) = ৳13,500. The guest saves ৳1,500 and you earn more per booking.
      </div>

      <h2 id="creating-a-package">2. Creating a package</h2>
      <ol>
        <li>Go to <strong>Dashboard → Packages → Add Package</strong>.</li>
        <li>Enter a <strong>Package Name</strong> — make it evocative and memorable (e.g., "Sunset Escape", "Family Fun Pack").</li>
        <li>Write a <strong>Description</strong> — list everything included. Be specific: "2 nights in a Deluxe Room, daily breakfast for 2, one couple's spa session, and a bottle of champagne on arrival."</li>
        <li>Set the <strong>Price</strong> — the total package price a guest pays.</li>
        <li>Set the <strong>Validity</strong> — which dates this package is available (e.g., valid only for weekend bookings, or during peak season).</li>
        <li>Upload a <strong>Cover Photo</strong> — use a beautiful, high-quality image that represents the package.</li>
        <li>Choose the <strong>Minimum Stay</strong> if required (e.g., package requires at least 2 nights).</li>
        <li>Toggle <strong>Active</strong> to make it visible to guests, or leave it off while you set it up.</li>
        <li>Click <strong>Save Package</strong>.</li>
      </ol>

      <h2 id="package-examples">3. Package examples</h2>
      <table>
        <thead>
          <tr><th>Package Name</th><th>What's Included</th><th>Target Guest</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Honeymoon Escape</strong></td>
            <td>Sea-view room, rose petal turndown, champagne, romantic dinner, late check-out</td>
            <td>Couples, newlyweds</td>
          </tr>
          <tr>
            <td><strong>Family Fun Pack</strong></td>
            <td>2-bedroom suite, breakfast for 4, kids' activity programme, pool access, one family photo session</td>
            <td>Families with children</td>
          </tr>
          <tr>
            <td><strong>Weekend Getaway</strong></td>
            <td>2 nights standard room, Saturday BBQ dinner, Sunday brunch, free bicycle rental</td>
            <td>Local weekend travellers</td>
          </tr>
          <tr>
            <td><strong>Corporate Stay</strong></td>
            <td>5 nights, daily breakfast, airport transfer, meeting room access, high-speed Wi-Fi, laundry service</td>
            <td>Business travellers</td>
          </tr>
          <tr>
            <td><strong>Festival Special</strong></td>
            <td>3 nights, Eid/Puja dinner, cultural event tickets, traditional breakfast</td>
            <td>Holiday season guests</td>
          </tr>
        </tbody>
      </table>

      <h2 id="linking-to-bookings">4. Linking to bookings</h2>
      <p>
        When creating a booking (or editing an existing one), you will see a <strong>Package</strong> dropdown.
        Select the package the guest wants to add. The package price is added to the booking total and all inclusions
        are noted on the booking record.
      </p>
      <p>
        Your staff can see which packages are attached to upcoming arrivals. This lets housekeeping prepare the room
        (flowers, champagne) and the kitchen prepare special meals before the guest arrives.
      </p>

      <h2 id="featuring-on-website">5. Featuring on your website</h2>
      <p>
        Active packages are automatically displayed on your ResortPro public website under the <strong>Packages</strong>
        section. Guests can browse packages and click through to book.
      </p>
      <p>
        To control the order packages appear: go to <strong>Packages</strong> and drag them to reorder. Put your
        most popular or seasonal packages at the top.
      </p>
      <div className="info-box">
        <strong>Tip:</strong> Create time-limited packages for festivals and holidays (Eid, Puja, New Year, Valentine's Day). Limited-time offers create urgency and usually sell out quickly.
      </div>

      <h2 id="faq">6. FAQ</h2>
      <h3>Can I offer a package discount on top of a rate plan?</h3>
      <p>Yes. Set your package price independently — it doesn't have to follow your standard room rate. You have full control over pricing.</p>

      <h3>How do I handle packages that include activities I coordinate manually?</h3>
      <p>Add a note in the package description explaining the activity. When a booking with that package is made, ResortPro will show the package inclusions on the booking detail page — your staff can then coordinate the activity manually.</p>

      <h3>Can I limit how many of a package can be sold?</h3>
      <p>Yes — set a <strong>Stock Limit</strong> when creating the package. Once that number of bookings is reached, the package will show as sold out on your website.</p>
    </DocLayout>
  );
}
