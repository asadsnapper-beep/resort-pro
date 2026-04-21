// ─── Auth ────────────────────────────────────────────────────────────────────
export type UserRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'GUEST';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
  firstName: string;
  lastName: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
  iat: number;
  exp: number;
}

// ─── Tenant ──────────────────────────────────────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  createdAt: string;
}

export type TenantPlan = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

// ─── Room ────────────────────────────────────────────────────────────────────
export type RoomType = 'STANDARD' | 'DELUXE' | 'SUITE' | 'VILLA' | 'COTTAGE' | 'BUNGALOW';
export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';

export interface Room {
  id: string;
  tenantId: string;
  number: string;
  name: string;
  type: RoomType;
  status: RoomStatus;
  floor: number | null;
  maxOccupancy: number;
  basePrice: number;
  description: string | null;
  amenities: string[];
  images: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Booking ─────────────────────────────────────────────────────────────────
export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'REFUNDED' | 'FAILED';

export interface Booking {
  id: string;
  tenantId: string;
  roomId: string;
  guestId: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  adults: number;
  children: number;
  totalAmount: number;
  paidAmount: number;
  specialRequests: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Guest ───────────────────────────────────────────────────────────────────
export interface Guest {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  nationality: string | null;
  idType: string | null;
  idNumber: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
}

// ─── Staff ───────────────────────────────────────────────────────────────────
export type StaffDepartment =
  | 'FRONT_DESK'
  | 'HOUSEKEEPING'
  | 'RESTAURANT'
  | 'MAINTENANCE'
  | 'SECURITY'
  | 'MANAGEMENT';

export interface Staff {
  id: string;
  tenantId: string;
  userId: string;
  firstName: string;
  lastName: string;
  department: StaffDepartment;
  position: string;
  phone: string | null;
  hireDate: string;
  isActive: boolean;
}

// ─── Housekeeping ─────────────────────────────────────────────────────────────
export type HousekeepingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
export type HousekeepingType = 'DAILY' | 'DEEP_CLEAN' | 'TURNDOWN' | 'CHECKOUT' | 'CHECKIN';

export interface HousekeepingTask {
  id: string;
  tenantId: string;
  roomId: string;
  assignedToId: string | null;
  type: HousekeepingType;
  status: HousekeepingStatus;
  scheduledDate: string;
  completedAt: string | null;
  notes: string | null;
}

// ─── Restaurant / F&B ────────────────────────────────────────────────────────
export type MenuItemCategory =
  | 'BREAKFAST'
  | 'LUNCH'
  | 'DINNER'
  | 'APPETIZER'
  | 'DESSERT'
  | 'BEVERAGE'
  | 'SPECIAL';

export interface MenuItem {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: MenuItemCategory;
  price: number;
  isAvailable: boolean;
  image: string | null;
}

export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface FoodOrder {
  id: string;
  tenantId: string;
  bookingId: string | null;
  guestId: string | null;
  tableNumber: string | null;
  status: OrderStatus;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export type InventoryCategory =
  | 'LINEN'
  | 'TOILETRIES'
  | 'CLEANING'
  | 'FOOD_BEVERAGE'
  | 'MAINTENANCE'
  | 'OFFICE'
  | 'OTHER';

export interface InventoryItem {
  id: string;
  tenantId: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  currentStock: number;
  minimumStock: number;
  unitCost: number;
}

// ─── Support Tickets ─────────────────────────────────────────────────────────
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory =
  | 'MAINTENANCE'
  | 'HOUSEKEEPING'
  | 'FOOD_BEVERAGE'
  | 'BILLING'
  | 'COMPLAINT'
  | 'REQUEST'
  | 'OTHER';

export interface SupportTicket {
  id: string;
  tenantId: string;
  guestId: string | null;
  assignedToId: string | null;
  bookingId: string | null;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

// ─── Chat ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: 'GUEST' | 'STAFF';
  message: string;
  createdAt: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export interface DashboardStats {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  activeBookings: number;
  openTickets: number;
  monthlyRevenue: number;
  revenueGrowth: number;
}
