import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/page-guard";
import Link from "next/link";
import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { getSystemHealth } from "@/lib/admin/health";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "สถานะระบบ", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function StatusIcon({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (ok) return <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-label="ปกติ" />;
  return warn ? <CircleAlert className="w-4 h-4 text-amber-400" aria-label="ควรตรวจสอบ" /> : <XCircle className="w-4 h-4 text-red-400" aria-label="ผิดปกติ" />;
}

export default async function AdminStatusPage() {
  await requireAdminPage();
  const health = await getSystemHealth(prisma);
  const queues = [
    { label: "สลิปรอตรวจ", value: health.queues.pendingReview, href: "/admin/orders?tab=review", warn: health.queues.pendingReview > 0 },
    { label: "สลิปที่ยังแจ้งเตือนแอดมินไม่สำเร็จ", value: health.queues.unnotifiedSlips, href: "/admin/orders?tab=review", warn: health.queues.unnotifiedSlips > 0 },
    { label: "คำสั่งซื้อรอชำระ (ยังไม่หมดเวลา)", value: health.queues.awaitingPayment, href: "/admin/orders?tab=pending", warn: false },
    { label: "สมาชิกหมดอายุใน 3 วัน", value: health.queues.expiringSoon, href: "/admin/members", warn: false },
    { label: "สิทธิ์ที่ปิดแล้วแต่ยังต้องถอดในช่องทาง", value: health.queues.pendingDeprovision, href: "/admin/members", warn: health.queues.pendingDeprovision > 0 },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader title="สถานะระบบ" description={`ตรวจเมื่อ ${formatDateTime(health.checkedAt)} — แสดงเฉพาะว่าตั้งค่าแล้วหรือยัง ไม่แสดงค่าความลับ`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title="บริการหลัก">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-gray-200">
              <StatusIcon ok={health.database.ok} /> ฐานข้อมูล {health.database.ok ? `(ตอบสนอง ${health.database.latencyMs} ms)` : "เชื่อมต่อไม่ได้"}
            </li>
            <li className="flex items-center gap-2 text-gray-200">
              <StatusIcon ok={health.payments.open} warn /> การรับชำระเงิน: {health.payments.open ? "เปิด" : "ปิด"}
              <Link href="/admin/settings" className="text-xs text-amber-300 hover:underline">ตั้งค่า</Link>
            </li>
          </ul>
        </AdminCard>

        <AdminCard title="คิวงาน">
          <ul className="space-y-2 text-sm">
            {queues.map((queue) => (
              <li key={queue.label} className="flex items-center justify-between gap-2 text-gray-200">
                <span className="flex items-center gap-2">
                  <StatusIcon ok={!queue.warn} warn /> {queue.label}
                </span>
                <Link href={queue.href} className="font-mono tabular-nums text-amber-300 hover:underline">{queue.value}</Link>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>

      <AdminCard title="ตัวแปรสภาพแวดล้อม (Environment)">
        <ul className="grid gap-2 sm:grid-cols-2 text-sm">
          {health.env.map((item) => (
            <li key={item.key} className="flex items-start gap-2 rounded-lg bg-black/20 px-3 py-2">
              <StatusIcon ok={item.configured} warn={!item.required} />
              <span>
                <span className="font-mono text-xs text-white">{item.key}</span>
                <span className="block text-xs text-gray-400">
                  {item.purpose} · {item.configured ? "ตั้งค่าแล้ว" : item.required ? "ยังไม่ได้ตั้ง (จำเป็น)" : "ยังไม่ได้ตั้ง"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </AdminCard>
    </div>
  );
}
