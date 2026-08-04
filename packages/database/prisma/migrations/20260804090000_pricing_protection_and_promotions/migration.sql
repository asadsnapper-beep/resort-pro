-- Preserve the published price for existing customers while pricing evolves.
ALTER TABLE "tenants" ADD COLUMN "priceProtectedUntil" TIMESTAMP(3);

-- Tracks one launch-promotion redemption per tenant. Duplicate-business review
-- remains a product decision; this table only records a fair, auditable claim.
CREATE TABLE "promotion_redemptions" (
    "id" TEXT NOT NULL,
    "promotionKey" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "normalizedBusinessName" TEXT NOT NULL,
    "normalizedAddress" TEXT,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promotion_redemptions_tenantId_key" ON "promotion_redemptions"("tenantId");
CREATE INDEX "promotion_redemptions_promotionKey_normalizedBusinessName_idx" ON "promotion_redemptions"("promotionKey", "normalizedBusinessName");
CREATE INDEX "promotion_redemptions_promotionKey_normalizedAddress_idx" ON "promotion_redemptions"("promotionKey", "normalizedAddress");

ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
