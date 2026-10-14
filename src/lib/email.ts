import { Resend } from "resend";
import { siteConfig } from "@/config/site";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.EMAIL_FROM || `${siteConfig.name} <noreply@peenoey.com>`;

/** escape ข้อความก่อนใส่ใน HTML อีเมล (อีเมล/ชื่อแพ็กเกจ/เหตุผลอาจมีอักขระพิเศษ) */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** สีตามธีมเว็บ (ครีม-ทอง): ทอง = ปุ่ม, ทองเข้ม = หัวข้อ/ลิงก์, ส้ม = เตือน — ตัวหนังสือบนพื้นขาวผ่าน WCAG AA */
const BRAND_GOLD = "#D4A537";
const GOLD_INK = "#8A5F00";
const WARNING_ORANGE = "#C2410C";
const TEXT = "#1F1A12";
const TEXT_SUBTLE = "#6B604E";
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** โครงอีเมลเดียวกันทุกฉบับ: ชื่อแบรนด์ด้านบน + ลงชื่อทีมงานพร้อมลิงก์เว็บด้านล่าง (ชื่อมาจาก siteConfig) */
export function emailLayout(heading: string, body: string, headingColor: string = GOLD_INK): string {
  const brand = escapeHtml(siteConfig.name);
  const site = appUrl();
  return `
        <div style="font-family: sans-serif; background-color: #FFFFFF; color: ${TEXT}; padding: 32px; border-radius: 16px; border: 1px solid #EADFC8;">
          <p style="margin: 0 0 24px; font-size: 18px; font-weight: bold;"><span style="display: inline-block; width: 10px; height: 10px; border-radius: 3px; background-color: ${BRAND_GOLD}; margin-right: 8px;"></span>${brand}</p>
          <h2 style="color: ${headingColor}; margin: 0 0 16px;">${heading}</h2>
          ${body}
          <hr style="border: none; border-top: 1px solid rgba(31,26,18,0.12); margin: 32px 0 16px;" />
          <p style="color: ${TEXT_SUBTLE}; font-size: 12px; margin: 0;">ทีมงาน ${brand} · <a href="${escapeHtml(site)}" style="color: ${GOLD_INK};">${escapeHtml(site.replace(/^https?:\/\//, ""))}</a></p>
        </div>
      `;
}

function emailButton(href: string, label: string): string {
  return `<div style="margin: 28px 0;"><a href="${escapeHtml(href)}" style="background-color: ${BRAND_GOLD}; color: ${TEXT}; padding: 12px 24px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block;">${label}</a></div>`;
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

  if (!resend) {
    // โหมด Development / ไม่มี Resend API Key: แสดงข้อมูลในคอนโซลสำหรับการทดสอบ
    console.info(`[Email Simulation] Password reset link for ${email}: ${resetUrl}`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `คำขอตั้งรหัสผ่านใหม่ - ${siteConfig.name}`,
      html: emailLayout(
        "ตั้งรหัสผ่านใหม่",
        `
          <p>เรียนผู้ใช้งาน,</p>
          <p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี <strong>${escapeHtml(email)}</strong> ของคุณ</p>
          <p>กรุณาคลิกปุ่มด้านล่างเพื่อดำเนินการตั้งรหัสผ่านใหม่ (ลิงก์มีอายุ 1 ชั่วโมง):</p>
          ${emailButton(resetUrl, "ตั้งรหัสผ่านใหม่")}
          <p style="color: ${TEXT_SUBTLE}; font-size: 13px;">หากคุณไม่ได้เป็นผู้ส่งคำขอนี้ สามารถเพิกเฉยต่ออีเมลนี้ได้อย่างปลอดภัย</p>
        `,
      ),
    });

    if (error) {
      console.error("[Email Error] Failed to send reset email via Resend:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email Exception] Unexpected error sending reset email:", err);
    return false;
  }
}

