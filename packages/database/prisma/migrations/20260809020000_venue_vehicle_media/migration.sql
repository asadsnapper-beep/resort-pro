-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "videos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "videos" TEXT[] DEFAULT ARRAY[]::TEXT[];

