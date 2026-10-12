import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitIp } from "@/lib/request";

const registerSchema = z.object({
  name: z.string().min(2, "ชื่อต้องมีความยาวอย่างน้อย 2 ตัวอักษร").max(100),
  email: z.string().max(254, "รูปแบบอีเมลไม่ถูกต้อง").email("รูปแบบอีเมลไม่ถูกต้อง").toLowerCase(),
  password: z.string().min(8, "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร"),
  // แสดงในข้อความถึงแอดมินและใช้เปิดสิทธิ์ TradingView — จำกัดรูปแบบกันการปลอมบรรทัด/ข้อความยาวผิดปกติ
  tradingViewUsername: z
    .string()
    .trim()
    .max(50, "ชื่อผู้ใช้ TradingView ยาวเกินไป")
    .regex(/^[A-Za-z0-9_.-]*$/, "ชื่อผู้ใช้ TradingView ใช้ได้เฉพาะ A-Z, a-z, 0-9, _ . -")
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    // IP ที่ตรวจรูปแบบแล้ว — ค่าปลอมใน x-forwarded-for ใช้ถังเดียวกันหมด จึงสลับค่าเพื่อเลี่ยง limit ไม่ได้
    const rateCheck = await checkRateLimit(`register:${rateLimitIp(req.headers)}`, 5, 10 * 60);

    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "มีการส่งคำขอสมัครสมาชิกมากเกินไป กรุณารอสักครู่แล้วลองใหม่" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "ข้อมูลไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const { name, email, password, tradingViewUsername } = parsed.data;

    // ตรวจสอบว่ามีอีเมลนี้แล้วหรือไม่
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "อีเมลนี้ลงทะเบียนในระบบแล้ว กรุณาเข้าสู่ระบบ" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    // การสมัครผ่านหน้าเว็บได้สิทธิ์ USER เสมอ — บัญชีแอดมินสร้าง/เลื่อนขั้นผ่าน `npm run db:seed` เท่านั้น
    // (เดิมให้ ADMIN ตาม ADMIN_EMAIL โดยไม่ยืนยันอีเมล ทำให้ใครสมัครอีเมลนั้นก่อนได้สิทธิ์แอดมิน)
    const role = "USER";

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        tradingViewUsername: tradingViewUsername?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tradingViewUsername: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "สมัครสมาชิกสำเร็จ", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Register Error]:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
