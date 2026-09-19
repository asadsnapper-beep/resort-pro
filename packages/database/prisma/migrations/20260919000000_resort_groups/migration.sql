-- CreateEnum
CREATE TYPE "ResortAccess" AS ENUM ('FULL', 'NUMBERS_ONLY');

-- CreateTable
CREATE TABLE "resort_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "payerTenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resort_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resort_group_tenants" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "access" "ResortAccess" NOT NULL DEFAULT 'FULL',
    "linkedUserId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resort_group_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resort_link_requests" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resort_link_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resort_group_events" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resort_group_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resort_groups_ownerUserId_idx" ON "resort_groups"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "resort_group_tenants_tenantId_key" ON "resort_group_tenants"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "resort_group_tenants_linkedUserId_key" ON "resort_group_tenants"("linkedUserId");

-- CreateIndex
CREATE INDEX "resort_group_tenants_groupId_idx" ON "resort_group_tenants"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "resort_link_requests_tokenHash_key" ON "resort_link_requests"("tokenHash");

-- CreateIndex
CREATE INDEX "resort_link_requests_tenantId_idx" ON "resort_link_requests"("tenantId");

-- CreateIndex
CREATE INDEX "resort_link_requests_groupId_idx" ON "resort_link_requests"("groupId");

-- CreateIndex
CREATE INDEX "resort_group_events_groupId_idx" ON "resort_group_events"("groupId");

-- CreateIndex
CREATE INDEX "resort_group_events_tenantId_idx" ON "resort_group_events"("tenantId");

-- AddForeignKey
ALTER TABLE "resort_group_tenants" ADD CONSTRAINT "resort_group_tenants_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "resort_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resort_group_tenants" ADD CONSTRAINT "resort_group_tenants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resort_link_requests" ADD CONSTRAINT "resort_link_requests_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "resort_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resort_link_requests" ADD CONSTRAINT "resort_link_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resort_group_events" ADD CONSTRAINT "resort_group_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "resort_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
