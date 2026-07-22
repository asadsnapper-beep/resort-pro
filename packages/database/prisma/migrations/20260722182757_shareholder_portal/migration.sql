-- AlterTable
ALTER TABLE "staff_invites" ADD COLUMN     "ownershipPercent" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "shareholder_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownershipPercent" DOUBLE PRECISION NOT NULL,
    "investedAmount" DOUBLE PRECISION,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shareholder_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shareholderProfileId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "netProfit" DOUBLE PRECISION NOT NULL,
    "occupancyRate" DOUBLE PRECISION NOT NULL,
    "ownerNote" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investor_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shareholder_profiles_userId_key" ON "shareholder_profiles"("userId");

-- CreateIndex
CREATE INDEX "shareholder_profiles_tenantId_idx" ON "shareholder_profiles"("tenantId");

-- CreateIndex
CREATE INDEX "payouts_tenantId_idx" ON "payouts"("tenantId");

-- CreateIndex
CREATE INDEX "payouts_shareholderProfileId_idx" ON "payouts"("shareholderProfileId");

-- CreateIndex
CREATE INDEX "investor_reports_tenantId_idx" ON "investor_reports"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "investor_reports_tenantId_month_key" ON "investor_reports"("tenantId", "month");

-- AddForeignKey
ALTER TABLE "shareholder_profiles" ADD CONSTRAINT "shareholder_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shareholder_profiles" ADD CONSTRAINT "shareholder_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_shareholderProfileId_fkey" FOREIGN KEY ("shareholderProfileId") REFERENCES "shareholder_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_reports" ADD CONSTRAINT "investor_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

