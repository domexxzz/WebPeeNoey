import type { Broker, PrismaClient } from "@prisma/client";
import { BROKERS } from "@/config/broker-ib";
import { SYSTEM_SETTING_ID } from "@/lib/db/constants";
import type { ActorContext } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { isKnownBrokerHost, normalizeBrokerLink, parseMinDepositThb, parseUsdThbRate } from "./validation";
import { readLockedLinks, type LockedLinks } from "./link-lock";

export interface BrokerIbSettingsSnapshot {
  ibClaimsEnabled: boolean;
  ibXmLink: string;
  ibExnessLink: string;
  ibMinDepositXmThb: number | null;
  ibMinDepositExnessThb: number | null;
  ibUsdThbRate: number | null;
}

export type BrokerIbSettingsResult =
  | { ok: true; warnings: string[]; changed: boolean; before: BrokerIbSettingsSnapshot | null; after: BrokerIbSettingsSnapshot }
  | { ok: false; code: "INVALID_IB_LINK" | "INVALID_MIN_DEPOSIT" | "INVALID_USD_THB_RATE" | "IB_NOT_CONFIGURED" };

interface BrokerIbSettingsInput {
  actor: ActorContext;
  ibClaimsEnabled: boolean;
  xmLink: string;
  exnessLink: string;
  xmMinDepositThb: string;
  exnessMinDepositThb: string;
  usdThbRate: string;
  /** ลิงก์ที่ล็อกด้วย env (ค่าเริ่มต้นอ่านจาก process.env) — ลิงก์ที่ล็อกแล้วใช้ค่านี้แทนค่าที่แอดมินพิมพ์ */
  lockedLinks?: LockedLinks;
}

function hostWarning(broker: Broker, link: string): string | null {
  if (!link || isKnownBrokerHost(broker, link)) return null;
  return `ลิงก์ ${BROKERS[broker].label} อยู่บนโดเมน ${new URL(link).hostname} ซึ่งไม่ใช่โดเมนที่รู้จักของ ${BROKERS[broker].label} — ตรวจให้แน่ใจว่าเป็นลิงก์พาร์ทเนอร์ของคุณจริง`;
}

/**
 * แก้ไขการตั้งค่าสิทธิ์ผ่าน IB (ลิงก์พาร์ทเนอร์ XM / Exness + ยอดฝากขั้นต่ำ + สวิตช์เปิดรับคำขอ)
 * - เปิดสวิตช์ไม่ได้ถ้ายังไม่มียอดฝากขั้นต่ำ หรือไม่มีลิงก์อย่างน้อย 1 โบรกเกอร์
 * - ลิงก์บนโดเมนที่ไม่รู้จัก: บันทึกได้แต่คืนคำเตือนให้แอดมินตรวจ (ลิงก์พาร์ทเนอร์จริงมักเป็นโดเมนติดตาม)
 * - ล็อกแถวตั้งค่าก่อนอ่าน ค่า "ก่อน" ใน AuditLog จึงถูกต้องแม้แอดมินสองคนบันทึกพร้อมกัน
 * - แตะเฉพาะฟิลด์ IB — ไม่ทับการตั้งค่า PromptPay
 */
export async function updateBrokerIbSettings(db: PrismaClient, input: BrokerIbSettingsInput): Promise<BrokerIbSettingsResult> {
  const locked = input.lockedLinks ?? readLockedLinks();
  const xm = normalizeBrokerLink(locked.XM ?? input.xmLink);
  const exness = normalizeBrokerLink(locked.EXNESS ?? input.exnessLink);
  if (!xm.ok || !exness.ok) return { ok: false, code: "INVALID_IB_LINK" };
  const xmMin = parseMinDepositThb(input.xmMinDepositThb);
  const exnessMin = parseMinDepositThb(input.exnessMinDepositThb);
  const rate = parseUsdThbRate(input.usdThbRate);
  if (!xmMin.ok || !exnessMin.ok) return { ok: false, code: "INVALID_MIN_DEPOSIT" };
  if (!rate.ok) return { ok: false, code: "INVALID_USD_THB_RATE" };

  const after: BrokerIbSettingsSnapshot = {
    ibClaimsEnabled: input.ibClaimsEnabled,
    ibXmLink: xm.url,
    ibExnessLink: exness.url,
    ibMinDepositXmThb: xmMin.value,
    ibMinDepositExnessThb: exnessMin.value,
    ibUsdThbRate: rate.value,
  };
  // เปิดรับคำขอได้เมื่อมีอัตราแลกเปลี่ยน และมีโบรกเกอร์ที่พร้อมใช้งานจริง (ลิงก์ + ขั้นต่ำ) อย่างน้อย 1 ราย
  const offered = [xm.url && after.ibMinDepositXmThb !== null, exness.url && after.ibMinDepositExnessThb !== null].some(Boolean);
  if (input.ibClaimsEnabled && (after.ibUsdThbRate === null || !offered)) {
    return { ok: false, code: "IB_NOT_CONFIGURED" };
  }

  const before = await db.$transaction(async (tx): Promise<BrokerIbSettingsSnapshot | null> => {
    await tx.$queryRaw`SELECT id FROM "SystemSetting" WHERE id = ${SYSTEM_SETTING_ID} FOR UPDATE`;
    const current = await tx.systemSetting.findUnique({ where: { id: SYSTEM_SETTING_ID } });
    const snapshot = current
      ? {
          ibClaimsEnabled: current.ibClaimsEnabled,
          ibXmLink: current.ibXmLink,
          ibExnessLink: current.ibExnessLink,
          ibMinDepositXmThb: current.ibMinDepositXmThb?.toNumber() ?? null,
          ibMinDepositExnessThb: current.ibMinDepositExnessThb?.toNumber() ?? null,
          ibUsdThbRate: current.ibUsdThbRate?.toNumber() ?? null,
        }
      : null;
    await tx.systemSetting.upsert({ where: { id: SYSTEM_SETTING_ID }, create: { id: SYSTEM_SETTING_ID, ...after }, update: after });
    await writeAudit(tx, {
      actor: input.actor,
      action: "IB_SETTINGS_UPDATE",
      targetType: "System",
      targetId: SYSTEM_SETTING_ID,
      details: { before: snapshot, after: { ...after } },
    });
    return snapshot;
  });

  const warnings = [hostWarning("XM", xm.url), hostWarning("EXNESS", exness.url)].filter((warning): warning is string => warning !== null);
  const changed = !before || (Object.keys(after) as (keyof BrokerIbSettingsSnapshot)[]).some((key) => before[key] !== after[key]);
  return { ok: true, warnings, changed, before, after };
}
