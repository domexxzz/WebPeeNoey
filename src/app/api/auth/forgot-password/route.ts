import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateSecureToken } from "@/lib/security";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

const forgotSchema = z.object({
  email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง").toLowerCase(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown-ip";
    const body = await req.json();
    const parsed = forgotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "อีเมลไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Rate limit: สูงสุด 3 ครั้งต่อ 15 นาที
    const rateCheck = await checkRateLimit(`forgot:${ip}:${email}`, 3, 15 * 60);
    if (!rateCheck.success) {
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

    // ลบ token เก่าของอีเมลนี้ทิ้งก่อน
    await prisma.passwordResetToken.deleteMany({
      where: { email },
    });

    // บันทึก token ใหม่
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
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
