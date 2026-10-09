# เอกสารส่งต่องาน (Project Handoff & Session Log)

## เซสชัน: Phase 0 — การวางแผนและกำหนดกติกา (Planning & Rules Setup)
**วันที่:** 10 ตุลาคม 2026  
**สถานะปัจจุบัน:** เสร็จสิ้น Phase 0 รอรวบรวมข้อมูลธุรกิจและขออนุมัติจากผู้ใช้งาน

---

### 1. สิ่งที่ทำเสร็จแล้วในเซสชันนี้
1. **จัดตั้งกฎเหล็กของโปรเจกต์ ([CLAUDE.md](file:///e:/Webpeenoey/CLAUDE.md)):**
   - กฎการทดสอบ Feature และฐานข้อมูลจริง (ห้าม Mock เฉพาะหน่วยความจำ)
   - กฎการ Commit เฉพาะไฟล์ที่แก้ไข (ห้าม `git add -A`)
   - จริยธรรมข้อมูล ห้ามทำรีวิวปลอม / ภาพ PnL ปลอม
   - การจัดการความลับใน `.env` และ Security Headers
   - ความเสถียรของ Cron, Webhook, Bot (ห้ามล้มเงียบ + มีแจ้งเตือน Telegram ทันที)
   - การกันกดซ้ำ (Idempotency) และ Audit Log ทุก Action ของแอดมิน
   - การบันทึกไฟล์ `.ps1` เป็น UTF-8 with BOM และการใช้ `next/image` พร้อม `sizes`
2. **จัดทำแผนแม่บทสถาปัตยกรรมระบบ ([docs/PLAN.md](file:///e:/Webpeenoey/docs/PLAN.md)):**
   - แผนผังหน้าทั้งหมด (Sitemap) ทั้ง Public, Auth, Account, Checkout, และ Admin
   - Schema ฐานข้อมูล Prisma ครบทุกโมเดล (`User`, `Plan`, `Order`, `Payment`, `Subscription`, `Refund`, `AuditLog`, `RateLimit`, `SystemSetting`)
   - State Machine สถานะออเดอร์ (`PENDING_PAYMENT` -> `SLIP_SUBMITTED` -> `APPROVED` / `REJECTED` / `REFUNDED` / `EXPIRED`)
   - Flow การทำงานละเอียดตั้งแต่ สมัคร -> จ่าย PromptPay QR ฝังยอด -> ตรวจสลิปซ้ำด้วย SHA-256 Hash -> แอดมินอนุมัติ -> ให้สิทธิ์ -> ต่ออายุทบวัน -> เตือนก่อนหมดอายุ D-3 -> หมดอายุถอดสิทธิ์ -> คืนเงิน
3. **กำหนดคำถามที่จำเป็นต้องใช้จากทางธุรกิจ:**
   - รวบรวมคำถามที่ยังขาดเพื่อขอข้อมูลจากผู้ใช้งานในรอบเดียว

---

### 2. สิ่งที่ค้างอยู่และต้องทำในเฟสถัดไป (Phase 1 — โครง + ระบบสมาชิก)
- รับคำตอบข้อมูลธุรกิจจากผู้ใช้งาน
- Initialise Next.js 14+ (App Router) ด้วย TypeScript, Tailwind CSS
- ติดตั้ง Prisma และกำหนด Schema ตาม [docs/PLAN.md](file:///e:/Webpeenoey/docs/PLAN.md)
- ติดตั้ง Auth.js (NextAuth v5) รองรับ Email+Password (bcrypt) และ Google OAuth
- สร้าง Layout แยกสำหรับ `/admin` (Isolated & Protected) และ `/account`
- ทำ Configuration ไฟล์เดียวสำหรับราคาและแพ็กเกจ
- ติดตั้ง Security Headers (ป้องกัน Clickjacking)
- จัดทำชุดทดสอบอัตโนมัติ (Integration Test) และทดสอบ Build ผ่าน 100%

---

### 3. กับดักและข้อควรระวังทางเทคนิคที่พบ (Technical Pitfalls & Gotchas)
1. **Windows PowerShell Encoding:** ไฟล์สคริปต์ `.ps1` ต้องเซฟด้วย UTF-8 with BOM เสมอ หากมีข้อความภาษาไทย
2. **Prisma Decimal vs JSON:** ตัวเลขทางการเงินใน `Order` และ `Plan` ต้องใช้ `Decimal(10, 2)` และระวังการแปลงเป็น JSON สำหรับ Client-side component
3. **Idempotency on Admin Actions:** เมื่อแอดมินคลิกอนุมัติ ต้องใช้ Atomic Check & Set บน Database ทันทีเพื่อป้องกัน Race Condition
