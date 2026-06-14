-- AlterTable: add googleAnalyticsId to website_content
ALTER TABLE "website_content" ADD COLUMN "googleAnalyticsId" TEXT;

-- CreateTable: website_page_views
CREATE TABLE "website_page_views" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "website_page_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_page_views_tenantId_date_key" ON "website_page_views"("tenantId", "date");
CREATE INDEX "website_page_views_tenantId_idx" ON "website_page_views"("tenantId");

-- AddForeignKey
ALTER TABLE "website_page_views" ADD CONSTRAINT "website_page_views_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
