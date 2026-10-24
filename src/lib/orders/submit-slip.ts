import { Prisma, type AccessKind, type OrderStatus, type PrismaClient } from "@prisma/client";
import { validateSlipFile } from "@/lib/payments/slip";
import type { SlipCheckResult } from "@/lib/payments/easyslip";
import type { QrIntegrity } from "@/lib/payments/slip-qr-payload";
import type { SlipQrResult } from "@/lib/payments/slip-qr";
import { computeSlipHash } from "@/lib/security";
import { acceptsSlip, computeOrderPhase } from "./phase";
import { createSlipInspector, SLIP_CHECK_DISABLED, slipCheckFields, type SlipInspector } from "./slip-inspection";

export type SubmitSlipResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      amount: number;
      planName: string;
      uploadId: string;
      check: SlipCheckResult;
      qrIntegrity: QrIntegrity | null;
    }
  | { ok: false; code: "EMPTY_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_TYPE" | "ORDER_NOT_FOUND" | "NOT_ACCEPTING_SLIP" | "DUPLICATE_SLIP" };

interface SubmitSlipInput {
  userId: string;
  orderId: string;
  bytes: Uint8Array;
  now?: Date;
  inspector?: SlipInspector;
}

type Db = PrismaClient | Prisma.TransactionClient;

/** สลิปนี้เคยถูกส่งแล้วหรือยัง: ไฟล์เดิม (hash), รายการโอนเดิมที่ถ่ายใหม่ (QR) หรือเลขอ้างอิงที่ธนาคารยืนยันซ้ำ (transRef) */
/**
 * QR/transRef เทียบเฉพาะออเดอร์อื่น: ลูกค้าที่ถูกปฏิเสธเพราะ "สลิปไม่ชัด" ต้องส่งรูปที่ชัดกว่าของการโอนเดิมให้ออเดอร์เดิมได้
 * (ไฟล์เดิมเป๊ะ — hash — ยังห้ามซ้ำทุกกรณีเหมือนเดิม)
 */
async function isKnownSlip(db: Db, keys: { orderId: string; hash: string; qrPayload: string | null; transRef?: string }): Promise<boolean> {
  const otherOrder = { orderId: { not: keys.orderId } };
  const or: Prisma.SlipUploadWhereInput[] = [{ hash: keys.hash }];
  if (keys.qrPayload) or.push({ qrPayload: keys.qrPayload, ...otherOrder });
  if (keys.transRef) or.push({ transRef: keys.transRef, ...otherOrder });
  return (await db.slipUpload.findFirst({ where: { OR: or }, select: { id: true } })) !== null;
}

/**
 * ก่อนบันทึกสลิปใบใหม่ของออเดอร์เดิม:
 * - ย้ายคีย์กันซ้ำ (QR/transRef) ที่ชนกับใบใหม่ออกจากใบเก่าของออเดอร์นี้ (คอลัมน์ unique) — ใบใหม่ถือคีย์แทน การกันข้ามออเดอร์ยังครบ
 * - ใบเก่าที่ยังรอตรวจซ้ำ เลิกตรวจ (ไม่งั้นค้างหัวคิวของงาน slip-recheck ตลอดไป)
 */
async function supersedeEarlierUploads(tx: Prisma.TransactionClient, keys: { orderId: string; qrPayload: string | null; transRef?: string }): Promise<void> {
  const colliding: Prisma.SlipUploadWhereInput[] = [];
  if (keys.qrPayload) colliding.push({ qrPayload: keys.qrPayload });
  if (keys.transRef) colliding.push({ transRef: keys.transRef });
  if (colliding.length > 0) {
    await tx.slipUpload.updateMany({ where: { orderId: keys.orderId, OR: colliding }, data: { qrPayload: null, transRef: null } });
  }
  await tx.slipUpload.updateMany({
    where: { orderId: keys.orderId, checkStatus: "PENDING" },
    data: { checkStatus: "DISABLED", checkNote: "มีสลิปใบใหม่แทนแล้ว — ไม่ตรวจซ้ำต่อ" },
  });
}

const TRANSACTION_TIMEOUT_MS = 10_000;

