-- CreateEnum
CREATE TYPE "FoodSettlement" AS ENUM ('PAY_NOW', 'CHARGE_TO_ROOM', 'COMPLIMENTARY', 'CORPORATE');

-- AlterTable
ALTER TABLE "food_orders" ADD COLUMN     "settlement" "FoodSettlement" NOT NULL DEFAULT 'PAY_NOW',
ADD COLUMN     "compReason" TEXT,
ADD COLUMN     "compBy" TEXT,
ADD COLUMN     "idempotencyKey" TEXT;

-- Existing orders attached to a stay already ride on that booking's invoice at
-- checkout, which is exactly CHARGE_TO_ROOM. Labelling them PAY_NOW would
-- misreport history; no monetary value changes either way.
UPDATE "food_orders" SET "settlement" = 'CHARGE_TO_ROOM' WHERE "bookingId" IS NOT NULL;

-- CreateIndex
-- Postgres treats NULLs as distinct, so orders sent without an idempotency key
-- are unconstrained; replays of the same key collide.
CREATE UNIQUE INDEX "food_orders_tenantId_idempotencyKey_key" ON "food_orders"("tenantId", "idempotencyKey");
