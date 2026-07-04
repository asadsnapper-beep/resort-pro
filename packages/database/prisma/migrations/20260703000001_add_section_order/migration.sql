-- AddColumn: sectionOrder on website_content (owner's custom section order)
ALTER TABLE "website_content" ADD COLUMN "sectionOrder" TEXT[] DEFAULT ARRAY[]::TEXT[];
