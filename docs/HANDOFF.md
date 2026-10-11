# เอกสารส่งต่องาน (Project Handoff & Session Log)

## เซสชัน: Phase 2 — หน้าบ้าน, SEO และนโยบาย (Public Site & SEO)
**วันที่:** 11 ตุลาคม 2026  
**สถานะปัจจุบัน:** โค้ด Phase 2 ครบ — เทสต์ผ่าน 58/58, `tsc --noEmit` ผ่าน, `npm run build` ผ่าน, ตรวจบน production server แล้ว, ผ่าน code review (แก้ HIGH ข้อ H2 และ MEDIUM/LOW ส่วนใหญ่แล้ว) — **ยังไม่ commit** และรอเจ้าของตรวจภาพหน้าจอ + ตัดสินใจข้อ 2 ก่อนเริ่ม Phase 3

### 1. สิ่งที่ทำเสร็จแล้ว
1. **แก้เทสต์รันไม่ได้บน Windows:** Windows Application Control บล็อกไฟล์ `@rollup/rollup-win32-x64-msvc/*.node` → เพิ่ม `overrides` ใน `package.json` ให้ใช้ `@rollup/wasm-node@4.63.5` แทน (เลือกเวอร์ชันที่ออกมาแล้ว ~2 สัปดาห์)
2. **หน้าสาธารณะใน route group `src/app/(marketing)/`** ใช้ layout ร่วม (Header + Mobile menu + Footer + skip link) — ทุกหน้าเป็น Static (○)
   - `/` Hero, จุดเด่น (bento), 4 ขั้นตอน, ราคา, FAQ (details/summary), ติดต่อ
   - `/features`, `/guide`, `/terms`, `/privacy` (PDPA), `/refund` — หน้านโยบายแสดงป้าย "ฉบับร่าง" จนกว่าจะตั้ง `legalConfig.isDraft = false`
   - Header ใช้ `useSession` ฝั่ง client (เดิมใช้ `getServerSession` ทำให้หน้าแรกเป็น dynamic)
3. **เนื้อหาแยกเป็นข้อมูล:** `src/config/marketing.ts`, `src/config/legal.ts`, `src/config/payment.ts` (กติกาชำระเงินที่ Phase 3 ต้องใช้ร่วม: 30 นาที, สลิป ≤5MB JPG/PNG/WebP, เตือน D-3), `src/content/{features,guide,legal}.ts`
4. **SEO:** `buildPageMetadata()` (canonical + OG + Twitter + รูปแชร์), `sitemap.xml`, `robots.txt` (กัน /admin /account /checkout /api /auth), JSON-LD Organization/Product/FAQPage (ไม่มี rating/review), OG image สร้างอัตโนมัติ 1200×630
5. **Security headers ทุกเส้นทาง** ผ่าน `next.config.mjs` (X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS, CSP `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`) + ปิด `X-Powered-By`
6. **ฟอนต์:** Prompt (หัวข้อ) + IBM Plex Sans Thai (เนื้อหา) ผ่าน `next/font`
7. **ช่องวางรูป `ImageSlot`:** ใช้ `next/image` + `sizes` เมื่อมี `src`, ถ้ายังไม่มีรูปแสดงกรอบพร้อมสเปก — สเปกทั้งหมดอยู่ที่ `IMAGE_SLOTS` ใน `src/config/marketing.ts`
8. **เทสต์:** `tests/phase2-seo-security.test.ts` + `tests/phase2-marketing-pages.test.tsx` (render หน้าจริงด้วย `react-dom/server`) ครอบคลุมลิงก์ทุกอันชี้หน้าจริง, sitemap/robots, headers, JSON-LD escape, คำต้องห้ามตาม CLAUDE.md ข้อ 3, ความสอดคล้องของกติกาชำระเงิน
9. **ภาพหน้าจอสำหรับตรวจ:** คอมพิวเตอร์ 1440px (หน้าแรก, features, guide, privacy) และมือถือ 390px (หน้าแรก, เมนูเปิด, features, guide) — ส่งให้เจ้าของในแชตแล้ว
10. **แก้ตามผล code review:** robots ใช้ prefix ไม่มี `/` ท้าย (เดิม `/admin/` ไม่ครอบ `/admin`), หน้านโยบายฉบับร่างเป็น `noindex` และไม่อยู่ใน sitemap, `resolveSiteUrl()` ทำให้ build บน Vercel Production ล้มถ้า `NEXT_PUBLIC_APP_URL` ว่าง/เป็น localhost, คู่มือไม่อ้างถึงปุ่ม Google และช่องกรอก Discord ID ที่ยังไม่มีจริง, เมนูมือถือซ่อน "เข้าสู่ระบบ" เมื่อล็อกอินแล้ว + คืน focus เมื่อกด Esc, ชื่อแบรนด์สั้นลงบนจอแคบ, คอนทราสต์ข้อความเตือนความเสี่ยง, คำเตือนความเสี่ยงอยู่ติดส่วนราคา, aria-label ปุ่มแพ็กเกจขึ้นต้นด้วยข้อความที่มองเห็น, ลบ "ราคาปกติ" (sr-only) ที่อ้างว่าราคาขีดฆ่าเป็นราคาจริง

