-- CreateEnum
CREATE TYPE "AccessKind" AS ENUM ('PAID', 'BROKER_IB');

-- CreateEnum
CREATE TYPE "Broker" AS ENUM ('XM', 'EXNESS');

-- CreateEnum
CREATE TYPE "TradingPlatform" AS ENUM ('MT4', 'MT5');

-- CreateEnum
CREATE TYPE "BrokerAccountStatus" AS ENUM ('PENDING', 'VERIFIED', 'RELEASED');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'CLAIM_SUBMITTED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "brokerAccountId" TEXT,
ADD COLUMN     "ibMinDepositUsd" DECIMAL(10,2),
ADD COLUMN     "kind" "AccessKind" NOT NULL DEFAULT 'PAID';

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "kind" "AccessKind" NOT NULL DEFAULT 'PAID';

-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "ibClaimsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ibExnessLink" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ibMinDepositUsd" DECIMAL(10,2),
ADD COLUMN     "ibXmLink" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "BrokerAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "broker" "Broker" NOT NULL,
    "platform" "TradingPlatform" NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "registeredEmail" TEXT NOT NULL,
    "status" "BrokerAccountStatus" NOT NULL DEFAULT 'PENDING',
    "firstVerifiedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "lastVerifiedByUserId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrokerAccount_userId_status_idx" ON "BrokerAccount"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerAccount_broker_platform_accountNumber_key" ON "BrokerAccount"("broker", "platform", "accountNumber");

-- CreateIndex
CREATE INDEX "Order_kind_status_idx" ON "Order"("kind", "status");

-- CreateIndex
CREATE INDEX "Order_brokerAccountId_idx" ON "Order"("brokerAccountId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_brokerAccountId_fkey" FOREIGN KEY ("brokerAccountId") REFERENCES "BrokerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerAccount" ADD CONSTRAINT "BrokerAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- แพ็กเกจสิทธิ์ฟรีผ่าน IB (ราคา 0, ไม่ขายผ่าน Checkout) — ให้ production มีแถวนี้เสมอ; seed อัปเดตชื่อ/ฟีเจอร์ตาม src/config/broker-ib.ts
INSERT INTO "Plan" ("id", "slug", "name", "durationDays", "price", "features", "isActive", "sortOrder", "kind", "createdAt", "updatedAt")
VALUES (
  'plan_broker_ib',
  'broker-ib',
  'สิทธิ์ใช้งานผ่านโบรกเกอร์พาร์ทเนอร์ (IB) 30 วัน',
  30,
  0,
  ARRAY[
    'สิทธิ์ใช้ Indicator TradingView แบบ Invite-only (Full Features)',
    'สิทธิ์เข้ากลุ่ม Telegram VIP สัญญาณเรียลไทม์',
    'ยศ VIP ใน Discord คอมมูนิตี้',
    'วิดีโอคู่มือสอนการตั้งค่าและกลยุทธ์ทีละขั้นตอน',
    'ระบบช่วยเหลือและ Support ทางเทคนิค'
  ]::TEXT[],
  true,
  100,
  'BROKER_IB',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
