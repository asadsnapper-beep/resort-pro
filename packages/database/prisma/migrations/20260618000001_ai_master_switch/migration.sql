-- AlterTable: platform_settings — global AI master switch (default off)
ALTER TABLE "platform_settings"
    ADD COLUMN "aiEnabledGlobal" BOOLEAN NOT NULL DEFAULT false;
