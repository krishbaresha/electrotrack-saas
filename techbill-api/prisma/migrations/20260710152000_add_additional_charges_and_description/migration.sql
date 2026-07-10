-- AlterTable
ALTER TABLE "sales" ADD COLUMN "additional_charges" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "sales" ADD COLUMN "description" TEXT;
