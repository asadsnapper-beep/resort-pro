-- Whether the linked user row exists only because of this connection.
-- Existing rows are all same-email links, which reuse the owner's own login on
-- the other resort — so false is the correct value for every one of them, and
-- disconnecting must keep leaving those accounts alone.
ALTER TABLE "resort_group_tenants" ADD COLUMN     "linkedUserCreated" BOOLEAN NOT NULL DEFAULT false;
