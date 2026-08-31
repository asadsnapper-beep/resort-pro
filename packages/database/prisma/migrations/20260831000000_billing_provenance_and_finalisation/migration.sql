-- AlterEnum
ALTER TYPE "InvoiceItemCategory" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedBy" TEXT;

-- CreateTable
CREATE TABLE "billing_audits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT,
    "invoiceId" TEXT,
    "action" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "reason" TEXT,
    "actorId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_audits_tenantId_bookingId_idx" ON "billing_audits"("tenantId", "bookingId");

-- CreateIndex
CREATE INDEX "billing_audits_tenantId_createdAt_idx" ON "billing_audits"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_items_invoiceId_sourceType_sourceId_key" ON "invoice_items"("invoiceId", "sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "billing_audits" ADD CONSTRAINT "billing_audits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

