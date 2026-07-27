-- CreateEnum
CREATE TYPE "DesignRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "themes" ADD COLUMN     "exclusiveToTenantId" TEXT;

-- CreateTable
CREATE TABLE "design_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "tier" TEXT,
    "budgetRange" TEXT,
    "timeline" TEXT,
    "description" TEXT NOT NULL,
    "referenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "DesignRequestStatus" NOT NULL DEFAULT 'NEW',
    "quotedAmount" DOUBLE PRECISION,
    "currency" TEXT,
    "quotedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "deliveredThemeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "design_requests_tenantId_idx" ON "design_requests"("tenantId");

-- CreateIndex
CREATE INDEX "design_requests_status_idx" ON "design_requests"("status");

-- CreateIndex
CREATE INDEX "themes_exclusiveToTenantId_idx" ON "themes"("exclusiveToTenantId");

-- AddForeignKey
ALTER TABLE "design_requests" ADD CONSTRAINT "design_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_exclusiveToTenantId_fkey" FOREIGN KEY ("exclusiveToTenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

