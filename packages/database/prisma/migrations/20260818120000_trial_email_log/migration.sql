-- CreateTable
CREATE TABLE "trial_email_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trial_email_logs_tenantId_idx" ON "trial_email_logs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "trial_email_logs_tenantId_stage_key" ON "trial_email_logs"("tenantId", "stage");

-- AddForeignKey
ALTER TABLE "trial_email_logs" ADD CONSTRAINT "trial_email_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

