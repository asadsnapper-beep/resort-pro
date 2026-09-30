-- When the password was last typed on an admin session (review M-03).
--
-- Sessions that already exist get NULL, which reads as "not recently", so the
-- first destructive action after this deploys asks for the password. That is
-- the intended direction: the alternative is trusting sessions that were opened
-- before the idea existed.

ALTER TABLE "admin_sessions" ADD COLUMN "reauthAt" TIMESTAMP(3);
