import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { getAdminActor, type ActorContext } from "./guard";
import { adminErrorMessage, type AdminErrorCode } from "./messages";

/** ตัวช่วยร่วมของ server action หลังบ้าน (ไฟล์ "use server" export ได้แค่ async function จึงแยกไว้ที่นี่) */

export type AdminActionState = { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

export const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
export const checked = (formData: FormData, name: string) => formData.get(name) === "on";
export const fail = (code: AdminErrorCode): AdminActionState => ({ status: "error", message: adminErrorMessage(code) });
export const done = (message: string): AdminActionState => ({ status: "success", message });

/** ตรวจสิทธิ์แอดมินจาก DB ทุกครั้งที่เรียก action (server action ถูกเรียกตรงได้โดยไม่ผ่านหน้าเว็บ) */
export async function requireAdmin(): Promise<ActorContext | null> {
  const session = await getServerSession(authOptions);
  const admin = await getAdminActor(prisma, session?.user?.id);
  return admin ? { id: admin.id, ipAddress: (await getClientIp()) ?? null } : null;
}

/** ห่อทุก action: ตรวจสิทธิ์ + log ข้อผิดพลาดที่ไม่คาดคิด (ห้ามล้มเงียบ) */
export async function runAdminAction(name: string, run: (actor: ActorContext) => Promise<AdminActionState>): Promise<AdminActionState> {
  const actor = await requireAdmin();
  if (!actor) return fail("FORBIDDEN");
  try {
    return await run(actor);
  } catch (error) {
    console.error(`[admin] ${name} failed`, { actorId: actor.id, error });
    // ห้ามล้มเงียบ: แจ้งกลุ่มแอดมินด้วย (sendAdminTelegram log ความล้มเหลวของตัวเองอยู่แล้ว)
    await sendAdminTelegram(`⚠️ หลังบ้าน: ${name} ล้มเหลว (UNEXPECTED)
แอดมิน: ${actor.id}`);
    return fail("UNEXPECTED");
  }
}
