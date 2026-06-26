-- AddColumn: roomTypeLabels on tenants (custom display names for room types)
ALTER TABLE "tenants" ADD COLUMN "roomTypeLabels" JSONB;
