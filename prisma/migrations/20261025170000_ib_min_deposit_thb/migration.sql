-- ยอดฝากขั้นต่ำสิทธิ์ IB: เปลี่ยนจากค่าเดียวเป็น USD → แยกรายโบรกเกอร์เป็นเงินบาท + อัตราแลกเปลี่ยนที่แอดมินตั้ง
-- เพิ่มคอลัมน์อย่างเดียว (ค่าเดิม ibMinDepositUsd คงไว้ ไม่ลบข้อมูลเก่า)

ALTER TABLE "SystemSetting"
  ADD COLUMN "ibMinDepositXmThb" DECIMAL(10,2),
  ADD COLUMN "ibMinDepositExnessThb" DECIMAL(10,2),
  ADD COLUMN "ibUsdThbRate" DECIMAL(10,4);

ALTER TABLE "Order"
  ADD COLUMN "ibMinDepositThb" DECIMAL(10,2),
  ADD COLUMN "ibUsdThbRate" DECIMAL(10,4);

-- ระบบที่ตั้งค่า IB ไว้แล้วต้องไม่ถูกปิดเองตอน deploy (ค่าใหม่เป็น NULL = ปิดรับคำขอ)
-- เติมค่าที่เจ้าของกำหนด: XM 1,000 บาท, Exness 1,500 บาท, อัตราเริ่มต้น 33.50 บาท/USD — แก้ได้ที่ /admin/settings
UPDATE "SystemSetting"
SET "ibMinDepositXmThb" = 1000,
    "ibMinDepositExnessThb" = 1500,
    "ibUsdThbRate" = 33.50
WHERE "ibMinDepositUsd" IS NOT NULL;
