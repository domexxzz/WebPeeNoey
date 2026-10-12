"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { siteConfig } from "@/config/site";
import { legalConfig } from "@/config/legal";
import { PAYMENT_RULES } from "@/config/payment";
import { createOrder, markAdminNotified, submitSlip, type SubmitSlipResult } from "@/lib/orders/checkout";
import { checkoutErrorMessage, type CheckoutErrorCode } from "@/lib/orders/messages";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { buildNewSlipMessage } from "@/lib/orders/slip-notification";
import { getClientIp } from "@/lib/request";

const RATE_WINDOW_SECONDS = 10 * 60;
const MAX_ORDER_ATTEMPTS = 10;
const MAX_SLIP_ATTEMPTS = 10;
const MAX_SLIP_BYTES = PAYMENT_RULES.slipMaxSizeMb * 1024 * 1024;
// endpoint เรื่องเงิน: ถ้านับ rate limit ไม่ได้ให้ปฏิเสธไว้ก่อน
const MONEY_RATE_LIMIT = { failClosed: true } as const;

async function requireUserId(callbackUrl: string): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return session.user.id;
}

function parsePrice(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : undefined;
}

/** แจ้งแอดมินเมื่อเกิดข้อผิดพลาดที่ไม่คาดคิด (sendAdminTelegram log ความล้มเหลวของตัวเองอยู่แล้ว) */
async function alertUnexpected(context: string, details: Record<string, string>): Promise<void> {
  const lines = Object.entries(details).map(([key, value]) => `${key}: ${value.slice(0, 80)}`);
  await sendAdminTelegram([`⚠️ ${context} ล้มเหลว (UNEXPECTED)`, ...lines].join("\n"));
}

/** สร้างออเดอร์แล้วพาไปหน้าชำระเงิน — ข้อผิดพลาดส่งกลับเป็น ?error=CODE */
export async function createOrderAction(formData: FormData): Promise<void> {
  const planSlug = String(formData.get("planSlug") ?? "");
  const checkoutPath = `/checkout/${encodeURIComponent(planSlug)}`;
  const userId = await requireUserId(checkoutPath);

  let target: string;
  if (formData.get("acceptTerms") !== "on") {
    target = `${checkoutPath}?error=TERMS_REQUIRED`;
  } else if (!(await checkRateLimit(`create-order:${userId}`, MAX_ORDER_ATTEMPTS, RATE_WINDOW_SECONDS, MONEY_RATE_LIMIT)).success) {
    target = `${checkoutPath}?error=RATE_LIMITED`;
  } else {
    try {
      const result = await createOrder(prisma, {
        userId,
        planSlug,
        expectedBasePrice: parsePrice(formData.get("expectedBasePrice")),
        termsVersion: legalConfig.effectiveDate,
        ipAddress: getClientIp(),
      });
      target = result.ok ? `/checkout/order/${result.orderId}` : `${checkoutPath}?error=${result.code}`;
    } catch (error) {
      console.error("[checkout] createOrder failed", { userId, planSlug, error });
      await alertUnexpected("สร้างคำสั่งซื้อ", { ผู้ใช้: userId, แพ็กเกจ: planSlug });
      target = `${checkoutPath}?error=UNEXPECTED`;
    }
  }
  // redirect() ต้องอยู่นอก try/catch เพราะทำงานด้วยการ throw
  redirect(target);
}

export type SlipFormState = { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

function slipError(code: CheckoutErrorCode): SlipFormState {
  return { status: "error", message: checkoutErrorMessage(code) ?? "" };
}

type AcceptedSlip = Extract<SubmitSlipResult, { ok: true }>;

/** แจ้งแอดมินเรื่องสลิปใหม่ — ส่งไม่สำเร็จจะไม่บันทึก adminNotifiedAt เพื่อให้ Watchdog ส่งซ้ำได้ */
async function notifyNewSlip(slip: AcceptedSlip): Promise<void> {
  const sent = await sendAdminTelegram(buildNewSlipMessage(slip, siteConfig.url));
  if (!sent.ok) {
    console.error("[checkout] ยังไม่ได้แจ้งแอดมินเรื่องสลิปใหม่ (adminNotifiedAt = null)", { orderNumber: slip.orderNumber, reason: sent.reason });
    return;
  }
  try {
    await markAdminNotified(prisma, { orderId: slip.orderId });
  } catch (error) {
    console.error("[checkout] บันทึก adminNotifiedAt ไม่สำเร็จ", { orderNumber: slip.orderNumber, error });
  }
}

function refreshOrderPages(orderId: string): void {
  try {
    revalidatePath(`/checkout/order/${orderId}`);
    revalidatePath("/account/orders");
  } catch (error) {
    // สลิปบันทึกแล้ว — ห้ามตอบผู้ใช้ว่าล้มเหลว ไม่งั้นลองใหม่แล้วจะเจอ "สลิปซ้ำ"
    console.error("[checkout] revalidatePath failed", { orderId, error });
  }
}

/** รับสลิปจากฟอร์ม (ใช้กับ useFormState) */
export async function submitSlipAction(_previous: SlipFormState, formData: FormData): Promise<SlipFormState> {
  const orderId = String(formData.get("orderId") ?? "");
  const userId = await requireUserId(`/checkout/order/${encodeURIComponent(orderId)}`);

  // นับ rate limit ก่อนตรวจไฟล์ เพื่อให้คำขอที่ไฟล์ผิด/ใหญ่เกินถูกนับด้วย
  if (!(await checkRateLimit(`submit-slip:${userId}`, MAX_SLIP_ATTEMPTS, RATE_WINDOW_SECONDS, MONEY_RATE_LIMIT)).success) {
    return slipError("RATE_LIMITED");
  }
  const file = formData.get("slip");
  if (!(file instanceof File) || file.size === 0) return slipError("NO_FILE");
  if (file.size > MAX_SLIP_BYTES) return slipError("FILE_TOO_LARGE");

  let result: SubmitSlipResult;
  try {
    result = await submitSlip(prisma, { userId, orderId, bytes: new Uint8Array(await file.arrayBuffer()) });
  } catch (error) {
    console.error("[checkout] submitSlip failed", { userId, orderId, error });
    await alertUnexpected("รับสลิป", { ผู้ใช้: userId, ออเดอร์: orderId });
    return slipError("UNEXPECTED");
  }
  if (!result.ok) return slipError(result.code);

  // สลิปถูกบันทึกแล้ว: งานหลังจากนี้ล้มเหลวได้โดยไม่กระทบผลลัพธ์ของผู้ใช้
  await notifyNewSlip(result);
  refreshOrderPages(orderId);
  return { status: "success", message: "ได้รับสลิปแล้ว ทีมงานจะตรวจสอบและแจ้งผลทางอีเมล" };
}
