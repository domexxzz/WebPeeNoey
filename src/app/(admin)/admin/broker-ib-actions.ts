"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";
import { formatDate } from "@/lib/format";
import { sendBrokerClaimApprovedEmail, sendBrokerClaimRejectedEmail } from "@/lib/email";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { checked, done, fail, field, runAdminAction, type AdminActionState } from "@/lib/admin/run-admin-action";
import { updateBrokerIbSettings } from "@/lib/broker-ib/settings";
import { BROKER_IB_OFFER_TAG } from "@/lib/broker-ib/public-offer";
import { approveBrokerClaim, rejectBrokerClaim, releaseBrokerAccount, revokeBrokerAccess } from "@/lib/broker-ib/review";
import { buildIbSettingsChangedMessage } from "@/lib/broker-ib/notification";

/** server action หลังบ้านของสิทธิ์ผ่าน IB โบรกเกอร์ (ตรวจสิทธิ์แอดมินจาก DB ทุกครั้งผ่าน runAdminAction) */

function refreshBrokerIbPages(): void {
  revalidateTag(BROKER_IB_OFFER_TAG);
  for (const path of ["/", "/broker-ib", "/admin/settings", "/account/broker-ib"]) revalidatePath(path);
}

export async function updateBrokerIbSettingsAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction("updateBrokerIbSettings", async (actor) => {
    const input = {
      ibClaimsEnabled: checked(formData, "ibClaimsEnabled"),
      xmLink: field(formData, "ibXmLink"),
      exnessLink: field(formData, "ibExnessLink"),
      minDepositUsd: field(formData, "ibMinDepositUsd"),
    };
    const result = await updateBrokerIbSettings(prisma, { actor, ...input });
    if (!result.ok) return fail(result.code);
    if (!result.changed) return done("ไม่มีการเปลี่ยนแปลง");
    // ลิงก์พาร์ทเนอร์ถูกเปลี่ยน = รายได้ IB อาจไหลไปบัญชีคนอื่น → แจ้งกลุ่มแอดมินทุกครั้งที่ค่าเปลี่ยน (ก่อน → หลัง จากค่าที่บันทึกจริง)
    await sendAdminTelegram(buildIbSettingsChangedMessage(result.before, result.after, actor.id));
    refreshBrokerIbPages();
    return done(["บันทึกการตั้งค่าสิทธิ์ผ่าน IB แล้ว", ...result.warnings.map((warning) => `⚠️ ${warning}`)].join(" "));
  });
}

function refreshClaim(orderId: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/broker-claims");
  revalidatePath(`/admin/broker-claims/${orderId}`);
}

export async function approveBrokerClaimAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction("approveBrokerClaim", async (actor) => {
    const orderId = field(formData, "orderId");
    const result = await approveBrokerClaim(prisma, {
      orderId,
      actor,
      checks: { underIb: checked(formData, "checkUnderIb"), emailMatches: checked(formData, "checkEmail"), qualifies: checked(formData, "checkQualifies") },
      note: field(formData, "note"),
    });
    if (!result.ok) return fail(result.code);

    const sent = await sendBrokerClaimApprovedEmail(result.email, { orderNumber: result.orderNumber, periodEnd: result.periodEnd, isRenewal: result.isRenewal });
    if (!sent) console.error("[admin] ส่งอีเมลอนุมัติสิทธิ์ผ่าน IB ไม่สำเร็จ", { orderNumber: result.orderNumber });
    refreshClaim(orderId);
    return done(
      `อนุมัติ ${result.orderNumber} แล้ว — สิทธิ์ถึง ${formatDate(result.periodEnd)}${result.isRenewal ? "" : " — อย่าลืมเปิดสิทธิ์ TradingView / Discord / Telegram ในแผงด้านล่าง"}${sent ? "" : " (ส่งอีเมลไม่สำเร็จ — แจ้งลูกค้าเอง)"}`,
    );
  });
}

export async function rejectBrokerClaimAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction("rejectBrokerClaim", async (actor) => {
    const orderId = field(formData, "orderId");
    const reason = [field(formData, "reasonPreset"), field(formData, "reasonDetail")].filter(Boolean).join(" — ");
    const result = await rejectBrokerClaim(prisma, { orderId, actor, reason, releaseAccount: checked(formData, "releaseAccount") });
    if (!result.ok) return fail(result.code);

    const sent = await sendBrokerClaimRejectedEmail(result.email, { orderNumber: result.orderNumber, reason: result.reason, pageUrl: `${siteConfig.url}/account/broker-ib` });
    if (!sent) console.error("[admin] ส่งอีเมลแจ้งคำขอ IB ไม่ผ่านไม่สำเร็จ", { orderNumber: result.orderNumber });
    refreshClaim(orderId);
    return done(
      `ปฏิเสธ ${result.orderNumber} แล้ว${result.released ? " และปลดการผูกบัญชีเทรด (สมาชิกคนอื่นยื่นบัญชีนี้ได้)" : ""}${sent ? "" : " (ส่งอีเมลแจ้งลูกค้าไม่สำเร็จ — แจ้งลูกค้าเอง)"}`,
    );
  });
}

function refreshMember(userId: string): void {
  revalidatePath(`/admin/members/${userId}`);
  revalidatePath("/admin/members");
  revalidatePath("/admin/broker-claims");
}

export async function revokeBrokerAccessAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction("revokeBrokerAccess", async (actor) => {
    const userId = field(formData, "userId");
    if (!checked(formData, "confirmRevoke")) return fail("CONFIRM_REQUIRED");
    const result = await revokeBrokerAccess(prisma, { userId, actor, reason: field(formData, "reason"), releaseAccount: checked(formData, "releaseAccount") });
    if (!result.ok) return fail(result.code);
    refreshMember(userId);
    const claims = result.rejectedClaims > 0 ? ` · ปฏิเสธคำขอที่รอตรวจ ${result.rejectedClaims} รายการ` : "";
    return done(
      result.continuing
        ? `ปิดสิทธิ์ผ่าน IB แล้ว ${result.revoked} ช่วง — สมาชิกยังมีช่วงที่จ่ายเงินต่อ จึงยังไม่ต้องถอดสิทธิ์ในช่องทางต่าง ๆ${claims}`
        : `ปิดสิทธิ์ผ่าน IB แล้ว ${result.revoked} ช่วง — อย่าลืมถอดสิทธิ์ใน TradingView / Discord / Telegram${claims}`,
    );
  });
}

export async function releaseBrokerAccountAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction("releaseBrokerAccount", async (actor) => {
    if (!checked(formData, "confirmRelease")) return fail("CONFIRM_REQUIRED");
    const result = await releaseBrokerAccount(prisma, { brokerAccountId: field(formData, "brokerAccountId"), actor, reason: field(formData, "reason") });
    if (!result.ok) return fail(result.code);
    // คำนวณหน้าที่ต้องรีเฟรชจากข้อมูลฝั่ง server เอง ไม่รับ path จากฟอร์ม
    refreshMember(result.userId);
    const claims = result.rejectedClaims > 0 ? ` (ปฏิเสธคำขอที่รอตรวจ ${result.rejectedClaims} รายการ)` : "";
    return done(`ปลดการผูกบัญชีเทรดแล้ว — สมาชิกคนใดก็ยื่นบัญชีนี้ได้${claims} · สิทธิ์ที่อนุมัติไปแล้วยังอยู่ (ใช้ปุ่มปิดสิทธิ์ผ่าน IB ถ้าต้องการปิด)`);
  });
}
