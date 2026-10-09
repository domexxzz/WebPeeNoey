# แผนแม่บทระบบสมาชิกรายเดือน (Master Technical & Architecture Plan)
**โปรเจกต์:** ระบบเว็บขายสมาชิกรายเดือน (Frontend + Backend + Back-office)  
**เวอร์ชัน:** 1.0.0 (Phase 0 Planning)  
**สถานะ:** รออนุมัติก่อนเริ่มพัฒนา Phase 1

---

## 1. ภาพรวมสถาปัตยกรรมระบบ (Architecture Overview)

```
┌────────────────────────────────────────────────────────────────────────┐
│                              ผู้ใช้งาน / มือถือ (Client)               │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ HTTPS                           │ HTTPS
                   ▼                                 ▼
┌─────────────────────────────────────┐  ┌───────────────────────────────┐
│        หน้าบ้านสาธารณะ & ลูกค้า       │  │        ระบบหลังบ้านแอดมิน      │
│  - Landing Page / Pricing / Guide   │  │  - Dashboard ยอดขาย / สมาชิก   │
│  - Auth (Credentials + Google)      │  │  - ตรวจสอบสลิป & อนุมัติออเดอร์  │
│  - Checkout (PromptPay QR ฝังยอด)   │  │  - จัดการสิทธิ์ / คืนเงิน / Audit│
│  - Client Dashboard & สิทธิ์การใช้งาน  │  │  - System Health & Kill-switch │
└──────────────────┬──────────────────┘  └───────────────┬───────────────┘
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Next.js App Router (Server Engine)                   │
│  - Middleware: Role-based Guard (/admin vs /account) + Security Headers│
│  - Server Actions & API Routes: Zod Validation + Rate Limiter          │
│  - Business Logic: Idempotency Locks, Slip Hash, Rollover Calculator   │
└──────────────┬──────────────────┬──────────────────────┬───────────────┘
               │                  │                      │
               ▼                  ▼                      ▼
┌──────────────────────┐ ┌────────────────┐ ┌────────────────────────────┐
│   PostgreSQL (Neon)  │ │ บริการภายนอก   │ │ งานอัตโนมัติ (Automations) │
│ - Prisma ORM         │ │ - Resend Email │ │ - Vercel / GitHub Actions  │
│ - Transaction ACID   │ │ - Telegram Bot │ │ - D-3 Expiry Warning Cron  │
│ - Slip Hash Index    │ │ - Discord API  │ │ - Revoke Expiry Cron       │
│ - Audit Trail Store  │ │ - TradingView  │ │ - Daily DB Backup Cron     │
└──────────────────────┘ └────────────────┘ └────────────────────────────┘
```

---

## 2. แผนผังหน้าเว็บไซต์ทั้งหมด (Sitemap & Page Hierarchy)

### 2.1 หน้าสาธารณะ (Public Routes - Layout ทั่วไป)
- `/` — หน้าหลัก (Hero, จุดเด่นฟีเจอร์, 4 ขั้นตอนการใช้งาน, ตารางราคาและแพ็กเกจ, FAQ คำถามพบบ่อย, ช่องทางติดต่อ)
- `/features` — รายละเอียดเชิงลึกของอินดิเคเตอร์/เครื่องมือ พร้อมภาพประกอบ
- `/guide` — คู่มือการติดตั้งและใช้งานจริงสำหรับสมาชิก
- `/terms` — ข้อกำหนดและเงื่อนไขการใช้บริการ
- `/privacy` — นโยบายความเป็นส่วนตัว (PDPA Compliant)
- `/refund` — นโยบายการคืนเงินและเงื่อนไขการรับประกัน

### 2.2 ระบบสมาชิกและการยืนยันตัวตน (Auth Routes - Minimal Layout)
- `/auth/signin` — เข้าสู่ระบบ (Email + Password หรือ Google OAuth) พร้อม Rate Limit ป้องกัน Brute-force
- `/auth/signup` — สมัครสมาชิกใหม่ (ชื่อ, อีเมล, รหัสผ่าน, TradingView Username / Discord Tag)
- `/auth/forgot-password` — หน้าขอรีเซ็ตรหัสผ่านทางอีเมล (ส่ง Magic Token จาก Resend)
- `/auth/reset-password` — หน้าระบุรหัสผ่านใหม่ (ตรวจสอบ Token ความปลอดภัยและวันหมดอายุ)

