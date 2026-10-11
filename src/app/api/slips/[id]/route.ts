import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSlipForViewer } from "@/lib/orders/slips";
import { buildSlipResponseHeaders } from "@/lib/orders/slip-headers";

export const dynamic = "force-dynamic";

const NOT_FOUND_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

/** ดูไฟล์สลิป — เฉพาะเจ้าของออเดอร์และแอดมิน (ตอบ 404 เหมือนกันทั้งกรณีไม่มีสิทธิ์และไม่พบ) */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401, headers: NOT_FOUND_HEADERS });

  try {
    const slip = await getSlipForViewer(prisma, { slipId: params.id, viewer: { id: session.user.id, role: session.user.role } });
    if (!slip) return new Response("Not found", { status: 404, headers: NOT_FOUND_HEADERS });
    return new Response(Buffer.from(slip.data), { status: 200, headers: buildSlipResponseHeaders(slip) });
  } catch (error) {
    console.error("[slips] failed to load slip", { slipId: params.id, error });
    return new Response("Internal error", { status: 500, headers: NOT_FOUND_HEADERS });
  }
}
