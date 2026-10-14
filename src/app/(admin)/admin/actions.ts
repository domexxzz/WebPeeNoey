"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";
import { sendReceiptEmail, sendSlipRejectedEmail } from "@/lib/email";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { formatDate } from "@/lib/format";
import { approveOrder, refundOrder, rejectOrder } from "@/lib/admin/order-review";
import { revokeMemberAccess, setProvisioning, PROVISIONING_CHANNELS, type ProvisioningChannel } from "@/lib/admin/members";
import { updatePaymentSettings } from "@/lib/admin/settings";
import { BROKER_IB_OFFER_TAG } from "@/lib/broker-ib/public-offer";
import { checked, done, fail, field, runAdminAction, type AdminActionState } from "@/lib/admin/run-admin-action";

export type { AdminActionState };

function refreshOrder(orderId: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function approveOrderAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction("approveOrder", async (actor) => {
    const orderId = field(formData, "orderId");
    if (!checked(formData, "confirmReceived")) return fail("CONFIRM_REQUIRED");
    const result = await approveOrder(prisma, { orderId, actor, referenceNo: field(formData, "referenceNo") });
    if (!result.ok) return fail(result.code);

    const sent = await sendReceiptEmail(result.email, result.orderNumber, result.planName, result.amount, result.periodEnd);
    if (!sent) console.error("[admin] ส่งอีเมลใบเสร็จไม่สำเร็จ", { orderNumber: result.orderNumber });
    if (result.promoOversold) {
      // ราคาโปรถูกล็อกให้ลูกค้าไปแล้ว (ยุติธรรมกับลูกค้า) แต่ต้องแจ้งให้แอดมินปิดโปรหรือปรับจำนวนที่นั่ง
      await sendAdminTelegram(`⚠️ ที่นั่งโปรโมชันเกินจำนวนที่ประกาศ
ออเดอร์: ${result.orderNumber}
แพ็กเกจ: ${result.planName}`);
    }
    refreshOrder(orderId);
    const notes = [
      sent ? "" : " (ส่งอีเมลใบเสร็จไม่สำเร็จ — แจ้งลูกค้าเอง)",
      result.promoOversold ? " ⚠️ ที่นั่งโปรโมชันเกินจำนวนที่ประกาศแล้ว — ควรปิดโปรของแพ็กเกจนี้" : "",
    ].join("");
    return done(`อนุมัติ ${result.orderNumber} แล้ว — สิทธิ์ถึง ${formatDate(result.periodEnd)}${notes}`);
  });
}

export async function rejectOrderAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction("rejectOrder", async (actor) => {
    const orderId = field(formData, "orderId");
    const reason = [field(formData, "reasonPreset"), field(formData, "reasonDetail")].filter(Boolean).join(" — ");
    const result = await rejectOrder(prisma, { orderId, actor, reason });
    if (!result.ok) return fail(result.code);

    const sent = await sendSlipRejectedEmail(result.email, result.orderNumber, result.reason, `${siteConfig.url}/checkout/order/${orderId}`);
    if (!sent) console.error("[admin] ส่งอีเมลแจ้งสลิปไม่ผ่านไม่สำเร็จ", { orderNumber: result.orderNumber });
    refreshOrder(orderId);
    return done(`ปฏิเสธสลิปของ ${result.orderNumber} แล้ว — ลูกค้าแนบสลิปใหม่ได้${sent ? "" : " (ส่งอีเมลแจ้งลูกค้าไม่สำเร็จ — แจ้งลูกค้าเอง)"}`);
  });
}

export async function refundOrderAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction("refundOrder", async (actor) => {
    const orderId = field(formData, "orderId");
    if (!checked(formData, "confirmRefund")) return fail("CONFIRM_REQUIRED");
    const result = await refundOrder(prisma, {
      orderId,
      actor,
      amount: Number(field(formData, "amount")),
      reason: field(formData, "reason"),
      transferReference: field(formData, "transferReference"),
    });
    if (!result.ok) return fail(result.code);
    refreshOrder(orderId);
    return done(
      result.continuing
        ? `บันทึกคืนเงิน ${result.amount.toFixed(2)} บาท ของ ${result.orderNumber} แล้ว — สมาชิกยังมีช่วงสิทธิ์ที่จ่ายไว้ต่อ จึงยังไม่ต้องถอดสิทธิ์ในช่องทางต่าง ๆ`
        : `บันทึกคืนเงิน ${result.amount.toFixed(2)} บาท ของ ${result.orderNumber} และปิดสิทธิ์แล้ว — อย่าลืมถอดสิทธิ์ใน TradingView / Discord / Telegram`,
    );
  });
}

export async function updateSettingsAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction("updateSettings", async (actor) => {
    const result = await updatePaymentSettings(prisma, {
      actor,
      paymentsEnabled: checked(formData, "paymentsEnabled"),
      maintenanceMode: checked(formData, "maintenanceMode"),
      promptpayNumber: field(formData, "promptpayNumber"),
      promptpayAccountName: field(formData, "promptpayAccountName"),
    });
    if (!result.ok) return fail(result.code);
    // การเปลี่ยนบัญชีรับเงินมีความเสี่ยงสูง — แจ้งกลุ่มแอดมินทุกครั้ง
    await sendAdminTelegram(
      `🔐 แก้ไขการตั้งค่ารับเงิน
รับเงิน: ${checked(formData, "paymentsEnabled") ? "เปิด" : "ปิด"}
PromptPay: ${field(formData, "promptpayNumber") || "-"}
โดยแอดมิน: ${actor.id}`,
    );
    revalidatePath("/admin/settings");
    revalidatePath("/admin");
    // โหมดปิดปรับปรุงปิดข้อเสนอสิทธิ์ผ่าน IB บนหน้าเว็บด้วย — รีเฟรชแคชทันที ไม่รอ 5 นาที
    revalidateTag(BROKER_IB_OFFER_TAG);
    revalidatePath("/");
    revalidatePath("/broker-ib");
    return done("บันทึกการตั้งค่าแล้ว");
  });
}

export async function revokeMemberAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction("revokeMember", async (actor) => {
    const userId = field(formData, "userId");
    if (!checked(formData, "confirmRevoke")) return fail("CONFIRM_REQUIRED");
    const result = await revokeMemberAccess(prisma, { userId, actor, reason: field(formData, "reason") });
    if (!result.ok) return fail(result.code);
    revalidatePath(`/admin/members/${userId}`);
    revalidatePath("/admin/members");
    return done(`ปิดสิทธิ์แล้ว ${result.revoked} ช่วง — อย่าลืมถอดสิทธิ์ใน TradingView / Discord / Telegram`);
  });
}

export async function setProvisioningAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction("setProvisioning", async (actor) => {
    const channel = field(formData, "channel");
    if (!Object.prototype.hasOwnProperty.call(PROVISIONING_CHANNELS, channel)) return fail("UNEXPECTED");
    const result = await setProvisioning(prisma, {
      subscriptionId: field(formData, "subscriptionId"),
      channel: channel as ProvisioningChannel,
      granted: field(formData, "granted") === "true",
      actor,
    });
    if (!result.ok) return fail("UNEXPECTED");
    // คำนวณหน้าที่ต้องรีเฟรชจากข้อมูลฝั่ง server เอง ไม่รับ path จากฟอร์ม
    revalidatePath(`/admin/orders/${result.orderId}`);
    revalidatePath(`/admin/broker-claims/${result.orderId}`);
    revalidatePath(`/admin/members/${result.userId}`);
    return done("อัปเดตสถานะการเปิดสิทธิ์แล้ว");
  });
}
