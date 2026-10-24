# เอกสารระบบ Gold Hybridshot (สำหรับผู้พัฒนาคนถัดไป)

> อ่านไฟล์นี้ก่อนเริ่มงาน แล้วอ่าน `CLAUDE.md` (กติกาถาวร ห้ามละเมิด) → `docs/PLAN.md` (สถาปัตยกรรมและ Flow ละเอียด) → `docs/HANDOFF.md` (บันทึกรายเซสชัน ล่าสุดอยู่บนสุด)
> อัปเดตล่าสุด: 22 ตุลาคม 2026 (commit ล่าสุดก่อนเขียน `69192a3`)

## 1. ระบบนี้คืออะไร

เว็บขายสมาชิกรายเดือนของอินดิเคเตอร์ TradingView แบบ Invite-only ชื่อ **Gold HybridShot Signals** (แบรนด์ "Gold Hybridshot")
สมาชิกจ่ายผ่าน **PromptPay QR ฝังยอด** → แนบสลิป → แอดมินตรวจและอนุมัติ → ได้สิทธิ์ตามแพ็กเกจ:

- เปิดสิทธิ์อินดิเคเตอร์บน TradingView ตาม TradingView Username ของสมาชิก (แอดมินเปิดด้วยมือ)
- ลิงก์เชิญกลุ่ม Telegram VIP (บอทของระบบช่วยเชื่อมบัญชี)
- ยศ VIP ใน Discord "Noble Gold Society" (แอดมินให้ยศด้วยมือ)
- ทางเลือกฟรี: เปิดบัญชีเทรด XM / Exness ผ่านลิงก์ IB + ฝากขั้นต่ำ → สิทธิ์ 30 วัน (ปิดไว้เป็นค่าเริ่มต้น)

แพ็กเกจ (`src/config/plans.ts`): 1 เดือน 990 บาท / 3 เดือน 2,490 / 6 เดือน 4,490 / 1 ปี 7,990 — ต่ออายุแบบ **ทบวัน** (เริ่มนับต่อจากวันหมดอายุเดิม)

## 2. ที่อยู่และบัญชีที่เกี่ยวข้อง

| อะไร | ที่ไหน |
|---|---|
| เว็บจริง (production) | **https://goldhybridshot.onrender.com** — Render Blueprint `Webpeenoey`, service `goldhybridshot`, แพ็กเกจ Starter (512MB), ภูมิภาค Singapore |
| โค้ด | GitHub `domexxzz/WebPeeNoey` สาขา `main` — push แล้ว Render deploy อัตโนมัติ |
| ฐานข้อมูล | Neon PostgreSQL `webpeenoey-db` (ap-southeast-1) ใช้ pooled URL |
| เว็บเก่า | `goldhybridshot.vercel.app` (Vercel ทีม `domezzxxs-projects`) — **ถูกพักถึง 19 พ.ย. 2026** เพราะโปรเจกต์อื่นในทีม (tradepulse) ใช้โควตา CPU ฟรีของทีมหมด — ย้ายมา Render แล้ว |
| งานตั้งเวลา | GitHub Actions: `watchdog.yml` (ทุกชั่วโมง), `check-expiry.yml` (ทุกวัน 02:05 UTC), `slip-recheck.yml` (ทุก 10 นาที), `backup.yml` (สำรองฐานข้อมูลรายวัน เข้ารหัส GPG) |
| ความลับบนเครื่องเจ้าของ | `.env.vercel-secrets.local` (gitignored) — `NEXTAUTH_SECRET`, `CRON_SECRET`, `PROD_ADMIN_PASSWORD` |

## 3. เทคโนโลยี

- **Next.js 15.5 (App Router) + React 19 + TypeScript**, Tailwind CSS
- **Prisma 5.22 + PostgreSQL** (Neon บน production, Docker/Postgres ในเครื่อง)
- **NextAuth v4** (JWT session): Credentials (อีเมล + รหัสผ่าน bcrypt 12 รอบ) + Google (ยังไม่ได้ตั้งค่า)
- `promptpay-qr` + `qrcode` สร้าง QR, `resend` ส่งอีเมล (ยังไม่ได้ตั้งค่า), `zod` ตรวจข้อมูล
- เทสต์: **Vitest** (unit) + Vitest integration กับ **PostgreSQL จริง**
- ไม่มี UI library / animation library — อนิเมชันเขียนเองด้วย CSS (`src/styles/motion*.css`) + runtime เล็ก ๆ

