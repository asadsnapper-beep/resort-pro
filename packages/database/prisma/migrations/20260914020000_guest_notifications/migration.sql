-- CreateTable
CREATE TABLE "guest_notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "via" TEXT,
    "providerId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_notifications_tenantId_createdAt_idx" ON "guest_notifications"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "guest_notifications_bookingId_event_channel_key" ON "guest_notifications"("bookingId", "event", "channel");

-- AddForeignKey
ALTER TABLE "guest_notifications" ADD CONSTRAINT "guest_notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_notifications" ADD CONSTRAINT "guest_notifications_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

