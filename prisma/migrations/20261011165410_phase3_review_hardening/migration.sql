-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adminNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "createdIp" TEXT,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "promptpayAccountName" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "Payment_referenceNo_key" ON "Payment"("referenceNo");