### 2. สิ่งที่ค้างอยู่ / ต้องให้เจ้าของตัดสินใจ
- **ยืนยันนโยบาย** ใน `src/config/legal.ts`: ระยะขอคืนเงิน 7 วัน, โอนคืนภายใน 7 วันทำการ, ระยะเก็บข้อมูล, อายุขั้นต่ำ 20 ปี, เงื่อนไขล็อกราคา Early Bird → แล้วตั้ง env `NEXT_PUBLIC_LEGAL_OPERATOR_NAME` / `NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS` และ `isDraft = false` (แนะนำให้ที่ปรึกษากฎหมายตรวจ รวมถึงประเด็นใบอนุญาต ก.ล.ต. สำหรับบริการสัญญาณ)
- **[HIGH จาก review — ห้าม deploy จนกว่าจะแก้] ข้อความราคาใน `src/config/plans.ts`:** ราคาขีดฆ่าต้องเป็นราคาที่เคยขายจริง, "ประหยัด 37%" คิดจากราคาขีดฆ่า (เทียบซื้อรายเดือน 3 ครั้งประหยัดจริง ~16%), "สร้างผลตอบแทนที่สม่ำเสมอ" เป็นคำอ้างผลตอบแทน, "ยอดนิยมสูงสุด" ยังไม่มีข้อมูลยอดขาย, "ตอบกลับภายใน 15 นาที" / Live Session / Backtest Vault ต้องมีจริง — หลังแก้ให้เพิ่ม `SITE_PLANS` + `PROMO_SETTINGS` เข้าเทสต์คำต้องห้าม (`tests/phase2-seo-security.test.ts`) และเพิ่ม pattern เช่น `ผลตอบแทน`, `ยอดนิยม`, `ภายใน \d+ นาที`
- **ช่องวางรูปแสดงสเปกให้ผู้เยี่ยมชมเห็น** — ต้องใส่รูปจริงหรือซ่อนก่อนเปิดเว็บจริง
- **ปุ่มเลือกแพ็กเกจส่ง `?plan=` ไปหน้าสมัคร แต่หน้าสมัครยังไม่อ่านค่า** — ต่อให้ถึง checkout ใน Phase 3
- **Telegram มี 2 ค่า:** `siteConfig.contact.telegram` (@peenoey_admin) กับ `NEXT_PUBLIC_SUPPORT_TELEGRAM` (peenoey_support ใช้ในหน้า account) — ควรเหลือแหล่งเดียว
- **เทสต์เมนูมือถือ** ตรวจได้แค่สถานะปิด (vitest ไม่มี DOM) — การเปิด/ปิดด้วย Esc ตรวจด้วยเบราว์เซอร์จริงแล้ว ควรเพิ่ม E2E (Playwright) ในอนาคต
- **rollup override เป็นแบบ global** — ถ้าแก้นโยบาย Application Control ของเครื่องได้ ให้ลบ `overrides` ออก
- **ช่องทางติดต่อใน `siteConfig.contact`** (support@peenoey.com, LINE @peenoey, Telegram @peenoey_admin) ต้องยืนยันว่ามีจริง
- **รูปจริง:** ตามสเปกใน `IMAGE_SLOTS` แล้วใส่ `src` ให้ `ImageSlot`; OG image ภาษาไทยให้วางไฟล์ `src/app/opengraph-image.png` แทน `.tsx`
- **CSP แบบ nonce สำหรับ script-src** ยังไม่ได้ทำ (ตอนนี้คุมเฉพาะ frame-ancestors/base-uri/object-src)
- **Secret สำรองที่ฝังในโค้ด** (`src/lib/auth.ts`, `src/middleware.ts` ใช้ค่า fallback เมื่อไม่มี `NEXTAUTH_SECRET`) — แยกเป็นงานต่างหากแล้ว ต้องแก้ก่อนขึ้น production
- **คู่มือ `/guide`** อธิบายขั้นตอนชำระเงิน/แนบสลิป/รับสิทธิ์ตาม PLAN — ต้องตรวจชื่อปุ่ม/เมนูให้ตรงเมื่อสร้าง Phase 3–4 เสร็จ

