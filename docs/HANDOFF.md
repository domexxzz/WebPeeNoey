# เอกสารส่งต่องาน (Project Handoff & Session Log)

## เซสชัน: มุมโค้งเป็นมิตร + กราฟจริงจาก TradingView
**วันที่:** 13 ตุลาคม 2026  
**สถานะ:** unit 208/208 (เพิ่ม `tests/live-chart.test.tsx`), `tsc` ผ่าน, `next build` ผ่าน (หน้าแรก First Load JS 110 kB) — ตรวจบน dev server: กราฟ TradingView โหลดขึ้นจริงทั้งจอแคบและจอ 1280px (BTC/USDT 1 ชม. ภาษาไทย) และคำบรรยายสลับเป็นของกราฟจริง, ไม่มี hydration error, ไม่มี error ใน console — **deploy ขึ้น production แล้ว** (commit `18a9458`): บนเว็บจริงกราฟ TradingView โหลดขึ้น คำบรรยาย + ลิงก์ระบุที่มาถูกต้อง, ไม่มี error ใน console, หน้าที่ต้องล็อกอินยังเด้งไป signin, security headers ครบ — หน้าสมาชิก/แอดมินยังไม่ได้ดูหน้าจอจริงหลังล็อกอิน (ให้เจ้าของตรวจ)

### 1. มุมโค้ง + เส้นนุ่ม (เจ้าของเลือกระดับ "นุ่มพอดี")
- token `line` (tailwind.config.ts): ขาว 60% → 16% (`line-soft` 9%, เพิ่ม `line-strong` 32% สำหรับตอนชี้)
- การ์ด/กล่องใหญ่ `rounded-2xl` (16px, ตัวที่มีแถบ/ตารางข้างในใส่ `overflow-hidden`), ปุ่ม/ช่องกรอก/กล่องไอคอน `rounded-xl` (12px), ป้าย/จุด `rounded-full` — ทั้งหน้าบ้าน สมาชิก ชำระเงิน auth และหลังบ้าน
- เมนูบน (หน้าบ้าน/สมาชิก/auth) และเมนูข้างของแอดมิน: เลิกช่องกรอบเส้น เป็นปุ่มแคปซูล/มุมโค้ง
- FAQ เป็นการ์ดแยกข้อ, การ์ดขั้นตอนเลิกตัดเฉียง, CTA ใน hero แยกเป็นปุ่มเดี่ยว, เงาแข็งแบบเลื่อนเหลี่ยม → เงาฟุ้ง, ภาพวาด SVG มุมโค้ง
- แก้: ตัวเลขขั้นตอน (01, 02, 04) ถูกตัดขอบขวา — mask ใช้ `clip-path` ตัดเฉพาะขอบล่างแทน `overflow:hidden`

### 2. กราฟจริงจาก TradingView ใน hero (`src/components/marketing/live-chart.tsx`)
- widget ทางการ "Advanced Real-Time Chart" — ค่าตั้งอยู่ที่ `TRADINGVIEW_CHART` ใน `src/config/marketing.ts` (เปลี่ยนสัญลักษณ์ได้ ตอนนี้ทองคำ `OANDA:XAUUSD` กรอบ 4 ชม. (`interval: "240"`) — เดิม `BINANCE:BTCUSDT`)
- โหลดสคริปต์ของ TradingView หลังหน้าโหลดเสร็จ + เห็นบนจอ + เบราว์เซอร์ว่าง (ไม่ถ่วง LCP) — ระหว่างรอ/โหลดไม่ได้ (เช่นตัวบล็อกโฆษณา) แสดงกราฟวาดและคำบรรยาย "ภาพประกอบ" ตามเดิม, หมดเวลา 15 วินาทีแล้วคงภาพวาดไว้
- คำบรรยายกราฟจริงบอกชัดว่า "ไม่ได้แสดงสัญญาณของ Peenoey Indicator และไม่ใช่คำแนะนำการลงทุน" (กติกาข้อ 3) + ลิงก์ระบุที่มา TradingView (เงื่อนไขการฝัง widget — ห้ามลบ)
- จอสัมผัส: ปิดการลาก/ซูมกราฟ (ไม่แย่งการเลื่อนหน้า), กรอบสัดส่วนคงที่ 4:3 / 16:10 (ไม่มี layout shift)
- นโยบายความเป็นส่วนตัว (ข้อ 8 คุกกี้) เพิ่มว่า TradingView อาจได้รับ IP/ใช้คุกกี้ของตน — **ฉบับร่าง ควรให้ฝ่ายกฎหมายตรวจ**
- เลิกการ์ดเอียงตามเมาส์ที่ hero (กราฟเป็น iframe รับเมาส์เอง)

### 3. กับดัก
- **`Math.sin` ของ Node กับเบราว์เซอร์ต่างกันที่ทศนิยมตำแหน่งที่ 14** → HeroChart (ตอนนี้ render ใน client component ด้วย) เกิด hydration mismatch — ปัดทุกพิกัดเป็นทศนิยม 2 ตำแหน่ง มีเทสต์จำลอง `Math.sin` ต่างกันแล้วผลต้องเท่ากัน
- สคริปต์ embed ของ TradingView อ่านค่าตั้งจากเนื้อหาแท็ก `<script>` ของตัวเอง และใส่ iframe ใน `.tradingview-widget-container__widget` ที่อยู่ใน parent ของสคริปต์ — ต้องคงโครงนี้ไว้

---

## เซสชัน: อนิเมชันหน้าบ้าน (Motion)
**วันที่:** 13 ตุลาคม 2026  
**สถานะ:** unit 199/199 (เพิ่ม `tests/motion.test.tsx` 26 เทสต์), `tsc` ผ่าน, `next build` ผ่าน (19/19 หน้า, First Load JS หน้าแรก 106 kB, CSS รวม 12 kB gzip) — ตรวจบน dev server ในเบราว์เซอร์: เป้าหมาย reveal ครบ 46 ชิ้นแสดงผลหลังเลื่อนผ่าน, header ซ่อนตอนเลื่อนลง/โผล่ตอนเลื่อนขึ้น/โผล่เมื่อโฟกัสเข้า, ปุ่มหยุดภาพเคลื่อนไหวหยุดเฉพาะอนิเมชันวนและจำค่าได้, กันพลาดแสดงเนื้อหาเองใน 2.5 วินาทีถ้าสคริปต์ไม่ทำงาน, จอ 375px ไม่ล้นแนวนอน, ไม่มี error ใน console — ผ่าน code review (react-reviewer) และแก้ทุกข้อแล้ว — **deploy ขึ้น production แล้ว** (commit `0e94f7c` + แก้ล้นจอ `cce6f89`): เว็บจริงโหลด runtime/CSS ครบ ไม่มี error ใน console, หน้าที่ต้องล็อกอินยังเด้งไป signin, security headers ครบ, จอกว้าง 640px ไม่ล้นแนวนอน

**แก้ตามผลรีวิว:** header ที่ซ่อนอยู่โผล่เมื่อโฟกัสคีย์บอร์ดเข้า (WCAG 2.4.11), เผยเนื้อหาทันทีเมื่อโฟกัสเข้าไป, runtime ที่เริ่มช้ากว่ากันพลาดไม่ทำให้เนื้อหาหายแล้วกลับมา, ย้าย `--scroll` จาก `<html>` ไปที่แถบ (ไม่คำนวณสไตล์ทั้งหน้าทุกเฟรม), หยุดอนิเมชันวนเมื่ออยู่นอกจอ (`[data-loop]`), เพิ่มปุ่มหยุด/เล่นภาพเคลื่อนไหว `MotionToggle` มุมซ้ายล่าง (WCAG 2.2.2), เปลี่ยนหน้าแบบเลื่อนอย่างเดียว + หัวข้อ hero เริ่มที่ opacity 0.2 (ไม่ถ่วง LCP), เส้นแสงการ์ดราคาหมุนด้วย `rotate` แทน `@property`, การ์ดเอียงมี transform เฉพาะตอนชี้ (ตัวอักษรคม), วัดขนาดกล่องครั้งเดียวต่อการชี้ (ไม่สั่นที่ขอบ), QR ขนาดเท่าเดิม (กรอบมุมอยู่นอก QR), ทรงเฉียงการ์ดขั้นตอนไม่หายในโหมดลดการเคลื่อนไหว, MutationObserver ตรวจเฉพาะโหนดใหม่

### 1. โครงสร้าง (ไม่เพิ่ม dependency)
- `src/components/motion/motion-runtime.tsx` (client ตัวเดียว ติดใน layout หน้าบ้าน): `[data-reveal]` → ใส่ `data-inview` ด้วย IntersectionObserver, `[data-tilt]` / `[data-magnetic]` / `[data-spotlight]` → ตั้ง `--px` `--py` `--spot-x` `--spot-y` ตามเมาส์ (เฉพาะอุปกรณ์ที่มีเมาส์), `<html>` → `--scroll`, `data-scrolled`, `data-header-hidden`
- `src/lib/motion.ts`: ฟังก์ชันคำนวณล้วน (`pointerRatio`, `scrollProgress`, `headerShouldHide`, `staggerStyle`, `indexStyle`)
- `src/styles/motion.css` (reveal, เล่นตอนโหลด, แถบความคืบหน้า, header, เอฟเฟกต์เมาส์, ปุ่มแสงวิ่ง) + `src/styles/motion-art.css` (กราฟ hero, ภาพฟีเจอร์, เส้นแสงการ์ดราคา, ขั้นตอน, FAQ, กรอบ QR, โลโก้ท้ายหน้า)
- component หน้าบ้านยังเป็น server component — ใส่แค่ data attribute / class / ตัวแปร CSS
- `template.tsx` ใน `(marketing)` และ `(account)`: เลื่อนเข้าเมื่อเปลี่ยนหน้า
- `src/components/motion/motion-toggle.tsx`: ปุ่มหยุด/เล่นภาพเคลื่อนไหว (หน้าบ้าน, auth, account) — ตั้ง `html[data-motion-paused]` และจำค่าใน localStorage `peenoey-motion`

