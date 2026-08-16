-- Theme one-time sales: per-theme price + a permanent purchase record.
-- See plan/theme-studio-and-design-service.md ("২০২৬-০৮-১৩" section).
--
-- Price lives on the theme row rather than in packages/types/src/plans.ts
-- because themes are added roughly weekly — keeping ~50 prices in code would
-- force a deploy every time one changed. USD and BDT are stored side by side
-- (no runtime FX lookup) so a Bangladeshi owner's price never moves with the
-- exchange rate, matching the rule PLAN_PRICING already follows.

-- AlterTable
ALTER TABLE "themes" ADD COLUMN     "offerEndsAt" TIMESTAMP(3),
ADD COLUMN     "offerPriceBdt" DECIMAL(10,2),
ADD COLUMN     "offerPriceUsd" DECIMAL(10,2),
ADD COLUMN     "priceBdt" DECIMAL(10,2) NOT NULL DEFAULT 3000,
ADD COLUMN     "priceUsd" DECIMAL(10,2) NOT NULL DEFAULT 30;

-- Backfill 1 — existing free themes must STAY free.
-- The columns above default to 30/3000 so that newly uploaded themes are
-- priced without the admin having to remember. Applied blindly, though, that
-- default would also put a $30 tag on the themes that have been free all
-- along (luxe, minimal, coastal, tea-garden-eco-resort — all seeded with
-- isPremium = false), and every resort already using one would be looking at
-- a bill for something they were given. isPremium is the pre-migration truth
-- about which themes were ever meant to cost money, so it decides here.
UPDATE "themes" SET "priceUsd" = 0, "priceBdt" = 0 WHERE "isPremium" = false;

-- CreateTable
CREATE TABLE "theme_purchases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "themeKey" TEXT NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "note" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "theme_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "theme_purchases_tenantId_idx" ON "theme_purchases"("tenantId");

-- CreateIndex
CREATE INDEX "theme_purchases_themeKey_idx" ON "theme_purchases"("themeKey");

-- CreateIndex
CREATE UNIQUE INDEX "theme_purchases_tenantId_themeKey_key" ON "theme_purchases"("tenantId", "themeKey");

-- AddForeignKey
ALTER TABLE "theme_purchases" ADD CONSTRAINT "theme_purchases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_purchases" ADD CONSTRAINT "theme_purchases_themeKey_fkey" FOREIGN KEY ("themeKey") REFERENCES "themes"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill 2 — grandfather anyone already running a paid theme.
-- Until now nothing enforced isPremium, so a resort could pick any theme for
-- free. The moment ownership starts being checked, whatever they are using
-- today has to keep working: taking a live public website's design away over
-- a rule introduced after the fact is not an acceptable outcome. They are
-- recorded as owning it at a price of 0, which is exactly what they paid.
INSERT INTO "theme_purchases" ("id", "tenantId", "themeKey", "amountPaid", "currency", "note")
SELECT gen_random_uuid()::text, wc."tenantId", t."key", 0, 'BDT', 'grandfathered'
FROM "website_content" wc
JOIN "themes" t ON t."key" = wc."templateId"
WHERE t."isPremium" = true
ON CONFLICT ("tenantId", "themeKey") DO NOTHING;
