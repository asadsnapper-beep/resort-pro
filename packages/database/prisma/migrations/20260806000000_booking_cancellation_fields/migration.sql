-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cancellationFee" DECIMAL(10,2),
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT;