### 3. กับดักทางเทคนิคที่พบ
1. **Rollup native ถูก Windows บล็อก** → ใช้ WASM ผ่าน `overrides` (อย่าลบออกจนกว่าจะแก้ที่นโยบายเครื่อง)
2. **`@vercel/og` แบบ Node runtime ใน Next 14 พังบน Windows** (`TypeError: Invalid URL` ตอน prerender `/opengraph-image`) → ตั้ง `runtime = "edge"`
3. **หน้าที่กำหนด `openGraph` เองจะทับรูป OG จากไฟล์ของ root** → `buildPageMetadata()` ต้องใส่ `images` เองทุกครั้ง (มีเทสต์กันแล้ว)
4. **เบราว์เซอร์ตัดคำไทยผิดในคำทับศัพท์** (เช่น "คอม|มูนิตี้") → หัวข้อใช้ `<Phrases>` ตัดบรรทัดเฉพาะช่องว่างระหว่างวลี ให้เว้นวรรคระหว่างวลีในข้อความหัวข้อ; อย่าใส่ letter-spacing กับอักษรไทย
5. **`X-Frame-Options: DENY` กันการฝังหน้าใน iframe ทุกหน้า** — ถ้าอนาคตต้องฝังหน้าใด ต้องแยก header เฉพาะเส้นทางนั้น
6. **`next build` กับ `next dev` ใช้โฟลเดอร์ `.next` ร่วมกัน** — หยุด dev server ก่อน build
7. **Build ล้มด้วย `Committing semi space failed ... heap out of memory`** ตอน Generating static pages = commit memory ของ Windows เต็ม (เคยใช้ 37.5/38.9 GB) ไม่ใช่บั๊กโค้ด → ปิดโปรแกรม/แท็บ Chrome ที่ไม่ใช้ แล้ว build ใหม่
8. **`next build` ไม่ type-check ไฟล์ `*.test.*`** — ให้รัน `npx tsc --noEmit` แยกเสมอ
9. **"✓ Compiled successfully" ไม่ได้แปลว่า build เสร็จ** — ต้องดูว่าถึง "Generating static pages (N/N)" และ exit code เป็น 0

### 4. ขั้นตอนถัดไป
1. เจ้าของตรวจภาพหน้าจอ + ตัดสินใจข้อ 2 → commit Phase 2
2. Phase 3: Checkout (`/checkout/[planId]`, `/checkout/order/[orderId]`), PromptPay QR, แนบสลิป + Slip Hash — ใช้ `PAYMENT_RULES` จาก `src/config/payment.ts` และต้องมี Integration Test กับ PostgreSQL จริง