### 2.3 หน้าสมาชิกและขั้นตอนสั่งซื้อ (Account & Checkout Routes - Protected Layout)
- `/account` — หน้าแดชบอร์ดสมาชิก (ดูสถานะแพ็กเกจปัจจุบัน, วันหมดอายุ, ลิงก์เข้าใช้สิทธิ์)
- `/account/subscriptions` — ประวัติและรายละเอียดสิทธิ์ (TradingView Invite status, Discord role, Telegram group)
- `/account/orders` — ประวัติการสั่งซื้อทั้งหมด และสถานะใบเสร็จ
- `/checkout/[planId]` — หน้าสรุปแพ็กเกจที่เลือก, ตรวจสอบสิทธิ์ราคาโปรโมชัน (ถ้ามี)
- `/checkout/order/[orderId]` — หน้าชำระเงิน: แสดง PromptPay QR แบบ Dynamic ฝังยอดเงินทศนิยม + ชื่อบัญชีผู้รับ + ตัวนับเวลาถอยหลัง (Timer 30 นาที) + ช่องอัปโหลดสลิปธนาคาร

### 2.4 ระบบหลังบ้านแอดมิน (Admin Routes - Isolated Admin Layout & Security Guard)
- `/admin` — ภาพรวมสถิติ (MRR/ARR, ยอดขายวันนี้/สัปดาห์นี้/เดือนนี้, จำนวนสมาชิก Active, สมาชิกใกล้หมดอายุ D-3)
- `/admin/orders` — รายการออเดอร์ทั้งหมด (แท็บ: รอตรวจสอบสลิป, อนุมัติแล้ว, ปฏิเสธ, คืนเงิน)
- `/admin/orders/[id]` — รายละเอียดออเดอร์เดี่ยว (รูปสลิปขยายได้, ข้อมูลผู้โอน, ปุ่ม "อนุมัติ" พร้อม Idempotency, ปุ่ม "ปฏิเสธ" พร้อมระบุเหตุผล, ปุ่ม "คืนเงิน")
- `/admin/members` — จัดการสมาชิกทั้งหมด (ค้นหาด้วยอีเมล/ชื่อ/TV Username, ปรับเปลี่ยนวันหมดอายุ, สั่ง "ปิดสิทธิ์ทันที" พร้อมบันทึกเหตุผล)
- `/admin/audit-logs` — บันทึกประวัติการกระทำของแอดมินทุกครั้ง (ใครทำ, เมื่อไหร่, แก้ไขข้อมูลอะไร, จาก IP ไหน)
- `/admin/settings` — ตั้งค่าระบบ:
  - สวิตช์หลัก "เปิด/ปิดรับชำระเงิน" (Payment Gateway Kill-switch)
  - ข้อมูลบัญชี PromptPay (เลขบัญชี, ชื่อบัญชีแสดงบนหน้า QR)
  - จำนวนสิทธิ์โปรโมชันคงเหลือ
- `/admin/status` — ตรวจสอบสุขภาพระบบ (System Health Check: เช็กการเชื่อมต่อ DB, เช็กความพร้อมของ Resend, Telegram Bot, Cron Worker และสถานะตัวแปร Environment)

---

## 3. โครงสร้างฐานข้อมูล (Prisma Schema Specification)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  USER
  ADMIN
}

enum OrderStatus {
  PENDING_PAYMENT    // สร้างออเดอร์ รอชำระเงิน
  SLIP_SUBMITTED     // แนบสลิปแล้ว กำลังรอแอดมินตรวจสอบ
  APPROVED           // อนุมัติสำเร็จ ได้รับสิทธิ์เรียบร้อย
  REJECTED           // ปฏิเสธ (เช่น สลิปไม่ตรง / สลิปปลอม)
  EXPIRED            // ออเดอร์หมดเวลา (ไม่ได้โอนภายในเวลา)
  REFUNDED           // มีการคืนเงิน
}

