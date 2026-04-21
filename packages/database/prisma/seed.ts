import { PrismaClient, UserRole, RoomType, RoomStatus, StaffDepartment } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Tenant ────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'palm-paradise-resort' },
    update: {},
    create: {
      name: 'Palm Paradise Resort',
      slug: 'palm-paradise-resort',
      plan: 'STARTER',
      phone: '+1-555-0100',
      email: 'info@palmparadise.com',
      currency: 'USD',
      timezone: 'America/New_York',
      checkInTime: '14:00',
      checkOutTime: '11:00',
    },
  });
  console.log(`✅ Tenant: ${tenant.name}`);

  // ── Owner User ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'owner@palmparadise.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'owner@palmparadise.com',
      passwordHash,
      firstName: 'Alex',
      lastName: 'Johnson',
      role: UserRole.OWNER,
    },
  });

  const manager = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'manager@palmparadise.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'manager@palmparadise.com',
      passwordHash,
      firstName: 'Maria',
      lastName: 'Garcia',
      role: UserRole.MANAGER,
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'staff@palmparadise.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'staff@palmparadise.com',
      passwordHash,
      firstName: 'Sam',
      lastName: 'Wilson',
      role: UserRole.STAFF,
    },
  });
  console.log(`✅ Users: owner, manager, staff created`);

  // ── Staff Records ─────────────────────────────────────────────────────────
  await prisma.staff.upsert({
    where: { userId: manager.id },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: manager.id,
      department: StaffDepartment.MANAGEMENT,
      position: 'General Manager',
      hireDate: new Date('2023-01-15'),
    },
  });

  await prisma.staff.upsert({
    where: { userId: staffUser.id },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: staffUser.id,
      department: StaffDepartment.FRONT_DESK,
      position: 'Front Desk Agent',
      hireDate: new Date('2023-06-01'),
    },
  });

  // ── Rooms ─────────────────────────────────────────────────────────────────
  const rooms = [
    { number: '101', name: 'Garden View Standard', type: RoomType.STANDARD, floor: 1, maxOccupancy: 2, basePrice: 120 },
    { number: '102', name: 'Garden View Standard', type: RoomType.STANDARD, floor: 1, maxOccupancy: 2, basePrice: 120 },
    { number: '201', name: 'Ocean View Deluxe', type: RoomType.DELUXE, floor: 2, maxOccupancy: 3, basePrice: 200 },
    { number: '202', name: 'Ocean View Deluxe', type: RoomType.DELUXE, floor: 2, maxOccupancy: 3, basePrice: 200 },
    { number: '301', name: 'Sunset Suite', type: RoomType.SUITE, floor: 3, maxOccupancy: 4, basePrice: 380 },
    { number: 'V1', name: 'Beachfront Villa', type: RoomType.VILLA, floor: 0, maxOccupancy: 6, basePrice: 650 },
    { number: 'V2', name: 'Garden Villa', type: RoomType.VILLA, floor: 0, maxOccupancy: 6, basePrice: 580 },
    { number: 'C1', name: 'Tropical Bungalow', type: RoomType.BUNGALOW, floor: 0, maxOccupancy: 2, basePrice: 280 },
  ];

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { tenantId_number: { tenantId: tenant.id, number: room.number } },
      update: {},
      create: {
        tenantId: tenant.id,
        ...room,
        basePrice: room.basePrice,
        status: RoomStatus.AVAILABLE,
        amenities: ['WiFi', 'AC', 'TV', 'Mini Bar'],
        images: [],
      },
    });
  }
  console.log(`✅ ${rooms.length} Rooms created`);

  // ── Amenities ─────────────────────────────────────────────────────────────
  const amenities = [
    { name: 'Infinity Pool', category: 'POOL' as const, icon: '🏊' },
    { name: 'Spa & Wellness', category: 'SPA' as const, icon: '💆' },
    { name: 'Fitness Center', category: 'GYM' as const, icon: '🏋️' },
    { name: 'Private Beach', category: 'BEACH' as const, icon: '🏖️' },
    { name: 'Water Sports', category: 'SPORTS' as const, icon: '🏄' },
    { name: 'Restaurant & Bar', category: 'ENTERTAINMENT' as const, icon: '🍽️' },
    { name: 'Airport Shuttle', category: 'TRANSPORT' as const, icon: '🚌' },
  ];

  for (const amenity of amenities) {
    await prisma.amenity.create({
      data: { tenantId: tenant.id, ...amenity },
    }).catch(() => {});
  }
  console.log(`✅ Amenities created`);

  // ── Menu Items ─────────────────────────────────────────────────────────────
  const menuItems = [
    { name: 'Continental Breakfast', category: 'BREAKFAST' as const, price: 18 },
    { name: 'Full English Breakfast', category: 'BREAKFAST' as const, price: 24 },
    { name: 'Caesar Salad', category: 'LUNCH' as const, price: 16 },
    { name: 'Grilled Snapper', category: 'DINNER' as const, price: 36 },
    { name: 'Lobster Thermidor', category: 'DINNER' as const, price: 58 },
    { name: 'Coconut Prawn Skewers', category: 'APPETIZER' as const, price: 22 },
    { name: 'Mango Cheesecake', category: 'DESSERT' as const, price: 12 },
    { name: 'Fresh Coconut Water', category: 'BEVERAGE' as const, price: 8 },
    { name: 'Tropical Smoothie', category: 'BEVERAGE' as const, price: 10 },
    { name: "Chef's Special", category: 'SPECIAL' as const, price: 45 },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.create({
      data: { tenantId: tenant.id, ...item, isAvailable: true },
    }).catch(() => {});
  }
  console.log(`✅ Menu items created`);

  // ── Website Content ────────────────────────────────────────────────────────
  await prisma.websiteContent.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      heroTitle: 'Your Paradise Awaits',
      heroSubtitle: 'Experience luxury and tranquility at Palm Paradise Resort',
      aboutTitle: 'About Palm Paradise',
      aboutText:
        'Nestled along a pristine stretch of beach, Palm Paradise Resort offers an unparalleled retreat. Our boutique property combines natural beauty with world-class amenities to create memories that last a lifetime.',
      seoTitle: 'Palm Paradise Resort | Luxury Beach Retreat',
      seoDescription:
        'Book your dream vacation at Palm Paradise Resort. Beachfront villas, suites, and deluxe rooms with stunning ocean views.',
      primaryColor: '#1a6b5e',
      accentColor: '#d4a853',
      galleryImages: [],
      testimonials: [],
    },
  });
  console.log(`✅ Website content created`);

  // ── Inventory ──────────────────────────────────────────────────────────────
  const inventory = [
    { name: 'Bath Towels', category: 'LINEN' as const, unit: 'pcs', currentStock: 200, minimumStock: 50, unitCost: 8 },
    { name: 'Bed Sheets (King)', category: 'LINEN' as const, unit: 'sets', currentStock: 80, minimumStock: 20, unitCost: 35 },
    { name: 'Shampoo (100ml)', category: 'TOILETRIES' as const, unit: 'bottles', currentStock: 500, minimumStock: 100, unitCost: 1.5 },
    { name: 'All-Purpose Cleaner', category: 'CLEANING' as const, unit: 'liters', currentStock: 40, minimumStock: 10, unitCost: 4 },
    { name: 'Coffee Beans', category: 'FOOD_BEVERAGE' as const, unit: 'kg', currentStock: 15, minimumStock: 5, unitCost: 20 },
  ];

  for (const item of inventory) {
    await prisma.inventoryItem.create({
      data: { tenantId: tenant.id, ...item },
    }).catch(() => {});
  }
  console.log(`✅ Inventory items created`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Login credentials:');
  console.log('  Owner:   owner@palmparadise.com / Password123!');
  console.log('  Manager: manager@palmparadise.com / Password123!');
  console.log('  Staff:   staff@palmparadise.com / Password123!');
  console.log(`\n🏨 Resort slug: ${tenant.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
