import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateSecureToken, hashToken } from "@/lib/security";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitIp } from "@/lib/request";

const WINDOW_SECONDS = 15 * 60;
/** ต่ออีเมล ไม่สน IP — กันการยิงอีเมลรีเซ็ตใส่เหยื่อโดยสลับ IP/ปลอม header */
const PER_EMAIL = 3;
const PER_IP = 10;

const forgotSchema = z.object({
  email: z.string().max(254, "รูปแบบอีเมลไม่ถูกต้อง").email("รูปแบบอีเมลไม่ถูกต้อง").toLowerCase(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "อีเมลไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Rate limit: ต่ออีเมล 3 ครั้ง และต่อ IP 10 ครั้ง ใน 15 นาที
    const perEmail = await checkRateLimit(`forgot-email:${email}`, PER_EMAIL, WINDOW_SECONDS);
    const perIp = perEmail.success ? await checkRateLimit(`forgot-ip:${rateLimitIp(req.headers)}`, PER_IP, WINDOW_SECONDS) : perEmail;
    if (!perEmail.success || !perIp.success) {
      return NextResponse.json(
        { error: "ส่งคำขอรีเซ็ตรหัสผ่านบ่อยเกินไป กรุณารอ 15 นาที" },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // ป้องกัน User Enumeration: หากไม่มีผู้ใช้ ให้ตอบข้อความเหมือนกันแต่ไม่ส่งเมล
    if (!user) {
      return NextResponse.json({
        message: "หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว",
      });
    }

    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 ชั่วโมง

    // ไม่ลบลิงก์เดิมที่ยังไม่หมดอายุ — ไม่งั้นคนอื่นกดขอรีเซ็ตแทนเราเพื่อทำให้ลิงก์ที่เราถืออยู่ใช้ไม่ได้ (จำนวนถูกจำกัดด้วย rate limit ต่ออีเมล)
    await prisma.passwordResetToken.deleteMany({
      where: { email, expiresAt: { lt: new Date() } },
    });

    // เก็บเฉพาะ hash ของโทเคน — โทเคนจริงอยู่ในอีเมลเท่านั้น
    await prisma.passwordResetToken.create({
      data: {
        email,
        token: hashToken(token),
        expiresAt,
      },
    });

    // ส่งอีเมล
    await sendPasswordResetEmail(email, token);

    return NextResponse.json({
      message: "หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว",
    });
  } catch (error) {
    console.error("[Forgot Password Error]:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการประมวลผลคำขอ" },
      { status: 500 }
    );
  }
}