## 4. โครงสร้างโค้ด

```
src/
  app/
    (marketing)/   หน้าสาธารณะ: / features guide broker-ib terms privacy refund
    auth/          signin signup forgot-password reset-password
    (account)/     สมาชิก: /account /account/orders /account/broker-ib /checkout/[plan] /checkout/order/[orderId]
    (admin)/       หลังบ้าน: /admin (ภาพรวม) orders members broker-claims settings status audit-logs
    api/
      auth/[...nextauth]  register  forgot-password  reset-password
      cron/check-expiry   cron/watchdog       (ต้องมี Authorization: Bearer CRON_SECRET)
      slips/[id]          (ดูไฟล์สลิป — เฉพาะเจ้าของ/แอดมิน)
      telegram/webhook    (ต้องมี secret header ของ Telegram)
    opengraph-image.tsx robots.ts sitemap.ts
  middleware.ts    กันเส้นทาง /admin /account /checkout + CSP แบบ nonce ของหลังบ้าน + security headers
  lib/
    orders/        สร้างออเดอร์ (เศษสตางค์สุ่มกันยอดชน), แนบสลิป, สถานะ
    payments/      promptpay.ts (ตรวจ PromptPay ID + สร้าง payload), slip.ts (ตรวจไฟล์จาก magic bytes + hash), pricing.ts
    admin/         อนุมัติ/ปฏิเสธ/คืนเงิน (order-review.ts), ช่วงสิทธิ์ทบวัน (membership.ts), audit, guard, settings, health
    broker-ib/     คำขอสิทธิ์ฟรีผ่าน IB ทั้งระบบ
    jobs/          expiry.ts (เตือน + หมดอายุ), watchdog.ts (ตรวจสุขภาพ), job-run.ts (บันทึกการรัน)
    telegram/      bot.ts (/start /status /stop), link.ts (โทเค็นเชื่อมบัญชี)
    notify/telegram.ts  แจ้งเตือนกลุ่มแอดมิน
    auth.ts auth-secret.ts login.ts (rate limit ล็อกอิน) request.ts (อ่าน IP) rate-limit.ts csp.ts security.ts
  config/          plans, marketing (เนื้อหา/ภาพ), site (URL), legal, community, payment
  content/         ข้อความหน้า guide / features / legal
  components/      marketing/ account/ checkout/ admin/ ...
prisma/schema.prisma + migrations/ (9 migration)
tests/ (unit) + tests/integration/ (ฐานข้อมูลจริง)
scripts/  setup-local-postgres, setup-local-db-env, telegram-set-webhook, db-restore-drill, send-discord-status
render.yaml  vercel.json  .github/workflows/
```

## 5. ข้อมูลหลัก (Prisma)

- `User` (role USER/ADMIN, tradingViewUsername), `Account`/`Session`/`VerificationToken` (NextAuth), `PasswordResetToken`
- `Plan` → `Order` (สถานะด้านล่าง, `kind` = PAID หรือ BROKER_IB) → `SlipUpload` (ไฟล์เก็บใน DB เป็น Bytes + hash) → `Payment` (เลขอ้างอิงธนาคาร unique)
- `Subscription` (ช่วงสิทธิ์ ACTIVE / EXPIRING_SOON / EXPIRED / REVOKED — หนึ่งออเดอร์ = หนึ่งช่วง ต่อกันแบบทบวัน), `Refund`
- `BrokerAccount` (บัญชีเทรด XM/Exness unique ต่อ broker+เลขบัญชี)
- `AuditLog` (**append-only** มี migration กันแก้/ลบ), `RateLimit`, `SystemSetting` (แถวเดียว: PromptPay, เปิดรับเงิน, โหมดปิดปรับปรุง, ตั้งค่า IB), `JobRun`, `TelegramLinkToken`

สถานะออเดอร์: `PENDING_PAYMENT → SLIP_SUBMITTED → APPROVED | REJECTED`, หมดเวลา → `EXPIRED`, คืนเงิน → `REFUNDED`, IB ใช้ `CLAIM_SUBMITTED` — แผนภาพเต็มใน `docs/PLAN.md` หัวข้อ 4

## 6. Flow สำคัญ (รายละเอียดใน `docs/PLAN.md` หัวข้อ 5)

