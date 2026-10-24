-- ตรวจสลิปอัตโนมัติ: อ่าน QR ในสลิป (กันสลิปเดิมที่ถ่ายใหม่) + ผลตรวจกับธนาคารผ่าน EasySlip
-- คอลัมน์ใหม่ทั้งหมด nullable/มีค่าเริ่มต้น — สลิปเดิมคงสถานะ DISABLED (ยังไม่เคยตรวจ)

-- CreateEnum
CREATE TYPE "SlipQrIntegrity" AS ENUM ('VALID', 'INVALID', 'ABSENT');

-- CreateEnum
CREATE TYPE "SlipCheckStatus" AS ENUM ('DISABLED', 'PENDING', 'VERIFIED', 'AMOUNT_MISMATCH', 'WRONG_RECEIVER', 'RECEIVER_UNVERIFIED', 'STALE', 'UNREADABLE', 'ERROR', 'DUPLICATE');

-- AlterTable
ALTER TABLE "SlipUpload"
  ADD COLUMN "qrPayload" TEXT,
  ADD COLUMN "qrReference" TEXT,
  ADD COLUMN "qrIntegrity" "SlipQrIntegrity",
  ADD COLUMN "checkStatus" "SlipCheckStatus" NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN "checkNote" TEXT,
  ADD COLUMN "checkAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "checkedAt" TIMESTAMP(3),
  ADD COLUMN "transRef" TEXT,
  ADD COLUMN "slipAmount" DECIMAL(10,2),
  ADD COLUMN "slipDate" TIMESTAMP(3),
  ADD COLUMN "receiverName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SlipUpload_qrPayload_key" ON "SlipUpload"("qrPayload");

-- CreateIndex
CREATE UNIQUE INDEX "SlipUpload_transRef_key" ON "SlipUpload"("transRef");

-- CreateIndex
CREATE INDEX "SlipUpload_checkStatus_idx" ON "SlipUpload"("checkStatus");
