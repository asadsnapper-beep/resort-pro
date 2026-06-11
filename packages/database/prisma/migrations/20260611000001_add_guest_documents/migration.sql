-- CreateTable
CREATE TABLE "guest_documents" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,

    CONSTRAINT "guest_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_documents_guestId_idx" ON "guest_documents"("guestId");

-- CreateIndex
CREATE INDEX "guest_documents_tenantId_idx" ON "guest_documents"("tenantId");

-- AddForeignKey
ALTER TABLE "guest_documents" ADD CONSTRAINT "guest_documents_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_documents" ADD CONSTRAINT "guest_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