/** บันทึกว่าแจ้งแอดมินเรื่องสลิปของออเดอร์นี้สำเร็จแล้ว (null = ยังไม่ได้แจ้ง ให้ Cron ส่งซ้ำ) */
export async function markAdminNotified(db: PrismaClient, { orderId, now = new Date() }: { orderId: string; now?: Date }): Promise<void> {
  await db.order.update({ where: { id: orderId }, data: { adminNotifiedAt: now } });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * รับสลิปการโอน (Flow 3 ใน docs/PLAN.md)
 * 1. ตรวจไฟล์ (ขนาด + Magic Bytes) ก่อนแตะฐานข้อมูล
 * 2. ตรวจว่าเป็นออเดอร์ของผู้ใช้และยังรับสลิปอยู่ "ก่อน" อ่าน QR (งานหนัก — ห้ามให้ใครยิงด้วย orderId มั่ว ๆ)
 *    แล้วอ่าน QR + ตรวจกับธนาคาร (EasySlip) นอก transaction — งานช้า/เรียกภายนอกห้ามถือ lock
 *    ปฏิเสธสลิปซ้ำก่อนเรียก EasySlip เพื่อไม่เสียโควตา; ผลตรวจอื่นไม่ปฏิเสธเอง แค่บันทึกให้แอดมินดู
 * 3. ล็อกแถวออเดอร์ (SELECT ... FOR UPDATE) กันการส่งซ้ำพร้อมกัน
 * 4. บันทึก SlipUpload — hash / qrPayload / transRef เป็น unique จึงกันสลิปซ้ำได้แม้ส่งพร้อมกันจากคนละออเดอร์
 */
export async function submitSlip(db: PrismaClient, input: SubmitSlipInput): Promise<SubmitSlipResult> {
  const now = input.now ?? new Date();
  const validation = validateSlipFile(input.bytes);
  if (!validation.ok) return { ok: false, code: validation.code };
  const hash = computeSlipHash(input.bytes);
  const inspector = input.inspector ?? createSlipInspector();

  const preview = await db.order.findUnique({
    where: { id: input.orderId },
    select: {
      userId: true,
      kind: true,
      status: true,
      expiresAt: true,
      amount: true,
      createdAt: true,
      payment: { select: { promptpayTarget: true, promptpayAccountName: true } },
    },
  });
  if (!preview || preview.userId !== input.userId || preview.kind !== "PAID") return { ok: false, code: "ORDER_NOT_FOUND" };

  let qr: SlipQrResult = { found: false };
  let check = SLIP_CHECK_DISABLED;
  if (acceptsSlip(computeOrderPhase(preview, now))) {
    const orderId = input.orderId;
    // ไฟล์เดิมเป๊ะ — ตอบได้ทันทีโดยไม่ต้องอ่าน QR
    if (await isKnownSlip(db, { orderId, hash, qrPayload: null })) return { ok: false, code: "DUPLICATE_SLIP" };
    qr = await inspector.readQr(input.bytes);
    const payload = qr.found ? qr.payload : null;
    if (payload && (await isKnownSlip(db, { orderId, hash, qrPayload: payload }))) return { ok: false, code: "DUPLICATE_SLIP" };
    check = await inspector.check({
      qrPayload: payload ?? undefined,
      image: { bytes: input.bytes, mimeType: validation.mimeType },
      expectedAmount: preview.amount.toNumber(),
      orderCreatedAt: preview.createdAt,
      receiverIds: [preview.payment?.promptpayTarget ?? "", ...inspector.receiverAccounts].filter(Boolean),
      receiverAccountName: preview.payment?.promptpayAccountName ?? "",
      now,
    });
  }
  const qrPayload = qr.found ? qr.payload : null;

  try {
    return await db.$transaction(
      async (tx): Promise<SubmitSlipResult> => {
        const [order] = await tx.$queryRaw<{ id: string; userId: string; status: OrderStatus; expiresAt: Date; kind: AccessKind }[]>`
          SELECT id, "userId", status, "expiresAt", kind FROM "Order" WHERE id = ${input.orderId} FOR UPDATE
        `;
        // คำขอสิทธิ์ผ่าน IB ไม่มีการชำระเงิน — ห้ามแนบสลิป (ออเดอร์ IB ที่ถูกปฏิเสธก็ห้าม)
        if (!order || order.userId !== input.userId || order.kind !== "PAID") return { ok: false, code: "ORDER_NOT_FOUND" };

        const phase = computeOrderPhase(order, now);
        if (!acceptsSlip(phase)) {
          if (phase === "EXPIRED" && order.status === "PENDING_PAYMENT") {
            await tx.order.update({ where: { id: order.id }, data: { status: "EXPIRED" } });
          }
          return { ok: false, code: "NOT_ACCEPTING_SLIP" };
        }

        if (await isKnownSlip(tx, { orderId: order.id, hash, qrPayload, transRef: check.transRef })) {
          return { ok: false, code: "DUPLICATE_SLIP" };
        }
        await supersedeEarlierUploads(tx, { orderId: order.id, qrPayload, transRef: check.transRef });

        const upload = await tx.slipUpload.create({
          data: {
            orderId: order.id,
            userId: input.userId,
            hash,
            mimeType: validation.mimeType,
            sizeBytes: input.bytes.length,
            data: Buffer.from(input.bytes),
            qrPayload,
            qrReference: qr.found ? qr.reference ?? null : null,
            qrIntegrity: qr.found ? qr.integrity : null,
            checkAttempts: check.status === "DISABLED" ? 0 : 1,
            ...slipCheckFields(check, now),
          },
          select: { id: true },
        });

        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            status: "SLIP_SUBMITTED",
            slipHash: hash,
            slipUploadedAt: now,
            slipUrl: `/api/slips/${upload.id}`,
            rejectedAt: null,
            rejectionReason: null,
            // สลิปใบใหม่ต้องแจ้งแอดมินใหม่
            adminNotifiedAt: null,
          },
          select: { orderNumber: true, amount: true, plan: { select: { name: true } } },
        });

        return {
          ok: true,
          orderId: order.id,
          orderNumber: updated.orderNumber,
          amount: updated.amount.toNumber(),
          planName: updated.plan.name,
          uploadId: upload.id,
          check,
          qrIntegrity: qr.found ? qr.integrity : null,
        };
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  } catch (error) {
    // สลิปเดียวกันถูกส่งพร้อมกันจากอีกออเดอร์ และอีกฝั่ง commit ก่อน
    if (isUniqueViolation(error)) return { ok: false, code: "DUPLICATE_SLIP" };
    throw error;
  }
}
