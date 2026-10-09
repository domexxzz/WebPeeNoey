import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security";

const resetSchema = z.object({
  email: z.string().email().toLowerCase(),
  token: z.string().min(10, "Token ไม่ถูกต้อง"),
  newPassword: z.string().min(8, "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "ข้อมูลไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const { email, token, newPassword } = parsed.data;

    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        email,
        token,
      },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { error: "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือถูกใช้งานไปแล้ว" },
        { status: 400 }
      );
    }

    if (resetRecord.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: resetRecord.id } });
      return NextResponse.json(
        { error: "ลิงก์รีเซ็ตรหัสผ่านหมดอายุแล้ว กรุณาส่งคำขอใหม่อีกครั้ง" },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);

    // อัปเดตรหัสผ่านใหม่
    await prisma.user.update({
      where: { email },
      data: { passwordHash: newHash },
    });

    // ลบ Token ที่ใช้งานแล้วทันที
    await prisma.passwordResetToken.delete({
      where: { id: resetRecord.id },
    });

    return NextResponse.json({
      message: "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว สามารถเข้าสู่ระบบได้ทันที",
    });
  } catch (error) {
    console.error("[Reset Password Error]:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการตั้งรหัสผ่านใหม่" },
      { status: 500 }
    );
  }
}
