-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('ROOM_BASED', 'VESSEL_BASED');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "type" "PropertyType" NOT NULL DEFAULT 'ROOM_BASED';

