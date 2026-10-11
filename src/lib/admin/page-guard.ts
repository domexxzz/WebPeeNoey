import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminActor, type AdminActor } from "./guard";

/**
 * เรียกบรรทัดแรกของทุกหน้า /admin — ตรวจ role จากฐานข้อมูล
 * (layout ถูกข้ามได้ตอนเปลี่ยนหน้าแบบ soft navigation และ JWT อาจเก่าได้ถึง 30 วัน)
 * ใช้ React cache จึง query ครั้งเดียวต่อคำขอแม้ layout และหน้าเรียกซ้ำ
 */
export const requireAdminPage = cache(async (): Promise<AdminActor> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/admin");
  const admin = await getAdminActor(prisma, session.user.id);
  if (!admin) redirect("/account?error=unauthorized_admin");
  return admin;
});