enum SubscriptionStatus {
  ACTIVE             // กำลังใช้งานปกติ
  EXPIRING_SOON      // แจ้งเตือนแล้ว (เหลือ <= 3 วัน)
  EXPIRED            // สิทธิ์หมดอายุแล้ว
  REVOKED            // ถูกปิดสิทธิ์ก่อนกำหนดโดยแอดมิน
}

enum PaymentMethod {
  PROMPTPAY_QR
  BANK_TRANSFER
  MANUAL_ADMIN
}

model User {
  id                    String         @id @default(cuid())
  email                 String         @unique
  name                  String?
  passwordHash          String?        // สำหรับอีเมล+รหัสผ่าน
  role                  Role           @default(USER)
  emailVerified         DateTime?
  image                 String?
  
  // Platform identifiers สำหรับการให้สิทธิ์
  tradingViewUsername   String?
  discordUserId         String?
  telegramChatId        String?
  
  // ความสัมพันธ์
  accounts              Account[]
  sessions              Session[]
  orders                Order[]
  subscriptions         Subscription[]
  auditLogs             AuditLog[]     @relation("AdminAuditLogs")
  
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  @@index([email])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  email     String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([email, token])
}

model Plan {
  id                  String         @id @default(cuid())
  slug                String         @unique // เช่น 'monthly', 'quarterly', 'biannual', 'annual'
  name                String         // เช่น 'แพ็กเกจ 1 เดือน'
  durationDays        Int            // เช่น 30, 90, 180, 365
  price               Decimal        @db.Decimal(10, 2)
  originalPrice       Decimal?       @db.Decimal(10, 2)
  isPromo             Boolean        @default(false)
  promoLimit          Int?           // โควต้าโปรโมชัน เช่น 300 คนแรก
  promoEnrolledCount  Int            @default(0)
  lockPriceForLife    Boolean        @default(false)
  features            String[]       // ลิสต์รายการฟีเจอร์ในแพ็กเกจ
  isActive            Boolean        @default(true)
  sortOrder           Int            @default(0)
  
  orders              Order[]
  subscriptions       Subscription[]
  
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
}

model Order {
  id                  String         @id @default(cuid())
  orderNumber         String         @unique // เช่น ORD-20261010-XXXX
  userId              String
  planId              String
  
  amount              Decimal        @db.Decimal(10, 2) // ยอดเงินสุทธิ
  status              OrderStatus    @default(PENDING_PAYMENT)
  
  // ข้อมูลสลิป
  slipUrl             String?
  slipHash            String?        @unique // SHA-256 ป้องกันสลิปซ้ำเด็ดขาด
  slipUploadedAt      DateTime?
  
  // กระบวนการตรวจสอบ
  approvedAt          DateTime?
  approvedByUserId    String?
  rejectedAt          DateTime?
  rejectionReason     String?
  
  expiresAt           DateTime       // กำหนดเวลาชำระเงิน (ปกติ 30 นาที)
  
  user                User           @relation(fields: [userId], references: [id], onDelete: Restrict)
  plan                Plan           @relation(fields: [planId], references: [id], onDelete: Restrict)
  payment             Payment?
  subscription        Subscription?
  refund              Refund?

  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  @@index([userId, status])
  @@index([slipHash])
  @@index([orderNumber])
}

model Payment {
  id                  String         @id @default(cuid())
  orderId             String         @unique
  method              PaymentMethod  @default(PROMPTPAY_QR)
  
  promptpayTarget     String         // เบอร์โทร/เลขบัตรที่สร้าง QR
  promptpayPayload    String         @db.Text // Payload มาตรฐาน EMVCo
  amount              Decimal        @db.Decimal(10, 2)
  
  referenceNo         String?        // เลขอ้างอิงธุรกรรมธนาคาร
  verifiedAt          DateTime?
  
  order               Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  
  createdAt           DateTime       @default(now())
}

