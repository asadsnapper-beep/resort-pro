-- AI schema — shipped behind feature flags (default OFF). plan/ai/ROLLOUT-STRATEGY.md

-- CreateTable: ai_keys
CREATE TABLE "ai_keys" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'platform',
    "dashboardKey" TEXT,
    "guestKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_keys_tenantId_key" ON "ai_keys"("tenantId");

-- CreateTable: ai_usage
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "queryCount" INTEGER NOT NULL DEFAULT 0,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_usage_tenantId_month_key" ON "ai_usage"("tenantId", "month");
CREATE INDEX "ai_usage_tenantId_idx" ON "ai_usage"("tenantId");

-- CreateTable: generated_content
CREATE TABLE "generated_content" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "appliedTo" TEXT,
    "tokensUsed" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generated_content_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "generated_content_tenantId_idx" ON "generated_content"("tenantId");

-- CreateTable: booking_leads
CREATE TABLE "booking_leads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "guests" INTEGER,
    "roomType" TEXT,
    "source" TEXT NOT NULL DEFAULT 'chatbot',
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_leads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "booking_leads_tenantId_idx" ON "booking_leads"("tenantId");
CREATE INDEX "booking_leads_status_idx" ON "booking_leads"("status");

-- CreateTable: guest_chat_sessions
CREATE TABLE "guest_chat_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "guest_chat_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "guest_chat_sessions_sessionId_key" ON "guest_chat_sessions"("sessionId");
CREATE INDEX "guest_chat_sessions_tenantId_idx" ON "guest_chat_sessions"("tenantId");

-- CreateTable: ai_abuse
CREATE TABLE "ai_abuse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "flaggedMsg" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_abuse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_abuse_tenantId_idx" ON "ai_abuse"("tenantId");

-- CreateTable: revenue_snapshots
CREATE TABLE "revenue_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "period" TEXT NOT NULL,
    "totalRooms" INTEGER NOT NULL,
    "availableRooms" INTEGER NOT NULL,
    "roomsSold" INTEGER NOT NULL,
    "occupancyRate" DOUBLE PRECISION NOT NULL,
    "adr" DOUBLE PRECISION NOT NULL,
    "revpar" DOUBLE PRECISION NOT NULL,
    "roomRevenue" DOUBLE PRECISION NOT NULL,
    "fbRevenue" DOUBLE PRECISION,
    "totalRevenue" DOUBLE PRECISION NOT NULL,
    "cancellations" INTEGER NOT NULL DEFAULT 0,
    "bySource" JSONB,
    "byRoomType" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revenue_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "revenue_snapshots_tenantId_snapshotDate_period_key" ON "revenue_snapshots"("tenantId", "snapshotDate", "period");
CREATE INDEX "revenue_snapshots_tenantId_idx" ON "revenue_snapshots"("tenantId");

-- CreateTable: ai_insights
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_insights_tenantId_idx" ON "ai_insights"("tenantId");

-- Foreign keys
ALTER TABLE "ai_keys" ADD CONSTRAINT "ai_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_content" ADD CONSTRAINT "generated_content_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_leads" ADD CONSTRAINT "booking_leads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guest_chat_sessions" ADD CONSTRAINT "guest_chat_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_abuse" ADD CONSTRAINT "ai_abuse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revenue_snapshots" ADD CONSTRAINT "revenue_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
