/**
 * Full demo tenant seed — rich data for every dashboard section.
 * Run: npx tsx src/scripts/seed-demo.ts
 */

import {
  PrismaClient, UserRole, RoomType, RoomStatus, StaffDepartment,
  BookingStatus, PaymentMethod, HousekeepingStatus, HousekeepingType,
  MaintenanceStatus, MaintenancePriority, MaintenanceIssueType,
  TicketStatus, TicketPriority, TicketCategory,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const d = (offsetDays: number, h = 12) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(h, 0, 0, 0);
  return date;
};

async function main() {
  console.log('🎭 Seeding full demo tenant...\n');

  // ── Idempotency guard ─────────────────────────────────────────────────────────
  // Operational data below uses create() (not upsert), so re-running would
  // duplicate bookings/payments/etc. Skip if the demo tenant is already seeded.
  // This makes the script safe to run on every deploy.
  const existing = await prisma.tenant.findUnique({ where: { slug: 'demo' }, select: { id: true } });
  if (existing) {
    const bookingCount = await prisma.booking.count({ where: { tenantId: existing.id } });
    if (bookingCount > 0) {
      console.log(`✅ Demo tenant already seeded (${bookingCount} bookings). Skipping to avoid duplicates.`);
      await prisma.$disconnect();
      return;
    }
  }

  // ── Demo Tenant ─────────────────────────────────────────────────────────────
  const demo = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: { isDemo: true, plan: 'PROFESSIONAL', planStatus: 'active' },
    create: {
      name: 'Coral Bay Resort',
      slug: 'demo',
      plan: 'PROFESSIONAL',
      planStatus: 'active',
      isDemo: true,
      phone: '+880-1700-000000',
      email: 'info@coralbay.demo',
      address: "1 Ocean Drive, Cox's Bazar, Bangladesh",
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      checkInTime: '14:00',
      checkOutTime: '11:00',
      taxRate: 10,
      smsEnabled: false,
      waEnabled: false,
      smsQuotaMonthly: 500,
      waQuotaMonthly: 200,
    },
  });
  console.log(`✅ Tenant: ${demo.name}`);

  // ── Demo Users ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo@ResortPro2026!', 12);

  const demoOwner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'demo@resortpro.site' } },
    update: {},
    create: { tenantId: demo.id, email: 'demo@resortpro.site', passwordHash, firstName: 'Demo', lastName: 'User', role: UserRole.OWNER },
  });

  const demoManager = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'manager@coralbay.demo' } },
    update: {},
    create: { tenantId: demo.id, email: 'manager@coralbay.demo', passwordHash, firstName: 'Nasrin', lastName: 'Sultana', role: UserRole.MANAGER },
  });

  const demoStaff1 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'reception@coralbay.demo' } },
    update: {},
    create: { tenantId: demo.id, email: 'reception@coralbay.demo', passwordHash, firstName: 'Rubel', lastName: 'Mia', role: UserRole.RECEPTIONIST },
  });

  const demoStaff2 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'hk@coralbay.demo' } },
    update: {},
    create: { tenantId: demo.id, email: 'hk@coralbay.demo', passwordHash, firstName: 'Rina', lastName: 'Akter', role: UserRole.STAFF },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'partner@coralbay.demo' } },
    update: {},
    create: { tenantId: demo.id, email: 'partner@coralbay.demo', passwordHash, firstName: 'Rafiq', lastName: 'Ahmed', role: UserRole.SHAREHOLDER },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'marketer@coralbay.demo' } },
    update: {},
    create: { tenantId: demo.id, email: 'marketer@coralbay.demo', passwordHash, firstName: 'Mitu', lastName: 'Islam', role: UserRole.MARKETER },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'dev@coralbay.demo' } },
    update: {},
    create: { tenantId: demo.id, email: 'dev@coralbay.demo', passwordHash, firstName: 'Shanto', lastName: 'Das', role: UserRole.DEVELOPER },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demo.id, email: 'chef@coralbay.demo' } },
    update: {},
    create: { tenantId: demo.id, email: 'chef@coralbay.demo', passwordHash, firstName: 'Karim', lastName: 'Molla', role: UserRole.CHEF },
  });

  console.log('✅ Users (owner, manager, receptionist, staff, partner, marketer, developer, chef)');

  // ── Staff Records ─────────────────────────────────────────────────────────────
  await prisma.staff.upsert({ where: { userId: demoOwner.id }, update: {}, create: { tenantId: demo.id, userId: demoOwner.id, department: StaffDepartment.MANAGEMENT, position: 'Resort Owner', hireDate: new Date('2022-01-01') } });
  await prisma.staff.upsert({ where: { userId: demoManager.id }, update: {}, create: { tenantId: demo.id, userId: demoManager.id, department: StaffDepartment.MANAGEMENT, position: 'General Manager', hireDate: new Date('2022-03-15') } });
  const staff1 = await prisma.staff.upsert({ where: { userId: demoStaff1.id }, update: {}, create: { tenantId: demo.id, userId: demoStaff1.id, department: StaffDepartment.FRONT_DESK, position: 'Senior Receptionist', hireDate: new Date('2022-06-01') } });
  const staff2 = await prisma.staff.upsert({ where: { userId: demoStaff2.id }, update: {}, create: { tenantId: demo.id, userId: demoStaff2.id, department: StaffDepartment.HOUSEKEEPING, position: 'Housekeeping Supervisor', hireDate: new Date('2023-01-10') } });
  console.log('✅ Staff records');

  // ── Rooms ────────────────────────────────────────────────────────────────────
  const roomsData = [
    { number: '101', name: 'Sea View Standard',   type: RoomType.STANDARD, floor: 1, maxOccupancy: 2, basePrice: 4500,  status: RoomStatus.AVAILABLE },
    { number: '102', name: 'Sea View Standard',   type: RoomType.STANDARD, floor: 1, maxOccupancy: 2, basePrice: 4500,  status: RoomStatus.OCCUPIED  },
    { number: '103', name: 'Garden Standard',     type: RoomType.STANDARD, floor: 1, maxOccupancy: 2, basePrice: 3800,  status: RoomStatus.CLEANING  },
    { number: '201', name: 'Ocean Deluxe',        type: RoomType.DELUXE,   floor: 2, maxOccupancy: 3, basePrice: 7500,  status: RoomStatus.AVAILABLE },
    { number: '202', name: 'Ocean Deluxe',        type: RoomType.DELUXE,   floor: 2, maxOccupancy: 3, basePrice: 7500,  status: RoomStatus.OCCUPIED  },
    { number: '301', name: 'Sunset Suite',        type: RoomType.SUITE,    floor: 3, maxOccupancy: 4, basePrice: 14000, status: RoomStatus.AVAILABLE },
    { number: '302', name: 'Honeymoon Suite',     type: RoomType.SUITE,    floor: 3, maxOccupancy: 2, basePrice: 16000, status: RoomStatus.OCCUPIED  },
    { number: 'V1',  name: 'Beachfront Villa',    type: RoomType.VILLA,    floor: 0, maxOccupancy: 6, basePrice: 28000, status: RoomStatus.AVAILABLE },
    { number: 'V2',  name: 'Garden Pool Villa',   type: RoomType.VILLA,    floor: 0, maxOccupancy: 6, basePrice: 24000, status: RoomStatus.OCCUPIED  },
    { number: 'C1',  name: 'Tropical Bungalow',   type: RoomType.BUNGALOW, floor: 0, maxOccupancy: 2, basePrice: 9500,  status: RoomStatus.AVAILABLE },
  ];

  const createdRooms: any[] = [];
  for (const room of roomsData) {
    const r = await prisma.room.upsert({
      where: { tenantId_number: { tenantId: demo.id, number: room.number } },
      update: { status: room.status },
      create: { tenantId: demo.id, ...room, amenities: ['WiFi', 'AC', 'Smart TV', 'Mini Bar'], images: [] },
    });
    createdRooms.push(r);
  }
  console.log(`✅ ${createdRooms.length} rooms`);

  // ── Rate Plans ────────────────────────────────────────────────────────────────
  const ratePlans = [
    { name: 'Best Available Rate', description: 'Our standard flexible rate. Free cancellation up to 24h before check-in.', multiplier: 1.0, minNights: 1, isActive: true },
    { name: 'Non-Refundable Rate', description: 'Save 15% with our non-refundable rate. Full payment at booking.', multiplier: 0.85, minNights: 1, isActive: true },
    { name: 'Weekly Saver',        description: 'Stay 7+ nights and save 20%. Perfect for longer getaways.',            multiplier: 0.80, minNights: 7, isActive: true },
    { name: 'Early Bird (30 days)',description: 'Book 30 days ahead and save 10%.',                                      multiplier: 0.90, minNights: 2, isActive: true },
  ];
  for (const rp of ratePlans) {
    await prisma.ratePlan.create({ data: { tenantId: demo.id, price: 0, ...rp } }).catch(() => {});
  }
  console.log('✅ Rate plans');

  // ── Packages ─────────────────────────────────────────────────────────────────
  const packages = [
    { name: 'Romantic Getaway', description: 'Perfect for couples — includes couple spa, candlelit dinner, and rose petal room decor.', price: 8500, duration: 2, isActive: true, inclusions: ['Couple Spa (60 min)', 'Candlelit Dinner', 'Rose Petal Decoration', 'Late Checkout (2 PM)', 'Welcome Drink'] },
    { name: 'Family Fun Package', description: 'Everything your family needs — water sports, kids club, and buffet breakfast included.', price: 12000, duration: 3, isActive: true, inclusions: ['Buffet Breakfast (daily)', 'Water Sports Session', 'Kids Club Access', 'Family Room Upgrade', 'Airport Transfer'] },
    { name: 'Business Stay', description: 'For the corporate traveler — fast WiFi, meeting room access, and express laundry.', price: 6000, duration: 2, isActive: true, inclusions: ['Meeting Room (2hrs)', 'Express Laundry', 'Airport Transfer', 'Daily Breakfast', 'High-Speed WiFi'] },
    { name: 'Honeymoon Bliss', description: 'Start your new journey in paradise — champagne, spa, and a private beach picnic.', price: 22000, duration: 3, isActive: true, inclusions: ['Champagne on Arrival', 'Private Beach Picnic', 'Couple Spa (90 min)', 'Honeymoon Suite Upgrade', 'Professional Photo Session'] },
  ];
  for (const pkg of packages) {
    await prisma.package.create({ data: { tenantId: demo.id, ...pkg } }).catch(() => {});
  }
  console.log('✅ Packages');

  // ── Guests ───────────────────────────────────────────────────────────────────
  const guestData = [
    { firstName: 'Karim',   lastName: 'Hossain',   email: 'karim@example.com',   phone: '+8801711111111', nationality: 'BD', address: "Cox's Bazar" },
    { firstName: 'Rina',    lastName: 'Begum',     email: 'rina@example.com',    phone: '+8801811111112', nationality: 'BD', address: 'Dhaka' },
    { firstName: 'James',   lastName: 'Miller',    email: 'james@example.com',   phone: '+447911111111',  nationality: 'GB', address: 'London' },
    { firstName: 'Priya',   lastName: 'Sharma',    email: 'priya@example.com',   phone: '+919811111111',  nationality: 'IN', address: 'Mumbai' },
    { firstName: 'Ahmed',   lastName: 'Rahman',    email: 'ahmed@example.com',   phone: '+8801911111113', nationality: 'BD', address: 'Chittagong' },
    { firstName: 'Sara',    lastName: 'Khan',      email: 'sara@example.com',    phone: '+8801611111114', nationality: 'BD', address: 'Sylhet' },
    { firstName: 'Michael', lastName: 'Chen',      email: 'michael@example.com', phone: '+6591111111',    nationality: 'SG', address: 'Singapore' },
    { firstName: 'Fatema',  lastName: 'Akter',     email: 'fatema@example.com',  phone: '+8801511111115', nationality: 'BD', address: 'Dhaka' },
    { firstName: 'Tanvir',  lastName: 'Islam',     email: 'tanvir@example.com',  phone: '+8801311111116', nationality: 'BD', address: 'Rajshahi' },
    { firstName: 'Nadia',   lastName: 'Chowdhury', email: 'nadia@example.com',   phone: '+8801211111117', nationality: 'BD', address: 'Dhaka' },
  ];

  const createdGuests: any[] = [];
  for (const g of guestData) {
    const guest = await prisma.guest.upsert({
      where: { tenantId_email: { tenantId: demo.id, email: g.email } },
      update: {},
      create: { tenantId: demo.id, ...g },
    });
    createdGuests.push(guest);
  }
  console.log(`✅ ${createdGuests.length} guests`);

  // ── Bookings + Payments ───────────────────────────────────────────────────────
  const bookingsData = [
    // Active / checked-in
    { g: 0, r: 1,  ci: d(-2),  co: d(1),  status: BookingStatus.CHECKED_IN,  total: 13500,  paid: 13500,  adults: 2, ch: 0, cn: 'CBR-2026-001', src: 'DIRECT' },
    { g: 4, r: 4,  ci: d(-1),  co: d(3),  status: BookingStatus.CHECKED_IN,  total: 30000,  paid: 15000,  adults: 2, ch: 1, cn: 'CBR-2026-002', src: 'BOOKING_COM' },
    { g: 6, r: 6,  ci: d(-3),  co: d(0),  status: BookingStatus.CHECKED_IN,  total: 48000,  paid: 48000,  adults: 2, ch: 0, cn: 'CBR-2026-003', src: 'AIRBNB' },
    { g: 7, r: 8,  ci: d(-1),  co: d(4),  status: BookingStatus.CHECKED_IN,  total: 120000, paid: 60000,  adults: 4, ch: 2, cn: 'CBR-2026-004', src: 'DIRECT' },
    // Upcoming confirmed
    { g: 1, r: 0,  ci: d(1),   co: d(4),  status: BookingStatus.CONFIRMED,   total: 13500,  paid: 6750,   adults: 2, ch: 0, cn: 'CBR-2026-005', src: 'DIRECT' },
    { g: 2, r: 3,  ci: d(2),   co: d(6),  status: BookingStatus.CONFIRMED,   total: 30000,  paid: 30000,  adults: 1, ch: 0, cn: 'CBR-2026-006', src: 'BOOKING_COM' },
    { g: 5, r: 5,  ci: d(3),   co: d(7),  status: BookingStatus.CONFIRMED,   total: 56000,  paid: 28000,  adults: 2, ch: 0, cn: 'CBR-2026-007', src: 'DIRECT' },
    { g: 3, r: 9,  ci: d(5),   co: d(8),  status: BookingStatus.CONFIRMED,   total: 28500,  paid: 28500,  adults: 2, ch: 0, cn: 'CBR-2026-008', src: 'AIRBNB' },
    { g: 8, r: 2,  ci: d(8),   co: d(11), status: BookingStatus.CONFIRMED,   total: 11400,  paid: 0,      adults: 2, ch: 0, cn: 'CBR-2026-009', src: 'DIRECT' },
    { g: 9, r: 7,  ci: d(10),  co: d(13), status: BookingStatus.CONFIRMED,   total: 84000,  paid: 42000,  adults: 3, ch: 1, cn: 'CBR-2026-010', src: 'DIRECT' },
    // Past check-outs (for revenue/analytics)
    { g: 0, r: 2,  ci: d(-15), co: d(-12),status: BookingStatus.CHECKED_OUT, total: 11400,  paid: 11400,  adults: 2, ch: 0, cn: 'CBR-2026-011', src: 'DIRECT' },
    { g: 2, r: 3,  ci: d(-20), co: d(-17),status: BookingStatus.CHECKED_OUT, total: 22500,  paid: 22500,  adults: 1, ch: 0, cn: 'CBR-2026-012', src: 'BOOKING_COM' },
    { g: 6, r: 7,  ci: d(-30), co: d(-27),status: BookingStatus.CHECKED_OUT, total: 72000,  paid: 72000,  adults: 4, ch: 0, cn: 'CBR-2026-013', src: 'AIRBNB' },
    { g: 1, r: 4,  ci: d(-45), co: d(-42),status: BookingStatus.CHECKED_OUT, total: 22500,  paid: 22500,  adults: 2, ch: 1, cn: 'CBR-2026-014', src: 'DIRECT' },
    { g: 3, r: 5,  ci: d(-60), co: d(-57),status: BookingStatus.CHECKED_OUT, total: 42000,  paid: 42000,  adults: 2, ch: 0, cn: 'CBR-2026-015', src: 'DIRECT' },
    { g: 5, r: 9,  ci: d(-25), co: d(-22),status: BookingStatus.CHECKED_OUT, total: 28500,  paid: 28500,  adults: 2, ch: 0, cn: 'CBR-2026-016', src: 'WALK_IN' },
    { g: 4, r: 6,  ci: d(-10), co: d(-8), status: BookingStatus.CHECKED_OUT, total: 32000,  paid: 32000,  adults: 2, ch: 0, cn: 'CBR-2026-017', src: 'DIRECT' },
    // Cancelled
    { g: 8, r: 1,  ci: d(-5),  co: d(-2), status: BookingStatus.CANCELLED,   total: 9000,   paid: 0,      adults: 2, ch: 0, cn: 'CBR-2026-018', src: 'BOOKING_COM' },
  ];

  const createdBookings: any[] = [];
  for (const b of bookingsData) {
    const existing = await prisma.booking.findFirst({ where: { tenantId: demo.id, confirmationNo: b.cn } });
    if (!existing) {
      // paymentStatus must reflect paid vs total — GET /bookings/:id/invoice and
      // the balance-consistency audit (scripts/audit-balances.ts) both check
      // this against the actual Payment rows below, so it has to be right.
      const paymentStatus =
        b.paid <= 0 ? 'PENDING' :
        b.paid >= b.total ? 'PAID' : 'PARTIAL';

      const booking = await prisma.booking.create({
        data: {
          tenantId: demo.id,
          guestId: createdGuests[b.g].id,
          roomId: createdRooms[b.r].id,
          checkIn: b.ci,
          checkOut: b.co,
          status: b.status,
          adults: b.adults,
          children: b.ch,
          totalAmount: b.total,
          paidAmount: b.paid,
          paymentStatus: paymentStatus as any,
          confirmationNo: b.cn,
          source: b.src as any,
          notes: b.status === BookingStatus.CANCELLED ? 'Guest requested cancellation' : undefined,
        },
      });
      createdBookings.push(booking);

      // Add payment records for paid bookings. `status` must be a real
      // PaymentStatus enum value ('PAID', not 'COMPLETED' — that value never
      // existed) — the previous 'COMPLETED' + a silent .catch(() => {}) meant
      // every one of these inserts had been failing invisibly, leaving every
      // "paid" demo booking with zero backing Payment rows.
      if (b.paid > 0 && b.status !== BookingStatus.CANCELLED) {
        await prisma.payment.create({
          data: {
            tenantId: demo.id,
            bookingId: booking.id,
            amount: b.paid,
            method: b.src === 'BOOKING_COM' || b.src === 'AIRBNB' ? PaymentMethod.BANK_TRANSFER : PaymentMethod.CASH,
            status: 'PAID',
            reference: `PAY-${b.cn}`,
            notes: 'Demo payment',
          },
        }).catch((err) => console.error(`⚠️  Payment create failed for ${b.cn}:`, err.message));
      }
    } else {
      createdBookings.push(existing);
    }
  }
  console.log(`✅ ${bookingsData.length} bookings + payments`);

  // ── Invoices ─────────────────────────────────────────────────────────────────
  // status/paidAmount used to come from an independent hardcoded array while
  // paidAmount was never set at all (defaulted to 0) — so several rows
  // showed e.g. "Paid" while a nonzero amount was still "Due", even though
  // each invoice is linked to a real booking with its own consistent
  // paidAmount/paymentStatus just above. Derive both from that booking
  // instead, the same "booking is the real source of truth" rule
  // withBookingPaymentTruth() enforces at read time in routes/invoices.ts —
  // seeding it self-contradictory defeats that safety net for demo data
  // nobody ever makes a real payment against afterwards.
  for (let i = 0; i < Math.min(7, createdBookings.length); i++) {
    const bk = createdBookings[i];
    const guest = createdGuests.find((g: any) => g.id === bk.guestId);
    const existing = await prisma.invoice.findFirst({ where: { tenantId: demo.id, bookingId: bk.id } });
    if (!existing) {
      const subtotal = Number(bk.totalAmount);
      const taxAmt = Math.round(subtotal * 0.10);
      const total = subtotal + taxAmt;

      // i===0 and i===5 are deliberately shown as "never sent" / "overdue"
      // demo examples (kept from the original hardcoded array) — everything
      // else derives status straight from the booking's real paidAmount so
      // it can never contradict the "Due" amount shown next to it.
      let status: 'DRAFT' | 'SENT' | 'PAID' | 'PARTIAL' | 'OVERDUE';
      let paidAmount: number;
      if (i === 0) {
        status = 'DRAFT';
        paidAmount = 0;
      } else if (i === 5) {
        status = 'OVERDUE';
        paidAmount = Math.min(Number(bk.paidAmount), total * 0.5);
      } else {
        paidAmount = Math.min(Number(bk.paidAmount), total);
        status = paidAmount <= 0 ? 'SENT' : paidAmount >= total ? 'PAID' : 'PARTIAL';
      }

      const inv = await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-2026-${String(i + 1).padStart(3, '0')}`,
          tenantId:      demo.id,
          bookingId:     bk.id,
          guestName:     guest ? `${guest.firstName} ${guest.lastName}` : 'Guest',
          guestEmail:    guest?.email,
          guestPhone:    guest?.phone,
          status:        status as any,
          subtotal,
          taxRate:       10,
          taxAmount:     taxAmt,
          paidAmount,
          total,
          dueDate:       d(status === 'OVERDUE' ? -3 : 7),
          notes:         'Thank you for choosing Coral Bay Resort.',
        },
      });
      await prisma.invoiceItem.create({
        data: {
          invoiceId:   inv.id,
          description: 'Room accommodation',
          category:    'ROOM' as any,
          quantity:    1,
          unitPrice:   subtotal,
          total:       subtotal,
        },
      }).catch(() => {});
    }
  }
  console.log('✅ Invoices');

  // ── Housekeeping Tasks ────────────────────────────────────────────────────────
  const hkTasks = [
    { r: 2,  type: HousekeepingType.CHECKOUT,   status: HousekeepingStatus.PENDING,     notes: 'Guest checked out — full clean needed', scheduledDate: d(0) },
    { r: 1,  type: HousekeepingType.DAILY,      status: HousekeepingStatus.IN_PROGRESS, notes: 'Daily turn-down service',               scheduledDate: d(0) },
    { r: 4,  type: HousekeepingType.DAILY,      status: HousekeepingStatus.PENDING,     notes: 'Daily clean for occupied room',         scheduledDate: d(0) },
    { r: 6,  type: HousekeepingType.TURNDOWN,   status: HousekeepingStatus.PENDING,     notes: 'Evening turn-down for honeymoon suite', scheduledDate: d(0) },
    { r: 0,  type: HousekeepingType.CHECKIN,    status: HousekeepingStatus.COMPLETED,   notes: 'Room prepared for new arrival',         scheduledDate: d(0) },
    { r: 3,  type: HousekeepingType.DEEP_CLEAN, status: HousekeepingStatus.PENDING,     notes: 'Weekly deep clean',                     scheduledDate: d(1) },
    { r: 8,  type: HousekeepingType.CHECKOUT,   status: HousekeepingStatus.PENDING,     notes: 'Villa deep clean after long stay',      scheduledDate: d(1) },
    { r: 5,  type: HousekeepingType.DAILY,      status: HousekeepingStatus.COMPLETED,   notes: 'Morning clean completed',               scheduledDate: d(-1) },
  ];
  for (const hk of hkTasks) {
    await prisma.housekeepingTask.create({
      data: {
        tenantId:      demo.id,
        roomId:        createdRooms[hk.r].id,
        // HousekeepingTask.assignedToId is a Staff FK, not a User FK — using
        // demoStaff2.id (the User id) here violated the FK constraint on any
        // fresh DB where housekeeping_tasks didn't already have stale rows
        // from before this bug (this is what broke CI's E2E job, which seeds
        // against a brand-new database every run).
        assignedToId:  staff2.id,
        type:          hk.type,
        status:        hk.status,
        notes:         hk.notes,
        scheduledDate: hk.scheduledDate,
        completedAt:   hk.status === HousekeepingStatus.COMPLETED ? d(-1) : null,
      },
    }).catch(() => {});
  }
  console.log(`✅ ${hkTasks.length} housekeeping tasks`);

  // ── Maintenance Tickets ───────────────────────────────────────────────────────
  const maintenanceTasks = [
    { r: 1, type: MaintenanceIssueType.AC,         priority: MaintenancePriority.HIGH,   status: MaintenanceStatus.OPEN,        title: 'AC not cooling properly',          desc: 'Guest reported AC is not cooling. Room temp stuck at 28°C.' },
    { r: 4, type: MaintenanceIssueType.PLUMBING,   priority: MaintenancePriority.URGENT, status: MaintenanceStatus.IN_PROGRESS, title: 'Bathroom shower draining slowly',   desc: 'Shower drain partially blocked. Plumber dispatched.' },
    { r: 6, type: MaintenanceIssueType.TV,         priority: MaintenancePriority.NORMAL, status: MaintenanceStatus.OPEN,        title: 'Smart TV remote not working',      desc: 'TV remote unresponsive. Batteries replaced — still faulty.' },
    { r: 8, type: MaintenanceIssueType.WIFI,       priority: MaintenancePriority.HIGH,   status: MaintenanceStatus.OPEN,        title: 'WiFi signal weak in villa',        desc: 'Guest complaining about weak WiFi signal. Need extender.' },
    { r: 0, type: MaintenanceIssueType.DOOR,       priority: MaintenancePriority.NORMAL, status: MaintenanceStatus.RESOLVED,    title: 'Room door lock stiff',             desc: 'Door lock was stiff. Lubricated and adjusted — resolved.' },
    { r: 3, type: MaintenanceIssueType.ELECTRICAL, priority: MaintenancePriority.HIGH,   status: MaintenanceStatus.OPEN,        title: 'Power socket not working',         desc: 'Bedside power socket dead. Electrician scheduled.' },
    { r: 2, type: MaintenanceIssueType.FURNITURE,  priority: MaintenancePriority.LOW,    status: MaintenanceStatus.RESOLVED,    title: 'Wardrobe door hinge loose',        desc: 'Wardrobe hinge was loose. Fixed by maintenance team.' },
  ];
  for (const mt of maintenanceTasks) {
    await prisma.maintenanceTicket.create({
      data: {
        tenantId:    demo.id,
        roomId:      createdRooms[mt.r].id,
        createdBy:   demoStaff1.id,
        issueType:   mt.type,
        priority:    mt.priority,
        status:      mt.status,
        description: mt.desc,
        resolvedAt:  mt.status === MaintenanceStatus.RESOLVED ? d(-1) : null,
      },
    }).catch(() => {});
  }
  console.log(`✅ ${maintenanceTasks.length} maintenance tickets`);

  // ── Support Tickets ───────────────────────────────────────────────────────────
  const tickets = [
    { g: 0, priority: TicketPriority.HIGH,   status: TicketStatus.OPEN,        category: TicketCategory.FOOD_BEVERAGE, subject: 'Room service delay',             msg: 'I ordered breakfast 45 minutes ago and it still has not arrived. Room 102.' },
    { g: 4, priority: TicketPriority.MEDIUM, status: TicketStatus.IN_PROGRESS, category: TicketCategory.REQUEST,       subject: 'Extra towels and pillow',        msg: 'Please send 2 extra towels and 1 extra pillow to Villa V2.' },
    { g: 6, priority: TicketPriority.LOW,    status: TicketStatus.RESOLVED,    category: TicketCategory.HOUSEKEEPING,  subject: 'Room not cleaned by 2pm',        msg: 'Our room was not cleaned today. We had Do Not Disturb until 1pm.' },
    { g: 2, priority: TicketPriority.HIGH,   status: TicketStatus.OPEN,        category: TicketCategory.BILLING,       subject: 'Invoice amount incorrect',       msg: 'The invoice I received shows a different amount than quoted at booking.' },
    { g: 7, priority: TicketPriority.MEDIUM, status: TicketStatus.RESOLVED,    category: TicketCategory.MAINTENANCE,   subject: 'TV remote not working',          msg: 'The remote for the TV in Villa V2 is not responding.' },
    { g: 1, priority: TicketPriority.LOW,    status: TicketStatus.OPEN,        category: TicketCategory.REQUEST,       subject: 'Early check-in request',         msg: 'Our flight arrives at 10am. Is early check-in possible for room 101?' },
    { g: 3, priority: TicketPriority.URGENT, status: TicketStatus.IN_PROGRESS, category: TicketCategory.COMPLAINT,     subject: 'Noise from neighboring villa',   msg: 'There is loud music coming from the next villa. It is after midnight.' },
  ];
  for (const t of tickets) {
    await prisma.supportTicket.create({
      data: {
        tenantId:    demo.id,
        guestId:     createdGuests[t.g].id,
        assignedToId: demoStaff1.id,
        title:       t.subject,
        description: t.msg,
        priority:    t.priority,
        status:      t.status,
        category:    t.category,
        resolvedAt:  t.status === TicketStatus.RESOLVED ? d(-1) : null,
      },
    }).catch(() => {});
  }
  console.log(`✅ ${tickets.length} support tickets`);

  // ── Food Orders ───────────────────────────────────────────────────────────────
  const menuItemsDB = await prisma.menuItem.findMany({ where: { tenantId: demo.id } });
  if (menuItemsDB.length === 0) {
    // Create menu items first
    const menuItems = [
      { name: 'Deshi Breakfast Set',    category: 'BREAKFAST', price: 350 },
      { name: 'Continental Breakfast',  category: 'BREAKFAST', price: 550 },
      { name: 'Hilsa Fish Curry',       category: 'LUNCH',     price: 680 },
      { name: 'Grilled Sea Bass',       category: 'DINNER',    price: 950 },
      { name: 'Lobster Thermidor',      category: 'DINNER',    price: 1800 },
      { name: 'Prawn Cocktail',         category: 'APPETIZER', price: 580 },
      { name: 'Mango Pudding',          category: 'DESSERT',   price: 220 },
      { name: 'Fresh Coconut Water',    category: 'BEVERAGE',  price: 120 },
      { name: 'Tropical Smoothie',      category: 'BEVERAGE',  price: 280 },
      { name: "Chef's Special",         category: 'SPECIAL',   price: 1250 },
    ];
    for (const item of menuItems) {
      await prisma.menuItem.create({ data: { tenantId: demo.id, ...(item as any), isAvailable: true } }).catch(() => {});
    }
  }
  const menuItems2 = await prisma.menuItem.findMany({ where: { tenantId: demo.id } });
  const foodOrderStatuses = ['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'DELIVERED', 'DELIVERED'];
  for (let i = 0; i < 6 && i < createdBookings.length && menuItems2.length > 0; i++) {
    const bk = createdBookings[i];
    if (bk.status === BookingStatus.CANCELLED) continue;
    const item1 = menuItems2[i % menuItems2.length];
    const item2 = menuItems2[(i + 2) % menuItems2.length];
    const total = Number(item1.price) + Number(item2.price);
    await prisma.foodOrder.create({
      data: {
        tenantId:   demo.id,
        bookingId:  bk.id,
        guestId:    bk.guestId,
        status:     foodOrderStatuses[i] as any,
        totalAmount: total,
        notes:      i % 2 === 0 ? 'No spicy please' : 'Extra sauce on side',
        items: {
          create: [
            { menuItemId: item1.id, quantity: 1, unitPrice: item1.price, notes: '' },
            { menuItemId: item2.id, quantity: 1, unitPrice: item2.price, notes: '' },
          ],
        },
      },
    }).catch(() => {});
  }
  console.log('✅ Food orders');

  // ── Expenses ──────────────────────────────────────────────────────────────────
  const expenses = [
    { description: 'Electricity Bill — May',       amount: 45000,  category: 'UTILITIES',     date: d(-5),  isPaid: true },
    { description: 'Water Supply — May',           amount: 8500,   category: 'UTILITIES',     date: d(-5),  isPaid: true },
    { description: 'Internet & WiFi — May',        amount: 5000,   category: 'UTILITIES',     date: d(-10), isPaid: true },
    { description: 'Staff Salary — May',           amount: 280000, category: 'SALARIES',      date: d(-3),  isPaid: true },
    { description: 'Contract Housekeeping Staff',  amount: 45000,  category: 'SALARIES',      date: d(-3),  isPaid: true },
    { description: 'Pool Maintenance & Chemicals', amount: 12000,  category: 'MAINTENANCE',   date: d(-7),  isPaid: true },
    { description: 'AC Servicing (4 units)',       amount: 8000,   category: 'MAINTENANCE',   date: d(-12), isPaid: true },
    { description: 'Food & Beverage Supplies',     amount: 38000,  category: 'SUPPLIES',      date: d(-2),  isPaid: true },
    { description: 'Laundry & Linen Service',      amount: 8500,   category: 'HOUSEKEEPING',  date: d(-1),  isPaid: true },
    { description: 'Towels & Linens (restock)',    amount: 22000,  category: 'SUPPLIES',      date: d(-4),  isPaid: true },
    { description: 'Marketing — Social Media',     amount: 15000,  category: 'MARKETING',     date: d(-8),  isPaid: true },
    { description: 'Google Ads Campaign',          amount: 20000,  category: 'MARKETING',     date: d(-15), isPaid: true },
    { description: 'Property Insurance — Q2',      amount: 35000,  category: 'OTHER',         date: d(-20), isPaid: true },
    { description: 'Garden & Landscaping',         amount: 9500,   category: 'MAINTENANCE',   date: d(-6),  isPaid: false },
    { description: 'CCTV Maintenance Contract',    amount: 6000,   category: 'MAINTENANCE',   date: d(-30), isPaid: true },
    // Previous months for analytics
    { description: 'Electricity Bill — April',     amount: 42000,  category: 'UTILITIES',     date: d(-35), isPaid: true },
    { description: 'Staff Salary — April',         amount: 280000, category: 'SALARIES',      date: d(-33), isPaid: true },
    { description: 'Food & Beverage — April',      amount: 35000,  category: 'SUPPLIES',      date: d(-32), isPaid: true },
    { description: 'Electricity Bill — March',     amount: 40000,  category: 'UTILITIES',     date: d(-65), isPaid: true },
    { description: 'Staff Salary — March',         amount: 275000, category: 'SALARIES',      date: d(-63), isPaid: true },
  ];
  for (const e of expenses) {
    await prisma.expense.create({ data: { tenantId: demo.id, createdBy: demoStaff1.id, ...e as any } }).catch(() => {});
  }
  console.log(`✅ ${expenses.length} expenses`);

  // ── Inventory ─────────────────────────────────────────────────────────────────
  const inventory = [
    { name: 'Bath Towels (Large)',      category: 'LINEN',         unit: 'pcs',     currentStock: 180, minimumStock: 60,  unitCost: 350  },
    { name: 'Bed Sheets (King)',        category: 'LINEN',         unit: 'sets',    currentStock: 65,  minimumStock: 25,  unitCost: 1200 },
    { name: 'Bed Sheets (Queen)',       category: 'LINEN',         unit: 'sets',    currentStock: 45,  minimumStock: 20,  unitCost: 950  },
    { name: 'Shampoo (100ml)',          category: 'TOILETRIES',    unit: 'bottles', currentStock: 420, minimumStock: 150, unitCost: 65   },
    { name: 'Conditioner (100ml)',      category: 'TOILETRIES',    unit: 'bottles', currentStock: 380, minimumStock: 120, unitCost: 70   },
    { name: 'Body Lotion (100ml)',      category: 'TOILETRIES',    unit: 'bottles', currentStock: 45,  minimumStock: 120, unitCost: 80   }, // low stock!
    { name: 'All-Purpose Cleaner',      category: 'CLEANING',      unit: 'liters',  currentStock: 38,  minimumStock: 15,  unitCost: 180  },
    { name: 'Coffee Beans (Premium)',   category: 'FOOD_BEVERAGE', unit: 'kg',      currentStock: 12,  minimumStock: 8,   unitCost: 1800 },
    { name: 'Tea Bags (Assorted)',      category: 'FOOD_BEVERAGE', unit: 'boxes',   currentStock: 85,  minimumStock: 30,  unitCost: 350  },
    { name: 'Mineral Water (500ml)',    category: 'FOOD_BEVERAGE', unit: 'cases',   currentStock: 8,   minimumStock: 20,  unitCost: 480  }, // low stock!
    { name: 'Toilet Paper Rolls',       category: 'CLEANING',      unit: 'packs',   currentStock: 120, minimumStock: 40,  unitCost: 220  },
    { name: 'Laundry Detergent',        category: 'CLEANING',      unit: 'kg',      currentStock: 25,  minimumStock: 10,  unitCost: 320  },
  ];
  for (const item of inventory) {
    await prisma.inventoryItem.create({ data: { tenantId: demo.id, ...item as any } }).catch(() => {});
  }
  console.log(`✅ ${inventory.length} inventory items`);

  // ── Guest Tags (CRM) ──────────────────────────────────────────────────────────
  const tagNames = ['VIP', 'Repeat Guest', 'Honeymoon', 'Corporate', 'Family', 'International'];
  const createdTags: any[] = [];
  for (const name of tagNames) {
    const t = await prisma.guestTag.create({
      data: { tenantId: demo.id, name, color: name === 'VIP' ? '#gold' : '#3b82f6' },
    }).catch(() => null);
    if (t) createdTags.push(t);
  }

  // Tag some guests
  if (createdTags.length > 0) {
    const tagMap = Object.fromEntries(createdTags.map((t: any) => [t.name, t]));
    const guestTagPairs = [
      { g: 0, tag: 'Repeat Guest' }, { g: 0, tag: 'VIP' },
      { g: 2, tag: 'International' }, { g: 2, tag: 'Corporate' },
      { g: 3, tag: 'International' },
      { g: 5, tag: 'Repeat Guest' },
      { g: 6, tag: 'International' }, { g: 6, tag: 'VIP' },
      { g: 7, tag: 'Family' },
      { g: 1, tag: 'Honeymoon' },
    ];
    for (const gtp of guestTagPairs) {
      const tag = tagMap[gtp.tag];
      if (tag) {
        await prisma.guestTagRelation.create({
          data: { guestId: createdGuests[gtp.g].id, tagId: tag.id },
        }).catch(() => {});
      }
    }
  }

  // ── Guest Scores (CRM) ────────────────────────────────────────────────────────
  for (let i = 0; i < createdGuests.length; i++) {
    await prisma.guestScore.upsert({
      where: { guestId: createdGuests[i].id },
      update: {},
      create: {
        tenantId:      demo.id,
        guestId:       createdGuests[i].id,
        totalStays:    i < 4 ? Math.floor(Math.random() * 5) + 1 : 1,
        totalSpend:    [13500, 22500, 30000, 28500, 120000, 28500, 48000, 120000, 11400, 84000][i] ?? 10000,
      },
    }).catch(() => {});
  }
  console.log('✅ CRM: guest tags + scores');

  // ── Amenities ─────────────────────────────────────────────────────────────────
  const amenities = [
    { name: 'Infinity Pool',      category: 'POOL',          icon: '🏊' },
    { name: 'Spa & Wellness',     category: 'SPA',           icon: '💆' },
    { name: 'Private Beach',      category: 'BEACH',         icon: '🏖️' },
    { name: 'Fitness Center',     category: 'GYM',           icon: '🏋️' },
    { name: 'Water Sports',       category: 'SPORTS',        icon: '🏄' },
    { name: 'Airport Transfer',   category: 'TRANSPORT',     icon: '🚌' },
    { name: 'Fine Dining',        category: 'ENTERTAINMENT', icon: '🍽️' },
    { name: 'Rooftop Bar',        category: 'ENTERTAINMENT', icon: '🍹' },
    { name: 'Kids Club',          category: 'ENTERTAINMENT', icon: '🎠' },
  ];
  for (const a of amenities) {
    await prisma.amenity.create({ data: { tenantId: demo.id, ...a as any } }).catch(() => {});
  }
  console.log('✅ Amenities');

  // ── Loyalty Program ───────────────────────────────────────────────────────────
  const existingLP = await prisma.loyaltyProgram.findUnique({ where: { tenantId: demo.id } });
  if (!existingLP) {
    const lp = await prisma.loyaltyProgram.create({
      data: {
        tenantId:         demo.id,
        programName:      'Coral Bay Rewards',
        pointsPerDollar:  10,
        redemptionRate:   100,
        bronzeThreshold:  0,
        silverThreshold:  5000,
        goldThreshold:    15000,
        platinumThreshold:50000,
        isEnabled:        true,
      },
    });
    // Give some guests loyalty accounts
    for (let i = 0; i < Math.min(5, createdGuests.length); i++) {
      const points = [12500, 3200, 8700, 1500, 25000][i] ?? 0;
      await prisma.loyaltyAccount.create({
        data: {
          tenantId:      demo.id,
          guestId:       createdGuests[i].id,
          points,
          tier:          points >= 50000 ? 'PLATINUM' : points >= 15000 ? 'GOLD' : points >= 5000 ? 'SILVER' : 'BRONZE',
          lifetimePoints:points + Math.floor(points * 0.2),
        },
      }).catch(() => {});
    }
  }
  console.log('✅ Loyalty program + accounts');

  // ── Website Content ───────────────────────────────────────────────────────────
  await prisma.websiteContent.upsert({
    where: { tenantId: demo.id },
    update: {},
    create: {
      tenantId: demo.id,
      heroTitle: 'Where Ocean Meets Luxury',
      heroSubtitle: "Experience the finest hospitality on the shores of Cox's Bazar",
      aboutTitle: 'About Coral Bay Resort',
      aboutText: "Perched on the world's longest natural sandy beach, Coral Bay Resort is a sanctuary of elegance and warmth. Our 10 exquisitely designed rooms and villas blend contemporary comfort with local Bengali hospitality. From infinity pool sunsets to private beach mornings — every moment here is extraordinary.",
      seoTitle: "Coral Bay Resort | Cox's Bazar Luxury Beach Hotel",
      seoDescription: "Book your dream beach vacation at Coral Bay Resort. Luxury villas, suites and rooms with stunning sea views on Cox's Bazar beach.",
      primaryColor: '#1a6b5e',
      accentColor: '#d4a853',
      galleryImages: [],
      testimonials: [
        { name: 'James Miller', rating: 5, text: 'Absolutely stunning resort. The staff went above and beyond. The beachfront villa was worth every penny!', date: '2026-04-15' },
        { name: 'Priya Sharma', rating: 5, text: 'Perfect honeymoon destination. The spa, the food, the views — everything was magical.', date: '2026-03-20' },
        { name: 'Michael Chen', rating: 4, text: 'Great location and beautiful rooms. The Hilsa curry at dinner was the best I have ever had.', date: '2026-05-01' },
      ],
    },
  });
  console.log('✅ Website content + testimonials');

  // ── Marketing Campaign (SMS Marketing demo) ───────────────────────────────────
  const existingCampaign = await prisma.marketingCampaign.findFirst({ where: { tenantId: demo.id } });
  if (!existingCampaign) {
    const camp1 = await prisma.marketingCampaign.create({
      data: {
        tenantId:       demo.id,
        name:           'Eid Special Offer 2026',
        channel:        'sms',
        status:         'sent',
        audienceType:   'all',
        recipientCount: 142,
        message:        'Coral Bay Resort: Eid Mubarak! বিশেষ Eid অফার — 2 রাত বুক করলে 20% ছাড়। বুক করুন: coralbay.com/eid',
        sentAt:         d(-7),
        deliveredCount: 138,
        failedCount:    4,
      },
    });
    const camp2 = await prisma.marketingCampaign.create({
      data: {
        tenantId:       demo.id,
        name:           'Summer Package Launch',
        channel:        'whatsapp',
        status:         'scheduled',
        audienceType:   'past',
        recipientCount: 89,
        message:        'Coral Bay Resort: গ্রীষ্মের বিশেষ প্যাকেজ এসে গেছে! পরিবার নিয়ে আসুন — 3 রাত + Water Sports + Breakfast মাত্র ৳12,000। Book: coralbay.com/summer',
        scheduledAt:    d(5),
        deliveredCount: 0,
        failedCount:    0,
      },
    });
    await prisma.marketingCampaign.create({
      data: {
        tenantId:       demo.id,
        name:           'Monsoon Weekend Deal',
        channel:        'both',
        status:         'draft',
        audienceType:   'vip',
        recipientCount: 0,
        message:        'Coral Bay Resort: বর্ষায় রিসোর্টের এক আলাদা সৌন্দর্য! VIP গেস্টদের জন্য বিশেষ ছাড়।',
        deliveredCount: 0,
        failedCount:    0,
      },
    });

    // Add sample logs for sent campaign
    for (let i = 0; i < Math.min(5, createdGuests.length); i++) {
      await prisma.campaignLog.create({
        data: {
          campaignId: camp1.id,
          guestId:    createdGuests[i].id,
          guestName:  `${createdGuests[i].firstName} ${createdGuests[i].lastName}`,
          phone:      createdGuests[i].phone ?? '+8801700000000',
          channel:    'sms',
          status:     i < 4 ? 'delivered' : 'failed',
          sentAt:     i < 4 ? d(-7) : null,
        },
      }).catch(() => {});
    }
  }
  console.log('✅ Marketing campaigns (sent, scheduled, draft)');

  // ── Message Templates ─────────────────────────────────────────────────────────
  const templates = [
    { name: 'Booking Confirmation',   channel: 'both', message: '{resort_name}: প্রিয় {guest_name}, আপনার বুকিং নিশ্চিত হয়েছে। Check-in এর সময় 2:00 PM। ধন্যবাদ।' },
    { name: 'Eid Offer Template',     channel: 'sms',  message: '{resort_name}: Eid Mubarak! বিশেষ Eid অফার — 2 রাত বুক করলে 20% ছাড়। সীমিত আসন।' },
    { name: 'Check-in Reminder',      channel: 'both', message: '{resort_name}: প্রিয় {guest_name}, আপনার check-in আগামীকাল। আমরা আপনার জন্য প্রস্তুত!' },
    { name: 'Feedback Request',       channel: 'sms',  message: '{resort_name}: প্রিয় {guest_name}, আমাদের সেবা কেমন লাগলো? আপনার মতামত আমাদের অনুপ্রেরণা।' },
  ];
  for (const t of templates) {
    await prisma.messageTemplate.create({ data: { tenantId: demo.id, ...t as any } }).catch(() => {});
  }
  console.log('✅ Message templates');

  // ── Group Bookings ────────────────────────────────────────────────────────────
  const existingGB = await prisma.groupBooking.findFirst({ where: { tenantId: demo.id } });
  if (!existingGB) {
    await prisma.groupBooking.create({
      data: {
        tenantId:      demo.id,
        name:          'Dhaka Corporate Retreat — TechCorp BD',
        contactName:   'Tanvir Islam',
        contactEmail:  'tanvir@example.com',
        contactPhone:  '+8801311111116',
        checkIn:       d(15),
        checkOut:      d(18),
        status:        'CONFIRMED' as any,
        notes:         'Corporate team-building event. Meeting room required on Day 1 and Day 2.',
      },
    }).catch(() => {});
  }
  console.log('✅ Group booking');

  // ── Notifications ─────────────────────────────────────────────────────────────
  const notifData = [
    { title: 'New Booking',         message: 'Ahmed Rahman booked Ocean Deluxe for 3 nights.',          type: 'BOOKING',     isRead: false },
    { title: 'Payment Received',    message: 'Payment of ৳30,000 received from James Miller.',          type: 'PAYMENT',     isRead: false },
    { title: 'Check-in Alert',      message: 'Rina Begum is due to check in to Room 101 today.',        type: 'CHECKIN',     isRead: true  },
    { title: 'Support Ticket',      message: 'Guest in Villa V2 reported AC not cooling properly.',     type: 'MAINTENANCE', isRead: false },
    { title: 'Low Inventory Alert', message: 'Mineral Water (500ml) stock is below minimum level.',     type: 'SYSTEM',      isRead: false },
    { title: 'New Review',          message: 'Michael Chen left a 5-star review on Booking.com.',       type: 'REVIEW',      isRead: true  },
  ];
  for (const n of notifData) {
    await prisma.notification.create({
      data: { tenantId: demo.id, userId: demoOwner.id, ...n as any, createdAt: d(-Math.floor(Math.random() * 3)) },
    }).catch(() => {});
  }
  console.log('✅ Notifications');

  console.log('\n🎉 Demo tenant fully seeded!');
  console.log('   Tenant:  Coral Bay Resort (slug: demo)');
  console.log('   Rooms:   10 (mix of available/occupied/cleaning)');
  console.log('   Guests:  10 with profiles, tags, scores');
  console.log('   Bookings: 18 (active, upcoming, past, cancelled)');
  console.log('   Revenue: Payments + Invoices populated');
  console.log('   Ops:     HK tasks, Maintenance, Support tickets');
  console.log('   Food:    Orders + Menu items');
  console.log('   Marketing: 3 campaigns + templates');
  console.log('   CRM:     Tags, Scores, Loyalty program');
  console.log('   Website: Content + Testimonials');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
