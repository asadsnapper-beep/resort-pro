/*
  Warnings:

  - You are about to drop the column `stripeId` on the `payments` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'BKASH';
ALTER TYPE "PaymentMethod" ADD VALUE 'NAGAD';
ALTER TYPE "PaymentMethod" ADD VALUE 'SSLCOMMERZ';
ALTER TYPE "PaymentMethod" ADD VALUE 'ROCKET';
ALTER TYPE "PaymentMethod" ADD VALUE 'RAZORPAY';
ALTER TYPE "PaymentMethod" ADD VALUE 'CASHFREE';
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYHERE';
ALTER TYPE "PaymentMethod" ADD VALUE 'ESEWA';
ALTER TYPE "PaymentMethod" ADD VALUE 'KHALTI';
ALTER TYPE "PaymentMethod" ADD VALUE 'MIDTRANS';
ALTER TYPE "PaymentMethod" ADD VALUE 'OMISE';
ALTER TYPE "PaymentMethod" ADD VALUE 'IPAY88';
ALTER TYPE "PaymentMethod" ADD VALUE 'MPESA';
ALTER TYPE "PaymentMethod" ADD VALUE 'FLUTTERWAVE';
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYSTACK';
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYPAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_bookingId_fkey";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "stripeId",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BDT',
ADD COLUMN     "gateway" TEXT,
ADD COLUMN     "gatewayOrderId" TEXT,
ADD COLUMN     "gatewayPaymentId" TEXT,
ADD COLUMN     "gatewaySessionId" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "payerEmail" TEXT,
ADD COLUMN     "payerName" TEXT,
ADD COLUMN     "payerPhone" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
ADD COLUMN     "webhookData" JSONB,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'BD',
ALTER COLUMN "currency" SET DEFAULT 'BDT',
ALTER COLUMN "timezone" SET DEFAULT 'Asia/Dhaka';

-- CreateTable
CREATE TABLE "tenant_payment_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "activeGateway" TEXT NOT NULL DEFAULT 'manual',
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "enabledMethods" TEXT[] DEFAULT ARRAY['manual']::TEXT[],
    "manualInstructions" TEXT,
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_payment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_payment_configs_tenantId_key" ON "tenant_payment_configs"("tenantId");

-- CreateIndex
CREATE INDEX "payments_gateway_idx" ON "payments"("gateway");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_gatewayPaymentId_idx" ON "payments"("gatewayPaymentId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_payment_configs" ADD CONSTRAINT "tenant_payment_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
