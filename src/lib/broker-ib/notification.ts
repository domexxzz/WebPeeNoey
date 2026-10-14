import type { Broker } from "@prisma/client";
import { BROKERS } from "@/config/broker-ib";

/** ข้อความแจ้งกลุ่มแอดมิน (Telegram) — ปิดบังเลขบัญชีเทรดและอีเมล (PDPA) ข้อมูลเต็มดูได้ในหลังบ้านเท่านั้น */

export function buildNewBrokerClaimMessage(
  claim: { orderId: string; orderNumber: string; broker: Broker; accountMasked: string; isRenewal: boolean },
  siteUrl: string,
  { retry = false }: { retry?: boolean } = {},
): string {
  return [
    retry ? "🤝 คำขอสิทธิ์ผ่าน IB รอตรวจ (ส่งซ้ำ — ครั้งก่อนแจ้งไม่สำเร็จ)" : "🤝 คำขอสิทธิ์ผ่าน IB ใหม่",
    `คำขอ: ${claim.orderNumber}${claim.isRenewal ? " (ต่ออายุ)" : ""}`,
    `โบรกเกอร์: ${BROKERS[claim.broker].label} บัญชี ${claim.accountMasked}`,
    "ตรวจใน Partner Portal แล้วอนุมัติ/ปฏิเสธที่:",
    `${siteUrl}/admin/broker-claims/${claim.orderId}`,
  ].join("\n");
}

/** มีคนยื่นบัญชีที่สมาชิกอื่นผูกไว้แล้ว — อาจเป็นการยื่นบัญชีของคนอื่นดักไว้ ให้แอดมินรู้ */
export function buildBrokerClaimConflictMessage(input: { broker: Broker; accountMasked: string; userId: string }, siteUrl: string): string {
  return [
    "⚠️ มีการยื่นบัญชีเทรดที่สมาชิกอื่นผูกไว้แล้ว",
    `โบรกเกอร์: ${BROKERS[input.broker].label} บัญชี ${input.accountMasked}`,
    `ผู้ยื่น: ${siteUrl}/admin/members/${input.userId}`,
    "หากเจ้าของบัญชีติดต่อมาพร้อมหลักฐาน ให้ปลดการผูกจากสมาชิกเดิมในหน้าสมาชิก",
  ].join("\n");
}

interface IbSettingsSnapshot {
  ibClaimsEnabled: boolean;
  ibXmLink: string;
  ibExnessLink: string;
  ibMinDepositUsd: number | null;
}

const hostOf = (link: string) => {
  try {
    return link ? new URL(link).hostname : "";
  } catch {
    return "";
  }
};

/**
 * แจ้งกลุ่มแอดมินเมื่อการตั้งค่า IB เปลี่ยน (ค่าที่บันทึกจริงหลัง normalize เท่านั้น) — แสดงก่อน → หลัง
 * ลิงก์พาร์ทเนอร์ถูกเปลี่ยน = รายได้ IB อาจไหลไปบัญชีอื่น จึงเตือนชัดเมื่อโดเมนเปลี่ยน
 */
export function buildIbSettingsChangedMessage(before: IbSettingsSnapshot | null, after: IbSettingsSnapshot, actorId: string): string {
  const show = (value: string | number | null) => (value === null || value === "" ? "-" : String(value));
  const lines = ["🔐 แก้ไขการตั้งค่าสิทธิ์ผ่าน IB"];
  if (before?.ibClaimsEnabled !== after.ibClaimsEnabled) {
    lines.push(`รับคำขอ: ${before ? (before.ibClaimsEnabled ? "เปิด" : "ปิด") : "-"} → ${after.ibClaimsEnabled ? "เปิด" : "ปิด"}`);
  }
  for (const [label, key] of [["XM", "ibXmLink"], ["Exness", "ibExnessLink"]] as const) {
    const previous = before?.[key] ?? "";
    if (previous === after[key]) continue;
    lines.push(`ลิงก์ ${label}: ${show(previous)} → ${show(after[key])}`);
    if (previous && after[key] && hostOf(previous) !== hostOf(after[key])) {
      lines.push(`⚠️ โดเมนลิงก์ ${label} เปลี่ยน: ${hostOf(previous)} → ${hostOf(after[key])} — ตรวจว่าเป็นลิงก์พาร์ทเนอร์ของเราจริง`);
    }
  }
  if ((before?.ibMinDepositUsd ?? null) !== after.ibMinDepositUsd) {
    lines.push(`ฝากขั้นต่ำ (USD): ${show(before?.ibMinDepositUsd ?? null)} → ${show(after.ibMinDepositUsd)}`);
  }
  lines.push(`โดยแอดมิน: ${actorId}`);
  return lines.join("\n");
}
