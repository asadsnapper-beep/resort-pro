-- AlterTable
ALTER TABLE "stay_time_grants" ADD COLUMN     "activeKey" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "invoiceExtraId" TEXT;

-- CreateIndex
-- One live grant of each kind per booking. Voided grants carry their own id in
-- activeKey instead of 'ACTIVE', so the history is kept and only the live row
-- is constrained — a retried request is refused here rather than charging the
-- guest a second time.
CREATE UNIQUE INDEX "stay_time_grants_bookingId_kind_activeKey_key" ON "stay_time_grants"("bookingId", "kind", "activeKey");