export async function sendReceiptEmail(
  email: string,
  orderNumber: string,
  planName: string,
  amount: number,
  periodEnd: Date
): Promise<boolean> {
  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Email] RESEND_API_KEY ไม่ได้ตั้งค่า — ไม่ได้ส่งอีเมลใบเสร็จ", { orderNumber });
      return false;
    }
    console.info(`[Email Simulation] Receipt for ${email}: Order ${orderNumber}, Plan: ${planName}, ${amount} THB`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `ใบเสร็จรับเงินและการอนุมัติสิทธิ์ (ออเดอร์ ${orderNumber}) - ${siteConfig.name}`,
      html: emailLayout(
        "อนุมัติคำสั่งซื้อเรียบร้อยแล้ว!",
        `
          <p>เรียนคุณ ${escapeHtml(email)},</p>
          <p>คำสั่งซื้อหมายเลข <strong>${escapeHtml(orderNumber)}</strong> ได้รับการตรวจสอบและอนุมัติสิทธิ์เรียบร้อยแล้ว</p>
          <div style="background-color: #FAF6EE; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid rgba(31,26,18,0.12);">
            <p style="margin: 6px 0;"><strong>แพ็กเกจ:</strong> ${escapeHtml(planName)}</p>
            <p style="margin: 6px 0;"><strong>ยอดชำระ:</strong> ${amount.toLocaleString()} บาท</p>
            <p style="margin: 6px 0;"><strong>วันหมดอายุสิทธิ์:</strong> ${periodEnd.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
          </div>
          <p>คุณสามารถเข้าใช้งานระบบและตรวจสอบสิทธิ์ได้ทันทีที่แดชบอร์ดสมาชิกของคุณ</p>
          ${emailButton(`${appUrl()}/account`, "เข้าสู่แดชบอร์ดสมาชิก")}
        `,
      ),
    });

    if (error) {
      console.error("[Email Error] Failed to send receipt email via Resend:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email Exception] Unexpected error sending receipt email:", err);
    return false;
  }
}

export async function sendSlipRejectedEmail(email: string, orderNumber: string, reason: string, orderUrl: string): Promise<boolean> {
  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Email] RESEND_API_KEY ไม่ได้ตั้งค่า — ไม่ได้ส่งอีเมลแจ้งสลิปไม่ผ่าน", { orderNumber });
      return false;
    }
    console.info(`[Email Simulation] Slip rejected for ${email}: Order ${orderNumber}, reason: ${reason}`);
    return true;
  }
  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `สลิปไม่ผ่านการตรวจสอบ (ออเดอร์ ${orderNumber}) - ${siteConfig.name}`,
      html: emailLayout(
        "สลิปไม่ผ่านการตรวจสอบ",
        `
          <p>คำสั่งซื้อหมายเลข <strong>${escapeHtml(orderNumber)}</strong> ยังไม่ได้รับการอนุมัติ</p>
          <p><strong>เหตุผล:</strong> ${escapeHtml(reason)}</p>
          <p>หากคุณโอนเงินแล้ว กรุณาแนบสลิปใบที่ถูกต้องอีกครั้งที่หน้าคำสั่งซื้อ หรือติดต่อทีมงาน</p>
          ${emailButton(orderUrl, "ไปหน้าคำสั่งซื้อ")}
        `,
        WARNING_ORANGE,
      ),
    });
    if (error) {
      console.error("[Email Error] Failed to send slip rejected email via Resend:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email Exception] Unexpected error sending slip rejected email:", err);
    return false;
  }
}

export interface ExpiryReminderEmail {
  planName: string;
  endsAt: Date;
  daysLeft: number;
  renewUrl: string;
}

/** เตือนก่อนสิทธิ์หมดอายุ (Flow 6 ขั้นที่ 1) พร้อมปุ่มต่ออายุ — ราคาที่ล็อกไว้คิดให้อัตโนมัติตอนสร้างออเดอร์ */
export async function sendExpiryReminderEmail(email: string, reminder: ExpiryReminderEmail): Promise<boolean> {
  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Email] RESEND_API_KEY ไม่ได้ตั้งค่า — ไม่ได้ส่งอีเมลเตือนก่อนหมดอายุ");
      return false;
    }
    console.info(`[Email Simulation] Expiry reminder for ${email}: ${reminder.planName} ends in ${reminder.daysLeft} day(s)`);
    return true;
  }
  const endsAt = reminder.endsAt.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "long", day: "numeric" });
  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `สิทธิ์สมาชิกของคุณจะหมดอายุในอีก ${reminder.daysLeft} วัน - ${siteConfig.name}`,
      html: emailLayout(
        "สิทธิ์ของคุณใกล้หมดอายุแล้ว",
        `
          <p>แพ็กเกจ <strong>${escapeHtml(reminder.planName)}</strong> จะหมดอายุวันที่ <strong>${escapeHtml(endsAt)}</strong> (อีก ${reminder.daysLeft} วัน)</p>
          <p>ต่ออายุก่อนหมด วันใช้งานจะทบต่อจากวันหมดอายุเดิมทันที ไม่เสียวันที่เหลือ และหากคุณได้ล็อกราคาโปรโมชันไว้ ระบบจะคิดราคาเดิมให้อัตโนมัติ</p>
          ${emailButton(reminder.renewUrl, "ต่ออายุสมาชิก")}
          <p style="color: ${TEXT_SUBTLE}; font-size: 12px;">หากต่ออายุแล้ว ไม่ต้องดำเนินการใด ๆ เพิ่มเติม</p>
        `,
        WARNING_ORANGE,
      ),
    });
    if (error) {
      console.error("[Email Error] Failed to send expiry reminder via Resend:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email Exception] Unexpected error sending expiry reminder:", err);
    return false;
  }
}

