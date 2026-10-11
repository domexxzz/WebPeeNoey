import type { PrismaClient } from "@prisma/client";

export interface AdminActor {
  id: string;
  email: string;
}

/** ผู้กระทำการในหลังบ้าน (ส่งต่อให้ service เพื่อบันทึก AuditLog) */
export interface ActorContext {
  id: string;
  ipAddress?: string | null;
}

/**
 * ตรวจสิทธิ์แอดมินจากฐานข้อมูลทุกครั้ง — ไม่เชื่อ role ใน session/JWT อย่างเดียว
 * (JWT ไม่ถูกเพิกถอนเมื่อแอดมินถูกลดสิทธิ์ และ role ใน token อาจเก่า)
 */
export async function getAdminActor(db: PrismaClient, userId: string | null | undefined): Promise<AdminActor | null> {
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
  return user?.role === "ADMIN" ? { id: user.id, email: user.email } : null;
}
