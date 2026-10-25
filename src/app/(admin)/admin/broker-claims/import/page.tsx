import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/page-guard";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { BrokerReportImport } from "@/components/admin/broker-report-import";

export const metadata: Metadata = { title: "นำเข้ารายงานโบรกเกอร์", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminBrokerReportImportPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="นำเข้ารายงานโบรกเกอร์"
        description="อัปโหลดรายงาน .csv ที่ export จาก Partner Portal ของ XM / Exness — ระบบเทียบเลขบัญชี MT5 กับคำขอที่รอตรวจ แล้วอนุมัติเฉพาะที่อยู่ใต้ IB ของเรา ยอดฝาก USD ถึงขั้นต่ำ และอีเมลตรง (ถ้ารายงานมีอีเมล)"
      >
        <Link href="/admin/broker-claims" className="text-sm text-gold-ink hover:underline">
          ← กลับไปหน้าคำขอ
        </Link>
      </AdminPageHeader>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-fg-muted">
        <li>XM: รายงาน → ลิสต์ของเทรดเดอร์ → สร้างรายงาน → ส่งออก (CSV) และรายงานธุรกรรมเงินฝาก ถ้าต้องการให้ตรวจยอดฝาก</li>
        <li>Exness: Reports → Client accounts / Client transactions → Export (CSV)</li>
        <li>กด &quot;ตรวจสอบ&quot; ดูผลก่อน แล้วกด &quot;อนุมัติคำขอที่ผ่านเงื่อนไข&quot; — ที่เหลือตรวจเองในหน้าคำขอ</li>
        <li>หลังอนุมัติ เปิดสิทธิ์ TradingView / Discord / Telegram ให้สมาชิกในหน้าคำขอตามเดิม</li>
      </ol>
      <BrokerReportImport />
    </div>
  );
}
