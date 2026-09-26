-- Let a group's history outlive the group.
--
-- The events cascaded away with their group, which meant the audit trail
-- vanished exactly when it was most likely to be asked for: a connection had
-- just ended, and the owner wanted to know who had had access and when. The
-- "unlinked" row written moments earlier went with it.
--
-- Nothing is dropped and no row changes: the column becomes nullable and the
-- foreign key nulls it instead of deleting the row.
ALTER TABLE "resort_group_events" DROP CONSTRAINT "resort_group_events_groupId_fkey";
ALTER TABLE "resort_group_events" ALTER COLUMN "groupId" DROP NOT NULL;
ALTER TABLE "resort_group_events" ADD CONSTRAINT "resort_group_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "resort_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
