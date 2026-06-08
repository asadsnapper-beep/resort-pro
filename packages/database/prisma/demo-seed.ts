/**
 * ResortPro — Full Demo Seed
 * Run: cd packages/database && npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/demo-seed.ts
 *
 * Creates: guests, bookings (past/current/future), food orders,
 * housekeeping, maintenance, loyalty, rate plans, expenses, support tickets
 */

import {
  PrismaClient,
  UserRole,
  RoomType,
  RoomStatus,
  StaffDepartment,
  BookingStatus,
  PaymentStatus,
  HousekeepingStatus,
  HousekeepingType,
  OrderStatus,
  ExpenseCategory,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceIssueType,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  RatePlanType,
  LoyaltyTier,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
}
function dateOnly(d: Date): Date {
  return new Date(d.toISOString().split('T')[0]);
}
let confCounter = 1;
const RUN_ID = Math.floor(Math.random() * 900 + 100); // 100-999
function confNo(slug: string) {
  return `${slug.toUpperCase().slice(0, 3)}-${new Date().getFullYear()}-${RUN_ID}${String(confCounter++).padStart(3, '0')}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 ResortPro Demo Seed starting...\n');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // ════════════════════════════════════════════════════════════════
  // 1. TENANT
  // ════════════════════════════════════════════════════════════════
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'palm-paradise-resort' },
    update: {
      plan: 'PROFESSIONAL',
      planStatus: 'ACTIVE',
    },
    create: {
      name: 'Palm Paradise Resort',
      slug: 'palm-paradise-resort',
      plan: 'PROFESSIONAL',
      planStatus: 'ACTIVE',
      phone: '+880-1711-000001',
      email: 'info@palmparadise.com',
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      checkInTime: '14:00',
      checkOutTime: '11:00',
      taxRate: 0.15,
      brandPrimaryColor: '#1a6b5e',
    },
  });
  const tid = tenant.id;
  console.log(`✅ Tenant: ${tenant.name} (${tid})`);

  // ════════════════════════════════════════════════════════════════
  // 2. USERS + STAFF
  // ════════════════════════════════════════════════════════════════
  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tid, email: 'owner@palmparadise.com' } },
    update: {},
    create: { tenantId: tid, email: 'owner@palmparadise.com', passwordHash, firstName: 'Karim', lastName: 'Hossain', role: UserRole.OWNER },
  });
  const manager = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tid, email: 'manager@palmparadise.com' } },
    update: {},
    create: { tenantId: tid, email: 'manager@palmparadise.com', passwordHash, firstName: 'Sumaiya', lastName: 'Islam', role: UserRole.MANAGER },
  });
  const staffUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tid, email: 'staff@palmparadise.com' } },
    update: {},
    create: { tenantId: tid, email: 'staff@palmparadise.com', passwordHash, firstName: 'Rahim', lastName: 'Chowdhury', role: UserRole.STAFF },
  });

  await prisma.staff.upsert({ where: { userId: manager.id }, update: {}, create: { tenantId: tid, userId: manager.id, department: StaffDepartment.MANAGEMENT, position: 'General Manager', hireDate: new Date('2022-01-15') } });
  const frontDeskStaff = await prisma.staff.upsert({ where: { userId: staffUser.id }, update: {}, create: { tenantId: tid, userId: staffUser.id, department: StaffDepartment.FRONT_DESK, position: 'Front Desk Agent', hireDate: new Date('2023-06-01') } });

  // Extra staff users for housekeeping/restaurant
  const hkUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tid, email: 'housekeeping@palmparadise.com' } },
    update: {},
    create: { tenantId: tid, email: 'housekeeping@palmparadise.com', passwordHash, firstName: 'Nipa', lastName: 'Begum', role: UserRole.STAFF },
  });
  const hkStaff = await prisma.staff.upsert({ where: { userId: hkUser.id }, update: {}, create: { tenantId: tid, userId: hkUser.id, department: StaffDepartment.HOUSEKEEPING, position: 'Housekeeping Supervisor', hireDate: new Date('2022-08-10') } });

  // ── Role-based demo users ──────────────────────────────────────────────────
  const receptionist = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tid, email: 'receptionist@palmparadise.com' } },
    update: {},
    create: { tenantId: tid, email: 'receptionist@palmparadise.com', passwordHash, firstName: 'Taslima', lastName: 'Khatun', role: UserRole.RECEPTIONIST },
  });
  await prisma.staff.upsert({ where: { userId: receptionist.id }, update: {}, create: { tenantId: tid, userId: receptionist.id, department: StaffDepartment.FRONT_DESK, position: 'Receptionist', hireDate: new Date('2024-03-01') } });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tid, email: 'partner@palmparadise.com' } },
    update: {},
    create: { tenantId: tid, email: 'partner@palmparadise.com', passwordHash, firstName: 'Arif', lastName: 'Mahmud', role: UserRole.PARTNER },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tid, email: 'marketer@palmparadise.com' } },
    update: {},
    create: { tenantId: tid, email: 'marketer@palmparadise.com', passwordHash, firstName: 'Priya', lastName: 'Sen', role: UserRole.MARKETER },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tid, email: 'developer@palmparadise.com' } },
    update: {},
    create: { tenantId: tid, email: 'developer@palmparadise.com', passwordHash, firstName: 'Rafiq', lastName: 'Ahmed', role: UserRole.DEVELOPER },
  });

  console.log('✅ Users & Staff created (owner / manager / receptionist / partner / marketer / developer / staff)');

  // ════════════════════════════════════════════════════════════════
  // 3. ROOMS
  // ════════════════════════════════════════════════════════════════
  const roomDefs = [
    { number: '101', name: 'Garden View Standard', type: RoomType.STANDARD, floor: 1, maxOccupancy: 2, basePrice: 3500, status: RoomStatus.AVAILABLE },
    { number: '102', name: 'Garden View Standard', type: RoomType.STANDARD, floor: 1, maxOccupancy: 2, basePrice: 3500, status: RoomStatus.AVAILABLE },
    { number: '103', name: 'Standard Twin',        type: RoomType.STANDARD, floor: 1, maxOccupancy: 2, basePrice: 3800, status: RoomStatus.AVAILABLE },
    { number: '201', name: 'Sea View Deluxe',      type: RoomType.DELUXE,   floor: 2, maxOccupancy: 3, basePrice: 6500, status: RoomStatus.OCCUPIED },
    { number: '202', name: 'Sea View Deluxe',      type: RoomType.DELUXE,   floor: 2, maxOccupancy: 3, basePrice: 6500, status: RoomStatus.AVAILABLE },
    { number: '203', name: 'Hillside Deluxe',      type: RoomType.DELUXE,   floor: 2, maxOccupancy: 2, basePrice: 5800, status: RoomStatus.AVAILABLE },
    { number: '301', name: 'Sunset Suite',         type: RoomType.SUITE,    floor: 3, maxOccupancy: 4, basePrice: 12000, status: RoomStatus.OCCUPIED },
    { number: '302', name: 'Honeymoon Suite',      type: RoomType.SUITE,    floor: 3, maxOccupancy: 2, basePrice: 15000, status: RoomStatus.AVAILABLE },
    { number: 'V1',  name: 'Beachfront Villa',     type: RoomType.VILLA,    floor: 0, maxOccupancy: 6, basePrice: 28000, status: RoomStatus.OCCUPIED },
    { number: 'V2',  name: 'Garden Villa',         type: RoomType.VILLA,    floor: 0, maxOccupancy: 4, basePrice: 22000, status: RoomStatus.AVAILABLE },
    { number: 'B1',  name: 'Tropical Bungalow',    type: RoomType.BUNGALOW, floor: 0, maxOccupancy: 2, basePrice: 9500, status: RoomStatus.AVAILABLE },
    { number: 'B2',  name: 'Rainforest Bungalow',  type: RoomType.BUNGALOW, floor: 0, maxOccupancy: 3, basePrice: 9800, status: RoomStatus.MAINTENANCE },
  ];

  const roomMap: Record<string, string> = {};
  for (const r of roomDefs) {
    const room = await prisma.room.upsert({
      where: { tenantId_number: { tenantId: tid, number: r.number } },
      update: { status: r.status },
      create: { tenantId: tid, ...r, amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'Hot Water'], images: [] },
    });
    roomMap[r.number] = room.id;
  }
  console.log(`✅ ${roomDefs.length} Rooms created`);

  // ════════════════════════════════════════════════════════════════
  // 4. RATE PLANS
  // ════════════════════════════════════════════════════════════════
  const ratePlans = [
    { name: 'Weekend Rate',       type: RatePlanType.WEEKEND,    price: 4500, startDate: null, endDate: null,                            daysOfWeek: [5, 6], minNights: 1, isActive: true, roomId: null },
    { name: 'Peak Season Rate',   type: RatePlanType.SEASONAL,   price: 5200, startDate: new Date('2025-12-20'), endDate: new Date('2026-01-05'), daysOfWeek: [], minNights: 2, isActive: true, roomId: null },
    { name: 'Summer Promo',       type: RatePlanType.PROMO,      price: 2800, startDate: new Date('2026-05-01'), endDate: new Date('2026-06-30'), daysOfWeek: [], minNights: 3, isActive: true, roomId: null },
    { name: 'Early Bird Special', type: RatePlanType.EARLY_BIRD, price: 3000, startDate: null, endDate: null,                            daysOfWeek: [], minNights: 5, isActive: true, roomId: null },
  ];
  for (const rp of ratePlans) {
    await prisma.ratePlan.create({ data: { tenantId: tid, ...rp } }).catch(() => {});
  }
  console.log('✅ Rate plans created');

  // ════════════════════════════════════════════════════════════════
  // 5. MENU ITEMS
  // ════════════════════════════════════════════════════════════════
  const menuDefs = [
    { name: 'ভাত ডাল', category: 'BREAKFAST' as const, price: 150 },
    { name: 'ডিম পরোটা', category: 'BREAKFAST' as const, price: 120 },
    { name: 'পাউরুটি ডিম', category: 'BREAKFAST' as const, price: 100 },
    { name: 'ফ্রেশ জুস', category: 'BEVERAGE' as const, price: 80 },
    { name: 'চা / কফি', category: 'BEVERAGE' as const, price: 60 },
    { name: 'কোক / সেভেন আপ', category: 'BEVERAGE' as const, price: 70 },
    { name: 'ভেজিটেবল নুডলস', category: 'LUNCH' as const, price: 180 },
    { name: 'চিকেন ফ্রাইড রাইস', category: 'LUNCH' as const, price: 220 },
    { name: 'চিকেন বিরিয়ানি', category: 'DINNER' as const, price: 350 },
    { name: 'মাটন রোস্ট', category: 'DINNER' as const, price: 480 },
    { name: 'ইলিশ ভাপা', category: 'DINNER' as const, price: 550 },
    { name: 'চিংড়ি মালাইকারি', category: 'DINNER' as const, price: 520 },
    { name: 'শিক কাবাব', category: 'APPETIZER' as const, price: 280 },
    { name: 'চিকেন উইংস', category: 'APPETIZER' as const, price: 240 },
    { name: 'মিষ্টি প্লেট', category: 'DESSERT' as const, price: 130 },
    { name: 'আইসক্রিম', category: 'DESSERT' as const, price: 120 },
    { name: 'শেফ স্পেশাল', category: 'SPECIAL' as const, price: 650 },
  ];
  const menuMap: Record<string, string> = {};
  for (const m of menuDefs) {
    const item = await prisma.menuItem.create({
      data: { tenantId: tid, ...m, isAvailable: true },
    }).catch(async () => {
      return prisma.menuItem.findFirst({ where: { tenantId: tid, name: m.name } });
    });
    if (item) menuMap[m.name] = item.id;
  }
  console.log(`✅ ${menuDefs.length} Menu items created`);

  // ════════════════════════════════════════════════════════════════
  // 6. GUESTS
  // ════════════════════════════════════════════════════════════════
  const guestDefs = [
    { firstName: 'Ahmed',   lastName: 'Rahman',    email: 'ahmed.rahman@gmail.com',    phone: '+8801711111001', nationality: 'Bangladeshi', notes: 'Prefers high floor, vegetarian meals' },
    { firstName: 'Fatima',  lastName: 'Begum',     email: 'fatima.begum@yahoo.com',    phone: '+8801811111002', nationality: 'Bangladeshi', notes: 'Anniversary couple — arrange flowers' },
    { firstName: 'Tanvir',  lastName: 'Ahmed',     email: 'tanvir.ahmed@hotmail.com',  phone: '+8801911111003', nationality: 'Bangladeshi', notes: '' },
    { firstName: 'Nasreen', lastName: 'Khatun',    email: 'nasreen.k@gmail.com',       phone: '+8801611111004', nationality: 'Bangladeshi', notes: 'Requires extra pillow' },
    { firstName: 'Rafiq',   lastName: 'Islam',     email: 'rafiq.islam@gmail.com',     phone: '+8801511111005', nationality: 'Bangladeshi', notes: '' },
    { firstName: 'Priya',   lastName: 'Sharma',    email: 'priya.sharma@gmail.com',    phone: '+919811111006', nationality: 'Indian',       notes: 'Jain food required' },
    { firstName: 'David',   lastName: 'Chen',      email: 'david.chen@outlook.com',    phone: '+8562011111007', nationality: 'Malaysian',    notes: 'Halal food preference' },
    { firstName: 'Sarah',   lastName: 'Johnson',   email: 'sarah.j@gmail.com',         phone: '+447911111008', nationality: 'British',      notes: 'Gluten intolerant' },
    { firstName: 'Omar',    lastName: 'Abdullah',  email: 'omar.abdl@gmail.com',       phone: '+971501111009', nationality: 'Emirati',      notes: 'VIP guest, suite preferred' },
    { firstName: 'Mia',     lastName: 'Tanaka',    email: 'mia.tanaka@gmail.com',      phone: '+8190111110010', nationality: 'Japanese',     notes: '' },
    { firstName: 'Kabir',   lastName: 'Hossain',   email: 'kabir.h@yahoo.com',         phone: '+8801711111011', nationality: 'Bangladeshi', notes: 'Corporate client — Apex Group' },
    { firstName: 'Ritu',    lastName: 'Das',       email: 'ritu.das@gmail.com',        phone: '+8801911111012', nationality: 'Bangladeshi', notes: '' },
    { firstName: 'James',   lastName: 'Wilson',    email: 'james.w@gmail.com',         phone: '+12121111013',  nationality: 'American',     notes: 'Frequent traveler' },
    { firstName: 'Ayesha',  lastName: 'Siddiqui',  email: 'ayesha.s@gmail.com',        phone: '+923001111014', nationality: 'Pakistani',    notes: '' },
    { firstName: 'Sumon',   lastName: 'Biswas',    email: 'sumon.b@gmail.com',         phone: '+8801811111015', nationality: 'Bangladeshi', notes: 'Group leader — family reunion' },
    { firstName: 'Nila',    lastName: 'Chowdhury', email: 'nila.c@gmail.com',          phone: '+8801611111016', nationality: 'Bangladeshi', notes: '' },
    { firstName: 'Rashed',  lastName: 'Mahmud',    email: 'rashed.m@gmail.com',        phone: '+8801511111017', nationality: 'Bangladeshi', notes: 'Honeymoon trip' },
    { firstName: 'Tasneem', lastName: 'Akter',     email: 'tasneem.a@gmail.com',       phone: '+8801711111018', nationality: 'Bangladeshi', notes: '' },
  ];

  const guestIds: string[] = [];
  for (const g of guestDefs) {
    const guest = await prisma.guest.upsert({
      where: { tenantId_email: { tenantId: tid, email: g.email } },
      update: {},
      create: { tenantId: tid, ...g },
    });
    guestIds.push(guest.id);
  }
  console.log(`✅ ${guestIds.length} Guests created`);

  // ════════════════════════════════════════════════════════════════
  // 7. BOOKINGS
  // ════════════════════════════════════════════════════════════════
  type BookingDef = {
    roomNumber: string; guestIdx: number;
    checkIn: Date; checkOut: Date;
    status: BookingStatus; paymentStatus: PaymentStatus;
    adults: number; children: number;
    totalAmount: number; paidAmount: number;
    source?: string; specialRequests?: string;
    actualCheckIn?: Date; actualCheckOut?: Date;
    notes?: string;
  };

  const bookingDefs: BookingDef[] = [
    // ── Checked-out (past) ─────────────────────────────────────────────────
    { roomNumber: '101', guestIdx: 0,  checkIn: daysAgo(60), checkOut: daysAgo(57), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 10500, paidAmount: 10500, actualCheckIn: daysAgo(60), actualCheckOut: daysAgo(57), source: 'ONLINE' },
    { roomNumber: '201', guestIdx: 1,  checkIn: daysAgo(55), checkOut: daysAgo(52), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 19500, paidAmount: 19500, actualCheckIn: daysAgo(55), actualCheckOut: daysAgo(52), source: 'ONLINE', specialRequests: 'Anniversary arrangement' },
    { roomNumber: '301', guestIdx: 8,  checkIn: daysAgo(50), checkOut: daysAgo(46), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 2, totalAmount: 48000, paidAmount: 48000, actualCheckIn: daysAgo(50), actualCheckOut: daysAgo(46), source: 'DIRECT' },
    { roomNumber: 'V1',  guestIdx: 14, checkIn: daysAgo(45), checkOut: daysAgo(40), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 4, children: 3, totalAmount: 140000, paidAmount: 140000, actualCheckIn: daysAgo(45), actualCheckOut: daysAgo(40), source: 'ONLINE', specialRequests: 'Family reunion — need extra chairs and table' },
    { roomNumber: '102', guestIdx: 5,  checkIn: daysAgo(40), checkOut: daysAgo(37), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 10500, paidAmount: 10500, actualCheckIn: daysAgo(40), actualCheckOut: daysAgo(37), source: 'ONLINE' },
    { roomNumber: '202', guestIdx: 6,  checkIn: daysAgo(38), checkOut: daysAgo(34), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 26000, paidAmount: 26000, actualCheckIn: daysAgo(38), actualCheckOut: daysAgo(34), source: 'DIRECT' },
    { roomNumber: 'B1',  guestIdx: 2,  checkIn: daysAgo(35), checkOut: daysAgo(32), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 28500, paidAmount: 28500, actualCheckIn: daysAgo(35), actualCheckOut: daysAgo(32) },
    { roomNumber: '302', guestIdx: 16, checkIn: daysAgo(30), checkOut: daysAgo(27), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 45000, paidAmount: 45000, actualCheckIn: daysAgo(30), actualCheckOut: daysAgo(27), source: 'ONLINE', specialRequests: 'Honeymoon couple — rose petals and cake please' },
    { roomNumber: '101', guestIdx: 10, checkIn: daysAgo(28), checkOut: daysAgo(25), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 1, children: 0, totalAmount: 10500, paidAmount: 10500, actualCheckIn: daysAgo(28), actualCheckOut: daysAgo(25), source: 'DIRECT' },
    { roomNumber: '203', guestIdx: 3,  checkIn: daysAgo(25), checkOut: daysAgo(22), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 1, totalAmount: 17400, paidAmount: 17400, actualCheckIn: daysAgo(25), actualCheckOut: daysAgo(22) },
    { roomNumber: '201', guestIdx: 12, checkIn: daysAgo(22), checkOut: daysAgo(18), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 26000, paidAmount: 26000, actualCheckIn: daysAgo(22), actualCheckOut: daysAgo(18), source: 'ONLINE' },
    { roomNumber: 'V2',  guestIdx: 4,  checkIn: daysAgo(20), checkOut: daysAgo(16), status: 'CHECKED_OUT', paymentStatus: 'PARTIAL', adults: 4, children: 2, totalAmount: 88000, paidAmount: 70000, actualCheckIn: daysAgo(20), actualCheckOut: daysAgo(16), notes: 'Balance ৳18,000 to be collected' },
    { roomNumber: '102', guestIdx: 11, checkIn: daysAgo(18), checkOut: daysAgo(15), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 10500, paidAmount: 10500, actualCheckIn: daysAgo(18), actualCheckOut: daysAgo(15) },
    { roomNumber: '301', guestIdx: 13, checkIn: daysAgo(15), checkOut: daysAgo(11), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 2, totalAmount: 48000, paidAmount: 48000, actualCheckIn: daysAgo(15), actualCheckOut: daysAgo(11), source: 'ONLINE' },
    { roomNumber: 'B1',  guestIdx: 17, checkIn: daysAgo(14), checkOut: daysAgo(12), status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 19000, paidAmount: 19000, actualCheckIn: daysAgo(14), actualCheckOut: daysAgo(12) },
    { roomNumber: '203', guestIdx: 7,  checkIn: daysAgo(12), checkOut: daysAgo(9),  status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 1, children: 0, totalAmount: 17400, paidAmount: 17400, actualCheckIn: daysAgo(12), actualCheckOut: daysAgo(9), source: 'DIRECT' },
    { roomNumber: '102', guestIdx: 9,  checkIn: daysAgo(10), checkOut: daysAgo(7),  status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 11400, paidAmount: 11400, actualCheckIn: daysAgo(10), actualCheckOut: daysAgo(7) },
    { roomNumber: '202', guestIdx: 0,  checkIn: daysAgo(8),  checkOut: daysAgo(5),  status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 19500, paidAmount: 19500, actualCheckIn: daysAgo(8),  actualCheckOut: daysAgo(5) },
    { roomNumber: '101', guestIdx: 15, checkIn: daysAgo(6),  checkOut: daysAgo(4),  status: 'CHECKED_OUT', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 7000,  paidAmount: 7000,  actualCheckIn: daysAgo(6),  actualCheckOut: daysAgo(4) },

    // ── Cancelled ─────────────────────────────────────────────────────────
    { roomNumber: '103', guestIdx: 3,  checkIn: daysAgo(30), checkOut: daysAgo(27), status: 'CANCELLED',   paymentStatus: 'REFUNDED', adults: 2, children: 0, totalAmount: 11400, paidAmount: 0, source: 'ONLINE' },
    { roomNumber: '202', guestIdx: 9,  checkIn: daysAgo(20), checkOut: daysAgo(17), status: 'CANCELLED',   paymentStatus: 'REFUNDED', adults: 1, children: 0, totalAmount: 19500, paidAmount: 0 },

    // ── Currently Checked-In ──────────────────────────────────────────────
    { roomNumber: '201', guestIdx: 1,  checkIn: daysAgo(2),  checkOut: daysFromNow(3), status: 'CHECKED_IN', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 32500, paidAmount: 32500, actualCheckIn: daysAgo(2), source: 'ONLINE', specialRequests: 'Late checkout requested' },
    { roomNumber: '301', guestIdx: 8,  checkIn: daysAgo(1),  checkOut: daysFromNow(4), status: 'CHECKED_IN', paymentStatus: 'PAID',    adults: 2, children: 1, totalAmount: 60000, paidAmount: 60000, actualCheckIn: daysAgo(1), source: 'DIRECT' },
    { roomNumber: 'V1',  guestIdx: 14, checkIn: daysAgo(3),  checkOut: daysFromNow(2), status: 'CHECKED_IN', paymentStatus: 'PARTIAL', adults: 5, children: 2, totalAmount: 140000, paidAmount: 100000, actualCheckIn: daysAgo(3), source: 'ONLINE', notes: 'Balance ৳40,000 pending' },

    // ── Upcoming Confirmed ─────────────────────────────────────────────────
    { roomNumber: '102', guestIdx: 2,  checkIn: daysFromNow(1),  checkOut: daysFromNow(4),  status: 'CONFIRMED', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 10500, paidAmount: 10500, source: 'ONLINE' },
    { roomNumber: '203', guestIdx: 5,  checkIn: daysFromNow(2),  checkOut: daysFromNow(5),  status: 'CONFIRMED', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 17400, paidAmount: 17400, source: 'ONLINE' },
    { roomNumber: '302', guestIdx: 16, checkIn: daysFromNow(3),  checkOut: daysFromNow(7),  status: 'CONFIRMED', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 60000, paidAmount: 30000, source: 'ONLINE', specialRequests: 'Honeymoon package' },
    { roomNumber: 'V2',  guestIdx: 4,  checkIn: daysFromNow(5),  checkOut: daysFromNow(10), status: 'CONFIRMED', paymentStatus: 'PARTIAL', adults: 4, children: 1, totalAmount: 110000, paidAmount: 50000, source: 'DIRECT' },
    { roomNumber: '101', guestIdx: 10, checkIn: daysFromNow(6),  checkOut: daysFromNow(9),  status: 'CONFIRMED', paymentStatus: 'PAID',    adults: 1, children: 0, totalAmount: 10500, paidAmount: 10500, source: 'DIRECT' },
    { roomNumber: 'B1',  guestIdx: 6,  checkIn: daysFromNow(7),  checkOut: daysFromNow(10), status: 'CONFIRMED', paymentStatus: 'PAID',    adults: 2, children: 0, totalAmount: 28500, paidAmount: 28500, source: 'ONLINE' },
    { roomNumber: '201', guestIdx: 12, checkIn: daysFromNow(10), checkOut: daysFromNow(15), status: 'CONFIRMED', paymentStatus: 'PARTIAL', adults: 2, children: 0, totalAmount: 32500, paidAmount: 16250, source: 'ONLINE' },
    { roomNumber: '301', guestIdx: 13, checkIn: daysFromNow(14), checkOut: daysFromNow(18), status: 'CONFIRMED', paymentStatus: 'PENDING', adults: 3, children: 1, totalAmount: 48000, paidAmount: 0, source: 'ONLINE' },
    { roomNumber: '202', guestIdx: 7,  checkIn: daysFromNow(20), checkOut: daysFromNow(23), status: 'CONFIRMED', paymentStatus: 'PAID',    adults: 1, children: 0, totalAmount: 19500, paidAmount: 19500, source: 'DIRECT' },

    // ── Pending (not yet confirmed) ────────────────────────────────────────
    { roomNumber: '103', guestIdx: 3,  checkIn: daysFromNow(4),  checkOut: daysFromNow(7),  status: 'PENDING', paymentStatus: 'PENDING', adults: 2, children: 1, totalAmount: 11400, paidAmount: 0, source: 'ONLINE' },
    { roomNumber: '203', guestIdx: 17, checkIn: daysFromNow(8),  checkOut: daysFromNow(11), status: 'PENDING', paymentStatus: 'PENDING', adults: 2, children: 0, totalAmount: 17400, paidAmount: 0 },
  ];

  const bookingIds: string[] = [];
  const guestBookingMap: Record<number, string[]> = {};

  for (const b of bookingDefs) {
    const roomId = roomMap[b.roomNumber];
    const guestId = guestIds[b.guestIdx];
    if (!roomId || !guestId) continue;

    const booking = await prisma.booking.create({
      data: {
        tenantId: tid,
        roomId,
        guestId,
        checkIn: dateOnly(b.checkIn),
        checkOut: dateOnly(b.checkOut),
        status: b.status,
        paymentStatus: b.paymentStatus,
        adults: b.adults,
        children: b.children,
        totalAmount: b.totalAmount,
        paidAmount: b.paidAmount,
        source: b.source ?? 'DIRECT',
        confirmationNo: confNo('PPR'),
        specialRequests: b.specialRequests,
        notes: b.notes,
        actualCheckIn: b.actualCheckIn,
        actualCheckOut: b.actualCheckOut,
      },
    });
    bookingIds.push(booking.id);
    if (!guestBookingMap[b.guestIdx]) guestBookingMap[b.guestIdx] = [];
    guestBookingMap[b.guestIdx].push(booking.id);
  }
  console.log(`✅ ${bookingIds.length} Bookings created`);

  // ════════════════════════════════════════════════════════════════
  // 8. FOOD ORDERS (linked to checked-in / checked-out bookings)
  // ════════════════════════════════════════════════════════════════
  const menuItemIds = Object.values(menuMap);
  const orderDefs = [
    { bookingIdx: 0, guestIdx: 0, items: [['চিকেন বিরিয়ানি', 2], ['কোক / সেভেন আপ', 2]], status: 'DELIVERED' as OrderStatus },
    { bookingIdx: 1, guestIdx: 1, items: [['মিষ্টি প্লেট', 1], ['ফ্রেশ জুস', 2]], status: 'DELIVERED' as OrderStatus },
    { bookingIdx: 2, guestIdx: 8, items: [['শেফ স্পেশাল', 2], ['মাটন রোস্ট', 1]], status: 'DELIVERED' as OrderStatus },
    { bookingIdx: 5, guestIdx: 6, items: [['ভাত ডাল', 2], ['চা / কফি', 2]], status: 'DELIVERED' as OrderStatus },
    { bookingIdx: 7, guestIdx: 16, items: [['ইলিশ ভাপা', 2], ['ফ্রেশ জুস', 2], ['আইসক্রিম', 2]], status: 'DELIVERED' as OrderStatus },
    // Currently checked-in orders
    { bookingIdx: 21, guestIdx: 1,  items: [['চিংড়ি মালাইকারি', 2], ['চা / কফি', 2]], status: 'PREPARING' as OrderStatus },
    { bookingIdx: 22, guestIdx: 8,  items: [['শেফ স্পেশাল', 2], ['কোক / সেভেন আপ', 3]], status: 'PENDING' as OrderStatus },
    { bookingIdx: 23, guestIdx: 14, items: [['চিকেন বিরিয়ানি', 4], ['মাটন রোস্ট', 2], ['ফ্রেশ জুস', 4]], status: 'READY' as OrderStatus },
  ];

  const menuIdByName: Record<string, string> = {};
  const allMenuItems = await prisma.menuItem.findMany({ where: { tenantId: tid } });
  for (const m of allMenuItems) menuIdByName[m.name] = m.id;

  for (const od of orderDefs) {
    const bookingId = bookingIds[od.bookingIdx];
    const guestId = guestIds[od.guestIdx];
    if (!bookingId || !guestId) continue;

    const orderItems = od.items.map(([name, qty]) => {
      const item = allMenuItems.find(m => m.name === name);
      if (!item) return null;
      return { menuItemId: item.id, quantity: qty as number, unitPrice: item.price, totalPrice: Number(item.price) * (qty as number), notes: null };
    }).filter(Boolean) as any[];

    if (orderItems.length === 0) continue;

    const total = orderItems.reduce((s: number, i: any) => s + Number(i.totalPrice), 0);
    await prisma.foodOrder.create({
      data: {
        tenantId: tid,
        bookingId,
        guestId,
        tableNumber: bookingDefs[od.bookingIdx].roomNumber,
        status: od.status,
        totalAmount: total,
        items: { create: orderItems },
      },
    }).catch(() => {});
  }
  console.log('✅ Food orders created');

  // ════════════════════════════════════════════════════════════════
  // 9. HOUSEKEEPING TASKS
  // ════════════════════════════════════════════════════════════════
  const hkDefs = [
    { roomNumber: '101', type: HousekeepingType.DAILY,     status: HousekeepingStatus.COMPLETED, scheduledDate: daysAgo(1), notes: 'Done' },
    { roomNumber: '102', type: HousekeepingType.CHECKIN,   status: HousekeepingStatus.PENDING,   scheduledDate: new Date(),  notes: 'Prepare for arriving guest tomorrow' },
    { roomNumber: '103', type: HousekeepingType.DEEP_CLEAN, status: HousekeepingStatus.IN_PROGRESS, scheduledDate: new Date(), notes: 'Post-checkout deep clean' },
    { roomNumber: '201', type: HousekeepingType.DAILY,     status: HousekeepingStatus.COMPLETED, scheduledDate: new Date(), notes: 'Guest requested extra towels' },
    { roomNumber: '202', type: HousekeepingType.DAILY,     status: HousekeepingStatus.PENDING,   scheduledDate: new Date(), notes: '' },
    { roomNumber: '203', type: HousekeepingType.TURNDOWN,  status: HousekeepingStatus.PENDING,   scheduledDate: new Date(), notes: 'Evening turndown service' },
    { roomNumber: '301', type: HousekeepingType.DAILY,     status: HousekeepingStatus.IN_PROGRESS, scheduledDate: new Date(), notes: 'Do not disturb until 2pm' },
    { roomNumber: '302', type: HousekeepingType.CHECKIN,   status: HousekeepingStatus.PENDING,   scheduledDate: daysFromNow(3), notes: 'Honeymoon setup — rose petals, champagne' },
    { roomNumber: 'V1',  type: HousekeepingType.DAILY,     status: HousekeepingStatus.COMPLETED, scheduledDate: new Date(), notes: 'Extra beach towels provided' },
    { roomNumber: 'V2',  type: HousekeepingType.CHECKIN,   status: HousekeepingStatus.PENDING,   scheduledDate: daysFromNow(5), notes: 'Prepare for family group' },
    { roomNumber: 'B1',  type: HousekeepingType.CHECKOUT,  status: HousekeepingStatus.COMPLETED, scheduledDate: daysAgo(1), notes: 'Checkout clean done' },
    { roomNumber: 'B2',  type: HousekeepingType.DEEP_CLEAN, status: HousekeepingStatus.PENDING,  scheduledDate: daysFromNow(1), notes: 'After maintenance complete' },
  ];

  for (const hk of hkDefs) {
    const roomId = roomMap[hk.roomNumber];
    if (!roomId) continue;
    await prisma.housekeepingTask.create({
      data: {
        tenantId: tid,
        roomId,
        type: hk.type,
        status: hk.status,
        scheduledDate: dateOnly(hk.scheduledDate),
        assignedToId: hkStaff.id,
        notes: hk.notes,
        completedAt: hk.status === 'COMPLETED' ? hk.scheduledDate : null,
      },
    }).catch(() => {});
  }
  console.log(`✅ ${hkDefs.length} Housekeeping tasks created`);

  // ════════════════════════════════════════════════════════════════
  // 10. MAINTENANCE TICKETS
  // ════════════════════════════════════════════════════════════════
  const maintDefs = [
    { roomNumber: 'B2',  issueType: MaintenanceIssueType.PLUMBING,   priority: MaintenancePriority.URGENT, status: MaintenanceStatus.IN_PROGRESS, description: 'Bathroom pipe leaking badly — room out of service', assignedTo: 'Jahangir (Plumber)' },
    { roomNumber: '103', issueType: MaintenanceIssueType.AC,          priority: MaintenancePriority.HIGH,   status: MaintenanceStatus.OPEN,        description: 'AC not cooling properly, guest complained twice' },
    { roomNumber: '201', issueType: MaintenanceIssueType.TV,          priority: MaintenancePriority.NORMAL, status: MaintenanceStatus.RESOLVED,    description: 'TV remote not working — replaced batteries', assignedTo: 'Kamal (Tech)', resolvedAt: daysAgo(2) },
    { roomNumber: '302', issueType: MaintenanceIssueType.WIFI,        priority: MaintenancePriority.HIGH,   status: MaintenanceStatus.RESOLVED,    description: 'WiFi signal weak in room — extender installed', resolvedAt: daysAgo(5) },
    { roomNumber: 'V1',  issueType: MaintenanceIssueType.DOOR,        priority: MaintenancePriority.NORMAL, status: MaintenanceStatus.OPEN,        description: 'Balcony door handle loose', assignedTo: 'Sabbir (Carpenter)' },
    { roomNumber: '101', issueType: MaintenanceIssueType.ELECTRICAL,  priority: MaintenancePriority.URGENT, status: MaintenanceStatus.RESOLVED,    description: 'Power socket not working near bed', resolvedAt: daysAgo(3) },
    { roomNumber: '203', issueType: MaintenanceIssueType.FURNITURE,   priority: MaintenancePriority.LOW,    status: MaintenanceStatus.OPEN,        description: 'Wardrobe door hinge broken' },
  ];

  for (const m of maintDefs) {
    const roomId = roomMap[m.roomNumber];
    if (!roomId) continue;
    await prisma.maintenanceTicket.create({
      data: {
        tenantId: tid,
        roomId,
        issueType: m.issueType,
        priority: m.priority,
        status: m.status,
        description: m.description,
        assignedTo: m.assignedTo ?? null,
        resolvedAt: (m as any).resolvedAt ?? null,
        createdBy: manager.id,
      },
    }).catch(() => {});
  }
  console.log(`✅ ${maintDefs.length} Maintenance tickets created`);

  // ════════════════════════════════════════════════════════════════
  // 11. EXPENSES
  // ════════════════════════════════════════════════════════════════
  const expenseDefs = [
    { category: ExpenseCategory.SALARIES,      amount: 180000, description: 'Staff salaries — May 2026',           date: daysAgo(1) },
    { category: ExpenseCategory.UTILITIES,     amount: 42000,  description: 'Electricity bill — April 2026',       date: daysAgo(5) },
    { category: ExpenseCategory.UTILITIES,     amount: 8500,   description: 'Water bill — April 2026',             date: daysAgo(5) },
    { category: ExpenseCategory.FOOD_BEVERAGE, amount: 95000,  description: 'Restaurant supplies — monthly',       date: daysAgo(3) },
    { category: ExpenseCategory.CLEANING,      amount: 18000,  description: 'Laundry service — monthly',           date: daysAgo(7) },
    { category: ExpenseCategory.MAINTENANCE,   amount: 32000,  description: 'Plumbing repair — B2 bathroom',       date: daysAgo(2) },
    { category: ExpenseCategory.SUPPLIES,      amount: 15000,  description: 'Toiletries & amenities restock',      date: daysAgo(10) },
    { category: ExpenseCategory.MARKETING,     amount: 25000,  description: 'Facebook & Instagram ads — May',      date: daysAgo(4) },
    { category: ExpenseCategory.INSURANCE,     amount: 60000,  description: 'Property insurance — Q2 2026',        date: daysAgo(45) },
    { category: ExpenseCategory.SALARIES,      amount: 180000, description: 'Staff salaries — April 2026',         date: daysAgo(35) },
    { category: ExpenseCategory.UTILITIES,     amount: 39000,  description: 'Electricity bill — March 2026',       date: daysAgo(65) },
    { category: ExpenseCategory.FOOD_BEVERAGE, amount: 88000,  description: 'Restaurant supplies — April',         date: daysAgo(33) },
    { category: ExpenseCategory.EQUIPMENT,     amount: 55000,  description: 'New vacuum cleaners (3 units)',        date: daysAgo(20) },
    { category: ExpenseCategory.TRANSPORTATION, amount: 12000, description: 'Airport shuttle fuel & maintenance',   date: daysAgo(15) },
    { category: ExpenseCategory.OTHER,         amount: 8000,   description: 'Miscellaneous expenses — April',      date: daysAgo(30) },
  ];

  for (const e of expenseDefs) {
    await prisma.expense.create({
      data: {
        tenantId: tid,
        ...e,
        date: dateOnly(e.date),
        createdBy: manager.id,
      },
    }).catch(() => {});
  }
  console.log(`✅ ${expenseDefs.length} Expenses created`);

  // ════════════════════════════════════════════════════════════════
  // 12. SUPPORT TICKETS
  // ════════════════════════════════════════════════════════════════
  const ticketDefs = [
    { guestIdx: 1,  category: TicketCategory.REQUEST,     priority: TicketPriority.MEDIUM, status: TicketStatus.OPEN,        title: 'Extra pillows needed',       description: 'Can we get 2 extra pillows for room 201 please?' },
    { guestIdx: 8,  category: TicketCategory.COMPLAINT,   priority: TicketPriority.HIGH,   status: TicketStatus.IN_PROGRESS, title: 'Noise from adjacent room',   description: 'There is loud noise from the next room after 11pm. Please address this.' },
    { guestIdx: 14, category: TicketCategory.FOOD_BEVERAGE, priority: TicketPriority.LOW,  status: TicketStatus.RESOLVED,    title: 'Room service delay',         description: 'Our food order took over 45 minutes. Please improve.' },
    { guestIdx: 2,  category: TicketCategory.REQUEST,     priority: TicketPriority.LOW,    status: TicketStatus.OPEN,        title: 'Late checkout request',      description: 'Can we have a 2pm checkout instead of 11am?' },
    { guestIdx: 7,  category: TicketCategory.BILLING,     priority: TicketPriority.HIGH,   status: TicketStatus.RESOLVED,    title: 'Incorrect charge on bill',   description: 'I was charged for a minibar item I did not use.' },
  ];

  for (const t of ticketDefs) {
    const guestId = guestIds[t.guestIdx];
    await prisma.supportTicket.create({
      data: {
        tenantId: tid,
        guestId,
        category: t.category,
        priority: t.priority,
        status: t.status,
        title: t.title,
        description: t.description,
      },
    }).catch(() => {});
  }
  console.log(`✅ ${ticketDefs.length} Support tickets created`);

  // ════════════════════════════════════════════════════════════════
  // 13. LOYALTY PROGRAM + ACCOUNTS
  // ════════════════════════════════════════════════════════════════
  const loyaltyProg = await prisma.loyaltyProgram.upsert({
    where: { tenantId: tid },
    update: { isEnabled: true },
    create: {
      tenantId: tid,
      isEnabled: true,
      pointsPerDollar: 10,
      redemptionRate: 100,
      bronzeThreshold: 0,
      silverThreshold: 500,
      goldThreshold: 2000,
      platinumThreshold: 5000,
      programName: 'Palm Paradise Rewards',
    },
  });

  // Enroll frequent guests with points
  const loyaltyDefs = [
    { guestIdx: 0,  points: 3200, lifetimePoints: 5400, tier: 'PLATINUM' as LoyaltyTier },
    { guestIdx: 1,  points: 1800, lifetimePoints: 2800, tier: 'GOLD' as LoyaltyTier },
    { guestIdx: 8,  points: 4500, lifetimePoints: 6100, tier: 'PLATINUM' as LoyaltyTier },
    { guestIdx: 14, points: 2200, lifetimePoints: 3500, tier: 'GOLD' as LoyaltyTier },
    { guestIdx: 2,  points: 850,  lifetimePoints: 1100, tier: 'SILVER' as LoyaltyTier },
    { guestIdx: 10, points: 620,  lifetimePoints: 800,  tier: 'SILVER' as LoyaltyTier },
    { guestIdx: 12, points: 1200, lifetimePoints: 2100, tier: 'GOLD' as LoyaltyTier },
    { guestIdx: 6,  points: 320,  lifetimePoints: 450,  tier: 'BRONZE' as LoyaltyTier },
    { guestIdx: 4,  points: 280,  lifetimePoints: 280,  tier: 'BRONZE' as LoyaltyTier },
    { guestIdx: 16, points: 750,  lifetimePoints: 750,  tier: 'SILVER' as LoyaltyTier },
  ];

  for (const ld of loyaltyDefs) {
    const guestId = guestIds[ld.guestIdx];
    const account = await prisma.loyaltyAccount.upsert({
      where: { guestId },
      update: { points: ld.points, lifetimePoints: ld.lifetimePoints, tier: ld.tier },
      create: {
        tenantId: tid,
        guestId,
        points: ld.points,
        lifetimePoints: ld.lifetimePoints,
        tier: ld.tier,
      },
    });

    // Add some transaction history
    await prisma.loyaltyTransaction.createMany({
      data: [
        { tenantId: tid, accountId: account.id, type: 'EARN', points: Math.floor(ld.lifetimePoints * 0.6), description: 'Points from past stays' },
        { tenantId: tid, accountId: account.id, type: 'EARN', points: Math.floor(ld.lifetimePoints * 0.4), description: 'Recent stay bonus' },
        ...(ld.lifetimePoints > ld.points ? [{
          tenantId: tid,
          accountId: account.id,
          type: 'REDEEM' as const,
          points: -(ld.lifetimePoints - ld.points),
          description: 'Redeemed for room discount',
        }] : []),
      ],
      skipDuplicates: true,
    }).catch(() => {});
  }
  console.log(`✅ ${loyaltyDefs.length} Loyalty accounts created`);

  // ════════════════════════════════════════════════════════════════
  // 14. WEBSITE CONTENT
  // ════════════════════════════════════════════════════════════════
  await prisma.websiteContent.upsert({
    where: { tenantId: tid },
    update: {},
    create: {
      tenantId: tid,
      heroTitle: 'কক্সবাজারের সেরা রিসোর্ট অভিজ্ঞতা',
      heroSubtitle: 'পাম প্যারাডাইস রিসোর্টে স্বাগতম — যেখানে বিলাসিতা ও প্রকৃতি একসাথে মেলে',
      aboutTitle: 'আমাদের সম্পর্কে',
      aboutText: 'কক্সবাজারের সোনালি সৈকতের কোলে অবস্থিত পাম প্যারাডাইস রিসোর্ট। আমাদের বুটিক প্রপার্টি প্রকৃতির সৌন্দর্য ও বিশ্বমানের সুযোগ-সুবিধার নিখুঁত সমন্বয়।',
      seoTitle: 'Palm Paradise Resort | কক্সবাজার লাক্সারি রিসোর্ট',
      seoDescription: 'কক্সবাজারের সেরা বিলাসবহুল রিসোর্ট। সমুদ্র সৈকতের পাশে ভিলা, সুইট এবং ডিলাক্স রুম।',
      primaryColor: '#1a6b5e',
      accentColor: '#d4a853',
      galleryImages: [],
      testimonials: [
        { name: 'করিম হোসেন', text: 'অসাধারণ অভিজ্ঞতা! সার্ভিস, খাবার সব কিছুই অপূর্ব।', rating: 5 },
        { name: 'Sarah Johnson', text: 'Absolutely stunning resort. The sea view from our suite was breathtaking!', rating: 5 },
        { name: 'Omar Abdullah', text: 'Best resort experience in Bangladesh. Will definitely return.', rating: 5 },
      ],
    },
  });
  console.log('✅ Website content created');

  // ════════════════════════════════════════════════════════════════
  // 15. INVENTORY
  // ════════════════════════════════════════════════════════════════
  const invDefs = [
    { name: 'বাথ টাওয়েল (লার্জ)',   category: 'LINEN' as const,       unit: 'pcs', currentStock: 180, minimumStock: 40, unitCost: 350 },
    { name: 'বেড শিট (কিং)',         category: 'LINEN' as const,       unit: 'sets', currentStock: 60, minimumStock: 15, unitCost: 1200 },
    { name: 'বেড শিট (টুইন)',        category: 'LINEN' as const,       unit: 'sets', currentStock: 45, minimumStock: 15, unitCost: 900 },
    { name: 'শ্যাম্পু (100ml)',      category: 'TOILETRIES' as const,  unit: 'bottles', currentStock: 420, minimumStock: 80, unitCost: 120 },
    { name: 'সাবান বার',             category: 'TOILETRIES' as const,  unit: 'pcs', currentStock: 600, minimumStock: 100, unitCost: 45 },
    { name: 'ক্লিনিং লিকুইড',       category: 'CLEANING' as const,    unit: 'liters', currentStock: 35, minimumStock: 8, unitCost: 280 },
    { name: 'ফ্লোর মপ',             category: 'CLEANING' as const,    unit: 'pcs', currentStock: 12, minimumStock: 3, unitCost: 450 },
    { name: 'চাল (বাসমতি)',         category: 'FOOD_BEVERAGE' as const, unit: 'kg', currentStock: 200, minimumStock: 50, unitCost: 180 },
    { name: 'মুরগি (ফ্রেশ)',         category: 'FOOD_BEVERAGE' as const, unit: 'kg', currentStock: 80, minimumStock: 20, unitCost: 350 },
    { name: 'কোল্ড ড্রিংক (কার্টন)', category: 'FOOD_BEVERAGE' as const, unit: 'ctn', currentStock: 25, minimumStock: 5, unitCost: 1800 },
    { name: 'এলপিজি গ্যাস',          category: 'MAINTENANCE' as const, unit: 'cylinder', currentStock: 8, minimumStock: 2, unitCost: 1400 },
    { name: 'এ/সি ফিল্টার',         category: 'MAINTENANCE' as const, unit: 'pcs', currentStock: 20, minimumStock: 5, unitCost: 650 },
    { name: 'প্রিন্টার পেপার',       category: 'OFFICE' as const,      unit: 'ream', currentStock: 15, minimumStock: 3, unitCost: 480 },
  ];
  for (const inv of invDefs) {
    await prisma.inventoryItem.create({ data: { tenantId: tid, ...inv } }).catch(() => {});
  }
  console.log(`✅ ${invDefs.length} Inventory items created`);

  // ════════════════════════════════════════════════════════════════
  // 16. CRM — TEMPLATES, CAMPAIGNS, SEQUENCES
  // ════════════════════════════════════════════════════════════════

  // ── Email Templates ──────────────────────────────────────────────
  const templateDefs = [
    {
      name: 'Booking Confirmation',
      subject: 'Your booking at Palm Paradise is confirmed! 🌴',
      preheader: 'We can\'t wait to welcome you.',
      isDefault: true,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:#1a6b5e;padding:32px 24px;text-align:center">
    <h1 style="color:#d4a853;font-size:24px;margin:0">Palm Paradise Resort</h1>
    <p style="color:#a7f3d0;margin:8px 0 0">Your stay is confirmed</p>
  </div>
  <div style="padding:32px 24px;background:#fff">
    <p>Dear {{guest_name}},</p>
    <p>Great news — your reservation at <strong>Palm Paradise Resort</strong> is confirmed!</p>
    <div style="background:#f0faf8;border-left:4px solid #1a6b5e;padding:16px;margin:24px 0;border-radius:4px">
      <p style="margin:4px 0"><strong>Booking Reference:</strong> {{confirmation_no}}</p>
      <p style="margin:4px 0"><strong>Room:</strong> {{room_name}}</p>
      <p style="margin:4px 0"><strong>Check-in:</strong> {{checkin_date}} at 2:00 PM</p>
      <p style="margin:4px 0"><strong>Check-out:</strong> {{checkout_date}} at 11:00 AM</p>
      <p style="margin:4px 0"><strong>Guests:</strong> {{adults}} adults</p>
    </div>
    <p>If you have any questions before your arrival, please don't hesitate to contact us.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="{{resort_url}}" style="background:#1a6b5e;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600">View Booking Details</a>
    </div>
    <p style="color:#6b7280;font-size:14px">Warm regards,<br><strong>Palm Paradise Resort Team</strong><br>📞 +880-1711-000001 | 📧 info@palmparadise.com</p>
  </div>
</div>`,
    },
    {
      name: 'Pre-Arrival Welcome',
      subject: 'Getting ready for your stay, {{guest_name}}! ✨',
      preheader: 'Your paradise awaits — here\'s everything you need to know.',
      isDefault: false,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:#1a6b5e;padding:32px 24px;text-align:center">
    <h1 style="color:#d4a853;font-size:24px;margin:0">We're Getting Ready For You!</h1>
    <p style="color:#a7f3d0;margin:8px 0 0">Your check-in is just {{days_until_arrival}} days away</p>
  </div>
  <div style="padding:32px 24px;background:#fff">
    <p>Dear {{guest_name}},</p>
    <p>We are so excited to welcome you to Palm Paradise Resort in just <strong>{{days_until_arrival}} days</strong>! Here's a quick reminder of your booking details and some things to help you prepare.</p>
    <h3 style="color:#1a6b5e">🏨 Your Booking</h3>
    <p>Check-in: <strong>{{checkin_date}}</strong> from 2:00 PM<br>Check-out: <strong>{{checkout_date}}</strong> by 11:00 AM</p>
    <h3 style="color:#1a6b5e">🌊 What to Expect</h3>
    <ul>
      <li>Complimentary airport pickup (please let us know your flight details)</li>
      <li>Welcome drink on arrival</li>
      <li>Free WiFi throughout the property</li>
      <li>Daily breakfast included in your package</li>
    </ul>
    <h3 style="color:#1a6b5e">🍽️ Dining</h3>
    <p>Our restaurant is open daily from 7:00 AM to 10:30 PM. We recommend making a dinner reservation for weekend evenings — reply to this email and we'll arrange it for you.</p>
    <p style="color:#6b7280;font-size:14px">See you soon!<br><strong>Palm Paradise Resort Team</strong></p>
  </div>
</div>`,
    },
    {
      name: 'Post-Stay Thank You',
      subject: 'Thank you for staying with us, {{guest_name}} 🙏',
      preheader: 'We hope to see you again soon.',
      isDefault: false,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:#1a6b5e;padding:32px 24px;text-align:center">
    <h1 style="color:#d4a853;font-size:24px;margin:0">Thank You!</h1>
    <p style="color:#a7f3d0;margin:8px 0 0">We hope you had a wonderful stay</p>
  </div>
  <div style="padding:32px 24px;background:#fff">
    <p>Dear {{guest_name}},</p>
    <p>It was our absolute pleasure hosting you at Palm Paradise Resort. We hope every moment of your stay was exactly what you needed.</p>
    <div style="background:#fffbeb;border-left:4px solid #d4a853;padding:16px;margin:24px 0;border-radius:4px">
      <p style="margin:0;font-weight:600;color:#92400e">🌟 You've earned {{points_earned}} loyalty points!</p>
      <p style="margin:8px 0 0;color:#78350f;font-size:14px">Your total balance is now <strong>{{total_points}} points</strong>. Redeem them on your next stay.</p>
    </div>
    <h3 style="color:#1a6b5e">📝 Share Your Experience</h3>
    <p>Your feedback means the world to us. Would you take 2 minutes to leave us a review?</p>
    <div style="text-align:center;margin:24px 0">
      <a href="{{review_url}}" style="background:#d4a853;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600">Leave a Review</a>
    </div>
    <h3 style="color:#1a6b5e">🎁 Special Return Offer</h3>
    <p>As a valued guest, enjoy <strong>15% off</strong> your next stay when you book within 30 days. Use code: <code style="background:#f3f4f6;padding:2px 8px;border-radius:4px">RETURN15</code></p>
    <p style="color:#6b7280;font-size:14px">With warm regards,<br><strong>Palm Paradise Resort Team</strong></p>
  </div>
</div>`,
    },
    {
      name: 'Win-Back Campaign',
      subject: 'We miss you, {{guest_name}}! Here\'s a special offer 🌴',
      preheader: 'It\'s been a while — come back with an exclusive discount.',
      isDefault: false,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:linear-gradient(135deg,#1a6b5e,#2d9e8f);padding:40px 24px;text-align:center">
    <h1 style="color:#d4a853;font-size:28px;margin:0">We Miss You! 🌊</h1>
    <p style="color:#fff;margin:12px 0 0;font-size:16px">It's been a while since your last visit to Paradise</p>
  </div>
  <div style="padding:32px 24px;background:#fff">
    <p>Dear {{guest_name}},</p>
    <p>It's been over 3 months since your last stay with us at Palm Paradise Resort — we genuinely miss having you here!</p>
    <p>As a token of our appreciation for being a valued guest, we'd love to welcome you back with an exclusive offer:</p>
    <div style="background:#f0faf8;border:2px solid #1a6b5e;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
      <p style="font-size:14px;color:#6b7280;margin:0">Your exclusive offer</p>
      <p style="font-size:40px;font-weight:700;color:#1a6b5e;margin:8px 0">20% OFF</p>
      <p style="font-size:14px;color:#374151;margin:0">on any room for any 2+ night stay</p>
      <p style="background:#1a6b5e;color:#fff;display:inline-block;padding:8px 20px;border-radius:6px;font-weight:600;margin-top:12px;font-size:16px;letter-spacing:2px">COMEBACK20</p>
    </div>
    <p style="color:#6b7280;font-size:13px;text-align:center">Valid for bookings made within the next 14 days. Offer applies to direct bookings only.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="{{booking_url}}" style="background:#1a6b5e;color:#fff;padding:16px 36px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px">Book My Return →</a>
    </div>
    <p style="color:#6b7280;font-size:14px">Can't wait to see you again,<br><strong>Palm Paradise Resort Team</strong></p>
  </div>
</div>`,
    },
    {
      name: 'Eid Special Promotion',
      subject: 'Eid Mubarak! 🌙 Celebrate at Palm Paradise with 25% off',
      preheader: 'Special Eid package — limited rooms available.',
      isDefault: false,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:linear-gradient(135deg,#d4a853,#f59e0b);padding:40px 24px;text-align:center">
    <h1 style="color:#fff;font-size:28px;margin:0">عيد مبارك 🌙</h1>
    <h2 style="color:#fff;font-size:20px;margin:8px 0 0;font-weight:400">Celebrate Eid at Palm Paradise Resort</h2>
  </div>
  <div style="padding:32px 24px;background:#fff">
    <p>Dear {{guest_name}},</p>
    <p>Eid Mubarak from all of us at Palm Paradise Resort! 🌙 This special holiday, we invite you to celebrate with family in the luxury and comfort of our resort.</p>
    <div style="background:#fffbeb;border:2px solid #d4a853;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
      <p style="font-size:20px;font-weight:700;color:#92400e;margin:0">Eid Special Package</p>
      <p style="font-size:36px;font-weight:700;color:#d4a853;margin:8px 0">25% OFF</p>
      <ul style="text-align:left;color:#374151;font-size:14px;margin:12px 0">
        <li>2 nights in Deluxe or Suite room</li>
        <li>Eid special dinner for the family</li>
        <li>Traditional Eid breakfast</li>
        <li>Complimentary sweets on arrival</li>
        <li>Free decorations for the room</li>
      </ul>
      <p style="margin:4px 0;font-size:13px;color:#6b7280">Use code: <strong>EID25</strong> | Valid for Eid week stays only</p>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="{{booking_url}}" style="background:#d4a853;color:#fff;padding:16px 36px;text-decoration:none;border-radius:8px;font-weight:600">Book Your Eid Package</a>
    </div>
    <p style="color:#6b7280;font-size:14px">With warm Eid greetings,<br><strong>Palm Paradise Resort Team</strong></p>
  </div>
</div>`,
    },
    {
      name: 'Birthday Greeting',
      subject: '🎂 Happy Birthday {{guest_name}}! A special gift from us',
      preheader: 'Your birthday deserves a paradise celebration.',
      isDefault: false,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:40px 24px;text-align:center">
    <h1 style="color:#fff;font-size:32px;margin:0">🎂 Happy Birthday!</h1>
    <p style="color:#fce7f3;margin:12px 0 0">Wishing you a day as wonderful as you are</p>
  </div>
  <div style="padding:32px 24px;background:#fff;text-align:center">
    <p style="font-size:18px">Dear <strong>{{guest_name}}</strong>,</p>
    <p>The entire team at Palm Paradise Resort wishes you a very Happy Birthday! 🎉 As a valued member of our Palm Paradise family, we'd love to make your birthday extra special.</p>
    <div style="background:#fdf4ff;border:2px solid #7c3aed;border-radius:12px;padding:24px;margin:24px 0">
      <p style="font-size:20px;font-weight:700;color:#7c3aed;margin:0">Your Birthday Gift 🎁</p>
      <p style="font-size:36px;font-weight:700;color:#ec4899;margin:8px 0">20% OFF</p>
      <p style="color:#374151">on any stay booked within the next 30 days</p>
      <p style="background:#7c3aed;color:#fff;display:inline-block;padding:8px 20px;border-radius:6px;font-weight:600;letter-spacing:2px">BDAY20</p>
    </div>
    <p>Stay with us and we'll make it unforgettable — complimentary cake, birthday decorations, and a special dinner.</p>
    <div style="margin:24px 0">
      <a href="{{booking_url}}" style="background:#7c3aed;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600">Claim Your Birthday Gift</a>
    </div>
    <p style="color:#6b7280;font-size:14px">With birthday wishes,<br><strong>Palm Paradise Resort Team</strong> 🌴</p>
  </div>
</div>`,
    },
    {
      name: 'Newsletter — Monthly Update',
      subject: 'Palm Paradise Updates — New packages & seasonal offers 🌴',
      preheader: 'See what\'s new at the resort this month.',
      isDefault: false,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:#1a6b5e;padding:24px;text-align:center">
    <h1 style="color:#d4a853;font-size:22px;margin:0">Palm Paradise Monthly Update</h1>
  </div>
  <div style="padding:32px 24px;background:#fff">
    <p>Dear {{guest_name}},</p>
    <p>Here's what's new and exciting at Palm Paradise Resort this month!</p>
    <h3 style="color:#1a6b5e">🆕 New This Month</h3>
    <ul>
      <li>New <strong>Beachfront Yoga Sessions</strong> every morning at 6:30 AM</li>
      <li>Expanded restaurant menu with 10 new dishes</li>
      <li>Pool renovation complete — deeper, bigger, and even more beautiful</li>
    </ul>
    <h3 style="color:#1a6b5e">🎉 Upcoming Events</h3>
    <ul>
      <li>Cultural Night — traditional music & dance every Friday</li>
      <li>Seafood Festival — last weekend of the month</li>
    </ul>
    <h3 style="color:#1a6b5e">💰 Best Value Packages</h3>
    <p>Book 3+ nights this month and get <strong>free airport transfer</strong> + <strong>complimentary sunset dinner</strong>. Use code <code>MONTHLY3</code>.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="{{booking_url}}" style="background:#1a6b5e;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600">Explore Packages</a>
    </div>
    <p style="color:#6b7280;font-size:12px;text-align:center">You're receiving this because you've stayed with us.<br><a href="{{unsubscribe_url}}" style="color:#6b7280">Unsubscribe</a></p>
  </div>
</div>`,
    },
  ];

  const templateMap: Record<string, string> = {};
  for (const t of templateDefs) {
    const tmpl = await prisma.emailTemplate.create({
      data: { tenantId: tid, ...t },
    }).catch(async () =>
      prisma.emailTemplate.findFirst({ where: { tenantId: tid, name: t.name } })
    );
    if (tmpl) templateMap[t.name] = tmpl.id;
  }
  console.log(`✅ ${templateDefs.length} Email templates created`);

  // ── Campaigns ────────────────────────────────────────────────────
  const campaignDefs = [
    {
      name: 'Eid-ul-Fitr 2026 Promotion',
      subject: 'Eid Mubarak! 🌙 Celebrate at Palm Paradise — 25% off',
      templateKey: 'Eid Special Promotion',
      status: 'SENT' as const,
      sentAt: daysAgo(14),
      scheduledAt: daysAgo(15),
      recipientCount: 142,
      statsData: { sent: 142, delivered: 138, opened: 87, clicked: 34, bounced: 4, unsubscribed: 2 },
    },
    {
      name: 'Win-Back — Guests Inactive 90+ Days',
      subject: 'We miss you! Come back with 20% off 🌴',
      templateKey: 'Win-Back Campaign',
      status: 'SENT' as const,
      sentAt: daysAgo(7),
      scheduledAt: daysAgo(8),
      recipientCount: 63,
      statsData: { sent: 63, delivered: 61, opened: 28, clicked: 12, bounced: 2, unsubscribed: 1 },
    },
    {
      name: 'Monthly Newsletter — May 2026',
      subject: 'Palm Paradise Updates — New packages & seasonal offers 🌴',
      templateKey: 'Newsletter — Monthly Update',
      status: 'SENT' as const,
      sentAt: daysAgo(3),
      scheduledAt: daysAgo(4),
      recipientCount: 218,
      statsData: { sent: 218, delivered: 212, opened: 104, clicked: 41, bounced: 6, unsubscribed: 3 },
    },
    {
      name: 'Summer Package Launch',
      subject: 'Summer\'s here! Our best deals for June–August ☀️',
      templateKey: 'Newsletter — Monthly Update',
      status: 'SCHEDULED' as const,
      scheduledAt: daysFromNow(3),
      sentAt: null,
      recipientCount: 195,
      statsData: null,
    },
    {
      name: 'VIP Guest Exclusive Offer',
      subject: 'For our VIP guests only — an offer you\'ll love 🏆',
      templateKey: 'Win-Back Campaign',
      status: 'DRAFT' as const,
      scheduledAt: null,
      sentAt: null,
      recipientCount: 0,
      statsData: null,
    },
    {
      name: 'Corporate Package Q3 2026',
      subject: 'Corporate stays redefined — new Q3 rates available',
      templateKey: 'Newsletter — Monthly Update',
      status: 'DRAFT' as const,
      scheduledAt: null,
      sentAt: null,
      recipientCount: 0,
      statsData: null,
    },
  ];

  const campaignIds: string[] = [];
  for (const c of campaignDefs) {
    const tmplId = c.templateKey ? templateMap[c.templateKey] : undefined;
    const tmplHtml = templateDefs.find(t => t.name === c.templateKey)?.html ?? '<p>{{body}}</p>';
    const campaign = await prisma.campaign.create({
      data: {
        tenantId: tid,
        name: c.name,
        subject: c.subject,
        html: tmplHtml,
        templateId: tmplId ?? null,
        status: c.status,
        scheduledAt: c.scheduledAt,
        sentAt: c.sentAt,
        recipientCount: c.recipientCount,
        segment: c.name.includes('VIP')
          ? { tier: 'VIP' }
          : c.name.includes('Win-Back')
          ? { inactiveDays: 90 }
          : c.name.includes('Corporate')
          ? { tags: ['Corporate'] }
          : { all: true },
      },
    }).catch(() => null);

    if (campaign) {
      campaignIds.push(campaign.id);
      if (c.statsData) {
        await prisma.campaignStats.create({
          data: { campaignId: campaign.id, ...c.statsData },
        }).catch(() => {});
      }

      // Add some EmailSend records for sent campaigns
      if (c.status === 'SENT' && c.sentAt) {
        const sampleGuests = guestIds.slice(0, Math.min(8, c.recipientCount));
        const statuses = ['DELIVERED', 'OPENED', 'CLICKED', 'DELIVERED', 'OPENED', 'BOUNCED', 'DELIVERED', 'OPENED'] as const;
        for (let i = 0; i < sampleGuests.length; i++) {
          await prisma.emailSend.create({
            data: {
              tenantId: tid,
              guestId: sampleGuests[i],
              campaignId: campaign.id,
              subject: c.subject,
              status: statuses[i % statuses.length],
              deliveredAt: c.sentAt,
              openedAt: statuses[i % statuses.length] === 'OPENED' || statuses[i % statuses.length] === 'CLICKED'
                ? new Date(c.sentAt.getTime() + 3600_000)
                : null,
            },
          }).catch(() => {});
        }
      }
    }
  }
  console.log(`✅ ${campaignDefs.length} Campaigns created`);

  // ── Sequences ─────────────────────────────────────────────────────
  const sequenceDefs = [
    {
      name: 'Booking Confirmation Flow',
      trigger: 'BOOKING_CONFIRMED' as const,
      triggerMeta: {},
      status: 'ACTIVE' as const,
      steps: [
        { stepOrder: 1, delayDays: 0,  templateKey: 'Booking Confirmation',  subject: 'Your booking at Palm Paradise is confirmed! 🌴' },
        { stepOrder: 2, delayDays: 3,  templateKey: 'Pre-Arrival Welcome',    subject: 'Getting ready for your stay — what to expect 🌊' },
      ],
    },
    {
      name: 'Pre-Arrival Sequence',
      trigger: 'PRE_ARRIVAL' as const,
      triggerMeta: { daysOffset: -3 },
      status: 'ACTIVE' as const,
      steps: [
        { stepOrder: 1, delayDays: 0, templateKey: 'Pre-Arrival Welcome',   subject: 'Your stay is just 3 days away! Here\'s what to know 🌴' },
      ],
    },
    {
      name: 'Post-Stay Follow Up',
      trigger: 'POST_STAY' as const,
      triggerMeta: { daysOffset: 1 },
      status: 'ACTIVE' as const,
      steps: [
        { stepOrder: 1, delayDays: 0,  templateKey: 'Post-Stay Thank You',   subject: 'Thank you for staying with us, {{guest_name}} 🙏' },
        { stepOrder: 2, delayDays: 7,  templateKey: 'Win-Back Campaign',     subject: 'Book your next stay and save 15% 🌴' },
        { stepOrder: 3, delayDays: 30, templateKey: 'Win-Back Campaign',     subject: 'We\'d love to welcome you back — exclusive offer inside' },
      ],
    },
    {
      name: 'Win-Back Sequence (90 Days Inactive)',
      trigger: 'WIN_BACK' as const,
      triggerMeta: { inactiveDays: 90 },
      status: 'ACTIVE' as const,
      steps: [
        { stepOrder: 1, delayDays: 0,  templateKey: 'Win-Back Campaign',     subject: 'We miss you! Come back with 20% off 🌴' },
        { stepOrder: 2, delayDays: 14, templateKey: 'Win-Back Campaign',     subject: 'Last chance — your exclusive offer expires soon ⏰' },
      ],
    },
    {
      name: 'Birthday Celebration',
      trigger: 'BIRTHDAY' as const,
      triggerMeta: { daysOffset: -7 },
      status: 'ACTIVE' as const,
      steps: [
        { stepOrder: 1, delayDays: 0, templateKey: 'Birthday Greeting', subject: '🎂 Happy Birthday {{guest_name}}! A special gift from us' },
      ],
    },
    {
      name: 'VIP Guest Nurture',
      trigger: 'MANUAL' as const,
      triggerMeta: { segment: 'VIP' },
      status: 'PAUSED' as const,
      steps: [
        { stepOrder: 1, delayDays: 0,  templateKey: 'Newsletter — Monthly Update', subject: 'Exclusive: First access to our new suite packages 🏆' },
        { stepOrder: 2, delayDays: 30, templateKey: 'Win-Back Campaign',            subject: 'Your VIP loyalty reward is waiting 🎁' },
      ],
    },
  ];

  for (const seq of sequenceDefs) {
    const sequence = await prisma.sequence.create({
      data: {
        tenantId: tid,
        name: seq.name,
        trigger: seq.trigger,
        triggerMeta: seq.triggerMeta,
        status: seq.status,
      },
    }).catch(() => null);

    if (!sequence) continue;

    for (const step of seq.steps) {
      const tmplId = templateMap[step.templateKey];
      const tmplHtml = templateDefs.find(t => t.name === step.templateKey)?.html ?? '<p>Content</p>';
      await prisma.sequenceStep.create({
        data: {
          sequenceId: sequence.id,
          templateId: tmplId ?? null,
          stepOrder: step.stepOrder,
          delayDays: step.delayDays,
          subject: step.subject,
          html: tmplHtml,
        },
      }).catch(() => {});
    }

    // Enroll some guests in active sequences
    if (seq.status === 'ACTIVE') {
      const enrollGuests = guestIds.slice(0, 5);
      for (const guestId of enrollGuests) {
        await prisma.sequenceEnrollment.create({
          data: {
            tenantId: tid,
            sequenceId: sequence.id,
            guestId,
            status: 'ACTIVE',
            currentStep: 1,
            enrolledAt: daysAgo(Math.floor(Math.random() * 14)),
          },
        }).catch(() => {});
      }
    }
  }
  console.log(`✅ ${sequenceDefs.length} Sequences created (with steps & enrollments)`);

  // ════════════════════════════════════════════════════════════════
  // 17. THEMES
  // ════════════════════════════════════════════════════════════════
  for (const theme of [
    { key: 'luxe',                  name: 'Luxe Gold',             description: 'Elegant luxury design with gold accents',                           sortOrder: 1 },
    { key: 'minimal',               name: 'Minimal Clean',         description: 'Clean modern design with focus on whitespace',                        sortOrder: 2 },
    { key: 'coastal',               name: 'Coastal Breeze',        description: 'Ocean-inspired design for beach and coastal properties',               sortOrder: 3 },
    { key: 'tea-garden-eco-resort', name: 'Tea Garden Eco Resort', description: 'Lush green theme for eco resorts nestled in tea gardens and hillsides', sortOrder: 4, isPremium: true, tags: ['Eco', 'Green', 'Nature', 'Hillside'] },
  ]) {
    await prisma.theme.upsert({ where: { key: theme.key }, update: {}, create: theme });
  }

  // ════════════════════════════════════════════════════════════════
  // DONE
  // ════════════════════════════════════════════════════════════════
  console.log('\n🎉 Demo seed সম্পূর্ণ!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 Login Credentials (all password: Password123!):');
  console.log('  Owner:        owner@palmparadise.com');
  console.log('  Manager:      manager@palmparadise.com');
  console.log('  Receptionist: receptionist@palmparadise.com');
  console.log('  Partner:      partner@palmparadise.com');
  console.log('  Marketer:     marketer@palmparadise.com');
  console.log('  Developer:    developer@palmparadise.com');
  console.log('  Staff:        staff@palmparadise.com');
  console.log('');
  console.log('🏨 Resort slug: palm-paradise-resort');
  console.log('📊 Data created:');
  console.log(`  • ${guestIds.length} Guests`);
  console.log(`  • ${bookingIds.length} Bookings (past/current/upcoming/pending)`);
  console.log(`  • ${roomDefs.length} Rooms`);
  console.log(`  • ${menuDefs.length} Menu items`);
  console.log(`  • ${expenseDefs.length} Expenses`);
  console.log(`  • ${maintDefs.length} Maintenance tickets`);
  console.log(`  • ${hkDefs.length} Housekeeping tasks`);
  console.log(`  • ${loyaltyDefs.length} Loyalty accounts`);
  console.log(`  • ${ticketDefs.length} Support tickets`);
  console.log(`  • ${templateDefs.length} Email templates`);
  console.log(`  • ${campaignDefs.length} Campaigns (3 sent, 1 scheduled, 2 draft)`);
  console.log(`  • ${sequenceDefs.length} Sequences (booking/pre-arrival/post-stay/win-back/birthday/VIP)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
