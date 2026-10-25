import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(admin)/admin/broker-claims/import/actions", () => ({ importBrokerReportsAction: vi.fn() }));

const { BrokerReportImport } = await import("@/components/admin/broker-report-import");

describe("Broker report import form", () => {
  const html = renderToStaticMarkup(<BrokerReportImport />);
  /** แท็กที่มีแอตทริบิวต์ครบ (React เรียงลำดับแอตทริบิวต์เอง จึงไม่เทียบตำแหน่ง) */
  const tagWith = (tag: string, ...attributes: string[]) =>
    (html.match(new RegExp(`<${tag}\\b[^>]*>`, "g")) ?? []).some((element) => attributes.every((attribute) => element.includes(attribute)));

  it("accepts several CSV files for each broker", () => {
    expect(tagWith("input", 'name="xmFiles"', 'type="file"', 'accept=".csv,text/csv"', "multiple")).toBe(true);
    expect(tagWith("input", 'name="exnessFiles"', 'type="file"', 'accept=".csv,text/csv"', "multiple")).toBe(true);
  });

  it("only lets the admin approve after checking the files first", () => {
    expect(tagWith("button", 'name="mode"', 'value="preview"')).toBe(true);
    expect(tagWith("button", 'name="mode"', 'value="approve"', 'disabled=""')).toBe(true);
  });
});