1. **สั่งซื้อ** (`lib/orders/create-order.ts`): advisory lock ต่อผู้ใช้ กันกดซ้ำ, ออเดอร์เดิมที่ยังไม่หมดเวลาถูกใช้ซ้ำ, ยอดเงินบวกเศษสตางค์สุ่มเพื่อแยกยอดโอน
2. **แนบสลิป** (`lib/orders/submit-slip.ts`, `lib/payments/slip.ts`): ตรวจชนิดไฟล์จาก magic bytes, ไม่เกิน 4MB, hash ไฟล์กันสลิปซ้ำ, แจ้งกลุ่มแอดมินทาง Telegram
   - **ตรวจสลิปอัตโนมัติ** (พอร์ตจาก Tradepulse): อ่าน QR ในสลิปในเซิร์ฟเวอร์ (`lib/payments/slip-qr.ts` — sharp + jsqr) → checksum CRC16 + กันสลิปเดิมที่ถ่าย/ครอปใหม่ด้วย `SlipUpload.qrPayload` (unique) → ถ้าตั้ง `EASYSLIP_TOKEN` ส่ง payload ให้ EasySlip API v2 ยืนยันกับธนาคาร (`lib/payments/easyslip.ts`): ยอดตรงถึงสตางค์, บัญชีผู้รับ (เลขพร้อมเพย์ของออเดอร์ + `SLIP_RECEIVER_ACCOUNTS`), โอนหลังสร้างออเดอร์, `transRef` unique
   - **ไม่มีการอนุมัติ/ปฏิเสธอัตโนมัติ** — ผลตรวจเป็นป้ายในหน้า `/admin/orders` + ข้อความ Telegram; สลิปซ้ำ (hash/QR/transRef) ถูกปฏิเสธตั้งแต่ตอนแนบ; สลิปที่ธนาคารยืนยันว่า transRef ถูกใช้แล้ว (`DUPLICATE`) อนุมัติไม่ได้
   - สลิปกรุงเทพที่โอนไม่ถึง 5 นาที (`SLIP_PENDING`) / ผู้ให้บริการขัดข้อง = `PENDING` → `lib/jobs/slip-recheck.ts` ตรวจซ้ำทุก 10 นาที (`.github/workflows/slip-recheck.yml` → `/api/cron/slip-recheck`) สูงสุด 12 ครั้ง
3. **อนุมัติ** (`lib/admin/order-review.ts`): ต้องกรอกเลขอ้างอิงธนาคาร (unique กันสลิปแก้ไฟล์), `SELECT … FOR UPDATE` + advisory lock `membership:<userId>` กันอนุมัติซ้ำ/ช่วงซ้อน, ต่ออายุทบวัน, AuditLog ใน transaction เดียว
4. **หมดอายุ** (`lib/jobs/expiry.ts`): เตือนก่อนหมด → เปลี่ยนเป็น EXPIRED → รายชื่อที่ต้องถอดสิทธิ์ช่องทางด้วยมือ (แสดงในหลังบ้าน)
5. **คืนเงิน / ปิดสิทธิ์ฉุกเฉิน**: คืนได้ครั้งเดียว ไม่เกินยอดที่จ่าย, ปิดช่วงสิทธิ์ทันที, เลื่อนช่วงที่ยังไม่เริ่มมาต่อกัน
6. **Watchdog** (`lib/jobs/watchdog.ts`): ตรวจงานค้าง/ล้มเหลว, สลิปที่แจ้งไม่สำเร็จ, สิทธิ์ที่ต้องถอด → แจ้ง Telegram (กันแจ้งซ้ำ 6 ชม.) และ GitHub Actions แจ้งเองถ้าแอปตอบไม่ได้

## 7. รันในเครื่อง

```bash
npm ci
npm run db:install      # หรือ npm run db:up (Docker) — Postgres ในเครื่อง
npm run db:env          # สร้าง .env สำหรับเครื่องนี้
npx prisma migrate dev && npm run db:seed
npm run dev             # http://localhost:3000
npm test                # unit (เครื่องเจ้าของ RAM น้อย: ใส่ --maxWorkers=2)
npm run test:integration  # ใช้ DATABASE_URL_TEST (PostgreSQL จริง)
```

## 8. Deploy