---

## เซสชัน: Phase 1 — โครงสร้างโปรเจกต์ + ระบบสมาชิกและความปลอดภัย (Foundation & Auth)
**วันที่:** 10 ตุลาคม 2026  
**สถานะปัจจุบัน:** เสร็จสิ้น Phase 1 เรียบร้อยแล้ว (ทดสอบ Test ผ่าน 100% และ Build ผ่าน 100%) รออนุมัติก่อนเริ่ม Phase 2

---

### 1. สิ่งที่ทำเสร็จแล้วในเซสชันนี้ (Phase 1)
1. **การติดตั้งและโครงสร้างโปรเจกต์ (Next.js 14 App Router + TypeScript + Tailwind CSS):**
   - ตั้งค่า [package.json](file:///e:/Webpeenoey/package.json), [tsconfig.json](file:///e:/Webpeenoey/tsconfig.json), [tailwind.config.ts](file:///e:/Webpeenoey/tailwind.config.ts), [postcss.config.mjs](file:///e:/Webpeenoey/postcss.config.mjs)
   - วางระบบดีไซน์ Luxury Dark Mode พร้อมเฉดสีทองพรีเมียม (#F59E0B) และเขียวมรกต (#10B981) ใน [src/app/globals.css](file:///e:/Webpeenoey/src/app/globals.css)
2. **Prisma Database Schema ครบถ้วนตามสเปก ([prisma/schema.prisma](file:///e:/Webpeenoey/prisma/schema.prisma)):**
   - โมเดลหลัก: `User`, `Plan`, `Order`, `Payment`, `Subscription`, `Refund`, `AuditLog`, `RateLimit`, `SystemSetting`
   - รองรับ NextAuth: `Account`, `Session`, `VerificationToken`, `PasswordResetToken`
   - รัน `prisma generate` สร้าง Prisma Client สำเร็จ
3. **ระบบราคาและแพ็กเกจใน Config ไฟล์เดียว ([src/config/plans.ts](file:///e:/Webpeenoey/src/config/plans.ts)):**
   - รวม 4 แพ็กเกจหลัก: 1 เดือน (990 บาท), 3 เดือน (2,490 บาท), 6 เดือน (4,490 บาท), 12 เดือน (7,990 บาท)
   - กำหนดโควต้า Early Bird 300 ท่านแรก พร้อมสิทธิ์ `lockPriceForLife`
4. **ระบบความปลอดภัยและการเข้ารหัส ([src/lib/security.ts](file:///e:/Webpeenoey/src/lib/security.ts)):**
   - แฮชรหัสผ่านด้วย `bcryptjs` (Salt 12)
   - คำนวณ SHA-256 Hash สำหรับสลิปโอนเงินธนาคารเพื่อป้องกันการใช้สลิปซ้ำ
   - สร้าง Secure Token สำหรับการรีเซ็ตรหัสผ่าน
5. **ระบบ Rate Limiter ป้องกันการโจมตี ([src/lib/rate-limit.ts](file:///e:/Webpeenoey/src/lib/rate-limit.ts)):**
   - ป้องกัน Brute-force สำหรับการล็อกอิน, การสมัครสมาชิก, และการขอรีเซ็ตรหัสผ่าน
   - รองรับทั้ง Database Rate Limit และ Memory fallback
6. **ระบบยืนยันตัวตน Auth.js / NextAuth ([src/lib/auth.ts](file:///e:/Webpeenoey/src/lib/auth.ts)):**
   - ล็อกอินด้วย Credentials (อีเมล + รหัสผ่าน) และรองรับ Google OAuth
   - ระบบลงทะเบียนสมาชิก ([src/app/api/auth/register/route.ts](file:///e:/Webpeenoey/src/app/api/auth/register/route.ts)) ตรวจจับ Admin อัตโนมัติจาก `ADMIN_EMAIL`
   - ระบบลืมรหัสผ่านทางอีเมล ([src/app/api/auth/forgot-password/route.ts](file:///e:/Webpeenoey/src/app/api/auth/forgot-password/route.ts)) และตั้งรหัสผ่านใหม่ ([src/app/api/auth/reset-password/route.ts](file:///e:/Webpeenoey/src/app/api/auth/reset-password/route.ts))
7. **การแยก Layout หน้าสมาชิกและหลังบ้านแอดมินออกจากกันอย่างเด็ดขาด:**
   - **Account Layout ([src/app/(account)/layout.tsx](file:///e:/Webpeenoey/src/app/(account)/layout.tsx)):** สำหรับบทบาท `USER` พร้อมหน้า Dashboard แสดงสถานะ Subscription, TradingView, Telegram และประวัติออเดอร์
   - **Admin Layout ([src/app/(admin)/layout.tsx](file:///e:/Webpeenoey/src/app/(admin)/layout.tsx)):** สำหรับบทบาท `ADMIN` เท่านั้น พร้อม Command Sidebar, ตรวจจับสิทธิ์เข้มงวด, และ Dashboard รวมยอดขาย
8. **Security Headers ป้องกัน Clickjacking ([src/middleware.ts](file:///e:/Webpeenoey/src/middleware.ts)):**
   - ตั้งค่า `X-Frame-Options: DENY` บนทุกหน้าเพื่อป้องกัน Clickjacking
   - ตั้งค่า `X-Content-Type-Options: nosniff`, `Referrer-Policy`, และ Role Guards
9. **ชุดทดสอบและผลการคอมไพล์:**
   - [tests/phase1-auth-security.test.ts](file:///e:/Webpeenoey/tests/phase1-auth-security.test.ts) รันผ่านครบ 10/10 เทสต์
   - `npm run build` รันผ่านสมบูรณ์ 100% ทั้ง 13 เส้นทาง (Routes)

---

### 2. สิ่งที่ค้างอยู่และต้องทำในเฟสถัดไป (Phase 2 — หน้าบ้าน & SEO)
- หน้าแรก (Landing Page) ฉบับสมบูรณ์: Hero, จุดเด่นฟีเจอร์, วิธีใช้ 4 ขั้นตอน, ตารางราคา, FAQ, ช่องทางติดต่อ
- หน้ารายละเอียดฟีเจอร์ (`/features`), คู่มือการใช้งาน (`/guide`)
- หน้านโยบายทางกฎหมาย: `/terms`, `/privacy`, `/refund`
- ระบบ Mobile-first รองรับทุกขนาดหน้าจอ
- การจัดเตรียมช่องวางรูปภาพพร้อมสเปกขนาดตามเกณฑ์ SEO / OG Image
- ถ่ายภาพหน้าจอทั้งมือถือและคอมพิวเตอร์ให้ตรวจสอบก่อนไปเฟส 3

---

### 3. กับดักและข้อควรระวังทางเทคนิคที่พบ (Technical Pitfalls & Solved Gotchas)
1. **Next.js 14 CSR Bailout with `useSearchParams`:**
   - หน้ารับ Query String เช่น `/auth/signin` และ `/auth/reset-password` ต้องหุ้มด้วย `<Suspense>` เสมอ มิฉะนั้น `next build` จะติด Error Prerender
   - ได้แก้ไขด้วยการแยก `SignInContent` และ `ResetPasswordContent` ภายใต้ `<Suspense>` เรียบร้อยแล้ว
2. **Prisma vs Vitest Environment:**
   - เมื่อรัน Vitest ในสภาพแวดล้อมที่ยังไม่มีค่า `DATABASE_URL` จริง ระบบ Rate Limiter ได้ถูกปรับให้ตรวจสอบและใช้งาน Memory Store อัตโนมัติ ทำให้เทสต์รันได้อย่างราบรื่นและรวดเร็ว
