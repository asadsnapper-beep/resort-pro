-- CreateEnum
CREATE TYPE "LostFoundStatus" AS ENUM ('UNCLAIMED', 'CLAIMED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "LaundryStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'READY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "LaundryServiceType" AS ENUM ('WASH', 'DRY_CLEAN', 'IRON', 'WASH_AND_IRON');

-- CreateTable
CREATE TABLE "lost_found_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "foundDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "foundBy" TEXT,
    "storageLocation" TEXT,
    "status" "LostFoundStatus" NOT NULL DEFAULT 'UNCLAIMED',
    "claimedBy" TEXT,
    "claimedContact" TEXT,
    "claimedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lost_found_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "minibar_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "minibar_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "minibar_consumptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bookingId" TEXT,
    "minibarItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "minibar_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laundry_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bookingId" TEXT,
    "itemCount" INTEGER NOT NULL,
    "description" TEXT,
    "serviceType" "LaundryServiceType" NOT NULL DEFAULT 'WASH',
    "status" "LaundryStatus" NOT NULL DEFAULT 'REQUESTED',
    "cost" DOUBLE PRECISION,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "readyAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laundry_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lost_found_items_tenantId_idx" ON "lost_found_items"("tenantId");

-- CreateIndex
CREATE INDEX "minibar_items_tenantId_idx" ON "minibar_items"("tenantId");

-- CreateIndex
CREATE INDEX "minibar_consumptions_tenantId_idx" ON "minibar_consumptions"("tenantId");

-- CreateIndex
CREATE INDEX "minibar_consumptions_roomId_idx" ON "minibar_consumptions"("roomId");

-- CreateIndex
CREATE INDEX "laundry_orders_tenantId_idx" ON "laundry_orders"("tenantId");

-- CreateIndex
CREATE INDEX "laundry_orders_roomId_idx" ON "laundry_orders"("roomId");

-- AddForeignKey
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minibar_items" ADD CONSTRAINT "minibar_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minibar_consumptions" ADD CONSTRAINT "minibar_consumptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minibar_consumptions" ADD CONSTRAINT "minibar_consumptions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minibar_consumptions" ADD CONSTRAINT "minibar_consumptions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "minibar_consumptions" ADD CONSTRAINT "minibar_consumptions_minibarItemId_fkey" FOREIGN KEY ("minibarItemId") REFERENCES "minibar_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_orders" ADD CONSTRAINT "laundry_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_orders" ADD CONSTRAINT "laundry_orders_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laundry_orders" ADD CONSTRAINT "laundry_orders_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

