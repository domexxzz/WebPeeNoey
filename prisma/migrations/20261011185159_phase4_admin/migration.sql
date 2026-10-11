-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "basePrice" DECIMAL(10,2),
ADD COLUMN     "priceReason" TEXT;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "transferReference" TEXT;

