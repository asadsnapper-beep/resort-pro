-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "corporateAccountId" TEXT,
ADD COLUMN     "corporateInvoiceId" TEXT;

-- CreateTable
CREATE TABLE "corporate_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "billingAddress" TEXT,
    "taxId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditLimit" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corporate_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "corporateAccountId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corporate_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "corporate_accounts_tenantId_idx" ON "corporate_accounts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "corporate_invoices_invoiceNumber_key" ON "corporate_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "corporate_invoices_tenantId_idx" ON "corporate_invoices"("tenantId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_corporateAccountId_fkey" FOREIGN KEY ("corporateAccountId") REFERENCES "corporate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_corporateInvoiceId_fkey" FOREIGN KEY ("corporateInvoiceId") REFERENCES "corporate_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_accounts" ADD CONSTRAINT "corporate_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_invoices" ADD CONSTRAINT "corporate_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_invoices" ADD CONSTRAINT "corporate_invoices_corporateAccountId_fkey" FOREIGN KEY ("corporateAccountId") REFERENCES "corporate_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

