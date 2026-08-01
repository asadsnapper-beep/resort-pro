-- AlterEnum
ALTER TYPE "ThemeType" ADD VALUE 'TEMPLATE';

-- AlterTable
ALTER TABLE "themes" ADD COLUMN     "contractVersion" TEXT,
ADD COLUMN     "templateCss" TEXT,
ADD COLUMN     "templateHtml" TEXT;

