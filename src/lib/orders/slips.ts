import type { PrismaClient, Role } from "@prisma/client";

export interface SlipFile {
  id: string;
  mimeType: string;
  sizeBytes: number;
  data: Uint8Array;
}

/**
 * คืนไฟล์สลิปให้เจ้าของออเดอร์หรือแอดมินเท่านั้น — นอกนั้นคืน null (ไม่บอกว่ามีสลิปนี้อยู่หรือไม่)
 * สิทธิ์แอดมินตรวจจากฐานข้อมูลเสมอ ไม่เชื่อ role ที่ส่งมาจาก session เพียงอย่างเดียว
 */
export async function getSlipForViewer(
  db: PrismaClient,
  { slipId, viewer }: { slipId: string; viewer: { id: string; role: Role } },
): Promise<SlipFile | null> {
  const slip = await db.slipUpload.findUnique({
    where: { id: slipId },
    select: { id: true, userId: true, mimeType: true, sizeBytes: true, data: true },
  });
  if (!slip) return null;

  const isOwner = slip.userId === viewer.id;
  const isAdmin =
    viewer.role === "ADMIN" && (await db.user.findUnique({ where: { id: viewer.id }, select: { role: true } }))?.role === "ADMIN";
  if (!isOwner && !isAdmin) return null;

  return { id: slip.id, mimeType: slip.mimeType, sizeBytes: slip.sizeBytes, data: slip.data };
}
