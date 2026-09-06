-- CreateTable
CREATE TABLE "stay_time_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "earlyFreeAfter" TEXT NOT NULL DEFAULT '11:00',
    "earlyHalfAfter" TEXT NOT NULL DEFAULT '06:00',
    "lateFreeUntil" TEXT NOT NULL DEFAULT '14:00',
    "lateHalfUntil" TEXT NOT NULL DEFAULT '18:00',
    "halfRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "chargeBasis" TEXT NOT NULL DEFAULT 'EFFECTIVE',
    "waiverRequiresManager" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stay_time_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stay_time_grants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "requestedFor" TIMESTAMP(3) NOT NULL,
    "approvedFor" TIMESTAMP(3) NOT NULL,
    "policyBand" TEXT NOT NULL,
    "quotedFee" DOUBLE PRECISION NOT NULL,
    "waivedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chargedFee" DOUBLE PRECISION NOT NULL,
    "overrideReason" TEXT,
    "approvedBy" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stay_time_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stay_time_policies_tenantId_key" ON "stay_time_policies"("tenantId");

-- CreateIndex
CREATE INDEX "stay_time_grants_tenantId_bookingId_idx" ON "stay_time_grants"("tenantId", "bookingId");

-- AddForeignKey
ALTER TABLE "stay_time_policies" ADD CONSTRAINT "stay_time_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_time_grants" ADD CONSTRAINT "stay_time_grants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_time_grants" ADD CONSTRAINT "stay_time_grants_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

