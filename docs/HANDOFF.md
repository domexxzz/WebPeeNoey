# เอกสารส่งต่องาน (Project Handoff & Session Log)

## เซสชัน: คำบนการ์ด Telegram และการยืนยันข้อตกลง 50 USD / ฟรี 7 วัน
**วันที่:** 27 ตุลาคม 2026  
**สถานะ:** unit 458 ผ่าน, integration 208 ผ่าน, `tsc` ผ่าน

- **แก้คำบนการ์ด Telegram ในหน้าบัญชี**: เจ้าของเว็บเองยังเข้าใจผิดว่าการ์ดนี้คือห้องชุมชน คำใหม่บอกตรง ๆ ว่าเป็น "แชตส่วนตัว" กับบอท มีแค่ลูกค้ากับบอท และต่อท้ายว่า "ไม่ใช่การเข้ากลุ่ม — ห้อง Discord VIP และกลุ่ม Telegram VIP อยู่ในรายการช่องทางของแพ็กเกจ" มีเทสต์ดักไว้ไม่ให้คำนี้หายไป
- **ยืนยันข้อตกลงกับพาร์ทเนอร์ด้วยเทสต์** (`tests/integration/broker-ib-fifty-usd.test.ts`): ฝาก 50 USD เท่ากันทั้ง XM และ Exness แล้วได้ใช้ฟรี 7 วัน
  - ลูกค้าเห็นขั้นต่ำ 50 USD เท่ากันทั้งสองโบรกเกอร์
  - ยังเป็น 50 USD ที่อัตราแลกเปลี่ยน 31 / 33.5 / 36.25 — เทสต์นี้ยึดผลลัพธ์ปลายทาง ไม่ใช่ตัวเลขบาทตัวใดตัวหนึ่ง
  - คำขอที่อนุมัติแล้วได้สิทธิ์ 7 วันพอดี ออเดอร์เป็นศูนย์บาท ใช้งานได้ถึงวันที่ 6.9 และหมดที่ 7.1

### ค้างอยู่: ต้องตั้งค่าเองใน /admin/settings (เป็นข้อมูลในฐานข้อมูล ไม่ใช่โค้ด)
ระบบเก็บขั้นต่ำเป็น **เงินบาท** รายโบรกเกอร์ แล้วแปลงเป็น USD ด้วย "อัตราแลกเปลี่ยน" ที่ตั้งไว้ในหน้าเดียวกัน
ดังนั้นต้องกรอกช่อง **ยอดฝากขั้นต่ำ XM** และ **Exness ให้เท่ากัน** = 50 × อัตราที่ตั้งไว้ (เช่น อัตรา 33.5 → กรอก 1675 ทั้งสองช่อง)

**กับดักที่ต้องระวัง**: ถ้าแก้อัตราแลกเปลี่ยนอย่างเดียวโดยไม่แก้ยอดบาททั้งสองช่องตาม ขั้นต่ำจริงจะไม่ใช่ 50 USD อีกต่อไป (เช่น เหลือ 1675 ที่อัตรา 36.25 = 46.21 USD) — ต้องแก้ทั้งสามช่องพร้อมกันเสมอ

---

## เซสชัน: กำหนดสิทธิ์แอดมินจากหน้าสมาชิก
**วันที่:** 27 ตุลาคม 2026  
**สถานะ:** unit 457 ผ่าน, integration 205 ผ่าน (เพิ่ม `tests/integration/member-role.test.ts` 8 ข้อ), `tsc` ผ่าน — ยังไม่ deploy

- หน้า `/admin/members/[id]` มีการ์ด "สิทธิ์การใช้งานระบบ" เลื่อนสมาชิกเป็นแอดมินหรือลดกลับเป็นสมาชิกได้ ต้องกรอกเหตุผลและติ๊กยืนยัน
- `setMemberRole()` ใน `src/lib/admin/members.ts` — กติกาที่บังคับไว้:
  - **เปลี่ยนสิทธิ์ตัวเองไม่ได้** (`SELF_ROLE_CHANGE`) กันทั้งลดตัวเองจนเข้าหลังบ้านไม่ได้ และเลื่อนขั้นตัวเองเงียบ ๆ
  - **ลดแอดมินคนสุดท้ายไม่ได้** (`LAST_ADMIN`)
  - **ล็อก `pg_advisory_xact_lock('member-role')`** ครอบการนับแอดมินกับการเขียนไว้ด้วยกัน — มีเทสต์ยิงแอดมินสองคนลดสิทธิ์กันและกันพร้อมกัน ต้องสำเร็จแค่คนเดียวและเหลือแอดมินอย่างน้อยหนึ่งคน
- บันทึก Audit `MEMBER_ROLE_CHANGE` (ก่อน-หลัง, เหตุผล, ผู้ทำ, IP) และแจ้งกลุ่มแอดมินทาง Telegram ทุกครั้ง เพราะการให้สิทธิ์แอดมินคือการเปิดข้อมูลลูกค้าและเงินทั้งหมด

### สิ่งที่แก้เพิ่มหลังรีวิวความปลอดภัย
- **ตรวจสิทธิ์ผู้สั่งซ้ำใต้ล็อก** (`ACTOR_NOT_ADMIN`): เดิมตรวจแค่ตอนเข้า action ถ้าถูกลดสิทธิ์ระหว่างนั้น ยังเลื่อนขั้นพวกพ้องได้อยู่ (ทางลดสิทธิ์มีการนับแอดมินกันไว้ แต่ทางเลื่อนขั้นไม่มี)
- **แจ้งเตือนเมื่อมีคนที่ไม่ใช่แอดมินพยายามสั่งเปลี่ยนสิทธิ์** พร้อมบัญชีและ IP หน่วงไว้ 10 นาทีต่อคน กันยิงรัว — คำสั่งหลังบ้านอื่นยังคงแค่ log ตามเดิม
- **ข้อความแจ้งเตือนบอกครบ**: อีเมลผู้ถูกเปลี่ยน, before → after, สถานะยืนยันอีเมล, อีเมลและ IP ของผู้สั่ง, เหตุผล — และถ้าส่งไม่ออก หน้าจอจะเตือนว่าให้แจ้งทีมเอง ไม่เงียบ
- **เตือนเมื่ออีเมลยังไม่ยืนยัน** ก่อนเลื่อนขั้น (ใครก็สมัครด้วยอีเมลของคนอื่นล่วงหน้าได้)
- แถวที่ถูกปฏิเสธบันทึกด้วยว่าพยายามเปลี่ยนเป็นอะไรและด้วยเหตุผลอะไร, เหตุผลถูกตัดอักขระควบคุม/สลับทิศทางก่อนบันทึก, และย้ายการแจ้งเตือนไปหลัง `revalidatePath` เพื่อไม่ให้การแจ้งเตือนล้มทำให้ดูเหมือนเปลี่ยนสิทธิ์ไม่สำเร็จ
- **ห้ามเปลี่ยน isolation level ของ transaction นี้**: การนับแอดมินถูกต้องเพราะเป็น READ COMMITTED ถ้าเปลี่ยนเป็น RepeatableRead/Serializable snapshot จะถูกจับตั้งแต่ตอนขอล็อก ยอดที่นับจะเก่าและกติกาพัง (เขียนเตือนไว้ในโค้ดแล้ว)
- **ยังไม่ได้ทำ (ตั้งใจ)**: ไม่มีกติกาสองคนอนุมัติ (two-person rule) และไม่มีเพดานจำนวนแอดมิน — แอดมินที่ถูกยึดบัญชียังเลื่อนพวกพ้องได้ภายในไม่กี่วินาที กันได้ด้วยการเฝ้าแจ้งเตือน Telegram เท่านั้น

### เรื่องสำคัญที่ค้นพบระหว่างทำ: JWT เก็บ role ไว้ 30 วัน
- `src/middleware.ts` ตรวจ `token.role` จาก JWT ซึ่งมีอายุ 30 วันและไม่รีเฟรช
- **การลดสิทธิ์มีผลทันที** เพราะ `requireAdminPage()` กับ `getAdminActor()` อ่าน role จากฐานข้อมูลใหม่ทุกครั้ง — middleware เป็นแค่ด่านแรก
- **แต่การเลื่อนขั้นไม่มีผลทันที** เพราะ token ของคนนั้นยังเขียนว่า USER อยู่ middleware จึงปัดตกก่อนถึงหน้า — **ต้องออกจากระบบแล้วเข้าใหม่หนึ่งครั้ง** ข้อความหลังกดเลื่อนขั้นบอกเรื่องนี้ไว้แล้ว

---

## เซสชัน: สิทธิ์ IB เหลือ 7 วัน + UAT ทั้งระบบ
**วันที่:** 26 ตุลาคม 2026  
**สถานะ:** ขึ้นเว็บจริงครบ (`f962bd5`, `01b31fa`, `397fad0`) — workflow ผ่านทุกคอมมิต, ตรวจ goldhybridshot.com แล้วไม่เหลือคำว่า "30 วัน" ที่ไหน

### เปลี่ยนนโยบาย: สิทธิ์ IB 30 → 7 วัน
- เจ้าของตกลงกับพาร์ทเนอร์ทางแชต: ทดลองฟรี 1 สัปดาห์ และขั้นต่ำเงินฝาก **$50 เท่ากันทั้ง XM และ Exness**
- **ช่วงยื่นต่ออายุต้องสั้นกว่าอายุสิทธิ์เสมอ** — เดิมตั้ง 7 วันเท่ากับอายุสิทธิ์พอดี ถ้าปล่อยไว้หน้าต่างจะเปิดค้างตั้งแต่วินาทีที่เพิ่งอนุมัติ สมาชิกยื่นต่อซ้ำได้ไม่จำกัดจากการฝากเงินครั้งเดียว → ตั้งเป็น **2 วัน** และมีเทสต์บังคับ `renewalWindowDays < durationDays`
- **`createBrokerClaim` อ่าน `durationDays` จากแถว Plan ในฐานข้อมูล ไม่ใช่จาก config** — แก้โค้ดอย่างเดียวไม่มีผลกับ production จึงต้องมี migration `20261026110000_ib_plan_seven_days` (เจ้าของรันผ่าน Neon SQL Editor เอง 26 ต.ค.)
- **ขั้นต่ำ 1,675 บาท ทั้งสองโบรก ยังไม่ได้ตั้ง** — เป็นค่าใน `/admin/settings` ไม่ใช่โค้ด เจ้าของต้องพิมพ์เอง (ตอนเขียนยังเป็น 1,000 / 1,500)

### บทเรียน: ตัวเลขนโยบายห้ามพิมพ์มือ
เปลี่ยนอายุสิทธิ์แล้วพบว่ามีตัวเลขเก่าค้างใน **9 ไฟล์** ทั้งหน้าขาย หน้าสมาชิก อีเมลต่ออายุ ข้อความปฏิเสธ และหน้าแอดมิน — โฆษณา 30 วันแต่ให้จริง 7 วัน และบอกว่ายื่นต่อได้ใน 7 วันก่อนหมดทั้งที่เหลือ 2 วัน
- แก้ให้ดึงจาก `BROKER_IB_PLAN.durationDays` / `BROKER_IB_RULES.renewalWindowDays` / `PAYMENT_RULES.expiryReminderDays` ทั้งหมด
- **`tests/day-counts-from-config.test.ts`** เดินอ่านทุกไฟล์ `.ts/.tsx` นอก `config/` ถ้าเจอ "เลข + วัน" พิมพ์ตรง ๆ จะฟ้องพร้อมไฟล์+บรรทัด — ยกเว้น session length และกรอบ 30 วันตอบคำขอตาม PDPA (ไม่ใช่ค่านโยบายของเรา)
- **เพิ่มฟีเจอร์ที่พูดถึงจำนวนวันเมื่อไหร่ ให้ใส่ค่าใน config แล้ว interpolate เสมอ**

