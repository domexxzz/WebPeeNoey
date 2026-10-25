import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { getAdminActor, type ActorContext } from "./guard";
import { adminErrorMessage, type AdminErrorCode } from "./messages";
import { writeAudit, type AuditTarget } from "./audit";

/** ตัวช่วยร่วมของ server action หลังบ้าน (ไฟล์ "use server" export ได้แค่ async function จึงแยกไว้ที่นี่) */

/** เหตุผลที่คำสั่งถูกปฏิเสธ — ติดมากับ state เพื่อให้ runAdminAction บันทึก AuditLog ได้ ไม่ได้แสดงให้ผู้ใช้ */
type Refusal = { code: AdminErrorCode; target?: AuditTarget; note?: string };

/** targetId มาจากฟอร์ม — ตัดความยาวก่อนบันทึก ไม่ให้ถมตาราง append-only ด้วยค่าขยะยาว ๆ */
const MAX_TARGET_ID_LENGTH = 64;

export type AdminActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; refusal?: Refusal };

export const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
export const checked = (formData: FormData, name: string) => formData.get(name) === "on";
export const fail = (code: AdminErrorCode, target?: AuditTarget): AdminActionState => ({
  status: "error",
  message: adminErrorMessage(code),
  refusal: { code, target },
});
export const done = (message: string): AdminActionState => ({ status: "success", message });

/** state ที่ส่งกลับหน้าเว็บไม่ต้องมีเหตุผลเชิงระบบติดไปด้วย — บันทึกไว้ฝั่งเซิร์ฟเวอร์แล้ว */
function withoutRefusal(state: AdminActionState): AdminActionState {
  if (state.status !== "error" || !state.refusal) return state;
  return { status: "error", message: state.message };
}

/** ตรวจสิทธิ์แอดมินจาก DB ทุกครั้งที่เรียก action (server action ถูกเรียกตรงได้โดยไม่ผ่านหน้าเว็บ) */
export async function requireAdmin(): Promise<ActorContext | null> {
  const session = await getServerSession(authOptions);
  const admin = await getAdminActor(prisma, session?.user?.id);
  return admin ? { id: admin.id, ipAddress: (await getClientIp()) ?? null } : null;
}

/**
 * บันทึกว่าคำสั่งถูกปฏิเสธ เพื่อให้ตามย้อนหลังได้ว่า "กดแล้วไม่เข้า" เพราะอะไร (CLAUDE.md ข้อ 5)
 * บันทึกไม่สำเร็จต้องไม่กลบข้อความที่แอดมินเห็น — คำสั่งถูกปฏิเสธไปแล้ว ไม่มีอะไรให้ย้อนกลับ
 * แต่ห้ามเงียบ: บันทึกไม่ลงคือร่องรอยหายไปเฉย ๆ ซึ่งเป็นปัญหาเดิมที่โค้ดชุดนี้ตั้งใจแก้ จึงต้องแจ้งกลุ่มแอดมิน
 */
export async function recordActionRefusal(name: string, actor: ActorContext, { code, target, note }: Refusal): Promise<void> {
  try {
    await writeAudit(prisma, {
      actor,
      action: "ADMIN_ACTION_REFUSED",
      targetType: target?.targetType ?? "System",
      targetId: (target?.targetId || name).slice(0, MAX_TARGET_ID_LENGTH),
      details: { action: name, kind: code === "UNEXPECTED" ? "UNEXPECTED" : "REFUSED", code, message: note?.slice(0, 300) ?? adminErrorMessage(code) },
    });
  } catch (error) {
    console.error(`[admin] บันทึกการปฏิเสธ ${name} ไม่สำเร็จ`, { actorId: actor.id, code, error });
    await sendAdminTelegram(`⚠️ หลังบ้าน: บันทึกการปฏิเสธ ${name} (${code}) ลง Audit Log ไม่สำเร็จ
แอดมิน: ${actor.id}`);
  }
}

/** ห่อทุก action: ตรวจสิทธิ์ + บันทึกทุกครั้งที่ถูกปฏิเสธหรือพัง (ห้ามล้มเงียบ) */
export async function runAdminAction(name: string, run: (actor: ActorContext) => Promise<AdminActionState>): Promise<AdminActionState> {
  const actor = await requireAdmin();
  // ไม่เขียนลงฐานข้อมูลตอนยังไม่รู้ว่าเป็นใคร — ใครก็ยิง server action ตรงได้ จะกลายเป็นช่องถมตาราง AuditLog
  if (!actor) {
    console.error(`[admin] ${name} ถูกปฏิเสธ: ไม่ใช่แอดมิน`);
    return withoutRefusal(fail("FORBIDDEN"));
  }
  try {
    const state = await run(actor);
    if (state.status === "error" && state.refusal) await recordActionRefusal(name, actor, state.refusal);
    return withoutRefusal(state);
  } catch (error) {
    console.error(`[admin] ${name} failed`, { actorId: actor.id, error });
    // ห้ามล้มเงียบ: แจ้งกลุ่มแอดมินด้วย (sendAdminTelegram log ความล้มเหลวของตัวเองอยู่แล้ว)
    // ยิงพร้อมกัน: ถ้าฐานข้อมูลเป็นต้นเหตุ การเขียน Audit Log จะค้างจนหมดเวลา ห้ามให้แจ้งเตือนช้าตาม
    await Promise.allSettled([
      sendAdminTelegram(`⚠️ หลังบ้าน: ${name} ล้มเหลว (UNEXPECTED)
แอดมิน: ${actor.id}`),
      recordActionRefusal(name, actor, { code: "UNEXPECTED" }),
    ]);
    return withoutRefusal(fail("UNEXPECTED"));
  }
}
