import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getLatestReportImport } from "@/lib/broker-ib/report-review";
import { ReportImportSummary } from "@/components/admin/report-import-summary";

describe("Latest broker report import on the admin pages", () => {
  it("reads the newest BROKER_REPORT_IMPORT audit row with the admin's email", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      createdAt: new Date("2026-10-25T13:00:00Z"),
      actor: { email: "admin@example.com" },
      details: { files: ["XM:traders.csv"], approved: 2, skipped: 3, failed: 1, approvedOrders: ["IB-1", "IB-2"] },
    });
    const latest = await getLatestReportImport({ auditLog: { findFirst } } as never);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { action: "BROKER_REPORT_IMPORT" }, orderBy: { createdAt: "desc" } }));
    expect(latest).toEqual({
      at: new Date("2026-10-25T13:00:00Z"),
      actorEmail: "admin@example.com",
      files: ["XM:traders.csv"],
      approved: 2,
      skipped: 3,
      failed: 1,
      approvedOrders: ["IB-1", "IB-2"],
    });
  });

  it("returns null when no report has been imported yet", async () => {
    expect(await getLatestReportImport({ auditLog: { findFirst: vi.fn().mockResolvedValue(null) } } as never)).toBeNull();
  });

  it("shows the counts, approved order numbers and a link to import again", () => {
    const html = renderToStaticMarkup(
      <ReportImportSummary
        latest={{ at: new Date("2026-10-25T13:00:00Z"), actorEmail: "admin@example.com", files: ["XM:traders.csv"], approved: 2, skipped: 3, failed: 1, approvedOrders: ["IB-1", "IB-2"] }}
        pendingClaims={4}
      />,
    );
    expect(html).toContain("อนุมัติอัตโนมัติ");
    expect(html).toMatch(/>2<[\s\S]*>3<[\s\S]*>1</);
    expect(html).toContain("IB-1");
    expect(html).toContain('href="/admin/broker-claims/import"');
  });

  it("invites the first import when nothing has been imported", () => {
    const html = renderToStaticMarkup(<ReportImportSummary latest={null} pendingClaims={0} />);
    expect(html).toContain("ยังไม่เคยนำเข้ารายงาน");
    expect(html).toContain('href="/admin/broker-claims/import"');
  });
});