### ผล UAT (รันกับระบบในเครื่อง โค้ดชุดเดียวกับที่ deploy)
ผ่าน: สมัครสมาชิก → ล็อกอิน → เลือกแพ็กเกจ → QR พร้อมเพย์ยอดถูก (989.52 ฿) → แนบสลิป → แอดมินอนุมัติ → ได้สิทธิ์ · **ทบวัน**: 30+90 วันต่อกันเป็น 23 ก.พ. 2570 ไม่ทับไม่ขาด · **สลิปซ้ำ**: ไฟล์เดิมไบต์ต่อไบต์ถูกปฏิเสธ ออเดอร์ไม่เปลี่ยนสถานะ · **IB**: สมาชิกที่ยังมีสิทธิ์เหลือถูกบอกให้รอถึง 2 วันก่อนหมด
ทางลบที่ผ่าน: ไม่ติ๊กยอมรับข้อกำหนดแล้วเลี่ยงการตรวจฝั่งเบราว์เซอร์ → เซิร์ฟเวอร์กันเอง (`TERMS_REQUIRED`) · กดอนุมัติโดยไม่ติ๊กยืนยัน → ขึ้นข้อความ **และบันทึก `ADMIN_ACTION_REFUSED`** พร้อม actor/IP/code จริง
รอบสอง (26 ต.ค. เช่นกัน) ผ่านอีก 4 เส้นทาง:
- **IB ฝั่งบวกจนจบ**: สมาชิกใหม่ยื่นคำขอ XM → แอดมินติ๊กครบ 3 ข้อแล้วอนุมัติ → ได้ `2026-10-26 → 2026-11-02` = **7 วันพอดี** บัญชีเป็น VERIFIED · ก่อนหน้านั้นลองติ๊กแค่ 2 จาก 3 → ขึ้น "ติ๊กยืนยันผลตรวจใน Partner Portal ให้ครบทุกข้อก่อนอนุมัติ" **และเขียน `ADMIN_ACTION_REFUSED code=CHECKS_REQUIRED`** — ตรงกับอาการ "กดอนุมัติแล้วไม่เข้า" ที่เคยตามไม่ได้
- **นำเข้ารายงานโบรกเกอร์**: อัป CSV (`Client account,Email,Deposit amount,Currency,Status`) → "ตรวจสอบ" ขึ้น "ผ่านเงื่อนไข 1 จาก 1" โดยยังไม่อนุมัติ → กดอนุมัติ → อนุมัติอัตโนมัติ ได้ 7 วัน และ **เลขบัญชีของแถวที่ไม่ผ่านไม่รั่วลง audit log**
- **ปิดสิทธิ์**: Subscription เป็น REVOKED, บัญชีเทรดเป็น RELEASED พร้อมเหตุผล, audit เก็บค่าก่อน-หลังและ IP ครบ
- **คืนเงิน**: ออเดอร์เป็น REFUNDED พร้อมเลขอ้างอิงโอน และ **ช่วงที่เหลือเลื่อนมาเติมช่องว่างให้เอง** (แพ็กเกจ 3 เดือนที่เคยต่อคิวอยู่ 25 พ.ย. ขยับมาเริ่ม 26 ต.ค. → 24 ม.ค. ลูกค้าไม่เสียวันที่จ่ายไปแล้ว) audit ระบุ `periodsMoved: 1, continuing: true`
- **ยังไม่ได้ทดสอบ**: ไฟล์ export จริงจาก Partner Portal ของ XM / Exness (ที่ทดสอบเป็น CSV ที่เขียนเอง — ถ้าหัวคอลัมน์จริงไม่ตรง ต้องเพิ่ม alias ใน `report-import.ts`), การตรวจสลิปอัตโนมัติเฟส B (EasySlip), Google sign-in
- บัญชีทดสอบในฐานข้อมูล **ในเครื่อง**: `uat-admin@example.test`, `uat-member@example.test` (รหัสทดสอบ ไม่ใช่ของจริง) — ไม่ได้แตะ production

### กับดักของเครื่องพัฒนา
รัน `tsc` + unit + integration ต่อกันรวดเดียวทำให้ Node หน่วยความจำหมด (exit 134) — **ให้รันแยกทีละชุด และปิด dev server ก่อน**

---

## เซสชัน: บันทึกคำสั่งหลังบ้านที่ถูกปฏิเสธ + เปลี่ยนรูปกราฟ
**วันที่:** 26 ตุลาคม 2026  
**สถานะ:** ขึ้นเว็บจริงแล้วทั้งสองคอมมิต (`28686c3`, `6ab3ff7`) — workflow "Test and deploy" ผ่านทั้งคู่, ตรวจ goldhybridshot.com แล้วได้ 200 และไฟล์รูปใหม่เสิร์ฟถูกต้อง

### บันทึกคำสั่งหลังบ้านที่ถูกปฏิเสธ (`28686c3`)
- **ที่มา:** ตามเรื่อง "กดอนุมัติเคลม IB แล้วไม่เข้า" แล้วพบว่า**ตามไม่ได้เลย** เพราะทางที่ปฏิเสธตามกติกาทุกทางใน `review.ts` (`CHECKS_REQUIRED`, `NOT_IN_RENEWAL_WINDOW`, `SELF_APPROVAL`, …) คืนข้อความขึ้นจออย่างเดียว ไม่เขียน audit ไม่เขียน log ไม่แจ้งเตือน
- `runAdminAction` เขียน `ADMIN_ACTION_REFUSED` ทุกครั้งที่ถูกปฏิเสธ: ชื่อ action, รหัสเหตุผล, `kind` (REFUSED / UNEXPECTED), ผู้กด, IP, ชี้ไปที่ Order / User / BrokerAccount / Subscription
- `fail(code, target?)` รับเป้าหมายได้แล้ว และ `writeAudit` รับ PrismaClient นอก transaction ได้ (เดิมรับแต่ `Tx`) — **แต่ audit ที่คู่กับการเปลี่ยนแปลงข้อมูลต้องส่ง `tx` เหมือนเดิม** ตัวตรวจไม่บังคับให้แล้ว
- `importBrokerReportsAction` ไม่ได้ห่อด้วย `runAdminAction` (คืนผลเป็นตาราง) จึงเรียก `recordActionRefusal` เอง
- **ไม่เขียนตอนยังไม่รู้ว่าเป็นใคร** (FORBIDDEN) — ยิง server action ตรง ๆ ถมตารางไม่ได้
- เขียน audit ไม่สำเร็จ = แจ้งกลุ่มแอดมินทันที (ร่องรอยหายคือปัญหาที่ตั้งใจแก้), `targetId` ตัดที่ 64 ตัวอักษร, ตอนระบบพังยิง Telegram + เขียน audit พร้อมกันด้วย `Promise.allSettled`
- ผ่าน security review: ไม่มี CRITICAL/HIGH — MEDIUM 2 + LOW 3 แก้ครบในคอมมิตเดียวกัน
- **กับดักที่เจอตอนแก้เทสต์:** ไฟล์เทสต์ที่ mock `@/lib/prisma` เป็น `{}` ต้องมี `auditLog.create` ไม่งั้น action ที่ถูกปฏิเสธจะยิง Telegram เตือน และ assertion ที่เขียนว่า `toHaveBeenCalledWith({}, …)` ต้องเปลี่ยนเป็น `prisma`

### รูปกราฟบนหน้าแรก (`6ab3ff7`)
- ภาพเดียวกัน (XAUUSD 5 นาที 26 ต.ค.) ใช้สองแบบ: **โชว์เคส = เต็มรวมตารางสรุป** (ส่วนนั้นมี disclaimer อธิบายว่าเป็นสถิติย้อนหลังของอินดิเคเตอร์ ไม่ใช่ผลเทรดจริง), **การ์ดฟีเจอร์ 01 = ตัดแถบขวา (ตาราง Win Rate + แกนราคา) ออก** เพราะการ์ดไม่มีคำอธิบายกำกับ → จะกลายเป็นโฆษณาผลตอบแทน (CLAUDE.md ข้อ 3)
- ย้าย `CHART_MARKERS` ทั้ง 4 จุดให้ตรงป้าย SELL / TP1 / TP2 / SL ของภาพใหม่ — **ถ้าเปลี่ยนรูปกราฟอีกต้องย้ายตามทุกครั้ง**
- โชว์เคสเปลี่ยน .png → .webp และแก้ width/height เป็น 1553×918 ให้ตรงไฟล์จริง; เทสต์ `indicator-showcase.test.tsx` เปลี่ยนจากอ่าน header PNG เป็น RIFF/VP8

### ค้างอยู่
- **ยังสรุปไม่ได้ว่าเคลม IB ตัวทดสอบ `IB-20261025-62B80C` ถูกอนุมัติหรือไม่** — ข้อสรุปเดิมที่ว่า "ไม่เข้าฐานข้อมูล" **ผิด** เพราะไปเช็ค `DATABASE_URL` ใน `.env` ซึ่งชี้ที่ `localhost:5432/webpeenoey` ไม่ใช่ Neon; ในเครื่องมีคำขอ IB แค่รายการเดียวจาก 14 ต.ค. — **เครื่องนี้ไม่มี connection string ของ production เก็บไว้** (อยู่ใน Render / Neon เท่านั้น) ถ้าจะตรวจ production ต้องเปิดหน้า admin เอง หรือเอา URL มาให้
- หลังทดสอบเสร็จ: ปล่อยเลขบัญชีทดสอบ `999999999` และลบสมาชิกทดสอบ
- เจ้าของยังต้องตั้ง: `BACKUP_DATABASE_URL` + `vars.BACKUP_GPG_PUBLIC_KEY` (**workflow สำรองฐานข้อมูลล้มทุกวัน**), `GOOGLE_CLIENT_ID/SECRET`, `NEXT_PUBLIC_LEGAL_OPERATOR_NAME/ADDRESS`
- ชื่อบัญชีพร้อมเพย์ใน DB เป็น "นายจักรพงษ์" แต่สลิปธนาคารขึ้น "นาย จักรพงษ์" (มีเว้นวรรค) — การตรวจชื่อผู้รับของ EasySlip อาจไม่ตรง
- **หลัง 19 พ.ย. 2026**: Vercel deployment เดิมกลับมาทำงาน แล้ว cron ของมันจะยิง Neon ตัวเดียวกัน — ต้องลบ/ชี้ที่อื่นก่อนถึงวันนั้น

---

## เซสชัน: ขั้นต่ำเงินฝากรายโบรกเกอร์เป็นบาท + รูปห้องสัญญาณบนหน้าแรก
**วันที่:** 25 ตุลาคม 2026  
**สถานะ:** ขึ้นเว็บจริงแล้ว — workflow "Test and deploy" ของ `7ef7878` ผ่านทั้ง test + deploy, ตรวจ `https://goldhybridshot.com/` ได้ 200 และการ์ดฟีเจอร์ใช้รูปใหม่ครบ

- **ขั้นต่ำเงินฝากแยกตามโบรกเกอร์เป็นบาท** (แทนค่า USD ค่าเดียวเดิม): XM 1,000 บาท, Exness 1,500 บาท + เรตแลกเปลี่ยน `ibUsdThbRate` (ค่าเริ่ม 33.50) — ลูกค้าเห็นเป็นบาท ระบบเทียบจริงเป็น USD เพราะรายงานโบรกเกอร์เป็น USD
  - `src/lib/broker-ib/deposit.ts`: `convertThbToUsd()`, `meetsMinimumDeposit()` (เผื่อคลาด 5% กันเรตแกว่ง), `minimumForBroker()`
  - `prisma/migrations/20261025170000_ib_min_deposit_thb` — **เพิ่มคอลัมน์อย่างเดียว + backfill** ค่าเดิมที่ตั้งไว้ เพื่อไม่ให้หน้า `/broker-ib` ปิดตัวเองตอน deploy
  - โบรกเกอร์จะถูกเสนอก็ต่อเมื่อมี**ทั้ง**ลิงก์ที่ล็อกไว้และขั้นต่ำที่ตั้งแล้ว
  - `public-offer.ts` ใส่ `OFFER_SHAPE_VERSION = "v2-thb-per-broker"` ใน cache key — **ถ้าแก้รูปร่าง `BrokerOffer` อีก ต้องขยับค่านี้ ไม่งั้น build ล้มตอน prerender เพราะ `unstable_cache` คืนรูปร่างเก่า**
- **รูปการ์ดฟีเจอร์หน้าแรก** (`7ef7878`): การ์ด 02 เปลี่ยนหัวข้อเป็น "สัญญาณเข้ากลุ่ม Telegram VIP และ Discord" ใช้ `discord-signals.webp` (ห้องสัญญาณจริงของเรา), การ์ด 03 กลับไปใช้ `discord-channels.webp`, ลบ `telegram-alert.webp` ซึ่งเป็นภาพกลุ่มของแบรนด์อื่นออกจาก repo (CLAUDE.md ข้อ 3)
- **แจ้งเตือนสมาชิกใหม่เข้า Telegram** `src/lib/notify/member-signup.ts` — ปิดบังอีเมล, ส่งเฉพาะ TradingView username / เวลา / ลิงก์สมาชิก; **ไม่ส่งชื่อที่ผู้ใช้พิมพ์เอง** (ปลอมเป็นชื่อแอดมินได้) และไม่ส่งรหัสผ่าน

