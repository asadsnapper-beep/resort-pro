-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'BIKE', 'SCOOTY', 'BICYCLE', 'VAN', 'OTHER');

-- CreateEnum
CREATE TYPE "VehicleAvailability" AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('RESERVED', 'OUT', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL DEFAULT 'CAR',
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "capacity" INTEGER,
    "hourlyRate" DOUBLE PRECISION,
    "dailyRate" DOUBLE PRECISION,
    "depositAmount" DOUBLE PRECISION,
    "availability" "VehicleAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_rentals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "guestId" TEXT,
    "bookingId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "actualReturnAt" TIMESTAMP(3),
    "status" "RentalStatus" NOT NULL DEFAULT 'RESERVED',
    "rate" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION,
    "depositCollected" DOUBLE PRECISION,
    "depositReturned" DOUBLE PRECISION,
    "odometerOut" INTEGER,
    "odometerIn" INTEGER,
    "fuelOut" TEXT,
    "fuelIn" TEXT,
    "conditionNotesOut" TEXT,
    "conditionNotesIn" TEXT,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_rentals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicles_tenantId_idx" ON "vehicles"("tenantId");

-- CreateIndex
CREATE INDEX "vehicle_rentals_tenantId_idx" ON "vehicle_rentals"("tenantId");

-- CreateIndex
CREATE INDEX "vehicle_rentals_vehicleId_idx" ON "vehicle_rentals"("vehicleId");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rentals" ADD CONSTRAINT "vehicle_rentals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rentals" ADD CONSTRAINT "vehicle_rentals_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rentals" ADD CONSTRAINT "vehicle_rentals_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rentals" ADD CONSTRAINT "vehicle_rentals_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

