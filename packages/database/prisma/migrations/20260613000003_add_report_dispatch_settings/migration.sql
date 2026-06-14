CREATE TABLE "report_dispatch_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "dispatchTime" TEXT NOT NULL DEFAULT '22:00',
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "telegramBotToken" TEXT,
    "telegramChatId" TEXT,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappPhone" TEXT,
    "lastDispatchedAt" TIMESTAMP(3),
    "lastDispatchDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_dispatch_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_dispatch_settings_tenantId_key" ON "report_dispatch_settings"("tenantId");

ALTER TABLE "report_dispatch_settings" ADD CONSTRAINT "report_dispatch_settings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