### ค้างอยู่ / กับดักที่เจอ
- **คำขอ IB ตัวทดสอบ `IB-20261025-62B80C` ยังเป็น `CLAIM_SUBMITTED`** ทั้งที่เจ้าของบอกว่ากดอนุมัติแล้ว — ไม่มี AuditLog `BROKER_CLAIM_APPROVE` เลยแม้แต่แถวเดียว แปลว่า action ไม่เคยถึงเซิร์ฟเวอร์ ตัดเรื่องอนุมัติตัวเองออกแล้ว (สมาชิกทดสอบเป็นคนละบัญชี) เดาเหลือสองทาง: ติ๊กช่องยืนยันไม่ครบ 3 ช่อง หรือ session หมดอายุ — **ยังไม่รู้ข้อความที่ขึ้นบนหน้าจอ** ถ้าทดสอบใหม่ให้จดข้อความ error ไว้ด้วย
- หลังทดสอบเสร็จ: ปล่อยเลขบัญชีทดสอบ `999999999` และลบสมาชิกทดสอบ
- เจ้าของยังต้องตั้ง: `BACKUP_DATABASE_URL` + `vars.BACKUP_GPG_PUBLIC_KEY` (**workflow สำรองฐานข้อมูลล้มทุกวัน**), `GOOGLE_CLIENT_ID/SECRET`, `NEXT_PUBLIC_LEGAL_OPERATOR_NAME/ADDRESS`
- ชื่อบัญชีพร้อมเพย์ใน DB เป็น "นายจักรพงษ์" แต่สลิปธนาคารขึ้น "นาย จักรพงษ์" (มีเว้นวรรค) — การตรวจชื่อผู้รับของ EasySlip อาจไม่ตรง
- **หลัง 19 พ.ย. 2026**: Vercel deployment เดิมกลับมาทำงาน แล้ว cron ของมันจะยิงฐานข้อมูล Neon ตัวเดียวกัน — ต้องลบ/ชี้ที่อื่นก่อนถึงวันนั้น
- **เทสต์ integration 2 ตัวที่เกี่ยวกับ rate limit ล็อกอิน** ช้าเกิน timeout 5 วิเมื่อรันทั้งชุด (bcrypt) — workflow จึงรันด้วย `--testTimeout=30000`

---


## เซสชัน: อนุมัติสิทธิ์ IB อัตโนมัติจากรายงานโบรกเกอร์ (เฟส 1)
**วันที่:** 25 ตุลาคม 2026  
**สถานะ:** unit 424 ผ่าน, integration 189 ผ่าน (PostgreSQL จริง — 2 เทสต์ rate limit ล็อกอินช้าเกิน 5 วิ เมื่อรันทั้งชุด แต่รันเดี่ยวผ่าน 9/9), `tsc` + `next build` ผ่าน — **ยังไม่ได้ลองกับไฟล์ export จริงของ XM / Exness**

- เหตุผล: XM / Exness ไม่มี Partner API สาธารณะ → เจ้าของเลือก "อัปโหลดรายงาน" แทนบอทล็อกอินพอร์ทัล (ไม่ต้องเก็บรหัสพอร์ทัล)
- หน้า `/admin/broker-claims/import` (ปุ่ม "นำเข้ารายงานโบรกเกอร์" ในหน้าคำขอ): อัปโหลด .csv ของแต่ละโบรกเกอร์ (≤ 2 ไฟล์ ไฟล์ละ ≤ 1MB — รวมต่ำกว่า bodySizeLimit 5MB) → "ตรวจสอบ" แสดงผลทุกคำขอที่รอตรวจ → "อนุมัติคำขอที่ผ่านเงื่อนไข" คำนวณใหม่จากไฟล์ฝั่งเซิร์ฟเวอร์แล้วเรียก `approveBrokerClaim` เดิม (lock / ช่วงยื่น / Subscription / AuditLog) + ส่งอีเมลอนุมัติ + สรุปเข้า Telegram แอดมิน
- นโยบายเจ้าของ: ผ่าน = เลขบัญชีอยู่ในรายงานของโบรกเกอร์นั้น + ยอดฝาก USD ≥ ขั้นต่ำที่บันทึกไว้ตอนยื่น + อีเมลตรง **ถ้ารายงานมีอีเมล** (ไม่มี = ข้าม, บันทึกใน note ของ Audit Log); เปิดใช้งานแล้วแต่ไม่รู้ยอด = ให้แอดมินตรวจเอง
- `report-import.ts` จับคอลัมน์จากชื่อ (ไทย/อังกฤษ): เลขบัญชี (`MT4/MT5 ID`, `Login`, `Client account`… — ไม่ใช้ `หมายเลขลูกค้า`/`Client ID`), อีเมล, ยอดฝาก (คอลัมน์ deposit ที่ไม่ใช่วันที่/จำนวนครั้ง หรือ ประเภทธุรกรรม + จำนวนเงิน) นับเฉพาะ USD; หลายไฟล์ = ยอดฝากใช้ค่าสูงสุด (ไม่นับซ้ำ); รองรับ BOM, `,` `;` แท็บ, UTF-16 — **ถ้าไฟล์จริงหัวคอลัมน์ไม่ตรง ให้เพิ่ม alias ที่นี่**
- แก้ตามรีวิวโค้ด: คำขอหนึ่งล้ม (เช่น deadlock) ไม่ทำให้รอบนั้นหยุด — บันทึกเป็น UNEXPECTED แล้วอนุมัติที่เหลือ + เขียนสรุปเสมอ; นับเฉพาะเงินฝากที่สำเร็จ (มีคอลัมน์สถานะ = ต้องสำเร็จ, ตัด reversal/cancel/refund/bonus/credit); **ไม่สมมติว่าเป็น USD** (ต้องมีคอลัมน์สกุลเงิน = USD, หัวคอลัมน์ระบุ USD หรือค่าติด $/USD); คอลัมน์ยอดฝากใช้รายชื่อแน่นอน (ไม่อ่าน count/method/status/date); ส่งอีเมลไม่สำเร็จแจ้ง Telegram ด้วย; ปุ่มอนุมัติถามยืนยันพร้อมจำนวนที่ผ่าน
- ข้อสังเกตที่ยังไม่แก้ (ตั้งใจ): ช่องอีเมลว่างในรายงานที่มีคอลัมน์อีเมล = ถือว่าไม่มีอีเมล (ข้ามการเทียบ); หลายไฟล์ธุรกรรมคนละช่วงเวลา = ใช้ยอดสูงสุดไม่รวมกัน (นับขาดได้ ไม่นับเกิน)
- ไฟล์ไม่ถูกเก็บ — Audit Log `BROKER_REPORT_IMPORT` เก็บแค่ชื่อไฟล์ จำนวน และเลขคำขอที่อนุมัติ
- export `requireAdmin` จาก `run-admin-action.ts` (action นี้คืน state แบบตารางจึงใช้ `runAdminAction` ตรง ๆ ไม่ได้)
- ล็อกลิงก์พาร์ทเนอร์ด้วย env `XM_PARTNER_LINK` / `EXNESS_PARTNER_LINK` (`src/lib/broker-ib/link-lock.ts`): ตั้งแล้วช่องในหน้าตั้งค่าเป็นอ่านอย่างเดียว, ค่าที่พิมพ์ถูกแทนด้วยค่าล็อก และหน้าเว็บใช้ค่าล็อกแม้ DB ถูกแก้ — ลิงก์ที่เจ้าของเลือก (อ่านจากพอร์ทัลกับเจ้าของ 25 ต.ค.): XM แคมเปญ "คืนยอดนักเทรด (AR)" `https://clicks.pipaffiliates.com/c?c=1263598&l=th&p=1`, Exness partner code `00awo0516g` `https://one.exnessonelink.com/a/00awo0516g` (เพิ่ม `exnessonelink.com` ในโดเมนที่รู้จัก)
- ขั้นถัดไป: ขอไฟล์ export จริงจากเจ้าของ (XM รายชื่อเทรดเดอร์ + รายงานเงินฝาก, Exness Client accounts / transactions) มาทดสอบ; เฟส 2 ที่คุยไว้: เปิดสิทธิ์ TradingView อัตโนมัติ (ต้องมีบอทล็อกอิน TradingView)

---

## เซสชัน: โดเมนจริง goldhybridshot.com
**วันที่:** 25 ตุลาคม 2026  
**สถานะ:** ออนไลน์แล้วที่ **https://goldhybridshot.com** — ตรวจจากเครื่อง: หน้าแรก 200 + `X-Frame-Options: DENY`, canonical/sitemap/NextAuth callback = `https://goldhybridshot.com`, `/llms.txt` 200 (commit `59b2bfc` ขึ้นแล้ว), `/admin` 307, อีเมลติดต่อใหม่แสดงบนหน้าแรก

- เจ้าของซื้อโดเมนที่ GoDaddy (DNS `ns13/ns14.domaincontrol.com`) — แก้ `A @` จาก Parked เป็น `216.24.57.1`, `CNAME www` เป็น `goldhybridshot.onrender.com`; เพิ่ม Custom Domain ใน Render → apex ยืนยันแล้ว ใบรับรองออกแล้ว; **`www` ยัง Waiting for Verification** (DNS สาธารณะบางที่ยังจำ record เดิม) — ถ้ายังไม่ผ่านให้กด 🔄 ใน Render ภายหลัง ตอนนี้ `https://www.goldhybridshot.com` ยังไม่มีใบรับรอง
- Render Subdomain (`goldhybridshot.onrender.com`) **เปิดไว้** — health check ภายในของ Render ยิงที่ URL นี้; canonical ชี้โดเมนใหม่แล้ว
- env production 3 ตัว (`NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_DOMAIN`) เจ้าของตั้งเป็นโดเมนใหม่แล้วก่อน deploy รอบนี้ — สมาชิก/แอดมินต้องล็อกอินใหม่หนึ่งครั้ง
- push ขึ้น main ไม่ deploy เอง: ลอง `autoDeployTrigger: commit` + ให้สิทธิ์ Render GitHub App แล้วก็ยังเป็น Manual ทุกครั้ง (ยืนยันจากภาพรายการ Deploys) → **เปลี่ยนเป็น `.github/workflows/deploy.yml`:** push ขึ้น main → tsc + unit + integration (Postgres 16 ใน CI) → ผ่านแล้วเรียก `secrets.RENDER_DEPLOY_HOOK` พร้อม `&ref=<sha>` (deploy เฉพาะ commit ที่ทดสอบแล้ว), ล้มเหลวแจ้ง Telegram; `render.yaml` ตั้ง `autoDeployTrigger: "off"` (ต้องมีเครื่องหมายคำพูด) กัน deploy ซ้ำ — **มี migration ใหม่ต้องรันกับ Neon (direct URL) ก่อน push เสมอ**
- `20261024120000_slip_check` รันกับ Neon แล้ว (25 ต.ค. — เพิ่มคอลัมน์อย่างเดียว เว็บเดิมยังตอบ 200) ก่อน push `3b6dbd4`: unit 403/403, integration 186/186 (PostgreSQL จริง), `tsc` ผ่าน
- GitHub `secrets.CRON_SECRET` ตั้งแล้ว (ค่าเดียวกับ Render) → รัน Check expiry + Watchdog ด้วยมือผ่าน (HTTP 200, `problems: []`)
- Telegram: บอท `@GHSAdmin_bot`, กลุ่มแอดมิน "AdminGHS" (supergroup) ส่งข้อความทดสอบได้; Resend: โดเมนเชื่อมผ่าน GoDaddy Domain Connect (DKIM/SPF/DMARC ขึ้นแล้ว), API key แบบ Sending access — ค่าทั้งหมดอยู่ใน `.env.vercel-secrets.local` รอเจ้าของกรอก 6 ค่าใน Render แล้วลงทะเบียน webhook (`npm run telegram:webhook`) + ทดสอบอีเมล
- (ข้อความเดิมก่อนแก้) ค้าง: `3b6dbd4` (ตรวจสลิป) ยังไม่ push — รอเจ้าของรัน migration `20261024120000_slip_check` กับ Neon; GitHub `vars.APP_URL` = `https://goldhybridshot.com` ตั้งแล้ว (25 ต.ค.) แต่ `secrets.CRON_SECRET` ยังไม่ได้ตั้ง → watchdog/check-expiry/slip-recheck ยังล้มทุกรอบ; ตอนนี้ทำได้แล้ว: ยืนยันโดเมนกับ Resend (SPF/DKIM ใน GoDaddy), Search Console แบบ Domain property (TXT), อีเมล `support@goldhybridshot.com` ผ่าน GoDaddy Email Forwarding

## เซสชัน: ตรวจสลิปอัตโนมัติ (พอร์ตจาก Tradepulse — Phase A + B, ไม่มีอนุมัติอัตโนมัติ)
**วันที่:** 24 ตุลาคม 2026  
**สถานะ:** unit 403/403 (เพิ่ม `tests/slip-check.test.ts`), integration 186/186 กับ PostgreSQL จริง (เพิ่ม `tests/integration/slip-check.test.ts` 15 ข้อ), `tsc` ผ่าน, `next build` ผ่าน — รีวิวโค้ด + รีวิวความปลอดภัยแล้ว แก้ HIGH/MEDIUM ตามด้านล่าง — **ยังไม่ commit / ยังไม่ deploy / ยังไม่ได้รัน migration กับ Neon**

