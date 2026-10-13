import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/page-guard";
import { prisma } from "@/lib/prisma";
import { formatDateTime, parsePage } from "@/lib/format";
import { AUDIT_ACTIONS, listAuditLogs, type AuditAction } from "@/lib/admin/audit";
import { AdminPageHeader, inputClass, Pagination } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "Audit Log", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  const query = await searchParams;
  await requireAdminPage();
  const action = query.action && Object.prototype.hasOwnProperty.call(AUDIT_ACTIONS, query.action) ? query.action : undefined;
  const page = parsePage(query.page);
  const { items, total, pageSize } = await listAuditLogs(prisma, { action, page });
  const href = (target: number) => `/admin/audit-logs?${new URLSearchParams({ ...(action ? { action } : {}), page: String(target) }).toString()}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Audit Log" description="ประวัติการดำเนินการของแอดมินทุกครั้ง — แก้ไขหรือลบไม่ได้">
        <form className="flex gap-2" action="/admin/audit-logs">
          <label className="sr-only" htmlFor="audit-action">กรองตามการกระทำ</label>
          <select id="audit-action" name="action" defaultValue={action ?? ""} className={inputClass}>
            <option value="">ทุกการกระทำ</option>
            {(Object.keys(AUDIT_ACTIONS) as AuditAction[]).map((key) => (
              <option key={key} value={key}>
                {AUDIT_ACTIONS[key]}
              </option>
            ))}
          </select>
          <button type="submit" className="bg-white/10 px-3 text-sm text-gray-200 hover:bg-white/20">กรอง</button>
        </form>
      </AdminPageHeader>

      <ol className="space-y-3">
        {items.length === 0 && <li className="border border-line bg-ink p-6 text-center text-sm text-gray-400 rounded-2xl">ยังไม่มีรายการ</li>}
        {items.map((log) => (
          <li key={log.id} className="border border-line bg-ink p-4 rounded-2xl">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-white">{log.actionLabel}</span>
              <span className="text-gray-400">โดย {log.actorEmail}</span>
              <span className="text-gray-400">{formatDateTime(log.createdAt)}</span>
              {log.ipAddress && <span className="font-mono text-xs text-gray-500">IP {log.ipAddress}</span>}
              <span className="font-mono text-xs text-gray-500">{log.targetType}:{log.targetId}</span>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-signal">รายละเอียด (ก่อน/หลัง)</summary>
              <pre className="mt-2 overflow-x-auto bg-ink-raised p-3 text-xs text-gray-300">{JSON.stringify(log.details, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ol>

      <Pagination page={page} pageSize={pageSize} total={total} href={href} />
    </div>
  );
}
