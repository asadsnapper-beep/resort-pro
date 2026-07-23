-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('FURNITURE', 'ELECTRONICS', 'APPLIANCE', 'KITCHEN_EQUIPMENT', 'VEHICLE', 'IT_EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('IN_USE', 'IN_REPAIR', 'IN_STORAGE', 'RETIRED');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL DEFAULT 'OTHER',
    "status" "AssetStatus" NOT NULL DEFAULT 'IN_USE',
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "locationRoomId" TEXT,
    "locationLabel" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DOUBLE PRECISION,
    "warrantyExpiresAt" TIMESTAMP(3),
    "vendorId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_maintenance_logs" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "performedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_assetTag_key" ON "assets"("assetTag");

-- CreateIndex
CREATE INDEX "assets_tenantId_idx" ON "assets"("tenantId");

-- CreateIndex
CREATE INDEX "assets_locationRoomId_idx" ON "assets"("locationRoomId");

-- CreateIndex
CREATE INDEX "assets_vendorId_idx" ON "assets"("vendorId");

-- CreateIndex
CREATE INDEX "asset_maintenance_logs_assetId_idx" ON "asset_maintenance_logs"("assetId");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_locationRoomId_fkey" FOREIGN KEY ("locationRoomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance_logs" ADD CONSTRAINT "asset_maintenance_logs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