- ที่มา: `domexxzz/tradepulse` (`src/lib/slip-qr.ts`, `slip-qr-verify.ts`, `slip-receiver.ts`, `slip-verify.ts`) — ที่นั่นใช้ EasySlip v1 + อ่าน QR ด้วย sharp + jsqr
- **Phase A (ทำงานเสมอ ไม่ต้องตั้งค่า):** `src/lib/payments/slip-qr.ts` อ่าน QR ในสลิป → `slip-qr-payload.ts` checksum CRC16 + แกะเลขอ้างอิง → `SlipUpload.qrPayload` (unique) กันสลิปเดิมที่ถ่าย/ครอปใหม่ (hash ไฟล์จับไม่ได้)
- **Phase B (ตั้ง `EASYSLIP_TOKEN`):** `src/lib/payments/easyslip.ts` เรียก **EasySlip API v2** `POST https://api.easyslip.com/v2/verify/bank` ด้วย `{payload}` (รูปสลิปถูกส่งเฉพาะตอนอ่าน QR เองไม่ได้ — multipart `image`) → ยอดตรงถึงสตางค์, บัญชีผู้รับ (เลขพร้อมเพย์ของออเดอร์ + `SLIP_RECEIVER_ACCOUNTS`) **และชื่อผู้รับ** (`Payment.promptpayAccountName`), โอนหลังสร้างออเดอร์ (±30 นาที), `SlipUpload.transRef` unique
- สถานะ (`SlipCheckStatus`): DISABLED / PENDING / VERIFIED / AMOUNT_MISMATCH / WRONG_RECEIVER / RECEIVER_UNVERIFIED / STALE / UNREADABLE / ERROR / DUPLICATE — **ไม่ปฏิเสธ/ไม่อนุมัติเอง** ยกเว้นสลิปซ้ำ (hash/QR/transRef ของออเดอร์อื่น) ถูกปฏิเสธตอนแนบ และ `approveOrder` ห้ามอนุมัติสลิปที่เป็น DUPLICATE
- ตรวจซ้ำ: `SLIP_PENDING` (สลิปกรุงเทพโอนไม่ถึง 5 นาที), 429/5xx, 402/403 (โควตา — แจ้งแอดมิน), เน็ตสะดุด = PENDING → `src/lib/jobs/slip-recheck.ts` ผ่าน `/api/cron/slip-recheck` + `.github/workflows/slip-recheck.yml` ทุก 10 นาที (รอบละ ≤10 ใบ งบ 45 วินาที, สูงสุด 12 ครั้งแล้วเป็น ERROR) — ไม่มีสลิปรอ = ตอบ skipped ไม่บันทึก JobRun; JOB_NAMES เพิ่ม `slip-recheck` (โชว์ในหน้าสถานะ)
- หน้าแอดมิน: ป้ายผลตรวจในรายการ `/admin/orders` + กล่องผลตรวจใต้สลิปในหน้าออเดอร์ + เตือนเมื่อผลไม่ผ่าน + เติมเลขอ้างอิงให้เฉพาะ `transRef` ที่ธนาคารยืนยัน; Telegram สลิปใหม่มีบรรทัดผลตรวจ; ปัญหา token/โควตาแจ้ง 🚨 ไม่เกินชั่วโมงละครั้งต่อโปรเซส
- แก้ตามรีวิว: (1) ลูกค้าส่งรูปที่ชัดกว่าของการโอนเดิมให้ออเดอร์เดิมหลังถูกปฏิเสธได้ (QR/transRef เทียบเฉพาะออเดอร์อื่น ใบเก่าของออเดอร์เดียวกันถูกย้ายคีย์ให้ใบใหม่) (2) jsQR บล็อก event loop (ภาพ noise เคยใช้ ~12 วินาที): ตรวจเจ้าของ/สถานะออเดอร์ก่อนอ่าน QR, ถอดทีละภาพทั้งโปรเซส, ทุกชั้น ≤1MP, งบรวม 3 วินาที (3) ภาพผอมสูง/ใหญ่: `limitInputPixels` 25MP, ปฏิเสธสัดส่วน >1:6 หรือด้านสั้น <200px, resize มีกรอบทั้งสองด้านเสมอ (4) เลขท้ายบัญชี 4 หลักปลอมได้ → ต้องชื่อผู้รับตรงด้วย ไม่งั้น WRONG_RECEIVER/RECEIVER_UNVERIFIED (5) QR checksum ปลอมได้ (CRC ไม่มีกุญแจ) → ป้ายเขียนว่า "รูปแบบถูกต้อง ยังไม่ใช่การยืนยันจากธนาคาร" และไม่เติมเลขจาก QR ในช่องอนุมัติ (6) คิวตรวจซ้ำค้าง: ใบที่ถูกแทน/ออเดอร์ที่แอดมินตัดสินแล้วเลิกตรวจ (DISABLED) (7) ข้อความจากผู้ให้บริการผ่าน `redactSensitive` + ตัด 120 ตัว
- นโยบายความเป็นส่วนตัวข้อ 4 เพิ่มการส่งข้อมูล QR/รูปสลิปให้ EasySlip; `render.yaml` / `.env.example` / หน้าสถานะ: `EASYSLIP_TOKEN` (ความลับ), `SLIP_RECEIVER_ACCOUNTS`; dependency ใหม่ `jsqr`, `sharp` (เดิมมากับ Next แบบ optional — ตอนนี้ระบุชัด)
- **กับดัก:** jsQR 1.4 `inversionAttempts: "onlyInvert"` พังด้วย "reading 'height'" — ภาพโหมดมืดใช้ `negate()` ของ sharp แทน; migration ถูกแก้ระหว่างพัฒนา (เพิ่ม RECEIVER_UNVERIFIED) — DB ทดสอบในเครื่องต้อง `migrate reset` แล้ว
- **ก่อน deploy:** รัน `prisma migrate deploy` กับ Neon (direct URL) สำหรับ `20261024120000_slip_check` → push → (Auto-Deploy น่าจะปิดอยู่ — กด Manual Deploy) → ตั้ง `EASYSLIP_TOKEN` + `SLIP_RECEIVER_ACCOUNTS` ใน Render เมื่อพร้อม; workflow slip-recheck ต้องการ `vars.APP_URL` + `secrets.CRON_SECRET` เหมือนงานอื่น
- ยังไม่ทำ: ข้อความส่งซ้ำของ Watchdog (สลิปที่แจ้งไม่สำเร็จ) ยังไม่มีบรรทัดผลตรวจ; ทดสอบกับสลิปจริงจากแต่ละธนาคาร (ทำได้หลังเปิดรับเงิน); ถ้าต้องการอนุมัติอัตโนมัติ (Phase C) ให้ใช้เฉพาะ VERIFIED และผ่านฟังก์ชันอนุมัติเดิม
- 24 ต.ค.: `59b2bfc` (llms.txt/schema) push แล้วแต่ 15 นาทีต่อมา `/llms.txt` ยัง 404 บนเว็บจริง → Render ไม่ได้ deploy เอง

## เซสชัน: ฐาน SEO / GEO / AEO (llms.txt, WebSite + Breadcrumb schema, ช่อง env ยืนยันเว็บและสถิติ)
**วันที่:** 24 ตุลาคม 2026  
**สถานะ:** unit 373/373 (เพิ่ม `tests/seo-groundwork.test.tsx` 14 ข้อ), `tsc` ผ่าน, `next build` ผ่าน (ใส่ `experimental.cpus: 1` ชั่วคราวแล้วเอาออก) — ตรวจบน `next start` ด้วยค่าทดสอบ: หน้าแรกมี meta `google-site-verification` / `msvalidate.01` + สคริปต์ Cloudflare beacon + JSON-LD Organization/WebSite/Product/FAQPage, `/features` มี BreadcrumbList, `/llms.txt` = `text/plain; charset=utf-8` 70 บรรทัด, `/privacy` ข้อ 8 มีข้อความ Cloudflare Web Analytics — ยังไม่ commit / ยังไม่ deploy

- `src/config/integrations.ts`: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_SITE_VERIFICATION` (ตัวอักษร A-Z 0-9 _ - 10–100 ตัว), `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` (hex 32 ตัว) — ไม่ตั้ง/ผิดรูปแบบ = ไม่ใส่แท็ก/ไม่โหลดสคริปต์; ประกาศใน `render.yaml`, `.env.example`, หน้าสถานะหลังบ้าน
- สถิติเลือก **Cloudflare Web Analytics (ไม่ใช้คุกกี้)** เพราะนโยบายความเป็นส่วนตัวข้อ 8 สัญญาว่าจะขอความยินยอมก่อนใช้คุกกี้วิเคราะห์ — ถ้าจะใช้ GA4 ต้องทำแบนเนอร์ขอความยินยอม (PDPA) ก่อน; สคริปต์โหลดเฉพาะหน้าบ้าน (layout marketing) ไม่โหลดในหน้าสมาชิก/หลังบ้าน; นโยบายความเป็นส่วนตัวเพิ่มย่อหน้าเปิดเผยเฉพาะเมื่อตั้ง token (`analyticsDisclosure`)
- `src/lib/seo.ts`: Organization มี `@id` (`<url>/#organization`), เพิ่ม `buildWebSiteJsonLd` (ไม่มี SearchAction เพราะไม่มีหน้าค้นหา) ใน layout หน้าบ้าน, `buildBreadcrumbJsonLd` ใน `/features`, `/guide`, `/broker-ib` และหน้ากฎหมาย (ผ่าน `LegalPage`)
- `/llms.txt` (`src/app/llms.txt/route.ts` + `src/lib/llms.ts`, force-static): สร้างจาก config จริง — คำอธิบาย, หน้าหลัก, ราคาแพ็กเกจ, สิทธิ์, FAQ, คำเตือนความเสี่ยง, ช่องทางติดต่อ (ถ้าตั้ง), หน้ากฎหมายเฉพาะเมื่อไม่ใช่ฉบับร่าง — เทสต์กันตัวเลข %/Win Rate/กำไร
- **กับดัก:** ใส่ token Cloudflare ปลอม/ของโดเมนอื่น beacon จะยิง CORS error ใน console (เห็นตอนทดสอบบน localhost) → คะแนน Best Practices ตก — ใช้ token ที่สร้างให้โดเมนจริงเท่านั้น
- `.next` ในเครื่องตอนนี้ build ด้วยค่าทดสอบ (ไม่ได้ deploy ไม่มีผลกับเว็บจริง)

## เซสชัน: ตรวจความพร้อมก่อนเปิดขาย (อ่านอย่างเดียว ไม่แก้โค้ด)
**วันที่:** 22 ตุลาคม 2026  
**สถานะ:** ตรวจเว็บจริง + GitHub Actions แล้ว — ไม่ได้ล็อกอินหลังบ้าน (ค่าใน `/admin/settings` และ `/admin/status` ยังไม่ได้ดูจากหน้าจริง)

- เว็บจริง https://goldhybridshot.onrender.com: หน้าสาธารณะ/auth = 200 (~0.1–0.4 วินาที), `/account` `/admin` `/checkout/*` = 307 ไป signin, cron ไม่มี secret = 401, header ความปลอดภัยครบ, `/broker-ib` = 404 (IB ปิด), ผู้ให้บริการล็อกอินมีแค่อีเมล+รหัสผ่าน (ไม่มี Google)
- **GitHub Actions ล้มทุกรอบตั้งแต่ 20 ต.ค.**: repo ไม่มี variables/secrets เลย — watchdog/check-expiry: "ยังไม่ได้ตั้ง vars.APP_URL หรือ secrets.CRON_SECRET", backup: "ยังไม่ได้ตั้ง secrets.BACKUP_DATABASE_URL หรือ vars.BACKUP_GPG_PUBLIC_KEY" → ไม่มีการหมดอายุสมาชิกอัตโนมัติ ไม่มี watchdog ไม่มีสำรองฐานข้อมูล
- **ช่องทางติดต่อบนเว็บจริงใช้ไม่ได้**: `support@peenoey.com` (โดเมน peenoey.com ไม่มี DNS), `t.me/peenoey_admin` ไม่มีผู้ใช้นี้ — ค่าตายตัวใน `src/config/site.ts` (`contact`); LINE `@peenoey` ยังไม่ได้ตรวจ
- ลิงก์ Discord `discord.gg/erJFe57YY` **หมดอายุ 13 พ.ย. 2026** (API ของ Discord คืน `expires_at`) — ต้องสร้างลิงก์ "ไม่หมดอายุ" แล้วตั้ง `NEXT_PUBLIC_DISCORD_INVITE` + deploy ใหม่
- หน้าข้อกำหนดยังขึ้น "ฉบับร่าง" (ยังไม่ได้ตั้ง `NEXT_PUBLIC_LEGAL_OPERATOR_NAME/ADDRESS`)
- รับเงินมี kill-switch ถูกต้อง (`src/lib/orders/availability.ts`: ปิด/ปิดปรับปรุง/ไม่มีบัญชี = ไม่สร้าง QR)

### แก้ช่องทางติดต่อให้อ่านจาก env (ยังไม่ commit / ยังไม่ deploy)
**สถานะ:** unit 359/359 (เพิ่ม `tests/contact-config.test.tsx` 11 ข้อ), `tsc` ผ่าน — ไม่ได้เปิด dev server (หน่วยความจำว่าง ~950MB) ตรวจผลแสดงผลผ่าน `renderToStaticMarkup` ในเทสต์แทน