model Subscription {
  id                  String             @id @default(cuid())
  userId              String
  planId              String
  orderId             String             @unique
  status              SubscriptionStatus @default(ACTIVE)
  
  currentPeriodStart  DateTime
  currentPeriodEnd    DateTime
  
  // ล็อกสิทธิ์ราคาโปรโมชันตลอดชีพ
  isPriceLocked       Boolean            @default(false)
  lockedPrice         Decimal?           @db.Decimal(10, 2)
  
  // ข้อมูลสิทธิ์การเชื่อมต่อ
  tradingViewGranted  Boolean            @default(false)
  discordRoleGranted  Boolean            @default(false)
  telegramGranted     Boolean            @default(false)
  
  // การเพิกถอนสิทธิ์
  revokedAt           DateTime?
  revocationReason    String?
  
  user                User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan                Plan               @relation(fields: [planId], references: [id], onDelete: Restrict)
  order               Order              @relation(fields: [orderId], references: [id], onDelete: Restrict)
  
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@index([userId, status])
  @@index([currentPeriodEnd])
}

model Refund {
  id                  String         @id @default(cuid())
  orderId             String         @unique
  amount              Decimal        @db.Decimal(10, 2)
  reason              String
  processedByUserId   String
  evidenceUrl         String?        // หลักฐานการโอนเงินคืน
  
  order               Order          @relation(fields: [orderId], references: [id], onDelete: Restrict)
  
  createdAt           DateTime       @default(now())

  @@index([orderId])
}

model AuditLog {
  id                  String         @id @default(cuid())
  actorId             String         // ID แอดมินผู้กระทำ
  action              String         // เช่น 'ORDER_APPROVE', 'ORDER_REJECT', 'SUBSCRIPTION_REVOKE', 'REFUND_ISSUE'
  targetType          String         // 'Order', 'Subscription', 'User', 'System'
  targetId            String
  details             Json?          // ข้อมูลการเปลี่ยนแปลงก่อน-หลัง
  ipAddress           String?
  
  actor               User           @relation("AdminAuditLogs", fields: [actorId], references: [id], onDelete: Restrict)
  
  createdAt           DateTime       @default(now())

  @@index([actorId])
  @@index([targetType, targetId])
  @@index([createdAt])
}

model RateLimit {
  id                  String         @id @default(cuid())
  key                 String         @unique // เช่น 'ip:1.2.3.4:login' หรือ 'user:123:slip'
  count               Int            @default(1)
  expiresAt           DateTime

  @@index([key, expiresAt])
}

model SystemSetting {
  id                  String         @id @default("default")
  paymentsEnabled     Boolean        @default(false) // ค่าเริ่มต้น = ปิดรับเงิน ตามกติกา
  promptpayAccountName String        @default("ชื่อบัญชีผู้รับ")
  promptpayNumber     String         @default("081XXXXXXX")
  supportTelegramUrl  String?
  maintenanceMode     Boolean        @default(false)
  updatedAt           DateTime       @updatedAt
}
```

---

## 4. สถานะออเดอร์และการเปลี่ยนสถานะ (Order Lifecycle State Machine)

```
       [ ผู้ใช้เลือกแพ็กเกจ ]
                 │
                 ▼
     ┌───────────────────────┐
     │   PENDING_PAYMENT     │  ◄── (สร้างออเดอร์, สร้าง PromptPay QR, กำหนดอายุ 30 นาที)
     └───────────┬───────────┘
                 │
        ┌────────┴──────────────────────────────┐
        │ ผู้ใช้แนบสลิป                           │ เกิน 30 นาที / กดยกเลิก
        ▼                                       ▼
 ┌───────────────┐                      ┌───────────────┐
 │ SLIP_SUBMITTED│                      │    EXPIRED    │
 └───────┬───────┘                      └───────────────┘
         │
         ├──────────────────────────────────────┐
         │ แอดมินตรวจผ่าน                         │ แอดมินตรวจไม่ผ่าน
         ▼                                      ▼
 ┌───────────────┐                      ┌───────────────┐
 │   APPROVED    │                      │   REJECTED    │ ──► ลูกค้าดูเหตุผล & แนบสลิปใหม่
 └───────┬───────┘                      └───────────────┘     (สถานะกลับไป SLIP_SUBMITTED)
         │
         │ ลูกค้าขอคืนเงิน / แอดมินสั่งคืนเงิน
         ▼
 ┌───────────────┐
 │   REFUNDED    │ ──► (ถอดสิทธิ์ Subscription ทันที)
 └───────────────┘
