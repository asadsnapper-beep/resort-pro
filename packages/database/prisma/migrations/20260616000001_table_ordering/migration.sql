-- CreateTable: restaurant_tables
CREATE TABLE "restaurant_tables" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

-- AlterTable: food_orders — add payment + table relation fields
ALTER TABLE "food_orders"
    ADD COLUMN "restaurantTableId" TEXT,
    ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "paymentMethod" "PaymentMethod",
    ADD COLUMN "gatewayPaymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_tables_tenantId_tableNumber_key" ON "restaurant_tables"("tenantId", "tableNumber");
CREATE INDEX "restaurant_tables_tenantId_idx" ON "restaurant_tables"("tenantId");
CREATE INDEX "food_orders_restaurantTableId_idx" ON "food_orders"("restaurantTableId");

-- AddForeignKey
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_restaurantTableId_fkey"
    FOREIGN KEY ("restaurantTableId") REFERENCES "restaurant_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