- `src/config/site.ts`: `siteConfig.contact` มาจาก `NEXT_PUBLIC_CONTACT_EMAIL` / `NEXT_PUBLIC_CONTACT_LINE` / `NEXT_PUBLIC_CONTACT_TELEGRAM` ผ่าน `resolveContact()` — ตรวจรูปแบบ (อีเมล, LINE OA `@id`, Telegram username 5–32 ตัวหรือ `https://t.me/<name>`) ไม่ตั้ง/ผิด = `null` **ไม่มีค่าเริ่มต้นแล้ว** (บัญชี peenoey เดิมไม่มีจริง)
- หน้าแรก (`ContactChannels` ใน `contact-section.tsx`) แสดงเฉพาะช่องทางที่ตั้ง ไม่มีเลย = ไม่แสดงรายการ; เอกสารกฎหมายใช้ `formatContactLine()` (ไม่มีเลย = "ยังไม่ได้ระบุช่องทางติดต่อ …"); JSON-LD ใส่ email เฉพาะเมื่อมี
- เพิ่มทั้ง 3 ตัวใน `render.yaml`, `.env.example` และหน้าสถานะหลังบ้าน (`MONITORED_ENV`, ไม่บังคับ)
- **หลัง deploy โดยยังไม่ตั้ง env ทั้ง 3 ตัว หน้าแรกจะไม่มีช่องทางติดต่อเลย** — ต้องกรอกใน Render แล้ว deploy ใหม่ (NEXT_PUBLIC_* ฝังตอน build)
- commit `15af4ba` push แล้ว (22 ต.ค. 22:19) + เจ้าของตั้ง `NEXT_PUBLIC_CONTACT_EMAIL=zoritananabi@gmail.com` ใน Render แล้ว — **แต่ ~35 นาทีหลัง push เว็บจริงยังเป็นโค้ดเก่า** (หน้าแรก/`/terms` ยังมีลิงก์ peenoey ไม่มีอีเมลใหม่) และ deploy ล่าสุดที่เห็นใน Render เป็น "Manually deployed" จาก `63304f6` → น่าจะปิด Auto-Deploy อยู่ ต้องกด Manual Deploy → Deploy latest commit แล้วตรวจซ้ำ (เอกสารที่บอกว่า push = deploy อัตโนมัติ อาจไม่จริง)
- GitHub Actions ยังไม่มี variables/secrets (ตรวจซ้ำ 22 ต.ค. 22:55) — workflow ใช้: `vars.APP_URL`, `vars.BACKUP_GPG_PUBLIC_KEY`, `secrets.CRON_SECRET`, `secrets.BACKUP_DATABASE_URL`, `secrets.TELEGRAM_BOT_TOKEN`, `secrets.TELEGRAM_ADMIN_CHAT_ID`
- 24 ต.ค.: `15af4ba` ขึ้นเว็บจริงแล้ว (หน้าแรกมีอีเมลใหม่ ไม่มีลิงก์ peenoey)
- 24 ต.ค. PageSpeed (มือถือ): Performance 90 / Accessibility 100 / Best Practices 77 (deprecated API + error ใน console — น่าจะมาจาก widget TradingView ยังไม่ได้ยืนยัน) / SEO 100 — LCP 2.9s, CLS 0.014, TBT 150ms; ยังไม่มี analytics, ไม่มี Search Console/Bing verification, ไม่มี `/llms.txt`, sitemap มี 3 URL (หน้ากฎหมายถูกตัดออกเพราะยังเป็นฉบับร่าง)
- ยังไม่แตะ: `siteConfig.supportTelegram` (ไม่มีที่ใช้ ค่าเริ่มต้นเป็น t.me/peenoey_support ที่ไม่มีจริง), `NEXT_PUBLIC_SUPPORT_TELEGRAM` (ลิงก์กลุ่ม VIP ในหน้าสมาชิก), `domain`/`adminEmail` ค่าเริ่มต้น peenoey

## เซสชัน: ภาพหน้าจอจริงในการ์ดฟีเจอร์หน้าแรก
**วันที่:** 21 ตุลาคม 2026  
**สถานะ:** unit 342/342, `tsc` ผ่าน, ตรวจบน dev server แล้ว (โหลดภาพครบ ไม่มี error ใน console) — ยังไม่ commit

- การ์ด 01 อินดิเคเตอร์ / 02 Telegram ใช้ภาพหน้าจอจริงที่เจ้าของส่งมา (`public/images/features/*.webp`, 1200×750, ≤ 42KB) ผ่าน `next/image` + `sizes` ของ `IMAGE_SLOTS.featureScreenshot`; การ์ด 03 Discord ยังเป็น SVG
- ตัดก่อนใช้: กราฟตัดตาราง Win Rate 69.6% / จำนวนสัญญาณออก (สถิติผลงานที่พิสูจน์ไม่ได้ — CLAUDE.md ข้อ 3); แชตเหลือเฉพาะข้อความ SELL SIGNAL — ตัดรายชื่อแชต (มีแถว Login code), รายชื่อ/รูปสมาชิกคนอื่น, ข้อความ "+822 POINTS" ออก และเบลอบรรทัด "… joined the group"
- อนิเมชันเดิม: การ์ดหมุนเข้าที่ (`.mx-art`) + ภาพเด้งเข้า (`.fa-pop`) + ชี้แล้วการ์ดตั้งตรง/ภาพซูมเล็กน้อย; ลบ `ChatArt` ที่ไม่ใช้แล้ว
- เพิ่มภายหลัง (ยังไม่ commit): การ์ด 03 Discord ใช้ภาพหน้าจอ Noble Gold Society (`discord-channels.webp`) — ตัดรายชื่อ/จำนวนสมาชิกด้านขวาออก, เบลอตาราง Win Rate 55.9% ในภาพคู่มือ; ลบ `CommunityArt` (SVG) แล้ว — ทั้ง 3 การ์ดเป็นภาพจริง
- อนิเมชันเฉพาะภาพ (ยังไม่ commit — `feature-art.tsx` + `src/styles/motion-art.css` ส่วน "ภาพหน้าจอจริงในการ์ดฟีเจอร์"):
  - กราฟ: แผ่นสีพื้นหดไปทางขวา (`.fa-wipe`, scale) = กราฟถูกวาดจากซ้ายไปขวา + วงแสงกระพริบที่ BUY → TP1 → TP2 → SL (`.fa-pulse`, ตำแหน่งเป็น % ใน `CHART_MARKERS` — ถ้าเปลี่ยนภาพกราฟต้องแก้ตำแหน่งด้วย)
  - Telegram: จุด "กำลังพิมพ์" (`.fa-typing`) แล้วข้อความเลื่อนขึ้น (`.fa-slide`)
  - Discord: แถบไฮไลต์ไล่ตามห้อง (`.fa-scan`, ระยะห่างห้อง = 110% ของแถบ — ผูกกับภาพ `discord-channels.webp`)
  - ทุกภาพ: แสงวิ้งเมื่อชี้ (`.mx-shine`) — ปุ่มหยุดอนิเมชันหยุด `.fa-pulse`/`.fa-scan`, ลดการเคลื่อนไหว = ซ่อนทุกชั้นและแสดงภาพเต็ม, runtime ไม่เริ่ม = failsafe เปิดภาพหลัง 2.5 วินาที
- ไม่ได้ใช้แบนเนอร์ "คืน Rebate XM" — มี QR/รหัสพันธมิตร/LINE @todaytrader และอ้าง "มูลค่า 50,000฿" รอเจ้าของยืนยันว่าเป็นของตัวเองและจะใช้ตรงไหน

## เซสชัน: เว็บจริงถูก Vercel พักไว้ (Fair-use CPU เกิน)
**วันที่:** 21 ตุลาคม 2026  
**สถานะ:** ตรวจสาเหตุแล้ว ไม่ได้แก้โค้ด — https://goldhybridshot.vercel.app แสดง "This deployment is temporarily paused"

- ทีม Vercel `domezzxxs-projects` (Hobby) โดน `softBlock` เหตุผล `FAIR_USE_LIMITS_EXCEEDED` ประเภท `fluidCpuDuration` เมื่อ 20 ต.ค. 2026 14:19 น. — ปลดเองอัตโนมัติ **19 พ.ย. 2026 14:19 น.** (ดูจาก `vercel api /v2/teams/<orgId>` ฟิลด์ `softBlock`)
- **โควตาเป็นของทั้งทีม ไม่ใช่ของโปรเจกต์นี้** — ทีมมี 14 โปรเจกต์ ถูกพักทั้งหมด (badminton-booking, free30 ได้ 402)
- สัดส่วนการใช้ 1–20 ต.ค. (จาก `vercel api "/v2/usage?type=requests&from=<ISO>&to=<ISO>"` ฟิลด์ `breakdown`): function invocations — tradepulse 96.6% (~447k), badminton-booking 3.3%, webpeenoey 0.1% (624 ครั้ง); function execution (GB-hrs) — tradepulse ~92%, badminton-booking ~8%, webpeenoey ~0.2% → **ตัวกินโควตาคือ tradepulse ไม่ใช่เว็บนี้**
- quantvisionx.com (โดเมนของ tradepulse) ตอนนี้ DNS ชี้ไป Render แล้ว (216.24.57.x) แต่ยังผูกโดเมนไว้ในโปรเจกต์ Vercel `tradepulse`; badminton-booking ใช้มากขึ้นตั้งแต่ 13 ต.ค. (บางวัน 38–56% ของทีม)
- Hobby ใช้ `vercel metrics` / `/v1/usage` ไม่ได้ (ต้อง Observability Plus / Pro) — ใช้ `/v2/usage` แทน
- ทางเลือก (เจ้าของตัดสินใจ): รอถึง 19 พ.ย. / อัปเกรด Pro ให้เว็บกลับมาทันที / แยก webpeenoey ไปอยู่บัญชีหรือโฮสต์ที่ไม่แชร์โควตากับ tradepulse และ badminton-booking
- **เจ้าของเลือก: ย้ายไป Render Starter (Singapore)** — ไม่ใช้ Vercel Hobby บัญชีใหม่ (Hobby ห้ามใช้เชิงพาณิชย์ เว็บนี้รับชำระเงิน)

### ย้ายไป Render — ขั้นที่ 2: ออนไลน์แล้ว (21 ต.ค. 2026 17:26 น.)
- **https://goldhybridshot.onrender.com** (Blueprint `Webpeenoey`, service `goldhybridshot`, Starter, commit `45720ad`) — build 1m47s ผ่านบน RAM 512MB
- smoke test บนเว็บจริงผ่าน: `/`, `/features`, `/guide`, `/terms`, `/privacy`, `/refund`, `/robots.txt`, `/sitemap.xml`, `/opengraph-image`, `/auth/signin` = 200 พร้อม `X-Frame-Options: DENY`; `/account`, `/admin` = 307 ไป signin; cron check-expiry / watchdog / webhook Telegram ไม่มี secret = 401; canonical = URL Render; ภาพการ์ดฟีเจอร์ทั้ง 3 ขึ้น
- **แก้ล็อกอินบน Render (commit `7b9ee8c`):** ล็อกอินสำเร็จแต่ middleware มองไม่เห็น session → `/admin`, `/account` เด้งกลับหน้าเข้าสู่ระบบ — `getToken()` เดาชื่อคุกกี้จาก `NEXTAUTH_URL` / `VERCEL` และบน Render คำขอหลัง proxy เป็น http จึงหา `next-auth.session-token` แต่ NextAuth ตั้ง `__Secure-next-auth.session-token` (ทดลองกับ production ด้วย session ของผู้ใช้สมมติที่ไม่มีอยู่จริง ยืนยันแล้ว) → middleware อ่านทั้งสองชื่อ (ยังตรวจลายเซ็นด้วย secret) — commit แรก `87fe231` ที่เดาจาก `x-forwarded-proto` ใช้ไม่ได้บน Render; ยืนยันแล้วว่าเปิด `/admin` ได้ (200) ด้วย session แอดมินจริง
- รีเซ็ตรหัสแอดมินในฐานข้อมูลจริงตามคำขอเจ้าของ (Audit Log `ADMIN_PASSWORD_RESET`) — รหัสใหม่อยู่ใน `.env.vercel-secrets.local` (`PROD_ADMIN_PASSWORD`, ไม่มีเครื่องหมายคำพูด); `cf-connecting-ip` บน Render ยืนยันแล้วจาก RateLimit key ที่ได้ IP จริง
- **กับดัก:** deploy แรกล้มเพราะ `vercel env pull` คืน `NEXTAUTH_SECRET` / `CRON_SECRET` เป็นค่าแทน 11 ตัว (ตัวแปร sensitive ของ Vercel) — ค่าจริงอยู่ใน `.env.vercel-secrets.local`
- **ยังค้าง:** เปลี่ยน GitHub `vars.APP_URL` เป็น URL Render (ไม่งั้น watchdog/check-expiry ยิงไป Vercel ที่ถูกพัก); ยืนยัน `cf-connecting-ip` จาก IP ใน Audit Log หลังมีการกระทำของแอดมินครั้งแรก; เจ้าของลองล็อกอินแอดมิน; เรียก check-expiry ครั้งแรก (หรือรอ 09:05) ไม่งั้น watchdog เตือน "ยังไม่เคยรันสำเร็จ"; หลัง 19 พ.ย. ทำ redirect จาก goldhybridshot.vercel.app

