-- AlterTable
ALTER TABLE "guest_documents" ADD COLUMN     "bookingId" TEXT;

-- CreateIndex
CREATE INDEX "guest_documents_bookingId_idx" ON "guest_documents"("bookingId");

-- AddForeignKey
ALTER TABLE "guest_documents" ADD CONSTRAINT "guest_documents_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
