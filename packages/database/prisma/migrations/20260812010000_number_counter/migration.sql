-- CreateTable
CREATE TABLE "number_counters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "number_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "number_counters_tenantId_key_key" ON "number_counters"("tenantId", "key");

-- AddForeignKey
ALTER TABLE "number_counters" ADD CONSTRAINT "number_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