### ย้ายไป Render — ขั้นที่ 1: เตรียมโค้ด (เสร็จ ยังไม่ commit / ยังไม่ deploy)
**สถานะ:** unit 341/341 + เทสต์ใหม่ผ่าน, `tsc` ผ่าน, `next build` ผ่านด้วย `RENDER=true` + `NEXT_PUBLIC_APP_URL=https://goldhybridshot.onrender.com`, `next start` ตอบ `/robots.txt`, `/`, `/sitemap.xml` = 200 พร้อม `X-Frame-Options: DENY` และ URL ที่ตั้งไว้

- `render.yaml` (Blueprint): web service `goldhybridshot`, node, singapore, starter, build `npm ci --include=dev && npx prisma generate && npm run build`, start `npm start`, health check `/robots.txt`, `NODE_VERSION=24`, ค่าลับทุกตัว `sync: false` (กรอกใน dashboard) — migration ยังรันเองก่อน deploy เหมือนเดิม
- `src/lib/request.ts`: บน Render (`RENDER=true`) อ่าน IP จาก `cf-connecting-ip` อย่างเดียว — Render แค่ต่อท้าย `x-forwarded-for` และไม่ตั้ง `x-real-ip` ผู้ใช้จึงปลอมสองตัวนั้นได้; ไม่มี header = ถัง `unknown-ip` รวม; บน Vercel ทำงานเหมือนเดิม
- `src/config/site.ts`: เช็ก `NEXT_PUBLIC_APP_URL` ตอน build production ทำงานบน Render ด้วย (`RENDER=true` และไม่ใช่ `IS_PULL_REQUEST=true`)
- งานประจำวัน check-expiry ย้ายจาก Vercel Cron (ลบ `crons` ออกจาก `vercel.json`) ไป `.github/workflows/check-expiry.yml` (02:05 UTC, Bearer `CRON_SECRET`, ล้มเหลว → แจ้ง Telegram) ใช้ `vars.APP_URL` / secrets ชุดเดียวกับ watchdog
- เทสต์: `tests/auth-rate-limit.test.ts` (Render 5 ข้อ), `tests/phase2-seo-security.test.ts` (Render 1 ข้อ), `tests/render-deploy-config.test.ts` (render.yaml ประกาศ env ที่หน้าสถานะตรวจครบ, ไม่มีค่าลับในไฟล์, workflow เรียก cron ผ่าน https + แจ้งเตือนเมื่อล้มเหลว, vercel.json ไม่มี cron ซ้ำ)
- **กับดัก:**
  - ก่อนเปลี่ยน `vars.APP_URL` เป็น URL ใหม่ watchdog/check-expiry ใน GitHub Actions จะล้มเหลวและแจ้ง Telegram ทุกครั้ง เพราะเว็บเก่าถูกพักอยู่
  - deployment เก่าบน Vercel ยังมี cron อยู่: พอปลดพัก 19 พ.ย. มันจะเรียก check-expiry กับ Neon ตัวเดียวกันซ้ำวันละครั้ง → ต้องแทนด้วย deployment ที่ redirect อย่างเดียว หรือลบโปรเจกต์ก่อน/ทันทีที่ปลดพัก
  - หลัง deploy จริงต้องยืนยันว่า Render ส่ง `cf-connecting-ip` มาจริง และค่าที่ผู้ใช้ส่งมาเองถูกเขียนทับ (ถ้าไม่มี rate limit จะรวมทุกคนเป็นถังเดียว)
  - อย่าเปิด proxy ของ Cloudflare (เมฆส้ม) ซ้อนบนโดเมนตัวเองที่ชี้ไป Render
- **ขั้นถัดไป:** 2) เจ้าของสร้าง Blueprint บน Render จาก repo + กรอก env 3) ตั้ง URL ใหม่ใน `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_DOMAIN`, Google OAuth redirect URI, `npm run telegram:webhook`, `vars.APP_URL` 4) smoke test บนเว็บจริง 5) หลัง 19 พ.ย. ให้ `goldhybridshot.vercel.app` redirect ไป URL ใหม่

---

## เซสชัน: ปุ่มเข้าร่วม Discord (Noble Gold Society)
**วันที่:** 15 ตุลาคม 2026  
**สถานะ:** เทสต์ `tests/community.test.tsx` 5 ข้อ + ชุดเดิมผ่าน, build ผ่าน, ตรวจบน dev server แล้ว — commit `278f810`, deploy ขึ้น https://goldhybridshot.vercel.app แล้ว (15 ต.ค. 2026) — หน้าแรกจริงมีปุ่ม Discord

- เจ้าของให้ลิงก์เชิญ `https://discord.gg/erJFe57YY` (หน้าเชิญสาธารณะแสดงชื่อเซิร์ฟเวอร์ Noble Gold Society) — เลือก: ปุ่มเข้าร่วมบนหน้าแรก + ขั้นตอน "เข้าร่วมแล้วแจ้งชื่อผู้ใช้เพื่อรับยศ VIP" ในแดชบอร์ดสมาชิก, **ไม่แสดงจำนวนสมาชิก/ออนไลน์**
- `src/config/community.ts`: ลิงก์ตั้งทับได้ด้วย `NEXT_PUBLIC_DISCORD_INVITE` (เพิ่มใน `.env.example`) — รับเฉพาะ `https://discord.gg/<code>` / `https://discord.com/invite/<code>` ไม่ถูกต้อง = ซ่อนปุ่ม
- หน้าแรก: แถบคอมมูนิตี้ใต้ช่องทางติดต่อ (`community-band.tsx`, ใน `contact-section.tsx`); แดชบอร์ด: แถว "Discord VIP" ที่ยังไม่ได้ยศ แสดงลิงก์เข้าร่วม + วิธีรับยศ (`discord-join-link.tsx`)
- เข้าไปแคปภาพในเซิร์ฟเวอร์ไม่ได้ (ต้องมีบัญชี Discord — ไม่สมัคร/ไม่ล็อกอินบริการภายนอกแทนเจ้าของ) — รอเจ้าของส่งภาพ (เบลอชื่อ/รูปสมาชิกคนอื่น) แล้วค่อยทำส่วนภาพคอมมูนิตี้
- **ต้องตั้งลิงก์เชิญใน Discord เป็น "ไม่หมดอายุ / ไม่จำกัดครั้ง"** ไม่งั้นปุ่มบนเว็บจะเสียหลัง 7 วัน (ค่าเริ่มต้นของ Discord)

---

## เซสชัน: สิทธิ์ใช้งานฟรีผ่าน IB โบรกเกอร์ (XM / Exness)
**วันที่:** 15 ตุลาคม 2026  
**สถานะ (หลังแก้ตามรีวิว):** unit 329/329, integration 171/171 (PostgreSQL จริง), `tsc` ผ่าน, `next build` ผ่าน — รีวิวโค้ด + รีวิวความปลอดภัยแล้ว (ไม่มี CRITICAL; แก้ HIGH/MEDIUM ตามด้านล่าง) — commit `83d0944`, รัน 2 migration กับ Neon แล้ว (แพ็กเกจ `broker-ib` อยู่ในฐานข้อมูล, `ibClaimsEnabled = false`, ยังไม่มีลิงก์), deploy แล้ว 15 ต.ค. 2026 — เว็บจริง: ส่วน IB บนหน้าแรกซ่อนอยู่, `/broker-ib` = 404 จนกว่าจะเปิด, หน้าสมาชิก/แอดมินใหม่ต้องล็อกอิน

- แก้ตามรีวิว: (1) บัญชีเทรดระบุด้วยโบรกเกอร์ + เลขบัญชี (migration ที่ 2 `20261015020000_broker_ib_account_key`) — เปลี่ยน MT4/MT5 หรือเติม 0 นำหน้าเพื่อผูกบัญชีเดียวซ้ำไม่ได้; (2) บัญชีที่ยืนยันแล้วห้ามแก้อีเมล/แพลตฟอร์มทับ; (3) คำขอที่ถูกปฏิเสธอัตโนมัติจากการปิดสิทธิ์/ปลดบัญชี แสดงข้อความกลางให้สมาชิก — เหตุผลจริงของแอดมินอยู่ใน Audit Log เท่านั้น (เดิมรั่วให้ผู้ยื่นดักบัญชีเห็นหลักฐาน); (4) ปิดสิทธิ์/ปลดบัญชีถือ lock เดียวกับการยื่นคำขอ (คำขอที่ยื่นพร้อมกันไม่ค้างในคิว) + เทสต์แข่งกัน; (5) แจ้ง Telegram การตั้งค่า IB เฉพาะเมื่อค่าเปลี่ยน แสดงก่อน → หลัง จากค่าที่บันทึกจริง และเตือนเมื่อโดเมนลิงก์เปลี่ยน; (6) จำกัดการยื่นต่อ IP + แจ้งเตือนบัญชีซ้ำไม่เกินชั่วโมงละครั้งต่อบัญชี; (7) เปิดโหมดปิดปรับปรุงแล้วซ่อนข้อเสนอ IB บนหน้าเว็บทันที; (8) ค้นหาสมาชิกด้วยเลขบัญชี: regex พิมพ์ผิด (`[s-]`) ทำให้คำค้นบางคำได้ทุกคน — แก้แล้ว
- ข้อเสนอแนะที่ยังไม่ได้ทำ (ตัดสินใจภายหลัง): ยืนยันอีเมลโบรกเกอร์ด้วยลิงก์ครั้งเดียว + ยืนยันอีเมลตอนสมัครสมาชิก (กันยื่นบัญชีของคนอื่นด้วยอีเมลที่ไม่ได้เป็นเจ้าของ), ล็อกลิงก์พาร์ทเนอร์ด้วย env (partner ID) / ต้องมีแอดมินคนที่สองยืนยัน, ลบ/ปิดบังเลขบัญชีใน Audit Log ตามระยะเวลาเก็บข้อมูล PDPA, ฐานข้อมูลอ่านไม่ได้ตอน build → ข้อเสนอถูกซ่อน 5 นาที (ปิดแบบปลอดภัย)
- dev server: หน้าในกลุ่ม account มีคำเตือน React "unique key — OuterLayoutRouter" (เห็นทั้ง `/account` และ `/account/orders` — น่าจะมาจาก Next.js กับ `template.tsx` ไม่ใช่โค้ดของงานนี้ แต่ยังไม่ได้เทียบกับ HEAD)
- **สถานะเดิม:** unit 318/318, integration 166/166 (PostgreSQL จริง, เพิ่ม 53), `tsc` ผ่าน, `next build` ผ่าน, ทดสอบครบเส้นทางบน dev server ด้วยบัญชีทดสอบ (แอดมินตั้งค่า → หน้าแรกแสดงส่วน IB ทันที → สมาชิกยื่นคำขอ → แอดมินอนุมัติ → สิทธิ์ 30 วัน + Audit Log) — **ยังไม่ commit / ยังไม่ deploy** — ปิดไว้เป็นค่าเริ่มต้น (`ibClaimsEnabled = false`)