### 2. กติกาที่ต้องรักษา
- ขยับเฉพาะ opacity / translate / scale / rotate / transform / clip-path / filter (มีเทสต์ตรวจ keyframes)
- สถานะซ่อนก่อน reveal อยู่ใต้ `@media (scripting: enabled)` + กันพลาด 2.5 วินาที — ปิด JS แล้วยังเห็นเนื้อหาครบ
- `prefers-reduced-motion: reduce` → ปิดอนิเมชันทั้งหมดในขอบเขต `.mx-scope` (หน้าบ้าน, auth, account) และแสดงเนื้อหาทันที
- ส่วนบนสุดของหน้า (hero, หัวเพจย่อย, auth) เล่นด้วย CSS ตอนโหลด ไม่รอ JS — ไม่ถ่วง LCP
- ภาพประกอบทั้งหมด aria-hidden ไม่มีตัวเลข/ข้อความ (กติกาข้อ 3)
- QR ชำระเงิน: ห้ามมีอะไรทับตัว QR — ใช้กรอบมุมด้านนอก (`.mx-qr`) เท่านั้น เพราะลูกค้าแคปหน้าจอ QR ไปสแกน
- หลังบ้าน (`/admin`) ไม่มีอนิเมชัน (CSP แบบ nonce เข้มงวด และควรนิ่ง)

### 3. กับดักที่เจอ
- **Chrome นับ `clip-path` ของตัวเป้าหมายเองใน IntersectionObserver** — ถ้าซ่อนด้วย `clip-path: inset(0 100% 0 0)` จะไม่มีวัน "เห็น" → reveal แบบ clip ซ่อนด้วย opacity แล้วค่อยเล่นคีย์เฟรมตัดหลังเห็นแล้ว
- ใส่ reveal (`translate`) กับ transform ของ Tailwind (`rotate-2`, `lg:translate-y-6`) ในชิ้นเดียวกันได้ เพราะเป็นคนละ property — แต่ `transition` ชนกัน: ให้ reveal อยู่บน wrapper แยกจากชิ้นที่มี hover transition
- เบราว์เซอร์ในแอป Claude หยุดวาดเฟรมเมื่อหน้าต่างไม่อยู่ด้านหน้า (0 fps) → transition/IntersectionObserver ไม่เดิน และ `focus()` ไม่ปล่อย event `focusin` (หน้าไม่มีโฟกัส) — ทดสอบ handler ด้วยการ dispatch event เอง
- ชิ้นที่ reveal แบบเลื่อนจากขวา (`data-reveal="right"`) ล้นขอบขวาจอก่อนเผย → ส่วนที่ครอบต้องมี `overflow-x-clip` (ใช้ clip ไม่ใช่ hidden เพื่อไม่ให้ sticky เสีย) — เจอบนเว็บจริงที่ส่วนขั้นตอน
- อนิเมชันวนใหม่ทุกตัวต้องเพิ่มใน selector ของ `html[data-motion-paused]` (motion.css) และครอบด้วย `[data-loop]` เพื่อหยุดเมื่ออยู่นอกจอ

---

## เซสชัน: Deploy ขึ้น Vercel (production)
**วันที่:** 12 ตุลาคม 2026  
**สถานะ:** ออนไลน์แล้วที่ **https://webpeenoey.vercel.app** (commit `14d5929`) — build บน Vercel ผ่าน (19/19 หน้า), smoke test บน production ผ่าน: หน้า public + auth ได้ 200, หน้าที่ต้องล็อกอินเด้งไป signin (307), `X-Frame-Options: DENY` / nosniff / HSTS ครบ, canonical เป็น URL จริง, cron / watchdog / webhook ไม่มี secret ได้ 401, console เบราว์เซอร์ไม่มี error — เจ้าของล็อกอินแอดมินบน production ได้แล้ว (ฟังก์ชันต่อ Neon ผ่าน pooled URL ได้จริง), runtime log 50 รายการล่าสุดไม่มี error/5xx
- อีเมลแอดมินเปลี่ยนเป็น `dometeenlek@gmail.com` ทั้ง production (DB + env `ADMIN_EMAIL` บน Vercel) และบนเครื่อง (DB + `.env`) — มี AuditLog `ADMIN_EMAIL_CHANGE` ทั้งสองที่

### 1. ที่ตั้งค่าแล้ว
- Vercel project `webpeenoey` (ทีม `domezzxxs-projects`, Hobby) — ฟังก์ชันรันที่ `sin1` (สิงคโปร์), `vercel.json` มี `framework: nextjs` (โปรเจกต์สร้างจาก CLI จึงไม่ได้ตรวจเฟรมเวิร์กให้), `vercel-build` = `prisma generate && next build`
- ฐานข้อมูล: Neon (Vercel Marketplace, แพ็กเกจฟรี) ชื่อ `webpeenoey-db` ภูมิภาค `ap-southeast-1` — env `DATABASE_URL` (pooled) / `DATABASE_URL_UNPOOLED` (direct, ใช้ตอน migrate) ถูกเพิ่มให้อัตโนมัติ
- migrate ครบ 7 รายการ + seed แล้ว: แพ็กเกจ 4 รายการ, ระบบรับชำระเงิน**ปิดไว้** (ยังไม่ได้ตั้ง PromptPay), บัญชีแอดมิน = `ADMIN_EMAIL`
- env production: `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` = https://webpeenoey.vercel.app, `NEXT_PUBLIC_SITE_*`, `NEXT_PUBLIC_SUPPORT_TELEGRAM`, `ADMIN_EMAIL`, `NEXTAUTH_SECRET` + `CRON_SECRET` (สร้างใหม่, Sensitive — อ่านกลับจาก Vercel ไม่ได้)
- ค่าความลับของ production (รหัสผ่านแอดมินครั้งแรก, `CRON_SECRET`) อยู่ในไฟล์ `.env.vercel-secrets.local` บนเครื่อง dev (gitignored) — **ย้ายเข้า password manager แล้วลบไฟล์**

### 2. วิธี deploy รอบถัดไป (จนกว่าจะแก้ข้อ 3)
- Deploy จากสำเนาโค้ดที่ commit แล้ว (ไม่มี `.git`): `git archive HEAD` → แตกไฟล์ในโฟลเดอร์ชั่วคราว → คัดลอก `.vercel/project.json` → `vercel deploy --prod --cwd <โฟลเดอร์นั้น>`
- ถ้า deploy จากโฟลเดอร์โปรเจกต์ตรง ๆ Vercel จะ **BLOCKED**: "commit author doesn't have permission" — อีเมลผู้ commit ใน git ผูกกับบัญชี Vercel อีกบัญชี ไม่ใช่ `domezzxx` (Hobby ไม่รองรับหลายคน)
- migration ใหม่: `vercel env pull <ไฟล์นอกโปรเจกต์> --environment production` แล้วรัน `prisma migrate deploy` ด้วย `DATABASE_URL_UNPOOLED` — ห้ามดึง env ไว้เป็น `.env.production.local` ในโปรเจกต์ (จะทับค่าตอน build/start บนเครื่อง)

### 3. กับดักที่เจอ
- `vercel link` เพิ่ม `.env*` ใน `.gitignore` (จะ ignore `.env.example` ด้วย) และสร้าง `.env.local` — คืนค่าแล้ว
- `vercel integration add neon` ดาวน์โหลด `.agents/` + `skills-lock.json` เข้าโปรเจกต์ — ลบแล้ว
- `vercel git connect` ล้มเหลว (Vercel ยังเข้าถึง repo `domexxzz/WebPeeNoey` ไม่ได้) จึงยังไม่มี auto-deploy ตอน push
- เครื่อง dev หน่วยความจำไม่พอ → Vercel CLI ล้มด้วย `Fatal process out of memory` ต้องปิดโปรแกรมอื่นก่อน

