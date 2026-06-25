-- CreateTable: Property (multi-property support, Enterprise plan only)
CREATE TABLE "properties" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "slug"         TEXT NOT NULL,
    "address"      TEXT,
    "phone"        TEXT,
    "email"        TEXT,
    "timezone"     TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "checkInTime"  TEXT NOT NULL DEFAULT '14:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- AddColumn: optional propertyId on rooms
ALTER TABLE "rooms" ADD COLUMN "propertyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "properties_tenantId_slug_key" ON "properties"("tenantId", "slug");
CREATE INDEX "properties_tenantId_idx" ON "properties"("tenantId");
CREATE INDEX "rooms_propertyId_idx" ON "rooms"("propertyId");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rooms" ADD CONSTRAINT "rooms_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
