import { Prisma, type OrderStatus, type PrismaClient } from "@prisma/client";
import { validateSlipFile } from "@/lib/payments/slip";
import { computeSlipHash } from "@/lib/security";
import { acceptsSlip, computeOrderPhase } from "./phase";

export type SubmitSlipResult =
  | { ok: true; orderId: string; orderNumber: string; amount: number; planName: string; uploadId: string }
  | { ok: false; code: "EMPTY_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_TYPE" | "ORDER_NOT_FOUND" | "NOT_ACCEPTING_SLIP" | "DUPLICATE_SLIP" };

interface SubmitSlipInput {
  userId: string;
  orderId: string;
  bytes: Uint8Array;
  now?: Date;
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
 * 2. ล็อกแถวออเดอร์ (SELECT ... FOR UPDATE) กันการส่งซ้ำพร้อมกัน
 * 3. บันทึก SlipUpload — hash เป็น unique จึงกันสลิปซ้ำได้แม้ส่งพร้อมกันจากคนละออเดอร์
 */
export async function submitSlip(db: PrismaClient, input: SubmitSlipInput): Promise<SubmitSlipResult> {
  const now = input.now ?? new Date();
  const validation = validateSlipFile(input.bytes);
  if (!validation.ok) return { ok: false, code: validation.code };
  const hash = computeSlipHash(input.bytes);

  try {
    return await db.$transaction(
      async (tx): Promise<SubmitSlipResult> => {
        const [order] = await tx.$queryRaw<{ id: string; userId: string; status: OrderStatus; expiresAt: Date }[]>`
          SELECT id, "userId", status, "expiresAt" FROM "Order" WHERE id = ${input.orderId} FOR UPDATE
        `;
        if (!order || order.userId !== input.userId) return { ok: false, code: "ORDER_NOT_FOUND" };

        const phase = computeOrderPhase(order, now);
        if (!acceptsSlip(phase)) {
          if (phase === "EXPIRED" && order.status === "PENDING_PAYMENT") {
            await tx.order.update({ where: { id: order.id }, data: { status: "EXPIRED" } });
          }
          return { ok: false, code: "NOT_ACCEPTING_SLIP" };
        }

        if (await tx.slipUpload.findUnique({ where: { hash }, select: { id: true } })) {
          return { ok: false, code: "DUPLICATE_SLIP" };
        }

        const upload = await tx.slipUpload.create({
          data: {
            orderId: order.id,
            userId: input.userId,
            hash,
            mimeType: validation.mimeType,
            sizeBytes: input.bytes.length,
            data: Buffer.from(input.bytes),
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