```

---

## 5. แผนภาพ Flow การทำงานทั้งหมดแบบละเอียด (End-to-End Flows)

### Flow 1: การสมัครสมาชิก & เข้าสู่ระบบ (Sign up & Auth)
1. ผู้ใช้เข้าหน้า `/auth/signup` กรอกข้อมูล: ชื่อ, อีเมล, รหัสผ่าน, และ TradingView Username (บังคับสำหรับอินดิเคเตอร์)
2. ระบบตรวจสอบ Password Strength, ป้องกัน Brute-force ด้วย Rate Limiting บันทึกในฐานข้อมูล
3. Hash รหัสผ่านด้วย `bcrypt` (Salt round 12)
4. ส่งอีเมลต้อนรับ / ยืนยันอีเมลด้วย Resend
5. รองรับการเชื่อมต่อแบบ Google OAuth (OAuth 2.0 ผ่าน Auth.js)

### Flow 2: สั่งซื้อ & ชำระเงินด้วย PromptPay QR ฝังยอด (Order Creation & Dynamic QR)
1. ผู้ใช้เลือกแพ็กเกจที่หน้า `/` หรือ `/pricing` → เข้าสู่ `/checkout/[planId]`
2. ระบบตรวจสถานะระบบ: ถ้า `SystemSetting.paymentsEnabled == false` จะแจ้งเตือน "ระบบปิดรับชำระเงินชั่วคราว"
3. ระบบคำนวณราคา: ตรวจสอบว่าผู้ใช้มีสิทธิ์ล็อกราคาโปรโมชัน (`isPriceLocked`) หรือยังอยู่ในโควต้า `promoLimit` หรือไม่
4. กดสั่งซื้อ → สร้าง Record ใน `Order` สถานะ `PENDING_PAYMENT` และคำนวณเวลาหมดอายุ `expiresAt = now() + 30 นาที`
5. สร้าง Payload PromptPay ตามมาตรฐาน **EMVCo QR Code** พร้อมฝังยอดเงินสุทธิและชื่อบัญชีผู้รับเงิน
6. บันทึกในตาราง `Payment` พร้อมแสดงผล QR บนหน้าเว็บ มีปุ่มบันทึกภาพ QR และแสดงเลขบัญชีสำหรับคัดลอก

### Flow 3: การแนบสลิป & การป้องกันสลิปซ้ำ (Slip Upload & Anti-duplicate Hash)
1. ผู้ใช้อัปโหลดรูปสลิปที่หน้า `/checkout/order/[orderId]` (แม้ระบบจะปิดรับชำระเงินใหม่ แต่ออเดอร์ที่ค้างอยู่ยังแนบได้)
2. Server Action ตรวจสอบ:
   - ตรวจสอบขนาดไฟล์ (จำกัดสูงสุด 5MB)
   - ตรวจสอบ MIME type และ Magic Bytes (เฉพาะ image/jpeg, image/png, image/webp)
   - คำนวณ **SHA-256 Hash ของไฟล์สลิป**
   - คิวรีฐานข้อมูล `Order.findUnique({ where: { slipHash } })`
   - หากพบ Hash ซ้ำในระบบ: **ปฏิเสธการอัปโหลดทันที** พร้อมแจ้ง "สลิปนี้เคยถูกใช้งานในระบบแล้ว ไม่สามารถใช้ซ้ำได้"
3. หากผ่าน: บันทึกรูปภาพขึ้น Cloud Storage, บันทึก `slipHash`, เปลี่ยนสถานะเป็น `SLIP_SUBMITTED`
4. **ส่งข้อความแจ้งเตือนเข้า Telegram กลุ่มแอดมินทันที** พร้อมปุ่มลิงก์ตรงไปยังหน้า `/admin/orders/[id]`

### Flow 4: แอดมินตรวจสอบ & การอนุมัติที่มี Idempotency (Admin Approval & Concurrency Protection)
1. แอดมินเปิดหน้า `/admin/orders/[id]` เพื่อตรวจหลักฐาน
2. หากต้องการอนุมัติ:
   - แอดมินคลิก "อนุมัติออเดอร์"
   - ระบบใช้ **Database Transaction with Row Locking** (`SELECT FOR UPDATE` หรือ Atomic Update):
     `WHERE id = orderId AND status = 'SLIP_SUBMITTED'`
   - หากสถานะถูกเปลี่ยนไปแล้ว (เช่น แอดมินอีกคนกดไปแล้วก่อนหน้า): จะหยุดทำงานทันที ไม่ประมวลผลซ้ำ
   - ปรับสถานะเป็น `APPROVED`
   - บันทึก `approvedAt = now()`, `approvedByUserId = admin.id`
   - เรียกกระบวนการ **Flow 5: การให้สิทธิ์และการต่ออายุ**
   - บันทึก `AuditLog` บันทึกแอดมินผู้ทำรายการ
   - ส่งอีเมลใบเสร็จรับเงิน (Official Receipt) ผ่าน Resend ให้ลูกค้า
3. หากต้องการปฏิเสธ:
   - แอดมินคลิก "ปฏิเสธ" พร้อมเลือกหรือพิมพ์เหตุผล (เช่น สลิปไม่ชัด, ยอดเงินไม่ตรง)
   - อัปเดตสถานะเป็น `REJECTED`, บันทึก `rejectionReason`
   - ส่งอีเมลแจ้งเตือนลูกค้าให้รับทราบ พร้อมลิงก์ให้อัปโหลดสลิปใหม่หากยังไม่หมดอายุ
   - บันทึก `AuditLog`

### Flow 5: การให้สิทธิ์ และ การต่ออายุทบวัน (Provisioning & Rollover Stacking)
1. ตรวจสอบว่าผู้ใช้มี `Subscription` ที่กำลัง `ACTIVE` อยู่เดิมหรือไม่:
   - **กรณีสมัครใหม่ (New Member)**:
     - `currentPeriodStart = now()`
     - `currentPeriodEnd = now() + plan.durationDays`
     - สร้าง Record ใน `Subscription`
     - หากเป็นแพ็กเกจโปรล็อกราคา: เซ็ต `isPriceLocked = true`, `lockedPrice = plan.price`
   - **กรณีต่ออายุ (Renewal)**:
     - ดึง `currentPeriodEnd` ของสิทธิ์เดิม
     - หากของเดิมยังไม่หมดอายุ (`currentPeriodEnd > now()`):
       **ทบวันต่อจากวันเดิม!**  
       `newPeriodEnd = currentPeriodEnd + plan.durationDays`
     - หากของเดิมหมดอายุแล้ว (`currentPeriodEnd <= now()`):
       `newPeriodEnd = now() + plan.durationDays`
     - อัปเดตสถานะเป็น `ACTIVE`
2. **การให้สิทธิ์จริง (Multi-channel Provisioning)**:
   - **TradingView**: บันทึกคำขอสิทธิ์เข้าคิว หรือเชื่อมต่อสคริปต์ Invite-only ผ่าน TradingView Automation
   - **Telegram**: สร้างลิงก์เชิญแบบกลุ่มส่วนตัว (One-time Invite Link with Join Request Approval) ส่งให้ผู้ใช้ผ่านแดชบอร์ดและอีเมล
   - **Discord**: อัปเดตยศ (Role) อัตโนมัติผ่าน Discord Bot API โดยใช้ Discord User ID

### Flow 6: ระบบเตือนก่อนหมดอายุ และ การหมดอายุอัตโนมัติ (Expiry Cron & Deprovisioning)
1. **GitHub Actions / Vercel Cron รันทุกวันเวลา 09:00 น.** (`/api/cron/check-expiry` มี Bearer Secret Token กำกับ)
2. **ขั้นที่ 1: เตือนก่อนหมดอายุ 3 วัน (D-3 Warning)**:
   - ค้นหา `Subscription` ที่ `currentPeriodEnd <= now() + 3 วัน` และยังไม่ได้ส่งเตือน
   - ส่งอีเมลแจ้งเตือน "สิทธิ์ของคุณกำลังจะหมดอายุในอีก 3 วัน" พร้อมปุ่มกดต่ออายุราคาเดิม
   - ส่ง Telegram แจ้งเตือนเข้าส่วนตัว (ถ้ามี)
3. **ขั้นที่ 2: ถอดสิทธิ์เมื่อหมดอายุ (Deprovisioning)**:
   - ค้นหา `Subscription` ที่ `currentPeriodEnd < now()` และสถานะยังเป็น `ACTIVE`
   - เปลี่ยนสถานะเป็น `EXPIRED`
   - สั่งถอดสิทธิ์ทุกช่องทาง:
     - ถอดสิทธิ์ TradingView Invite
     - ถอดยศใน Discord ผ่าน Bot API
     - เตะ/ปิดสิทธิ์ใน Telegram Group ผ่าน Bot API
   - ส่งแจ้งเตือนสรุปรายการสมาชิกที่หมดอายุเข้า Telegram กลุ่มแอดมิน
   - หาก Cron ล้มเหลว: ส่งแจ้งเตือน Error ทันที (ห้ามล้มเงียบ)

### Flow 7: การปิดสิทธิ์ฉุกเฉิน & การคืนเงิน (Emergency Revocation & Refund with Idempotency)
1. แอดมินสามารถกด "ปิดสิทธิ์ทันที (Revoke Access)" จากหน้า `/admin/members/[id]`
   - บันทึกเหตุผล, ปรับสถานะเป็น `REVOKED`, ถอดสิทธิ์ทุกระบบทันที
   - บันทึก `AuditLog`
2. หากมีการคืนเงิน (Refund):
   - แอดมินกด "คืนเงิน" ที่หน้าออเดอร์
   - ตรวจสอบว่าออเดอร์นี้เคยถูกคืนเงินแล้วหรือไม่ (ป้องกันการกดคืนเงินซ้ำซ้อน)
   - สร้าง Record ในตาราง `Refund` พร้อมอัปโหลดสลิปหลักฐานการโอนเงินคืน
   - เปลี่ยนสถานะออเดอร์เป็น `REFUNDED`
   - ปิดสิทธิ์ `Subscription` ที่เชื่อมโยงทันที
   - บันทึก `AuditLog` แสดงแอดมินผู้ทำการคืนเงิน

---

## 6. แผนความปลอดภัยและการป้องกันความเสี่ยง (Security & Hardening Plan)

1. **Security Headers ป้องกัน Clickjacking:**
   - ติดตั้ง Middleware กำหนด:
     - `X-Frame-Options: DENY` (ห้ามนำหน้าแอดมินและหน้าเว็บไปเปิดใน iframe)
     - `X-Content-Type-Options: nosniff`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Content-Security-Policy` ที่รัดกุม