### 4. ขั้นตอนถัดไป
1. เจ้าของล็อกอินแอดมินบน production → ตั้งบัญชี PromptPay ที่ `/admin/settings` แล้วเปิดรับชำระเงิน → ตรวจ `/admin/status`
2. ตั้ง `RESEND_API_KEY` + `EMAIL_FROM` (ถ้าไม่มี ส่งอีเมลใบเสร็จ / ลืมรหัสผ่าน / เตือนหมดอายุไม่ได้)
3. บอท Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` แล้วรัน `npm run telegram:webhook`
4. GitHub Actions secrets (watchdog / backup) ตามหัวข้อ Phase 5 — `CRON_SECRET` ใช้ค่าเดียวกับ Vercel, `vars.APP_URL` = https://webpeenoey.vercel.app
5. แก้ให้ deploy อัตโนมัติจาก GitHub: เพิ่มอีเมลที่ใช้ commit เข้าบัญชี Vercel `domezzxx` (Account Settings → Emails) หรือเชื่อม GitHub `domexxzz` กับบัญชีนี้ แล้วรัน `vercel git connect` ใหม่
6. ผูกโดเมน `peenoey.com` เมื่อพร้อม → เปลี่ยน `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` แล้ว deploy ใหม่

---

## เซสชัน: รีดีไซน์หน้าบ้านตามสไตล์ "Finance App Landing Page (Bold)"
**วันที่:** 12 ตุลาคม 2026  
**สถานะ:** ทั้งเว็บใช้ธีมเดียวกันแล้ว (หน้าบ้าน, สมาชิก/ชำระเงิน, auth, หลังบ้าน) — unit 173/173, Integration กับ PostgreSQL จริง 113/113, `tsc` ผ่าน, `next build` ผ่าน (19/19 หน้า), smoke test บน production build ผ่าน: หน้าสาธารณะ + auth 10 หน้าได้ 200, สมาชิกเปิด /account /account/orders /checkout/monthly ได้ (500 ที่เคยเจอบน dev server เกิดจากหน่วยความจำหมด ไม่ใช่บั๊ก — บน production ได้ 200), แอดมินเปิดได้ทั้ง 6 หน้า + CSP nonce/`X-Frame-Options: DENY` ครบ, cron/watchdog/webhook Telegram ผ่าน, ไม่มี error ใน log เซิร์ฟเวอร์และ console เบราว์เซอร์ — ตรวจหน้าตาจาก HTML ที่ render จริง (มือถือ 375px / จอ 1280px ไม่มีเนื้อหาล้นจอ) และบน production server — ยังไม่ commit

- ต้นแบบ: Wix template "Finance App Landing Page (Bold)" (https://www.wix.com/website-template/view/html/3977) — ใช้แนวทางการออกแบบ (โครงเส้นกรอบ, ตัวอักษรหนาขนาดใหญ่, เขียวสด) ไม่ได้คัดลอกรูปหรือข้อความ
- โทเคน (`tailwind.config.ts`): `ink` #111312, `signal` #6EEA6E, `line` (ขาว 60%/14%), ฟอนต์ `font-display` (Familjen Grotesk → Anuphan สำหรับไทย), `font-thai` (Anuphan), animation `marquee` (หยุดเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว) — ฟอนต์โหลดเฉพาะหน้าบ้าน (`src/components/marketing/fonts.ts`)
- หน้าแรก: header แบบช่องกรอบ, Hero (หัวข้อใหญ่ + ภาพกราฟ SVG วาดเอง + แถบตัวอักษรเลื่อน + แถบ CTA), จุดเด่น (แถวภาพเอียง + กล่องไอคอนซ้อน), ขั้นตอน 4 ข้อบนพื้นเขียว (แทนส่วนรีวิวของต้นแบบ — ตามกติกาข้อ 3), ราคา (กล่องเส้นเหลื่อม), FAQ, ปิดท้าย/ติดต่อ (ภาพใหญ่ + กล่องดำซ้อน), footer แบบกล่อง
- หน้า features / guide / terms / privacy / refund เปลี่ยนเป็นธีมเดียวกัน (มุมเหลี่ยม เขียวสัญญาณ)
- ภาพกราฟทั้งหมดเป็นภาพประกอบ ไม่มีตัวเลข/ราคา/กำไร และมีคำบรรยาย "ไม่ใช่ผลการเทรดจริง"
- **โซนสมาชิก + ชำระเงิน** (`/account`, `/account/orders`, `/checkout/*`) เปลี่ยนเป็นธีมเดียวกันแล้ว: header แบบช่องกรอบ (มือถือมีแถบเมนู 3 ช่องใต้ header — เดิมมือถือไม่มีเมนู), หัวหน้า `AccountPageHeader`, การ์ดสถานะสมาชิกแบบกล่อง, ป้ายสถานะคำสั่งซื้อเหลี่ยม
  - สีอำพันคงไว้เฉพาะความหมาย "เตือน/รอ/นับถอยหลัง" ส่วนสำเร็จใช้เขียวสัญญาณ
  - แก้: เมนู "สิทธิ์การใช้งาน" เดิมลิงก์ไป `/account/subscriptions` ที่ไม่มีอยู่ (404) → เปลี่ยนเป็น "แพ็กเกจ / ต่ออายุ"; คำสั่งซื้อล่าสุดใช้ `OrderStatusBadge` จริง (เดิมแสดงคืนเงิน/หมดอายุเป็น "ปฏิเสธ/ยกเลิก") และกดเข้าแต่ละออเดอร์ได้; ลิงก์กลุ่ม Telegram ไม่ใช้ค่า fallback ที่ฮาร์ดโค้ดแล้ว
- **หน้า auth** (`/auth/signin|signup|forgot-password|reset-password`): layout ใหม่ `src/app/auth/layout.tsx` (header กรอบ + แผงแบรนด์ซ้ายบนจอใหญ่ + ฟอร์มกรอบเส้น); แก้ a11y: ผูก `label` กับ `input` ทุกช่อง (`htmlFor`/`id`) และข้อความผิดพลาดมี `role="alert"`; เปลี่ยนข้อความ "256-bit SSL" เป็น "เชื่อมต่อแบบเข้ารหัส (HTTPS)"
- **หลังบ้าน** (`/admin/*`): sidebar กรอบเส้น + ป้าย ADMIN สีแดง (มือถือเป็นแถบเมนูเลื่อนแนวนอน), `admin-ui.tsx` (การ์ด/หัวข้อ/ป้าย/input/แบ่งหน้า) และปุ่ม `ActionForm` ใช้ธีมใหม่ (หลัก = เขียว, อันตราย = แดง); แดชบอร์ดเป็นตารางกรอบตัวเลข; แท็บออเดอร์ที่เลือกเป็นสีเขียวทึบ
  - แก้: แถบบนเดิมแสดงข้อความตกแต่งที่ไม่จริง ("Node: Production Ready") และเวลาจากนาฬิกาเซิร์ฟเวอร์ (บน Vercel เป็น UTC) → แสดงเวลาไทยและข้อความว่าทุกการเปลี่ยนแปลงบันทึกใน Audit Log
- ฟอนต์ใหม่ของหลังบ้านโหลดจาก `next/font` (self-host) จึงผ่าน CSP `font-src 'self'` ของ /admin

**กับดักที่เจอ**
- เครื่อง dev หน่วยความจำ (commit memory) เหลือน้อย: `next dev` ล้มด้วย `Zone Allocation failed` และ `next build` ล้มด้วย `spawn UNKNOWN` — แก้ชั่วคราวด้วย `experimental.cpus: 1` ใน `next.config.mjs` ตอน build บนเครื่องนี้เท่านั้น (**ห้าม commit**) แล้วคืนค่าเดิม
- เทสต์ที่ import layout หน้าบ้านต้อง mock `next/font/google` (ดู `tests/phase2-marketing-pages.test.tsx`)

**ขั้นตอนถัดไป**
- รอเจ้าของอนุมัติ commit (แยก dev tooling กับ redesign) — local `main` ยังไม่ได้ push
- ควรเพิ่ม E2E (Playwright) ตรวจหน้าตาที่ 320/768/1440px และเมนูมือถือ — ตอนนี้ตรวจด้วยสคริปต์ + ภาพหน้าจอเท่านั้น

---

## เซสชัน: อัปเกรดเครื่องมือพัฒนา (vitest / tsx)
**วันที่:** 12 ตุลาคม 2026  
**สถานะ:** unit 173/173, Integration กับ PostgreSQL จริง 113/113, `tsc` ผ่าน, `npm run db:seed` ผ่าน tsx ตัวใหม่, `next build` ผ่าน — `npm audit --omit=dev` = 0; รวม dev จาก 16 → 7 (critical 2 → 0) — ยังไม่ commit

### 1. สิ่งที่ทำ
- vitest 2.1.9 → **5.0.3**, vite 5 → **7.3.7** (ตรึงไว้ที่ 7: vite 8 ใช้ rolldown/oxc ที่เป็น native binary ซึ่ง Windows Application Control บนเครื่องนี้บล็อก — vite 7 ใช้ rollup ที่ override เป็น WASM อยู่แล้ว)
- tsx 4.19.2 → **4.23.15**, `@types/node` 20 → **22** (vitest 5 ต้องการ; ตรงกับ runtime ของ Vercel)
- `vitest.config.ts`: `maxWorkers: 4` — vitest 5 เปิด worker เท่าจำนวน CPU (16) จนหน่วยความจำเครื่อง dev หมด
- ช่องโหว่ critical ของ vitest/tinypool และ high ของ vite หายหมด
- ลบ `eslint` + `eslint-config-next` และสคริปต์ `lint` (ไม่มี ESLint config อยู่แล้ว ไม่เคยใช้งาน — เจ้าของอนุมัติ); ถ้าจะใช้ lint ภายหลังให้ติดตั้งใหม่พร้อม `eslint.config.mjs` (flat config)
- `overrides.next.postcss = "$postcss"` + `postcss` เป็น devDependency — ให้ Next ใช้ postcss รุ่นที่แก้ช่องโหว่แล้ว แทนรุ่นที่ฝังมากับ Next

### 2. ที่เหลือ 7 รายการ (dev เท่านั้น ไม่ขึ้น production) — แก้ไม่ได้ถ้าไม่ย้ายไป Tailwind 4
- `braces` ≤3.0.3 (stack exhaustion จาก pattern ซ้อนลึก) — ไม่มีเวอร์ชัน 3.x ที่แก้แล้ว; มาจาก tailwind 3 (chokidar/micromatch/fast-glob)
- `postcss-selector-parser` <7.1.6 (CPU จาก selector ยาวผิดปกติ) — แก้เฉพาะใน 7.x แต่ tailwind 3 ใช้ API 6.x
- ความเสี่ยงจริงต่ำ: ทั้งหมดประมวลผลเฉพาะ CSS/pattern ของเราเองตอน build ไม่รับข้อมูลจากผู้ใช้
- เจ้าของเลือก "ยังไม่ย้าย Tailwind 4" ในรอบนี้

### 3. Tailwind 4 — สิ่งที่ต้องทำถ้าจะย้าย (ยังไม่ได้ทำ รอเจ้าของตัดสินใจ)
- ใช้ `npx @tailwindcss/upgrade`: ย้าย `tailwind.config` → CSS (`@import "tailwindcss"` + `@theme`), PostCSS plugin เป็น `@tailwindcss/postcss`, เลิกใช้ autoprefixer
- คลาสเปลี่ยนชื่อ/ความหมาย: `shadow-sm`→`shadow-xs`, `shadow`→`shadow-sm`, `rounded-sm`→`rounded-xs`, `outline-none`→`outline-hidden`, `ring` หนา 1px (เดิม 3px), สีขอบเริ่มต้นเป็น currentColor, `hover:` ทำงานเฉพาะอุปกรณ์ที่มี hover — ต้องตรวจหน้าตาทุกหน้า
- **รองรับเฉพาะเบราว์เซอร์ใหม่**: Safari 16.4+, Chrome 111+, Firefox 128+ — มือถือรุ่นเก่าจะแสดงผลเพี้ยน (กระทบลูกค้าบางส่วน)
- Tailwind 4 ใช้ native binary (Oxide / Lightning CSS) — **เสี่ยงถูก Windows Application Control บล็อกบนเครื่องนี้** (เหมือน rollup/SWC) ต้องทดสอบก่อน

---

## เซสชัน: อัปเกรด Next.js 15.5 + ปิดช่องเลี่ยง rate limit (สมัคร / ล็อกอิน / ลืมรหัสผ่าน)
**วันที่:** 12 ตุลาคม 2026  
**สถานะ:** เสร็จ + แก้ตามผล security review แล้ว — unit 173/173, Integration กับ PostgreSQL จริง 113/113, `tsc` ผ่าน, `next build` ผ่าน (Next 15.5.27), smoke test บน production build ผ่านทุกหน้า (แอดมิน/สมาชิก/checkout/cron/webhook), ทดสอบฟอร์มล็อกอินในเบราว์เซอร์จริงผ่าน, dev server ไม่มีคำเตือน sync dynamic API — `npm audit --omit=dev` = 0 ช่องโหว่ — ยังไม่ commit (รอเจ้าของอนุมัติ แยก 2 commit)

### 1. ปิดช่องเลี่ยง rate limit ด้วย header ปลอม
- เดิม: สมัคร/ลืมรหัสผ่าน/ล็อกอิน ใช้ `x-forwarded-for` ดิบเป็น key → ส่งค่าใหม่ทุกครั้งก็ไม่โดนจำกัด (ล็อกอินเดารหัสผ่านได้ไม่จำกัด, ยิงอีเมลรีเซ็ตใส่เหยื่อได้)
- `src/lib/request.ts`: `clientIpFromHeaders` / `rateLimitIp` — ใช้ `x-real-ip` (Vercel ตั้งเอง) ก่อน แล้วค่อย `x-forwarded-for` ตัวแรก; ตรวจด้วย `net.isIP` (ไม่รับ `a:1`, `01.2.3.4`, zone id); ค่าปลอมทั้งหมดใช้ถัง `unknown-ip` เดียวกัน; **IPv6 นับรวมทั้ง /64** และ IPv4-mapped นับเป็น IPv4 (สลับที่อยู่ในบล็อกเดียวกันเลี่ยงไม่ได้)
- ล็อกอิน (`src/lib/login.ts`): จำกัด 2 ชั้น — ต่อ IP+อีเมล 5 ครั้ง และ **ต่ออีเมล 10 ครั้ง** ใน 15 นาที (สลับ IP ก็เดารหัสต่อไม่ได้); สำเร็จแล้วล้างทั้งสองชั้น; อีเมลที่ไม่มีบัญชีก็ตรวจกับ hash หลอก (เวลาตอบเท่ากัน เดาอีเมลจากเวลาไม่ได้); อีเมลยาวเกิน 254 ตัวปฏิเสธทันที; **บัญชีแอดมินถูกล็อกจากรหัสผิด → แจ้งกลุ่มแอดมินทาง Telegram**
- ลืมรหัสผ่าน: **ต่ออีเมล 3 ครั้ง** + ต่อ IP 10 ครั้ง ใน 15 นาที; **ไม่ลบลิงก์เดิมที่ยังไม่หมดอายุ** (คนอื่นกดขอแทนเพื่อทำลายลิงก์ของเราไม่ได้); **เก็บเฉพาะ SHA-256 ของโทเคน** (ข้อมูลหลุดก็ใช้รีเซ็ตไม่ได้); ใช้ลิงก์แล้วลบทุกลิงก์ของอีเมลนั้นใน transaction เดียวกับการตั้งรหัส; สมัคร: ต่อ IP 5 ครั้ง/10 นาที
- เทสต์: `tests/auth-rate-limit.test.ts`, `tests/integration/auth-rate-limit.test.ts` (ยิงจริงกับ PostgreSQL ด้วย header ปลอม)
- ข้อจำกัดที่ยอมรับ: (1) ต้องรันหลัง proxy ที่เชื่อถือได้ (Vercel) — ย้ายโฮสต์ต้องให้ proxy เขียนทับ `x-real-ip`; (2) คนที่รู้อีเมลทำให้บัญชีนั้นล็อกอินไม่ได้ชั่วคราว 15 นาทีได้ (ราคาของการกันเดารหัส) — แอดมินได้รับแจ้งเตือน; ทางเลือกในอนาคต: CAPTCHA หลังผิดหลายครั้ง หรือคุกกี้อุปกรณ์ที่เคยล็อกอินสำเร็จ; (3) ลิงก์รีเซ็ตที่ออกไปก่อนอัปเกรดนี้ใช้ไม่ได้แล้ว (เปลี่ยนเป็นเก็บ hash) — ขอลิงก์ใหม่ได้ทันที

### 2. อัปเกรด Next.js 14.2.35 → 15.5.27 (+ React 19.3, next-auth 4.24.15)
- ปิด advisory ระดับ critical ของ Next 14 (EOL) — `npm audit --omit=dev` เหลือ 0
- `params` / `searchParams` เป็น Promise (7 หน้า + `/api/slips/[id]`), `headers()` เป็น async → `getClientIp()` เป็น async
- `useFormState` (react-dom) → `useActionState` (react); เทสต์ไม่ต้องจำลอง react-dom แล้ว
- `package.json` overrides: บังคับ postcss ภายใน Next เป็น 8.5.29 (ตัวที่ Next ตรึงไว้ 8.4.31 มีช่องโหว่อ่านไฟล์ผ่าน sourceMappingURL)
- Next ปรับ `tsconfig.json` เอง (`target: ES2017` + จัดรูปแบบ)

### 3. ข้อควรรู้
- บนเครื่องนี้ Windows Application Control บล็อก `@next/swc-win32-x64-msvc` ของ Next 15 → Next ใช้ SWC แบบ WASM แทนอัตโนมัติ (build ช้ากว่าเล็กน้อย, บน Vercel ใช้ตัว native ปกติ)
- `npm audit` (รวม dev) เดิม 16 รายการ — อัปเกรด vitest/tsx แล้วเหลือ 9 (ดูเซสชันอัปเกรดเครื่องมือพัฒนาด้านบน)
- `next lint` ถูก deprecate ใน 15.5 และโปรเจกต์ยังไม่มี ESLint config
- npm รุ่นนี้ถาม `approve-scripts` สำหรับ install script (esbuild/prisma) — หลัง `npm install` ให้รัน `npx prisma generate` เอง

---

## เซสชัน: Phase 5 — งานอัตโนมัติ, Watchdog, บอท Telegram และการสำรองข้อมูล
**วันที่:** 12 ตุลาคม 2026  
**สถานะ:** Phase 5 เสร็จ + แก้ตามผล security review แล้ว — unit 166/166, Integration กับ PostgreSQL จริง 104/104, `tsc` ผ่าน, `next build` ผ่าน, smoke test บน production build ผ่าน, ซ้อมกู้คืนฐานข้อมูลจริงผ่าน — **ยังไม่ commit** (รอเจ้าของอนุมัติ)

### 1. สิ่งที่ทำเสร็จแล้ว
- **งานประจำวัน `GET /api/cron/check-expiry`** (Vercel Cron 02:00 UTC = 09:00 น. ไทย, `vercel.json`) — `src/lib/jobs/expiry.ts`
  1. ปิดออเดอร์ค้างชำระที่หมดเวลา
  2. ช่วงสิทธิ์ที่เลยวันสิ้นสุด → `EXPIRED` ทีละคนภายใต้ advisory lock `membership:<userId>` (ลำดับ lock เดียวกับอนุมัติ/คืนเงิน) + AuditLog แบบระบบ (`actorId = null`)
  3. **ย้ายสถานะเปิดสิทธิ์ไปช่วงที่ต่ออายุไว้** (`carryOverProvisioning`) — คนที่ต่อทบวันจึงไม่ถูกนับว่า "ต้องถอดสิทธิ์"; คืนเงินช่วงปัจจุบันก็ใช้ตัวเดียวกัน
  4. เตือนก่อนหมด 3 วันแบบ "รายคน" (วันหมดของช่วงสุดท้ายที่ต่อกัน) ทางอีเมล + Telegram ส่วนตัว — จองด้วย `expiryReminderClaimedAt` ก่อนส่ง (รันซ้อนก็เตือนครั้งเดียว), สำเร็จบันทึก `expiryReminderSentAt`, ส่งไม่ได้ทุกช่องทาง → ปล่อยการจองให้รอบหน้าลองใหม่, การจองค้างเกิน 30 นาที (งานถูกตัดกลางคัน) ส่งใหม่ได้
  5. ส่งสรุปเข้ากลุ่มแอดมิน: ใครหมดอายุ + ช่องทางที่ต้องถอดด้วยมือ (อีเมลแบบปิดบางส่วน / TradingView username / ลิงก์หน้าสมาชิกในหลังบ้าน) — เงียบถ้าไม่มีอะไรต้องแจ้ง; ส่งไม่สำเร็จ → บันทึก `summaryDelivered=false` ให้ Watchdog เตือน
  6. จำกัดเวลา 40 วินาทีต่อรอบ (ก่อน serverless timeout 60 วินาที) — ที่เหลือทำต่อรอบถัดไป
- **Watchdog `GET /api/cron/watchdog`** (เรียกทุกชั่วโมงจาก GitHub Actions `.github/workflows/watchdog.yml`) — `src/lib/jobs/watchdog.ts`
  - งานตรวจวันหมดอายุไม่สำเร็จเกิน 26 ชม. / งานค้าง RUNNING เกิน 30 นาที (ปิดเป็น FAILED ให้) / สลิปรอตรวจเกิน 24 ชม. / สิทธิ์ที่ต้องถอดค้างเกิน 24 ชม. / สรุปรอบล่าสุดส่งไม่ถึงแอดมิน / webhook บอทมี error หรือค้าง
  - **ส่งแจ้งสลิปใหม่ซ้ำ** สำหรับออเดอร์ที่ `adminNotifiedAt = null` (ซ่อมเองได้)
  - แจ้งปัญหาชุดเดิมซ้ำได้ทุก 6 ชม. (กันสแปม) และแจ้ง "กลับมาปกติ"; ตอบ 503 + `adminNotified` — workflow ล้มเหลว (แจ้ง Telegram เอง + GitHub ส่งอีเมล) เมื่อแอปล่ม หรือเมื่อแอปแจ้งแอดมินไม่ได้ (เช่น Telegram ล่ม/token ถูกเพิกถอน)
- **JobRun**: ทุกงานบันทึก RUNNING/SUCCESS/FAILED + summary + error; ล้มเหลว → log + แจ้งแอดมินทันที (`src/lib/jobs/job-run.ts`); หน้า `/admin/status` แสดงรันล่าสุดของทุกงาน
- **บอท Telegram สำหรับสมาชิก** (webhook `POST /api/telegram/webhook`, ยืนยันด้วย `X-Telegram-Bot-Api-Secret-Token`)
  - หน้า `/account` มีการ์ด "เชื่อมต่อ Telegram" → ลิงก์ `t.me/<bot>?start=<token>` ใช้ครั้งเดียว อายุ 15 นาที (เก็บแค่ SHA-256), 1 แชตผูกได้ 1 บัญชี — แชตที่ผูกบัญชีอื่นอยู่จะไม่ถูกย้ายเงียบ ๆ (ต้อง /stop ก่อน)
  - คำสั่ง `/status` (วันหมดอายุรวม), `/stop` (ยกเลิก); ตอบเฉพาะแชตส่วนตัว, จำกัด 20 ข้อความ/นาที/แชต
- **หน้า `/account` แก้บั๊ก**: เดิมเช็กแค่สถานะ `ACTIVE` ของช่วงล่าสุด → สมาชิกที่ถูกเตือนแล้ว (`EXPIRING_SOON`) จะเห็นว่า "ไม่มีสิทธิ์" ช่วง 3 วันสุดท้าย และคนที่ต่ออายุเห็นช่องทาง "รอระบบอัปเดต" — ตอนนี้ใช้สถานะรวมรายคน + แถบเตือน "ต่ออายุ" เมื่อเหลือ ≤ 3 วัน
- **สำรองข้อมูล**: `.github/workflows/backup.yml` (pg_dump ทุกวัน 02:30 น. → ตรวจไฟล์ → เข้ารหัสด้วย GPG **public key** → artifact เก็บ 30 วัน, ล้มเหลวแจ้ง Telegram) — GitHub ไม่มีกุญแจถอดรหัส (ทดสอบเข้ารหัส/ถอดรหัสด้วยคำสั่งเดียวกันบนเครื่องแล้ว)
- **ซ้อมกู้คืนจริง 1 รอบ** (`npm run db:restore-drill`): สำรอง → กู้ลงฐานข้อมูลชั่วคราว → เทียบจำนวนแถว 17 ตารางตรงกันหมด + trigger AuditLog กลับมาครบ → ลบทิ้ง (ไฟล์ 41 KB, 0.9 วินาที) — ทำกับฐานข้อมูล dev บนเครื่อง
- Migration `phase5_automation`: `JobRun`, `TelegramLinkToken`, `User.telegramChatId` unique + `telegramLinkedAt`, `AuditLog.actorId` nullable (งานของระบบ); `phase5_reminder_lease`: `Subscription.expiryReminderClaimedAt/SentAt`
- เทสต์: `tests/integration/jobs.test.ts` (19), `tests/integration/telegram.test.ts` (8), `tests/integration/register.test.ts` (+1), `tests/phase5-automation.test.ts`, `tests/phase5-routes.test.ts`, `tests/phase5-account.test.tsx`

### แก้ตามผล Security Review (Phase 5 — ไม่มี CRITICAL, ไม่มีช่องข้ามการยืนยันตัวตน)
- **[HIGH]** Watchdog ภายนอกเงียบเมื่อ Telegram เองล่ม → endpoint ส่ง `adminNotified`; workflow ล้มเหลวเมื่อ 503 แต่แอปแจ้งไม่ได้ (GitHub อีเมลเป็นช่องทางสำรอง)
- [MEDIUM] สรุปถึงแอดมินส่งไม่สำเร็จแล้วรายชื่อหาย → `summaryDelivered` + Watchdog ตรวจ + ตรวจคิวถอดสิทธิ์ค้าง 24 ชม.
- [MEDIUM] การจองส่งเตือนหายเมื่องานถูกตัดกลางคัน / สมาชิกเกิน 300 คนไม่ถูกเตือน / งานค้าง RUNNING ตลอดไป → lease (`claimedAt`/`sentAt`), จำกัดเวลา 40 วินาที, เลือกเฉพาะที่ยังไม่ส่ง, Watchdog ปิดงานค้างเป็น FAILED
- [MEDIUM] `CRON_SECRET` ค่าตัวอย่างใน `.env.example` ผ่านการตรวจความยาว → ตรวจความแข็งแรง (`isStrongSecret`: ยาว ≥32, ตัวอักษรต่างกัน ≥12, ไม่ใช่ค่าตัวอย่าง) + ลบค่าตัวอย่าง
- [MEDIUM] ลิงก์ของคนอื่นตัดการแจ้งเตือนของเราได้ (ย้ายแชตเงียบ ๆ) → ปฏิเสธ `CHAT_LINKED_ELSEWHERE`
- [MEDIUM] TradingView username ไม่จำกัดรูปแบบ (ปลอมบรรทัดในข้อความแอดมิน) → ตรวจตอนสมัคร (≤50, `A-Za-z0-9_.-`) + ตัดบรรทัด/ความยาวตอนสร้างข้อความ
- [MEDIUM] อีเมลสมาชิกในกลุ่ม Telegram (PDPA) → ปิดบางส่วน + ลิงก์หน้าสมาชิกในหลังบ้าน
- [LOW] ตรวจ content-length ก่อนอ่าน body webhook; ลบ connection string / bot token / อีเมลออกจาก error ก่อน log/บันทึก/แจ้ง (`src/lib/redact.ts`); log ความลับที่ไม่ได้ตั้งครั้งเดียว; workflow บังคับ https; ช่องทางเตือนแยกกัน (`allSettled`); Watchdog ตรวจ webhook เฉพาะเมื่อบอทเปิดใช้ครบ; สำรองข้อมูลเข้ารหัสแบบกุญแจคู่

### 2. สิ่งที่เจ้าของต้องตั้งค่าตอน deploy
- Vercel: `CRON_SECRET` (สุ่มยาว 32+ ตัว เช่น `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`, Sensitive) — Vercel Cron ส่ง `Authorization: Bearer` ให้อัตโนมัติ
- GitHub → Settings → Secrets and variables → Actions: `vars.APP_URL`, `secrets.CRON_SECRET` (ค่าเดียวกับ Vercel), `secrets.TELEGRAM_BOT_TOKEN`, `secrets.TELEGRAM_ADMIN_CHAT_ID`, `secrets.BACKUP_DATABASE_URL` (Neon direct URL ของ role ที่อ่านได้อย่างเดียว), `vars.BACKUP_GPG_PUBLIC_KEY` (สร้างตามคำแนะนำในหัวไฟล์ `backup.yml` — **private key เก็บออฟไลน์/ใน password manager เท่านั้น หายแล้วกู้ไฟล์ไม่ได้**)
- บอทสมาชิก (ไม่บังคับ): สร้างบอทกับ @BotFather → ตั้ง `TELEGRAM_BOT_USERNAME` + `TELEGRAM_WEBHOOK_SECRET` ใน Vercel → รัน `npm run telegram:webhook` (ใช้ token/secret จาก env ของเครื่องที่รัน)
- หลัง deploy ครั้งแรก: เรียก check-expiry 1 ครั้ง (หรือรอ 09:00) ไม่งั้น Watchdog จะเตือนว่า "ยังไม่เคยรันสำเร็จ"
- ซ้อมกู้คืนกับ Neon จริงอีกรอบหลังขึ้น production (ดาวน์โหลด artifact → `gpg --decrypt` → `pg_restore` ลง Neon branch ใหม่)

### 3. ข้อควรรู้ / ยังไม่ได้ทำ
- การถอดสิทธิ์ TradingView / Discord / กลุ่ม Telegram ยังเป็นงานมือ (ไม่มี API ทางการของ TradingView) — ระบบส่งรายชื่อ + คิวในหน้าสถานะ
- Vercel Hobby รัน Cron ได้วันละครั้ง จึงให้ Watchdog รายชั่วโมงอยู่บน GitHub Actions (ตารางของ GitHub อาจช้าได้หลายนาทีในช่วงคิวแน่น)
- โปรเจกต์ยังไม่มีการตั้งค่า ESLint (`next lint` ถามให้สร้าง config) — ยังไม่ได้เพิ่มในเฟสนี้
- บนเครื่อง dev: role ของแอปเป็น superuser (ติดตั้งเอง) — production บน Neon ต้องใช้ role ปกติ
- ~~rate limit ของการสมัครใช้ `x-forwarded-for` ดิบ~~ — แก้แล้ว (ดูเซสชันอัปเกรด Next.js 15.5 ด้านบน)

---

## เซสชัน: Phase 4 — ระบบหลังบ้านแอดมิน
**วันที่:** 12 ตุลาคม 2026  
**สถานะ:** Phase 4 เสร็จ + แก้ตามผล security review แล้ว — unit 138/138, Integration กับ PostgreSQL จริง 76/76, `tsc` ผ่าน, `next build` ผ่าน, smoke test บน production build ผ่าน (ไม่ล็อกอิน → 307 ไปหน้า signin; แอดมินเปิดได้ทั้ง 7 หน้า + หน้าสมาชิก, CSP มี nonce และไม่มี `unsafe-inline` ใน script-src, `X-Frame-Options: DENY`, script ทุกตัวมี nonce ตรงกับ header) — **ยังไม่ commit** (Phase 3 ก็ยังไม่ commit — รอเจ้าของอนุมัติ แยก commit ตามเฟส)

### หน้าเว็บหลังบ้าน
- `/admin` แดชบอร์ด (`src/lib/admin/dashboard.ts`): ยอดขายสุทธิ = รับเข้า (APPROVED + REFUNDED) − คืนเงิน คำนวณด้วย aggregate ใน DB, สมาชิกนับ "รายคน" (ไม่ใช่รายช่วงสิทธิ์), ใกล้หมดอายุนับจากวันสิ้นสุดของช่วงที่ต่อทบกันทั้งหมด (คนที่ต่ออายุไว้แล้วไม่นับ), แถบเตือนเมื่อมีสิทธิ์ที่ต้องถอดด้วยมือ
- `/admin/orders`: แท็บ + จำนวน + ค้นหาเลขออเดอร์/อีเมล/เลขอ้างอิง (คิวรอตรวจเรียงเก่าสุดก่อน), แสดง "ยังไม่ได้แจ้งเตือน" เมื่อ Telegram ส่งไม่สำเร็จ, ทำออเดอร์ค้างที่หมดเวลาให้เป็น EXPIRED ก่อนนับ
- `/admin/orders/[id]`: ดูสลิป (next/image `unoptimized` ผ่าน `/api/slips/[id]`), อนุมัติ (ต้องกรอกเลขอ้างอิง + ติ๊กยืนยันว่าเงินเข้า), ปฏิเสธ (เหตุผลสำเร็จรูป + รายละเอียด), คืนเงิน (ติ๊กยืนยันว่าโอนคืนแล้ว), เช็กลิสต์เปิดสิทธิ์, ประวัติ
- `/admin/members` + `/admin/members/[id]`: สถานะสมาชิก/วันหมดอายุ, ช่วงสิทธิ์ทั้งหมด, ปิดสิทธิ์ฉุกเฉิน, เช็กลิสต์ถอดสิทธิ์ของช่วงที่ปิดแล้ว
- `/admin/audit-logs` (กรองตาม action), `/admin/settings` (Kill-switch + PromptPay), `/admin/status` (ไม่แสดงค่า env, มีคิว "สิทธิ์ที่ปิดแล้วแต่ยังต้องถอด")

### Service layer (`src/lib/admin/`)
- `guard.ts` (`getAdminActor` ตรวจ role จาก DB), `page-guard.ts` (`requireAdminPage` — ทุกหน้า /admin เรียกบรรทัดแรก, มีเทสต์บังคับครบทุกหน้า)
- `audit.ts`: `writeAudit` ใน transaction เดียวกัน + `listAuditLogs`; ตาราง AuditLog เป็น append-only ด้วย DB trigger (`audit_log_no_update_delete`)
- `membership.ts`: ต่อทบวัน `nextPeriodFor`, `repackFutureSegments` (เลื่อนช่วงที่ยังไม่เริ่มมาต่อกันหลังคืนเงิน/ปิดสิทธิ์), สรุปสถานะสมาชิก
- `order-review.ts`: approve/reject/refund ใช้ `SELECT … FOR UPDATE` + advisory lock `membership:<userId>`, เลขอ้างอิงธนาคาร unique, ห้ามอนุมัติออเดอร์ตัวเอง (`SELF_APPROVAL`), นับที่นั่งโปรครั้งเดียวต่อคน, oversell แจ้งแอดมินทั้งบนจอ + Telegram + audit
- `members.ts`, `settings.ts` (ล็อกแถวตั้งค่าก่อนอ่านค่า "ก่อน"), `orders-query.ts`, `health.ts`, `dashboard.ts`, `messages.ts`
- `src/app/(admin)/admin/actions.ts`: ทุก action ตรวจแอดมินจาก DB; error ไม่คาดคิด → log + Telegram; เปลี่ยนการตั้งค่ารับเงิน → Telegram ทุกครั้ง; path ที่ revalidate คำนวณฝั่ง server (ไม่รับจากฟอร์ม); บอกแอดมินเมื่อส่งอีเมลลูกค้าไม่สำเร็จ

### แก้ตามผล Security Review (Phase 4)
- HIGH: หน้า /admin ทุกหน้าตรวจสิทธิ์เอง (layout ถูกข้ามได้ตอน soft navigation) → `requireAdminPage` + เทสต์ครอบคลุมทุกไฟล์ `page.tsx`
- HIGH: `NEXTAUTH_SECRET` ห้ามว่าง/สั้นกว่า 32 ตัวใน production (`src/lib/auth-secret.ts`) ใช้ทั้ง auth และ middleware
- ตรวจรูปแบบ IP ก่อนบันทึก (`isValidIp`), จำกัดเลขหน้า (`parsePage`), `X-XSS-Protection: 0`
- คืนเงินกลางช่วงที่ต่อทบ → ช่วงถัดไปเลื่อนเข้ามาต่อทันที (ไม่มีช่องว่าง) + audit บอกจำนวนช่วงที่เลื่อน
- AuditLog แก้/ลบไม่ได้ในระดับ DB, audit การปิดสิทธิ์เก็บสถานะช่องทางของทุกช่วงที่ถูกปิด
- อีเมลทุกฉบับ escape HTML (รวมอีเมลรีเซ็ตรหัสผ่าน), production ที่ไม่มี `RESEND_API_KEY` คืน false + log error (ไม่แกล้งว่าส่งสำเร็จ)
- แดชบอร์ดไม่โหลดทุกออเดอร์มาบวกเงินอีกต่อไป (aggregate)

### ข้อควรรู้ / ยังไม่ได้ทำ (ตั้งใจเลื่อนไว้)
- เปิด/ถอดสิทธิ์ TradingView/Discord/Telegram ยังเป็นงานมือ — ระบบช่วยแค่เช็กลิสต์ + คิวเตือน + Audit Log
- คืนเงินไม่คืนที่นั่งโปรโมชัน (`promoEnrolledCount` ไม่ลด)
- ยังไม่มี: ยืนยันรหัสผ่านซ้ำก่อนทำ action เสี่ยง (step-up re-auth), ปุ่มย้อนกลับ (undo) ของปฏิเสธ/ปิดสิทธิ์, rate limit สำหรับ admin actions, การบันทึกความพยายามเข้าหลังบ้านที่ถูกปฏิเสธลง DB (ตอนนี้แค่ redirect), ตัวบอกว่ารายการถูกตัด (รายละเอียดสมาชิกแสดงล่าสุด 50 รายการ)
- Next.js 14 หมดอายุซัพพอร์ต มี advisory ที่ต้องอัปเกรดเป็น 15.5.x — แยกเป็นงาน "Upgrade Next.js 14.2 to 15.5"
- ฐานข้อมูล dev: ปิดรับเงินอยู่, มีออเดอร์ทดสอบที่อนุมัติแล้ว 1 รายการ และผู้ใช้ทดสอบ E2E 2 บัญชี

### ขั้นตอนถัดไป
1. เจ้าของอนุมัติ → commit Phase 3 และ Phase 4 แยกกัน (เฉพาะไฟล์ที่เกี่ยวข้อง)
2. Phase 5: เสร็จแล้ว (ดูด้านบน)
3. อัปเกรด Next.js 15.5

---

## เซสชัน: Phase 3 — สั่งซื้อ, PromptPay QR และแนบสลิป (Checkout)
**วันที่:** 11 ตุลาคม 2026  
**สถานะปัจจุบัน:** โค้ด Phase 3 ครบ + แก้ตามผล security review แล้ว — unit test 104/104, Integration Test กับ PostgreSQL จริง 43/43, `tsc` ผ่าน, `next build` ผ่าน (Next 14.2.35), ทดสอบ E2E ในเบราว์เซอร์จริงผ่าน — **ยังไม่ commit** (รออนุมัติจากเจ้าของ)

### แก้ตามผล Security Review (ไม่มี CRITICAL)
- **[HIGH] Open redirect bypass** `/.//evil.com` → `safeCallbackUrl` ตรวจซ้ำหลัง normalize (+เทสต์ 6 รูปแบบ)
- **[HIGH] สลิปที่แก้ไฟล์ 1 byte ได้ hash ใหม่** → `Payment.referenceNo` เป็น unique แล้ว; **Phase 4 ต้องบังคับให้แอดมินกรอกเลขอ้างอิงธนาคารตอนอนุมัติ** (hash ไฟล์กันได้เฉพาะไฟล์เดียวกันทุก byte)
- **[HIGH] เศษสตางค์ชนกันข้ามผู้ใช้** → advisory lock ต่อราคา (ลำดับ: ผู้ใช้ → ราคา) + ใช้ครบ 99 ค่าแล้วตอบ `CHECKOUT_BUSY` แทนการใช้ยอดซ้ำ (+เทสต์ 10 คนพร้อมกัน)
- **[MEDIUM] Rate limiter ไม่ atomic / fail-open** → `INSERT ... ON CONFLICT ... RETURNING` + `failClosed` สำหรับ endpoint เงิน + นับก่อนตรวจไฟล์ (+เทสต์ 20 คำขอพร้อมกัน)
- **[MEDIUM] QR กับชื่อบัญชีไม่ตรงกัน / ปิดรับเงินแล้ว QR ยังแสดง** → เก็บ `Payment.promptpayAccountName` ตอนสร้าง QR และซ่อน QR (`paymentSuspended`) เมื่อปิดรับเงินหรือเปลี่ยนเลข PromptPay
- **[MEDIUM] ห้ามล้มเงียบ** → error ไม่คาดคิดแจ้ง Telegram แอดมิน, `Order.adminNotifiedAt` (null = ยังไม่ได้แจ้ง ให้ Cron ส่งซ้ำ — Cron ยังไม่ได้ทำ), revalidate ล้มเหลวไม่ทำให้ผู้ใช้เห็นว่าสลิปส่งไม่สำเร็จ
- **[MEDIUM] ราคาเปลี่ยนระหว่างหน้ายืนยันกับตอนกดซื้อ** → ส่ง `expectedBasePrice` ตอบ `PRICE_CHANGED`; **โควตาโปรโมชันต้องตรวจซ้ำตอนอนุมัติใน Phase 4**
- **[MEDIUM] Next.js 14.2.24 มี CVE-2025-29927 (ข้าม middleware)** → อัปเป็น 14.2.35; **ยังเหลือ critical 2 ตัวที่แก้ได้เฉพาะ Next 15.5.24+** (RCE บน Windows host — ไม่กระทบ Vercel, RCE ผ่าน Image Optimization + AVIF — ไม่มี remotePatterns) → แยกเป็นงาน "Upgrade Next.js 14.2 to 15.5"
- **[MEDIUM] สมัครด้วย ADMIN_EMAIL ได้สิทธิ์แอดมินทันที (ไม่ยืนยันอีเมล)** → สมัครผ่านเว็บได้ USER เสมอ; seed เลื่อนบัญชีเดิมเป็นแอดมินพร้อมตั้งรหัสผ่านเป็น `SEED_ADMIN_PASSWORD` (กันคนสมัครดักไว้ก่อน)
- **[LOW]** `?error=__proto__` ทำหน้าล่ม → ใช้ `hasOwnProperty`; บันทึก `termsAcceptedAt`/`termsVersion`/`createdIp`; นับถอยหลังชดเชยนาฬิกาเครื่องผู้ใช้ + ลองรีเฟรชซ้ำ; หน้า `/account/orders` อัปเดตออเดอร์หมดอายุครั้งเดียว; แก้ line ending ปนกันใน `signin/page.tsx`
- **เพิ่มเทสต์ที่ขาด:** server actions (13), components (QR, ฟอร์มสลิป, countdown, badge), สิทธิ์ดูสลิป, rate limiter, registration
- **ยังไม่ได้ทำ (บันทึกไว้):** แยกไฟล์สลิปไป object storage + นโยบายระยะเวลาเก็บสลิป (มีข้อมูลบัญชีธนาคาร), `bodySizeLimit: 5mb` มีผลกับทุก server action

### 1. สิ่งที่ทำเสร็จแล้ว
1. **ตาราง `SlipUpload`** (migration `phase3_slip_uploads`): เก็บไฟล์สลิปทุกใบในฐานข้อมูล (bytea) พร้อม `hash` unique — สลิปที่เคยถูกปฏิเสธก็นำกลับมาใช้ซ้ำไม่ได้
2. **Service ระบบเงิน** `src/lib/orders/*` (รับ PrismaClient เป็นพารามิเตอร์ ทดสอบกับ DB จริงได้):
   - `getPaymentAvailability` — Kill-switch: ต้องเปิด `paymentsEnabled` + ไม่ใช่ `maintenanceMode` + มีเลข PromptPay ถูกรูปแบบ + ชื่อบัญชี
   - `createOrder` — `pg_advisory_xact_lock` ต่อผู้ใช้กันกดซ้ำ (ออเดอร์แพ็กเกจเดิมที่ยังไม่หมดเวลาถูกนำกลับมาใช้), จำกัดออเดอร์ค้าง 3 รายการ, ราคา LOCKED → PROMO (ยังมีโควตา) → REGULAR, หักเศษสตางค์ 1–99 ที่ยังไม่ชนกับออเดอร์ค้างอื่น, สร้าง Payment + EMVCo payload
   - `submitSlip` — ตรวจขนาด/Magic Bytes ก่อนแตะ DB, `SELECT ... FOR UPDATE` ล็อกแถวออเดอร์, กันสลิปซ้ำด้วย unique hash (จับ P2002 กรณีส่งพร้อมกัน), รับสลิปได้ช่วงชำระเงิน + ช่วงผ่อนผัน 30 นาที + ออเดอร์ REJECTED
   - `getOrderForUser` / `listOrdersForUser` — เฉพาะเจ้าของ, หมดอายุแบบ lazy (บันทึก EXPIRED ตอนมีคนเปิดดู)
3. **หน้าเว็บ:** `/checkout/[plan]` (สรุปราคา + ยอมรับข้อกำหนด), `/checkout/order/[orderId]` (QR SVG + นับถอยหลัง + แนบสลิป + สถานะทุกแบบ), `/account/orders`
4. **Server Actions** (`src/app/(account)/checkout/actions.ts`): rate limit ต่อผู้ใช้, log ข้อผิดพลาดทุกครั้ง, แจ้ง Telegram แอดมินเมื่อมีสลิปใหม่ (ถ้าไม่ได้ตั้ง token จะ log `[notify:telegram]` — ไม่ล้มเงียบ)
5. **ปุ่มเลือกแพ็กเกจ** ไป `/checkout/<slug>` — ผู้ที่ยังไม่ล็อกอินถูกพาไปเข้าสู่ระบบ/สมัคร แล้วกลับมาหน้าชำระเงินอัตโนมัติ
6. **แก้ช่องโหว่ Open Redirect** ใน `/auth/signin` (`callbackUrl` ผ่าน `safeCallbackUrl()`), และแก้บั๊ก `router.push` + `router.refresh` แข่งกันจนหลังล็อกอิน/สมัครเด้งไป `/account` แทนปลายทาง (ใช้ `window.location.assign`)
7. **เลขออเดอร์** ใช้วันที่ตามเวลาไทย + สุ่ม 6 หลัก (เดิม 4 หลัก ชนกันง่ายที่ ~300 ออเดอร์/วัน) และลองใหม่ถ้าชน
8. **ดูสลิป `/api/slips/[id]`:** เฉพาะเจ้าของออเดอร์หรือแอดมิน (ตรวจ role แอดมินจาก DB ซ้ำ ไม่เชื่อ session อย่างเดียว), ตอบ 404 เหมือนกันทั้งไม่มีสิทธิ์/ไม่พบ, header `inline` + `nosniff` + `CSP: default-src 'none'; sandbox` + `no-store`
9. **บั๊กที่ integration test จับได้:** ตรวจทศนิยมยอดเงินด้วย `amount * 100` ผิดเพราะ floating point (เช่น 2489.99) — แก้ด้วยค่าเผื่อ + เทสต์ไล่ทุกราคา × ทุกเศษสตางค์

### 2. การตัดสินใจที่ควรรู้
- **หักเศษสตางค์ (ไม่บวกเพิ่ม)** ลูกค้าไม่ต้องจ่ายเกินราคาที่ประกาศ
- **ขนาดสลิปสูงสุด 4MB** (เดิมแผน 5MB) เพราะ Vercel รับ request body ไม่เกิน 4.5MB; ตั้ง `serverActions.bodySizeLimit: "5mb"`
- **โควตาโปรโมชันนับตอนอนุมัติ (Phase 4)** ออเดอร์ที่รอชำระไม่จองที่นั่ง
- **ราคาล็อก** ใช้ Subscription ล่าสุดของแพ็กเกจเดียวกันที่ `isPriceLocked` และไม่ถูก REVOKE

### 3. สิ่งที่ค้างอยู่
- **Phase 4 (หลังบ้าน):** `/admin/orders` (แสดงสลิปจาก `Order.slipUrl` → `/api/slips/<id>` ซึ่งมีแล้ว), อนุมัติ/ปฏิเสธพร้อม idempotency + AuditLog + เพิ่ม `promoEnrolledCount`, หน้า `/admin/settings` สำหรับกรอก PromptPay และเปิด/ปิดรับเงิน (ตอนนี้ต้องแก้ใน DB เอง)
- **ตั้งค่า Telegram** (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`) และอีเมลแจ้งผล (Resend)
- **ESLint ยังไม่ได้ตั้งค่า** (`next lint` ถามให้เลือก config) — ควรตั้งแบบ Strict
- ข้อมูลทดสอบใน DB พัฒนา: สมาชิก `e2e-*@example.com` 2 บัญชี + ออเดอร์ทดสอบ 3 รายการ (1 รายการมีสลิปรอตรวจ — ใช้ทดสอบ Phase 4 ได้); ค่า E2E อยู่ใน `.env` (`E2E_MEMBER_*`)

### 4. กับดักทางเทคนิคที่พบ
1. **ยอดเงินทศนิยม:** อย่าเทียบ `x * 100` ตรง ๆ — ใช้ค่าเผื่อ หรือคำนวณเป็นสตางค์ (integer)
2. **Prisma `$queryRaw` กับฟังก์ชันที่คืน `void`** (เช่น `pg_advisory_xact_lock`) deserialize ไม่ได้ — ใช้ `$executeRaw`
3. **Error ใน interactive transaction ทำให้ทั้ง transaction ใช้ต่อไม่ได้** — เช็กเลขออเดอร์ซ้ำก่อน insert แทนการจับ P2002 แล้วลองใหม่ใน transaction เดิม
4. **tsconfig target ES5** — ห้ามวนลูป `for...of` / spread บน `Set`/`Buffer` ในโค้ดที่ tsc ตรวจ (รวมไฟล์เทสต์) ใช้ `Array.from`
5. **E2E ด้วย chrome-devtools ในโหมดจำลองมือถือ (touch)** คลิกปุ่ม submit อาจไม่ติด — ใช้ `form.requestSubmit()` แทน

---

## เซสชัน: ตั้งค่าฐานข้อมูลบนเครื่อง (Local PostgreSQL + Seed + Integration Test)
**วันที่:** 11 ตุลาคม 2026  
**สถานะปัจจุบัน:** ฐานข้อมูลใช้งานได้จริงแล้ว — migration แรก `20261011161740_init` apply แล้ว, seed แล้ว, Integration Test กับ PostgreSQL จริงผ่าน 7/7, unit test ผ่าน 58/58, `tsc --noEmit` ผ่าน, ล็อกอินแอดมินและเปิด `/admin` ได้ (ตรวจด้วยสคริปต์บน dev server) — **ยังไม่ commit** (รวมกับงาน Phase 2)

### 1. สิ่งที่ทำเสร็จแล้ว
1. **PostgreSQL 16.15 ติดตั้งตรงบน Windows** (service พอร์ต 5432) ผ่าน `npm run db:install` (`scripts/setup-local-postgres.mjs`) — ใช้แทน Docker เพราะ Docker Desktop เปิด VM ไม่ขึ้น (commit memory เครื่องเต็ม ~37–38/38.9 GB)
   - ฐานข้อมูล `webpeenoey` (พัฒนา) และ `webpeenoey_test` (Integration Test)
   - ติดตั้งด้วยรหัส superuser ชั่วคราว แล้วเปลี่ยนเป็นรหัสจริงผ่าน stdin (กันรหัสหลุดใน log ของ winget)
2. **ไฟล์ Docker สำรองไว้:** `docker-compose.yml` (postgres:16.6-alpine, bind 127.0.0.1 เท่านั้น) + `docker/postgres/init/01-create-test-db.sh` — ใช้ได้เมื่อเครื่องมีหน่วยความจำพอ (ถ้าใช้ ต้องหยุด service PostgreSQL ของ Windows ก่อนเพราะพอร์ตชน)
3. **`npm run db:env`** (`scripts/setup-local-db-env.mjs`) เติม `POSTGRES_*`, `DATABASE_URL_TEST`, `SEED_ADMIN_PASSWORD` (สุ่ม) ลง `.env` จาก `DATABASE_URL` โดยไม่พิมพ์ค่าออกหน้าจอ
4. **Migration แรก** `prisma/migrations/20261011161740_init` — ก่อนสร้าง แก้ค่าเริ่มต้น `SystemSetting.promptpayNumber/promptpayAccountName` จากเบอร์/ชื่อบริษัทสมมติ (`0812345678`) เป็นค่าว่าง กันเงินลูกค้าโอนเข้าบัญชีคนอื่นถ้าเปิดรับเงินโดยลืมตั้งค่า
5. **Seed** (`src/lib/db/seed.ts` + `prisma/seed.ts`, รันด้วย `npm run db:seed` ผ่าน `tsx@4.19.2`): แพ็กเกจ 4 รายการจาก `src/config/plans.ts`, `SystemSetting` (ปิดรับชำระเงิน), บัญชีแอดมินจาก `ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` — รันซ้ำได้ ไม่ทับรหัสผ่านแอดมิน/ค่าที่แอดมินตั้ง/ตัวนับโปรโมชัน
6. **Integration Test กับ PostgreSQL จริง** (`npm run test:integration`, `vitest.integration.config.ts`): ใช้ `DATABASE_URL_TEST` เท่านั้น, `global-setup` รัน `prisma migrate deploy` และปฏิเสธฐานข้อมูลที่ไม่ใช่ localhost หรือไม่ลงท้าย `_test`, `resetDatabase()` ล้างทุกตารางก่อนแต่ละเทสต์ — โครงนี้พร้อมใช้กับเทสต์เรื่องเงินใน Phase 3
7. **Unit test แยกจากฐานข้อมูล:** `vitest.config.ts` ตั้ง `DATABASE_URL=""` (Prisma โหลด `.env` เองอัตโนมัติ ทำให้ rate limiter ใน unit test เคยพยายามต่อฐานข้อมูลจริง)

### 2. วิธีเริ่มบนเครื่องใหม่
`.env` ตั้ง `DATABASE_URL` → `npm run db:env` → `npm run db:install` (หรือ `npm run db:up` ถ้าใช้ Docker) → `npm run db:migrate` → `npm run db:seed` → `npm run test:integration`  
บัญชีแอดมินทดสอบ: อีเมล = `ADMIN_EMAIL`, รหัสผ่าน = `SEED_ADMIN_PASSWORD` (ดูใน `.env`)

### 3. กับดักทางเทคนิคที่พบ
1. **winget/UAC จาก process เบื้องหลังของ agent ถูกยกเลิก** (`0x800704C7`) — ต้องรัน `npm run db:install` ใน terminal ที่ผู้ใช้เห็น เพื่อให้หน้าต่าง UAC ขึ้นได้
2. **การเชื่อมต่อ PostgreSQL ที่ปิดอยู่บน Windows ใช้เวลา ~4 วินาทีก่อนล้ม** (ลอง ::1 แล้ว 127.0.0.1) — เทสต์ที่พึ่งการ fallback จะ timeout
3. **`npm run x | grep` ซ่อน exit code** — ดูข้อความผลลัพธ์ อย่าเชื่อ exit 0 ของ pipeline

### 4. ขั้นตอนถัดไป
1. เจ้าของอนุมัติ commit (Phase 2 + ฐานข้อมูล) และตัดสินใจเรื่องข้อความราคาใน `src/config/plans.ts`
2. Phase 3: Checkout + PromptPay QR + แนบสลิป (ต้องไม่ยอมเปิด `paymentsEnabled` ถ้ายังไม่กรอกเลข PromptPay จริง) พร้อม Integration Test
3. หลังบ้าน: `/admin/orders` (อนุมัติ/ปฏิเสธพร้อม idempotency + AuditLog) — ตอนนี้เมนูแอดมิน 5 หน้ายังเป็น 404

---

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