- **push ขึ้น `main` = deploy production บน Render อัตโนมัติ** (build `npm ci --include=dev && npx prisma generate && npm run build`, start `npm start`, health check `/robots.txt`)
- **migration ไม่รันอัตโนมัติ** — มี migration ใหม่ต้องรัน `prisma migrate deploy` กับ Neon (direct/unpooled URL) **ก่อน** push โค้ดที่ใช้ schema ใหม่
- env ทั้งหมดกรอกใน Render dashboard (`render.yaml` มีรายชื่อ, ค่าลับเป็น `sync: false`) — ค่า `NEXT_PUBLIC_*` ถูกฝังตอน build: แก้แล้วต้อง deploy ใหม่
- build production ล้มทันทีถ้า `NEXT_PUBLIC_APP_URL` ว่าง/เป็น localhost (`src/config/site.ts`) หรือ `NEXTAUTH_SECRET` สั้นกว่า 32 ตัว (`src/lib/auth-secret.ts`) — ตั้งใจให้เป็นแบบนี้

## 9. กติกาที่ต้องรักษา (สรุปจาก CLAUDE.md — อ่านตัวเต็มด้วย)

- ทุก feature ต้องมีเทสต์; เรื่องเงิน/สิทธิ์ (ออเดอร์, สลิปซ้ำ, อนุมัติ, ทบวัน, คืนเงิน) ต้องมี **integration test กับ PostgreSQL จริง**
- ห้ามบอกว่าเสร็จโดยไม่มีหลักฐาน (test/build pass, หน้าจอจริง, query จริง)
- Git: `git pull` ก่อนเริ่ม, **add เฉพาะไฟล์ที่แก้** (ห้าม `git add -A` / `.`), commit message แบบ `feat(scope): …`
- **ห้ามรีวิวปลอม/สถิติกำไรปลอม/Win Rate** บนเว็บ (มีเทสต์ดักคำต้องห้ามใน `tests/phase2-seo-security.test.ts`) — ภาพหน้าจอจริงต้องตัดสถิติผลงานและเบลอข้อมูลสมาชิกคนอื่นก่อนใช้
- ความลับอยู่ใน env เท่านั้น ห้ามพิมพ์ลงโค้ด/terminal/commit
- งานอัตโนมัติห้ามล้มเงียบ: บันทึก + แจ้ง Telegram กลุ่มแอดมิน
- action แอดมินต้องมี lock/idempotency + AuditLog (actorId, เวลา, ก่อน/หลัง, IP)
- รูปใช้ `next/image` พร้อม `sizes` ตรงขนาดจริง; ไฟล์ `.ps1` บันทึกเป็น UTF-8 with BOM
- จบงานทุกครั้งอัปเดต `docs/HANDOFF.md`

## 10. กับดักที่เจอแล้ว (อย่าพลาดซ้ำ)

- **คุกกี้ session บน Render**: proxy ส่งคำขอเข้าแอปเป็น http ทำให้ `getToken()` ของ next-auth เดาชื่อคุกกี้ผิด (หาชื่อธรรมดา แต่ NextAuth ตั้ง `__Secure-next-auth.session-token`) → ล็อกอินสำเร็จแต่ถูกเด้งกลับหน้า signin — `src/middleware.ts` จึงอ่านทั้งสองชื่อ (ยังตรวจลายเซ็นด้วย secret) อย่าเปลี่ยนกลับ
- **IP ผู้ใช้บน Render** (`src/lib/request.ts`): ใช้ `cf-connecting-ip` เท่านั้นเมื่อ `RENDER=true` — `x-forwarded-for` / `x-real-ip` บน Render ผู้ใช้ปลอมได้; ห้ามเปิด proxy (เมฆส้ม) ของ Cloudflare ซ้อนบนโดเมนตัวเอง
- **`vercel env pull` คืนค่าแทน** สำหรับตัวแปร sensitive (`NEXTAUTH_SECRET`, `CRON_SECRET` ได้ค่ายาว 11 ตัว ไม่ใช่ค่าจริง) — ค่าจริงอยู่ใน `.env.vercel-secrets.local`
- **ไฟล์ `.env*` ครอบค่าด้วยเครื่องหมายคำพูด** — เวลา copy รหัสไปกรอกเองอย่าเอา `"` ไปด้วย
- **PromptPay รับเฉพาะเบอร์มือถือ 10 หลัก / เลขประจำตัว 13 หลัก / e-Wallet 15 หลัก** — ใส่เลขบัญชีธนาคารตรง ๆ ไม่ได้
- **เครื่องเจ้าของ RAM น้อย**: `next build` / vitest / Vercel CLI อาจ OOM — เช็ก `Win32_OperatingSystem.FreeVirtualMemory` ก่อน, vitest ใช้ `--maxWorkers=2`, build ในเครื่องให้ใส่ `experimental.cpus: 1` ชั่วคราวใน `next.config.mjs` แล้วเอาออก (ห้าม commit)
- **ตำแหน่งอนิเมชันผูกกับภาพ**: วงแสง BUY/TP/SL (`CHART_MARKERS` ใน `src/components/marketing/feature-art.tsx`) และแถบไฮไลต์ห้อง Discord (`.fa-scan` ใน `motion-art.css`) — เปลี่ยนภาพต้องแก้ตำแหน่ง
- อนิเมชันต้องเคารพ `prefers-reduced-motion`, ปุ่มหยุด (`html[data-motion-paused]`) และมี failsafe ถ้า runtime ไม่เริ่ม — มีเทสต์ใน `tests/motion.test.tsx`