2. **การป้องกัน Double Submission / Race Conditions:**
   - ใช้ Database Transaction Isolation
   - Idempotency Keys บนปุ่มกดอนุมัติของแอดมิน (Disable ปุ่มทันทีที่คลิก + เช็กสถานะก่อนเขียนข้อมูล)
3. **การตรวจสอบไฟล์สลิป (File Security):**
   - ตรวจสอบ Magic Bytes ที่หัวไฟล์ ห้ามเชื่อเฉพาะ Extension
   - คำนวณ Unique Hash (SHA-256) และทำ Unique Index ใน Database
4. **Rate Limiting:**
   - จำกัดการเข้าสู่ระบบ: สูงสุด 5 ครั้ง ต่อ 15 นาที ต่อ IP
   - จำกัดการสร้างออเดอร์: สูงสุด 3 ออเดอร์ที่ค้างอยู่ต่อ User
   - ป้องกันการยิงสแปมอัปโหลดสลิป
5. **Audit Trail ครบวงจร:**
   - ทุก Action สำคัญของแอดมินถูกบันทึกลงตาราง `AuditLog` แบบไม่สามารถแก้ไขได้ (Append-only)

---

## 7. แผนการสำรองข้อมูล (Database Backup Strategy)
1. ใช้ฟังก์ชัน Point-in-Time Recovery (PITR) ของ Neon PostgreSQL
2. สคริปต์ Cron สำรองข้อมูลรายวันผ่าน `pg_dump` เข้ารหัสและจัดเก็บใน Secure Storage
3. ใน Phase 5 จะมีการทดสอบซ้อมกู้คืนฐานข้อมูลจริง 1 รอบตามข้อกำหนด
