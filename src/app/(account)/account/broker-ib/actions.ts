"use server";

import type { Broker, TradingPlatform } from "@prisma/client";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { siteConfig } from "@/config/site";
import { legalConfig } from "@/config/legal";
import { BROKER_IB_RULES } from "@/config/broker-ib";
import { getClientIp } from "@/lib/request";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { markAdminNotified } from "@/lib/orders/checkout";
import { createBrokerClaim, type BrokerClaimInput, type CreateBrokerClaimResult } from "@/lib/broker-ib/claims";
import { BROKER_CLAIM_SUCCESS_MESSAGE, brokerClaimErrorMessage, type BrokerClaimErrorCode } from "@/lib/broker-ib/messages";
import { buildBrokerClaimConflictMessage, buildNewBrokerClaimMessage } from "@/lib/broker-ib/notification";
import { maskAccountNumber, normalizeAccountNumber } from "@/lib/broker-ib/validation";

export type BrokerClaimFormState = { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

const PAGE_PATH = "/account/broker-ib";
const BROKER_VALUES: readonly Broker[] = ["XM", "EXNESS"];
const PLATFORM_VALUES: readonly TradingPlatform[] = ["MT4", "MT5"];

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const isChecked = (formData: FormData, name: string) => formData.get(name) === "on";
const error = (code: BrokerClaimErrorCode, opensAt?: Date): BrokerClaimFormState => ({ status: "error", message: brokerClaimErrorMessage(code, opensAt) });

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/auth/signin?callbackUrl=${encodeURIComponent(PAGE_PATH)}`);
  return session.user.id;
}

/** อ่านฟอร์ม → คำขอ (ไม่อ่าน userId จากฟอร์มเด็ดขาด) */
function parseClaim(formData: FormData): BrokerClaimInput | "INVALID_BROKER" {
  if (text(formData, "mode") === "RENEW") return { mode: "RENEW" };
  const broker = text(formData, "broker") as Broker;
  const platform = text(formData, "platform") as TradingPlatform;
  if (!BROKER_VALUES.includes(broker) || !PLATFORM_VALUES.includes(platform)) return "INVALID_BROKER";
  return { mode: "NEW", broker, platform, accountNumber: text(formData, "accountNumber"), registeredEmail: text(formData, "registeredEmail") };
}

type CreatedClaim = Extract<CreateBrokerClaimResult, { ok: true }>;

/** แจ้งแอดมิน — ส่งไม่สำเร็จจะไม่บันทึก adminNotifiedAt เพื่อให้ Watchdog ส่งซ้ำ */
async function notifyAdmins(claim: CreatedClaim): Promise<void> {
  const sent = await sendAdminTelegram(buildNewBrokerClaimMessage(claim, siteConfig.url));
  if (!sent.ok) {
    console.error("[broker-ib] ยังไม่ได้แจ้งแอดมินเรื่องคำขอ IB ใหม่ (adminNotifiedAt = null)", { orderNumber: claim.orderNumber, reason: sent.reason });
    return;
  }
  try {
    await markAdminNotified(prisma, { orderId: claim.orderId });
  } catch (cause) {
    console.error("[broker-ib] บันทึก adminNotifiedAt ไม่สำเร็จ", { orderNumber: claim.orderNumber, error: cause });
  }
}

function refreshPages(): void {
  try {
    revalidatePath(PAGE_PATH);
    revalidatePath("/account");
  } catch (cause) {
    console.error("[broker-ib] revalidatePath failed", cause);
  }
}

/** ยื่นคำขอสิทธิ์ผ่าน IB (ครั้งแรก / ต่ออายุ) — ใช้กับ useActionState */
export async function submitBrokerClaimAction(_previous: BrokerClaimFormState, formData: FormData): Promise<BrokerClaimFormState> {
  const userId = await requireUserId();
  const ipAddress = await getClientIp();
  const { claimRateLimit, claimIpRateLimit } = BROKER_IB_RULES;
  // สิทธิ์เข้าถึง = เรื่องสิทธิ์: นับ rate limit ไม่ได้ให้ปฏิเสธไว้ก่อน — จำกัดทั้งต่อสมาชิกและต่อ IP (กันสร้างหลายบัญชีมายื่นถล่ม)
  if (!(await checkRateLimit(`broker-claim:${userId}`, claimRateLimit.max, claimRateLimit.windowSeconds, { failClosed: true })).success) return error("RATE_LIMITED");
  if (!(await checkRateLimit(`broker-claim-ip:${ipAddress ?? "unknown"}`, claimIpRateLimit.max, claimIpRateLimit.windowSeconds, { failClosed: true })).success) {
    return error("RATE_LIMITED");
  }

  const claim = parseClaim(formData);
  if (claim === "INVALID_BROKER") return error("INVALID_BROKER");
  const confirmed = claim.mode === "NEW" ? isChecked(formData, "confirmOpenedViaLink") && isChecked(formData, "confirmDeposit") : isChecked(formData, "confirmStillActive");
  if (!confirmed) return error("CONFIRM_REQUIRED");
  if (!isChecked(formData, "acceptTerms")) return error("TERMS_REQUIRED");

  let result: CreateBrokerClaimResult;
  try {
    result = await createBrokerClaim(prisma, { userId, claim, termsVersion: legalConfig.effectiveDate, ipAddress });
  } catch (cause) {
    console.error("[broker-ib] createBrokerClaim failed", { userId, error: cause });
    await sendAdminTelegram(`⚠️ ยื่นคำขอสิทธิ์ผ่าน IB ล้มเหลว (UNEXPECTED)\nผู้ใช้: ${userId}`);
    return error("UNEXPECTED");
  }

  if (!result.ok) {
    if (result.code === "ACCOUNT_CLAIMED" && claim.mode === "NEW") {
      const account = normalizeAccountNumber(claim.accountNumber) ?? claim.accountNumber;
      // แจ้งแอดมินครั้งเดียวต่อบัญชีต่อชั่วโมง — กันการยิงซ้ำจนกลบการแจ้งเตือนอื่น
      const firstInWindow = await checkRateLimit(`broker-conflict:${claim.broker}:${account}`, 1, BROKER_IB_RULES.conflictAlertWindowSeconds);
      if (firstInWindow.success) {
        await sendAdminTelegram(buildBrokerClaimConflictMessage({ broker: claim.broker, accountMasked: maskAccountNumber(account), userId }, siteConfig.url));
      }
    }
    return error(result.code, result.code === "NOT_IN_RENEWAL_WINDOW" ? result.opensAt : undefined);
  }

  // คำขอถูกบันทึกแล้ว: งานหลังจากนี้ล้มเหลวได้โดยไม่กระทบผลลัพธ์ของผู้ใช้ — กดซ้ำไม่แจ้งแอดมินซ้ำ
  if (!result.reused) await notifyAdmins(result);
  refreshPages();
  return { status: "success", message: BROKER_CLAIM_SUCCESS_MESSAGE };
}