/** แจ้งสมาชิกว่าคำขอสิทธิ์ผ่าน IB โบรกเกอร์ได้รับอนุมัติ */
export async function sendBrokerClaimApprovedEmail(
  email: string,
  claim: { orderNumber: string; periodEnd: Date; isRenewal: boolean },
): Promise<boolean> {
  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Email] RESEND_API_KEY ไม่ได้ตั้งค่า — ไม่ได้ส่งอีเมลอนุมัติสิทธิ์ผ่าน IB", { orderNumber: claim.orderNumber });
      return false;
    }
    console.info(`[Email Simulation] IB claim approved for ${email}: ${claim.orderNumber} until ${claim.periodEnd.toISOString()}`);
    return true;
  }
  const endsAt = claim.periodEnd.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "long", day: "numeric" });
  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `${claim.isRenewal ? "ต่ออายุ" : "อนุมัติ"}สิทธิ์ใช้งานผ่านโบรกเกอร์แล้ว (คำขอ ${claim.orderNumber}) - ${siteConfig.name}`,
      html: emailLayout(
        claim.isRenewal ? "ต่ออายุสิทธิ์ผ่านโบรกเกอร์เรียบร้อย" : "อนุมัติสิทธิ์ผ่านโบรกเกอร์เรียบร้อย",
        `
          <p>ทีมงานตรวจสอบบัญชีเทรดของคุณใน Partner Portal แล้ว (คำขอ <strong>${escapeHtml(claim.orderNumber)}</strong>)</p>
          <p>สิทธิ์ใช้งานถึงวันที่ <strong>${escapeHtml(endsAt)}</strong> — ทีมงานจะเปิดสิทธิ์ในแต่ละช่องทางให้ตามข้อมูลในหน้าสมาชิก</p>
          <p>ต่ออายุได้ในช่วง 7 วันก่อนหมดอายุ ที่หน้า "สิทธิ์ผ่านโบรกเกอร์" ในแดชบอร์ดสมาชิก (ทีมงานจะตรวจบัญชีอีกครั้ง)</p>
          ${emailButton(`${appUrl()}/account/broker-ib`, "ดูสถานะสิทธิ์")}
        `,
      ),
    });
    if (error) {
      console.error("[Email Error] Failed to send IB claim approved email via Resend:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email Exception] Unexpected error sending IB claim approved email:", err);
    return false;
  }
}

/** แจ้งสมาชิกว่าคำขอสิทธิ์ผ่าน IB ไม่ผ่านการตรวจสอบ พร้อมเหตุผล */
export async function sendBrokerClaimRejectedEmail(
  email: string,
  claim: { orderNumber: string; reason: string; pageUrl: string },
): Promise<boolean> {
  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Email] RESEND_API_KEY ไม่ได้ตั้งค่า — ไม่ได้ส่งอีเมลแจ้งคำขอ IB ไม่ผ่าน", { orderNumber: claim.orderNumber });
      return false;
    }
    console.info(`[Email Simulation] IB claim rejected for ${email}: ${claim.orderNumber}, reason: ${claim.reason}`);
    return true;
  }
  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `คำขอสิทธิ์ผ่านโบรกเกอร์ไม่ผ่านการตรวจสอบ (คำขอ ${claim.orderNumber}) - ${siteConfig.name}`,
      html: emailLayout(
        "คำขอสิทธิ์ผ่านโบรกเกอร์ไม่ผ่านการตรวจสอบ",
        `
          <p>คำขอ <strong>${escapeHtml(claim.orderNumber)}</strong> ยังไม่ได้รับการอนุมัติ</p>
          <p><strong>เหตุผล:</strong> ${escapeHtml(claim.reason)}</p>
          <p>แก้ไขตามเหตุผลแล้วยื่นคำขอใหม่ได้ที่หน้าสิทธิ์ผ่านโบรกเกอร์ หรือติดต่อทีมงาน</p>
          ${emailButton(claim.pageUrl, "ไปหน้าสิทธิ์ผ่านโบรกเกอร์")}
        `,
        WARNING_ORANGE,
      ),
    });
    if (error) {
      console.error("[Email Error] Failed to send IB claim rejected email via Resend:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email Exception] Unexpected error sending IB claim rejected email:", err);
    return false;
  }
}