- เจ้าของเลือก: เปิดบัญชีผ่านลิงก์ IB + ฝากครั้งแรกถึงขั้นต่ำ → สิทธิ์ 30 วัน ต่อทุกเดือน (ตรวจใหม่ทุกครั้ง) → แอดมินตรวจด้วยมือใน Partner Portal; ลิงก์พาร์ทเนอร์และยอดฝากขั้นต่ำ **ยังไม่ได้รับจากเจ้าของ** — กรอกที่ `/admin/settings` (การ์ด "สิทธิ์ฟรีผ่านโบรกเกอร์ (IB)") แล้วติ๊กเปิด
- ข้อมูล: migration `20261014171437_broker_ib` — `OrderStatus.CLAIM_SUBMITTED`, enum `AccessKind` (Plan.kind / Order.kind), `Broker`, `TradingPlatform`, `BrokerAccountStatus`, ตาราง `BrokerAccount` (unique `broker+platform+accountNumber`, แถวไม่ถูกลบ ปลดด้วย RELEASED แล้วคนใหม่ใช้แถวเดิม), `Order.brokerAccountId` / `ibMinDepositUsd`, `SystemSetting.ibClaimsEnabled/ibXmLink/ibExnessLink/ibMinDepositUsd` + insert แพ็กเกจ `broker-ib` (ราคา 0, 30 วัน) + migration ที่ 2 เปลี่ยน unique เป็น `broker+accountNumber` — **ต้องรัน `prisma migrate deploy` กับ Neon (ทั้ง 2 migration) ก่อน deploy โค้ด**
- คำขอ = ออเดอร์ `kind BROKER_IB` ราคา 0 ไม่มี Payment; อนุมัติแล้วสร้าง Subscription ปกติ → ทบวัน/หมดอายุ/เตือน/เปิดสิทธิ์ช่องทาง/ปิดสิทธิ์ฉุกเฉิน ใช้ของเดิมทั้งหมด; ไม่ล็อกราคา ไม่นับที่นั่งโปร ไม่นับเป็นรายได้
- กันเส้นทางเงิน: Checkout ขายแพ็กเกจ IB ไม่ได้ (`kind: PAID`), แนบสลิปกับออเดอร์ IB ไม่ได้, คืนเงินออเดอร์ IB ไม่ได้, อนุมัติสลิปกับคำขอ IB ไม่ได้ (และกลับกัน), รายการ/ยอดขายในหลังบ้านไม่รวม IB, หน้า `/checkout/order/[id]` และประวัติคำสั่งซื้อแสดงเฉพาะออเดอร์จ่ายเงิน
- กติกา: ยื่น/อนุมัติได้เมื่อสิทธิ์ที่เหลือ ≤ 7 วัน (ตรวจทั้งตอนยื่นและตอนอนุมัติ — กันสะสมเดือนฟรี); 1 บัญชีเทรดต่อ 1 สมาชิก และ 1 สมาชิกต่อ 1 บัญชี; คำขอที่รอตรวจยังตรวจได้แม้ปิดรับ (ยอดขั้นต่ำ ณ เวลายื่นถูกบันทึกในออเดอร์)
- ลำดับ lock: ออเดอร์ → `membership:<userId>` → แถว BrokerAccount (ยื่นคำขอใช้ advisory `broker-claim:<userId>` → `broker-account:<key>` → แถว BrokerAccount และไม่ล็อกออเดอร์เดิม) — มีเทสต์แข่งกัน: 2 คนยื่นบัญชีเดียวกัน, กดซ้ำ, แอดมิน 2 คนอนุมัติพร้อมกัน, อนุมัติชนปฏิเสธ, อนุมัติ IB ชนอนุมัติแพ็กเกจจ่ายเงิน, ปิดสิทธิ์ชนอนุมัติ
- หน้าใหม่: สมาชิก `/account/broker-ib` (ขั้นตอน + ฟอร์ม / รอตรวจ / รอช่วงต่อ / ต่ออายุ / ประวัติ), แอดมิน `/admin/broker-claims` (คิว เก่าสุดก่อน ไฮไลต์เกิน 24 ชม.) + `/admin/broker-claims/[id]` (ติ๊กผลตรวจ 3 ข้อ, ปฏิเสธพร้อมเลือกปลดบัญชี), การ์ดบัญชีโบรกเกอร์ในหน้าสมาชิกของแอดมิน (ปิดสิทธิ์ IB เฉพาะส่วน / ปลดการผูกบัญชี), หน้าสาธารณะ `/broker-ib` + ส่วนในหน้าแรกต่อจากราคา (แสดงเฉพาะตอนเปิด, แคช 5 นาที + `revalidateTag` ทันทีเมื่อแก้ตั้งค่า), ลิงก์เมนูหลังบ้าน "คำขอสิทธิ์ IB" + แบนเนอร์ในภาพรวม
- อัตโนมัติ: Watchdog แจ้งคำขอค้างเกิน 24 ชม. และส่งแจ้งเตือนคำขอใหม่ซ้ำถ้า Telegram ล้ม; อีเมลเตือนหมดอายุของสมาชิก IB ชี้ไป `/account/broker-ib` (เดิมจะเป็น `/checkout/broker-ib` ที่ไม่มีจริง)
- ความปลอดภัย/PDPA: Telegram ปิดบังเลขบัญชี (****1234) ไม่มีอีเมล; ลิงก์พาร์ทเนอร์ต้อง https ไม่มี user:pass (โดเมนอื่นบันทึกได้แต่เตือน); เปลี่ยนลิงก์ = แจ้งกลุ่มแอดมินพร้อมลิงก์เต็ม (กันลิงก์ถูกเปลี่ยนเป็น IB ของคนอื่น); ลิงก์ออกนอกเว็บใช้ `rel="sponsored noopener noreferrer"`; ฟอร์มไม่มีช่องรหัสผ่าน
- ข้อกฎหมาย: เพิ่มหัวข้อ 7 ในข้อกำหนด (ข้อ 8–13 เลื่อนเลข), ข้อมูลบัญชีเทรดในนโยบายความเป็นส่วนตัว, สิทธิ์ IB ไม่คืนเงินในนโยบายคืนเงิน, `legalConfig.effectiveDate` → 2026-10-15; หน้า IB มีคำเตือนความเสี่ยง + การเปิดเผยค่าตอบแทน — **ควรให้ผู้เชี่ยวชาญกฎหมายตรวจเรื่องการแนะนำโบรกเกอร์ต่างประเทศให้ลูกค้าในไทย (ก.ล.ต.) ก่อนเปิดจริง**
- ข้อมูลทดสอบใน DB dev (localhost): ผู้ใช้ `ib-admin-e2e@example.com` / `ib-member-e2e@example.com` + คำขอ 1 รายการ + เปิด IB ด้วยลิงก์ทดสอบ (รหัสผ่านอยู่ใน scratchpad ของเซสชัน ไม่อยู่ใน repo)
- ข้อสังเกตเดิม (ไม่เกี่ยวกับ IB): หัวเว็บบนจอ 375px ตอนล็อกอินเป็นแอดมิน ล้นขวา 1px (ปุ่ม "หลังบ้านแอดมิน" ยาวกว่า "สมัครสมาชิก")

---

## เซสชัน: เปลี่ยนลิงก์เว็บเป็น goldhybridshot.vercel.app
**วันที่:** 14 ตุลาคม 2026  
**สถานะ:** ขึ้นจริงแล้ว — https://goldhybridshot.vercel.app (deploy จาก `5cc4218`), smoke test ผ่านทั้งชุดบนโดเมนใหม่

- เพิ่มโดเมน `goldhybridshot.vercel.app` เข้าโปรเจกต์ Vercel `webpeenoey` (`vercel domains add`) — ชื่อโดเมนเป็นตัวพิมพ์เล็กเสมอ (เบราว์เซอร์แสดงตัวเล็ก)
- โดเมนเดิม `webpeenoey.vercel.app` ตั้ง redirect 308 ไปโดเมนใหม่ (คง path + query) ผ่าน `vercel api` PATCH `/v9/projects/webpeenoey/domains/webpeenoey.vercel.app` — ลิงก์เก่า/บุ๊กมาร์กยังใช้ได้
- env production: `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` = https://goldhybridshot.vercel.app, `NEXT_PUBLIC_SITE_DOMAIN` = goldhybridshot.vercel.app แล้ว deploy ใหม่ (ค่า NEXT_PUBLIC_* ฝังตอน build) — canonical, og:url, sitemap, robots, ลิงก์ในอีเมล และ NextAuth ใช้โดเมนใหม่แล้ว
- ผลกระทบ: คุกกี้ล็อกอินผูกกับโดเมน → แอดมิน/สมาชิกต้องล็อกอินใหม่ที่โดเมนใหม่หนึ่งครั้ง
- ตอนตั้งค่าที่ยังค้าง ให้ใช้โดเมนใหม่: GitHub Actions `vars.APP_URL` (watchdog) และ `npm run telegram:webhook` (ใช้ `NEXT_PUBLIC_APP_URL`)
- ชื่อโปรเจกต์ Vercel / repo ยังเป็น `webpeenoey` (ไม่กระทบผู้ใช้)

---

## เซสชัน: บัตรสมาชิกกระดาษ 3 มิติ ในส่วนราคา
**วันที่:** 14 ตุลาคม 2026  
**สถานะ:** unit 261/261 (เพิ่ม `tests/member-card.test.tsx` 26 + `tests/member-card-motion.test.ts` 16 — ตัวขับทดสอบใน Node ด้วย EventTarget/คิว rAF จำลอง), `tsc` ผ่าน, `next build` ผ่าน (หน้าแรก First Load JS 115 → 120 kB) — ตรวจบน dev server ที่ 1280px และ 375px ไม่ล้นจอ — commit `b8bb624`, deploy แล้ว 15 ต.ค. 2026 (หน้าแรกจริงมี `data-member-card`) — **ยังไม่ได้ตรวจบน iPhone/Safari จริง**

- แก้ตามรีวิวโค้ด (ไม่มี CRITICAL/HIGH): ระหว่างลากฟัง pointerup/cancel/move ที่ window + `lostpointercapture` + window `blur` + เมาส์ที่ปุ่มไม่ได้กดแล้ว → จบการลากเสมอ (เดิมพลาดอีเวนต์ปล่อยแล้วบัตรค้าง + rAF วนไม่หยุด); แถบแสง/วงแสง/เงาขอบเป็นชั้นแยกขยับด้วย translate/opacity (เดิมเปลี่ยน background-position ทุกเฟรม = วาดใหม่ทั้งบัตร); `touch-action: pan-y pinch-zoom` (เดิมจีบนิ้วซูมบนบัตรไม่ได้); วงแสงด้านหลังกลับซ้ายขวาให้อยู่ใต้เมาส์; นิ้วสั่น ≤10px ยังนับเป็นแตะ; แตะพลิกใช้ `click` (แตะหยุดการเลื่อนหน้าไม่พลิกเอง); ขนาดตัวอักษรตราประทับคำนวณจากความยาวชื่อแบรนด์; ประกาศด้านที่พลิกผ่าน `aria-live`; เบราว์เซอร์ไม่มี `overflow: clip` (iOS ≤15) ซ่อนตัวหนังสือยักษ์
- ที่ยังตรวจไม่ได้ (ไม่มีเครื่องจริง): Safari/iPhone — ด้านที่หันหนีมีชั้นแยก (ตราหมุน/แสง) โผล่ทะลุหรือไม่ (ใส่ backface-visibility ที่ชั้นลูกกันไว้แล้ว) — ควรเปิดดูบน iPhone หลัง deploy; พื้นที่เหลือในบัตรจอ 375px: ด้านหน้า 61px ด้านหลัง 88px (รองรับการขยายตัวอักษรของระบบได้ระดับหนึ่ง)

- ที่มา: เจ้าของอยากได้อนิเมชันแบบ ThreeUI "3D Paper – Site of the Year" (threeui.com) — ตัวนั้นเป็นของเสียเงิน ซอร์สปิด เนื้อหาตายตัว (ใบรางวัล "Site of the Year" ที่เราไม่ได้รับจริง = ผิดกฎข้อ 3) และหนักราว 3.3 MB จึงทำเองด้วย CSS 3D ให้ได้ความรู้สึกเดียวกัน — เจ้าของเลือก: วางในส่วนราคา + แบบเบา (CSS 3D)
- `src/components/marketing/member-card.tsx`: บัตรแนวตั้งโปร่งแสงเล็กน้อย ด้านหน้า = แบรนด์ + ตราประทับหมุน + "บัตรสมาชิก" + ป้าย Indicator / Telegram VIP / Discord; ด้านหลัง = สิทธิ์ 4 ข้อแรกของแพ็กเกจเริ่มต้น (`MEMBER_CARD.perks` ดึงจาก `SITE_PLANS[0].features` — เทสต์บังคับว่าต้องมาจากแพ็กเกจจริง และห้ามมีตัวเลข % / Win Rate / กำไร) — ด้านที่หันหนีเป็น `aria-hidden`, มีปุ่ม "พลิกดูสิทธิ์สมาชิก" (aria-controls) ให้คีย์บอร์ด/จอสัมผัส
- `src/components/marketing/member-card-motion.ts`: เมาส์ชี้ = เอียงเข้าหาเมาส์ + แสงตามเมาส์ + ตัวหนังสือ "GOLD" ยักษ์ด้านหลังขยับตามความลึก; จับลาก (เมาส์/นิ้ว) = หมุนตามมือ ปล่อยแล้วไหลต่อตามแรงส่ง (ไม่เกิน 1 รอบ) แล้วเด้งหยุดที่ด้านใกล้สุด; แตะโดยไม่ลาก = พลิก; วน requestAnimationFrame เฉพาะตอนยังขยับ — ฟิสิกส์ (สปริง, เลือกด้าน, ความเร็ว) อยู่ใน `src/lib/paper-card.ts` เป็นฟังก์ชันล้วน
- ลดการเคลื่อนไหว: ไม่เอียง/ไม่ลากหมุน ปุ่ม/แตะพลิกทันที; ปุ่มหยุดภาพเคลื่อนไหวหยุดตราประทับหมุน (`.pc-seal-ring` ใน motion.css); นอกจอหยุดอนิเมชันวน (`data-loop`)
- จอสัมผัส: `touch-action: pan-y` — ปัดขึ้นลงยังเลื่อนหน้าได้ ปัดซ้ายขวาหมุนบัตร; ส่วนราคาใส่ `overflow-x-clip` กันตัวหนังสือยักษ์ทำให้จอเลื่อนข้าง
- ตรวจใน browser pane (หน้าต่างไม่ถูกวาด rAF จึงเดินเฉพาะตอนแคปจอ): ปุ่มพลิก → 180° (เด้งเกินเล็กน้อย 182.7° แล้วนิ่ง), สะบัด 150px → ไปด้านหลัง, ลากช้าแล้วค้าง → กลับด้านเดิม, แตะ → พลิก, เมาส์ชี้มุมขวาบน → เอียง rotateX 8° / rotateY 11°
- ข้อสังเกต: คำว่า "เรียลไทม์" ในสิทธิ์ข้อ 2 ตัดบรรทัดกลางคำบนจอแคบ (ตัวตัดคำไทยของเบราว์เซอร์ไม่รู้จักคำทับศัพท์) — เป็นข้อความเดียวกับในกล่องแพ็กเกจ ยังไม่ได้แก้

