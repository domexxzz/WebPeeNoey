import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.EMAIL_FROM || "Peenoey Trading <noreply@peenoey.com>";

/** escape ข้อความก่อนใส่ใน HTML อีเมล (อีเมล/ชื่อแพ็กเกจ/เหตุผลอาจมีอักขระพิเศษ) */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
      subject: "คำขอตั้งรหัสผ่านใหม่ - Peenoey Indicator",
      html: `
        <div style="font-family: sans-serif; background-color: #0B0F17; color: #FFFFFF; padding: 40px; border-radius: 8px;">
          <h2 style="color: #F59E0B;">ตั้งรหัสผ่านใหม่</h2>
          <p>เรียนผู้ใช้งาน,</p>
          <p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี <strong>${escapeHtml(email)}</strong> ของคุณ</p>
          <p>กรุณาคลิกปุ่มด้านล่างเพื่อดำเนินการตั้งรหัสผ่านใหม่ (ลิงก์มีอายุ 1 ชั่วโมง):</p>
          <div style="margin: 30px 0;">
            <a href="${escapeHtml(resetUrl)}" style="background-color: #F59E0B; color: #000000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">ตั้งรหัสผ่านใหม่</a>
          </div>
          <p style="color: #9CA3AF; font-size: 13px;">หากคุณไม่ได้เป็นผู้ส่งคำขอนี้ สามารถเพิกเฉยต่ออีเมลนี้ได้อย่างปลอดภัย</p>
        </div>
      `,
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
      subject: `ใบเสร็จรับเงินและการอนุมัติสิทธิ์ (ออเดอร์ ${orderNumber}) - Peenoey Indicator`,
      html: `
        <div style="font-family: sans-serif; background-color: #0B0F17; color: #FFFFFF; padding: 40px; border-radius: 8px;">
          <h2 style="color: #10B981;">อนุมัติคำสั่งซื้อเรียบร้อยแล้ว!</h2>
          <p>เรียนคุณ ${escapeHtml(email)},</p>
          <p>คำสั่งซื้อหมายเลข <strong>${escapeHtml(orderNumber)}</strong> ได้รับการตรวจสอบและอนุมัติสิทธิ์เรียบร้อยแล้ว</p>
          <div style="background-color: #111827; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.1);">
            <p style="margin: 6px 0;"><strong>แพ็กเกจ:</strong> ${escapeHtml(planName)}</p>
            <p style="margin: 6px 0;"><strong>ยอดชำระ:</strong> ${amount.toLocaleString()} บาท</p>
            <p style="margin: 6px 0;"><strong>วันหมดอายุสิทธิ์:</strong> ${periodEnd.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
          </div>
          <p>คุณสามารถเข้าใช้งานระบบและตรวจสอบสิทธิ์ได้ทันทีที่แดชบอร์ดสมาชิกของคุณ</p>
          <div style="margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/account" style="background-color: #10B981; color: #000000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">เข้าสู่แดชบอร์ดสมาชิก</a>
          </div>
        </div>
      `,
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
      subject: `สลิปไม่ผ่านการตรวจสอบ (ออเดอร์ ${orderNumber}) - Peenoey Indicator`,
      html: `
        <div style="font-family: sans-serif; background-color: #0B0F17; color: #FFFFFF; padding: 40px; border-radius: 8px;">
          <h2 style="color: #F59E0B;">สลิปไม่ผ่านการตรวจสอบ</h2>
          <p>คำสั่งซื้อหมายเลข <strong>${escapeHtml(orderNumber)}</strong> ยังไม่ได้รับการอนุมัติ</p>
          <p><strong>เหตุผล:</strong> ${escapeHtml(reason)}</p>
          <p>หากคุณโอนเงินแล้ว กรุณาแนบสลิปใบที่ถูกต้องอีกครั้งที่หน้าคำสั่งซื้อ หรือติดต่อทีมงาน</p>
          <div style="margin: 30px 0;">
            <a href="${escapeHtml(orderUrl)}" style="background-color: #F59E0B; color: #000000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">ไปหน้าคำสั่งซื้อ</a>
          </div>
        </div>
      `,
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