## 11. สถานะปัจจุบันและงานค้าง (22 ต.ค. 2026)

**ใช้งานได้แล้ว:** เว็บบน Render ทั้งหน้าสาธารณะ/สมาชิก/หลังบ้าน, ล็อกอินแอดมิน, security headers, cron/webhook กันด้วย secret, การ์ดฟีเจอร์หน้าแรกใช้ภาพจริง 3 ภาพพร้อมอนิเมชัน

**ยังปิด / ยังไม่ได้ตั้งค่า (เจ้าของต้องทำหรือให้ค่ามา):**
1. **รับชำระเงินยังปิด** — เจ้าของต้องผูกพร้อมเพย์กับบัญชี Bangkok Bank แล้วกรอก PromptPay ID + ชื่อบัญชี "นาย จักรพงษ์ มูลวิชา" ที่ `/admin/settings`, ทดสอบสแกน QR ก่อนติ๊กเปิดรับเงิน
2. **GitHub `vars.APP_URL`** ต้องเป็น `https://goldhybridshot.onrender.com` (ไม่งั้น watchdog/check-expiry ยิงไป Vercel ที่ถูกพักและแจ้งเตือนว่าเว็บล่ม)
3. ยังไม่ได้ตั้ง: `GOOGLE_CLIENT_ID/SECRET` (ปุ่ม Google), `RESEND_API_KEY` + `EMAIL_FROM` (อีเมล/ลืมรหัสผ่าน), `TELEGRAM_*` (บอท + แจ้งเตือนแอดมิน — ตั้งแล้วรัน `npm run telegram:webhook`), `NEXT_PUBLIC_LEGAL_OPERATOR_NAME/ADDRESS` (หน้าข้อกำหนดยังเป็นฉบับร่าง)
4. **สิทธิ์ฟรีผ่าน IB** ปิดอยู่ (`ibClaimsEnabled = false`) — รอลิงก์พาร์ทเนอร์ XM/Exness และยอดฝากขั้นต่ำจากเจ้าของ
5. **หลัง Vercel ปลดพัก 19 พ.ย. 2026**: deployment เก่ายังมี Vercel Cron เรียก check-expiry กับ Neon ตัวเดียวกัน (รันซ้ำ) → ต้องแทนด้วย deployment ที่ redirect `goldhybridshot.vercel.app` → Render อย่างเดียว หรือลบโปรเจกต์
6. แบนเนอร์ "คืน Rebate XM" ที่เจ้าของส่งมายังไม่ได้ใส่ — มี QR/รหัสพันธมิตร/LINE @todaytrader และอ้าง "มูลค่า 50,000฿" (ขัดกฎข้อ 3) รอเจ้าของยืนยัน
7. Render Starter RAM 512MB — build ผ่าน (1–2 นาที) แต่ถ้าโตขึ้นจนล้มให้พิจารณา `output: "standalone"` หรือขยับแพ็กเกจ

**ข้อเสนอที่ยังไม่ได้ทำ (ดู HANDOFF ส่วน IB):** ยืนยันอีเมลตอนสมัคร/อีเมลโบรกเกอร์, ล็อกลิงก์พาร์ทเนอร์ด้วย env, ปิดบังเลขบัญชีใน Audit Log ตามระยะเวลา PDPA