---

## เซสชัน: เปลี่ยนธีมเป็นครีม-ทอง (สว่าง)
**วันที่:** 13 ตุลาคม 2026  
**สถานะ:** unit 219/219, `tsc` ผ่าน, `next build` ผ่าน — ตรวจหน้าจอบน dev server (หน้าแรกทุกส่วน, auth) และ layout account/admin ที่ render ด้วย session จำลอง, จอ 360px ไม่ล้น — commit `d9ab8e2` และ deploy ขึ้น https://webpeenoey.vercel.app แล้ว (14 ต.ค. 2026): smoke test ผ่าน (header ความปลอดภัย, หน้าสมาชิก/แอดมินพาไปหน้าเข้าสู่ระบบ, cron/webhook ไม่มีสิทธิ์ได้ 401), เว็บจริงพื้นครีม ตัวหนังสือเข้ม, จอ 375/1280px ไม่ล้น, bundle จริงตั้งกราฟ TradingView เป็น light / 4 ชม. / พื้นขาว
- หมายเหตุ smoke: `/auth/signin` ขึ้น MISSING "เข้าสู่ระบบ" เพราะหน้านี้ render ฝั่ง client (ใช้ `useSearchParams` ใน Suspense) ข้อความจึงไม่อยู่ใน HTML จากเซิร์ฟเวอร์ — เปิดในเบราว์เซอร์แล้วเห็นหัวข้อ "เข้าสู่ระบบสมาชิก" ปกติ ไม่ใช่ปัญหาจากรอบนี้

- เจ้าของเลือก "ครีม-ทอง" จาก 3 ทาง (ดำ-ทอง / กรมท่า-ทอง / ครีม-ทอง)
- token ใหม่ตามหน้าที่ (tailwind.config.ts): `page` #FAF6EE, `surface` #FFFFFF / `surface-sunken` #F3EDE0, `fg` #1F1A12 / `fg-muted` #5C5344 / `fg-subtle` #6B604E, `gold` #D4A537 (พื้นปุ่ม ตัวหนังสือบนทองใช้ fg) / `gold-ink` #8A5F00 (ตัวหนังสือ ลิงก์ วงโฟกัส), `line` เข้มโปร่ง — ค่าความต่างสีคำนวณจริงตาม WCAG: ทุกระดับตัวหนังสือ ≥ 4.5:1 บน page/surface/sunken, fg บนทอง 7.6:1
- เลิกใช้ token `ink` / `signal` (ไม่มีคลาสเก่าเหลือ) และลบ token `surface` ชุดเก่าที่ไม่ได้ใช้; แปลงคลาสทั้ง src 857 จุดด้วยสคริปต์ตารางแปลง แล้วแก้ด้วยมือส่วนที่ต้องดูบริบท (พื้น layout หลัก = page, ปุ่มอันตรายตัวหนังสือขาว, เส้นอินดิเคเตอร์ในกราฟวาด, แถบความคืบหน้าในส่วนขั้นตอน, spotlight บนการ์ดทอง)
- สีความหมาย: สำเร็จ/ใช้งาน = เขียว (emerald), รอ/เตือน = ส้ม (เดิมอำพัน — ปนกับทองของแบรนด์), รอชำระ = ฟ้า, ไม่ผ่าน = แดง — ทองสงวนไว้สำหรับแบรนด์/ปุ่ม
- กราฟ TradingView เป็นธีมสว่าง, กราฟวาด/ภาพฟีเจอร์/แอนิเมชัน/กรอบ QR เป็นทอง, อีเมลพื้นขาว + ปุ่มทอง, ภาพแชร์ OG เป็นครีม-ทอง (ตัวอักษรในโลโก้มาจากชื่อแบรนด์)
- ภาพหน้าจออินดิเคเตอร์จริง (showcase) ยังเป็นภาพธีมมืดของ TradingView — แสดงในกรอบเหมือนหน้าจอ
- `.claude/launch.json` (ไม่ commit): dev/prod ตั้ง `autoPort: true` เพราะพอร์ต 3000 ถูกเซสชันอื่นใช้

---

## เซสชัน: เปลี่ยนชื่อเว็บเป็น Gold Hybridshot
**วันที่:** 13 ตุลาคม 2026  
**สถานะ:** unit 216/216 (เพิ่ม `tests/branding.test.tsx`), `tsc` ผ่าน, `next build` ผ่าน — จอ 360px: โลโก้ header/footer ไม่ล้น ไม่ชนปุ่ม

- เจ้าของยืนยันว่า Gold HybridShot Signals คืออินดิเคเตอร์ที่สมาชิกได้รับ → `siteConfig.name` / `shortName` = "Gold Hybridshot" (ตัวพิมพ์ตามที่เจ้าของกำหนด — คำบรรยายภาพหน้าจอก็ใช้ "Gold Hybridshot" ตามที่เจ้าของขอ แม้ในภาพ TradingView จะแสดงชื่อสคริปต์ว่า Gold HybridShot Signals) — title, OG, JSON-LD, เอกสารกฎหมายเปลี่ยนตามอัตโนมัติ
- หัวเรื่องอีเมล, ชื่อผู้ส่งอีเมลเริ่มต้น และข้อความบอท Telegram ใช้ `siteConfig.name` แทนการเขียนชื่อตายตัว — เทสต์กันไม่ให้มี "Peenoey Indicator" ในโค้ดอีก
- โลโก้ตัวอักษรขนาดใหญ่ (ท้ายหน้า) แยกเป็นคำ (`inline-block whitespace-nowrap`) คั่นด้วยช่องว่างจริง → คอลัมน์แคบ (จอ 1024–1536px) ตัดเป็น "Gold" / "Hybridshot" สองบรรทัด ไม่ล้นไปทับกล่องเมนู (เดิมใช้ ` ` ห้ามตัดบรรทัด จึงล้นทับ — เจอบนเว็บจริงหลังเปลี่ยนชื่อ) — ตรวจที่ 360/768/1024/1280/1536px แล้ว
- `NEXT_PUBLIC_SITE_NAME` (.env, .env.example, Vercel) เปลี่ยนเป็น "Gold Hybridshot" — ตัวแปรนี้โค้ดไม่ได้อ่าน แค่ให้ตรงกัน
- ชื่อใหม่ยาวกว่าเดิม → header ของหน้า account แน่นเกิน (จอ 768–1023px เมนูตัด 2–3 บรรทัด) แก้: เมนูในแถบบนแสดงตั้งแต่ 1024px (ต่ำกว่านั้นใช้แถบปุ่ม 3 ปุ่มใต้ header), ป้าย PORTAL/ชื่อผู้ใช้/ข้อความลิงก์แอดมินแสดงตั้งแต่ 1280px (ต่ำกว่านั้นลิงก์แอดมินเป็นไอคอน มีข้อความ sr-only), ทุกปุ่มใน header ห้ามตัดบรรทัด; แถบข้าง admin ลดระยะขอบให้ป้าย ADMIN ไม่ล้น — วัดด้วย layout จริงที่ render ด้วย session จำลอง (ฟอนต์จริง) ที่ 360/768/1024/1280px
- ปุ่ม "ออกจากระบบ" บนจอเล็กเดิมไม่มีชื่อให้โปรแกรมอ่านหน้าจอ (ข้อความ hidden) → เปลี่ยนเป็น sr-only
- footer หน้าบ้าน/หน้า account เว้นขอบล่าง (pb-20) ไม่ให้ปุ่มหยุดภาพเคลื่อนไหวทับข้อความลิขสิทธิ์
- อีเมลทุกฉบับใช้โครงร่วม `emailLayout()` (src/lib/email.ts): ชื่อแบรนด์ด้านบน + "ทีมงาน Gold Hybridshot" พร้อมลิงก์เว็บด้านล่าง, สีธีมปัจจุบัน (ปุ่มเขียว, หัวข้อเตือนสีอำพัน) แทนสีทองของธีมเก่า — มีเทสต์ (mock Resend) ตรวจผู้ส่ง/หัวเรื่อง/เนื้อหามีชื่อแบรนด์ และยัง escape ข้อความผู้ใช้
- บอท Telegram: `npm run telegram:webhook` ตั้งชื่อโปรไฟล์บอท (setMyName) และคำอธิบาย (setMyShortDescription / setMyDescription) จาก `NEXT_PUBLIC_SITE_NAME` ให้ด้วย — ล้มแล้วแค่เตือน (Telegram จำกัดความถี่เปลี่ยนชื่อ) — **ยังไม่ได้รัน เพราะยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN**; ข้อความในแชตบอทใช้ `siteConfig.name` อยู่แล้ว
- **ยังเป็นชื่อเดิม (เป็นบัญชี/โดเมนจริง เปลี่ยนในโค้ดอย่างเดียวไม่ได้):** อีเมล support@peenoey.com, LINE @peenoey, Telegram @peenoey_admin, โดเมน peenoey.com, URL webpeenoey.vercel.app, repo/โปรเจกต์ Vercel `webpeenoey`, คีย์ localStorage `peenoey-motion`

---

## เซสชัน: ภาพหน้าจออินดิเคเตอร์จริง (ส่วน "หน้าตาอินดิเคเตอร์บนกราฟจริง")
**วันที่:** 13 ตุลาคม 2026  
**สถานะ:** unit 213/213 (เพิ่ม `tests/indicator-showcase.test.tsx`), `tsc` ผ่าน, `next build` ผ่าน (หน้าแรก First Load JS 115 kB) — ตรวจบน dev server: ส่วนใหม่อยู่ถัดจาก "จุดเด่น", รูปโหลดผ่าน next/image เป็น WebP 21–60 kB ตามขนาดจอ, ไม่ล้นจอ, server ไม่มี error — ยังไม่ commit / ยังไม่ deploy

- รูป: `public/images/showcase/xauusd-5m-gold-hybridshot.png` (1752×830 — เจ้าของแคปจากบัญชี TradingView ของตัวเอง: XAUUSD OANDA กรอบ 5 นาที, อินดิเคเตอร์ Gold HybridShot Signals, 13 ต.ค. 2569)
- ข้อความทั้งหมดอยู่ที่ `INDICATOR_SHOWCASE` ใน `src/config/marketing.ts` — คำอธิบาย 4 ข้อบอกเฉพาะสิ่งที่เห็นในภาพ, หมายเหตุบอกชัดว่าตัวเลขในตาราง (Win Rate / จำนวนสัญญาณ) เป็นสถิติย้อนหลังบนกราฟนั้น ไม่ใช่ผลเทรดจริงของสมาชิก อาจไม่รวมสเปรด/ค่าธรรมเนียม ไม่รับประกันผลในอนาคต — มีเทสต์กันไม่ให้ดึงตัวเลข % มาเป็นคำโฆษณา
- ลิงก์เลย์เอาต์ที่เจ้าของให้มา (`th.tradingview.com/chart/AfpEvvfU/`) เป็นแบบส่วนตัว คนนอกเปิดไม่ได้ ("Chart Not Found") จึงไม่ได้ใส่ในเว็บ — ถ้าจะให้คนกดไปดู ต้องเปิดแชร์เลย์เอาต์หรือใช้ลิงก์ snapshot (`tradingview.com/x/...`)
- widget ของ TradingView ฝังอินดิเคเตอร์ Invite-only ไม่ได้ — กราฟสดใน hero จึงยังไม่มีอินดิเคเตอร์ของเรา
- **รอเจ้าของ:** (1) ยืนยันว่า "Gold HybridShot Signals" คือตัวที่สมาชิกได้รับ (เว็บเรียกสินค้าว่า Peenoey Indicator) (2) ข้อมูล backtest ถ้าต้องการส่วน backtest แยก — ช่วงเวลา, สัญลักษณ์/กรอบเวลา, จำนวนเทรด ชนะ/แพ้, กติกา TP/SL, drawdown สูงสุด และต้นทุนที่คิด (หรือภาพ Strategy Tester ของ TradingView)

---

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
