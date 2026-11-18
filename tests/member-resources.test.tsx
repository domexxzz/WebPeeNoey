import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemberResources } from "@/components/account/member-resources";
import { PricingSection } from "@/components/marketing/pricing-section";
import { SITE_PLANS } from "@/config/plans";
import { TRADING_JOURNAL, TRADING_JOURNAL_COPY, buildTradingJournal, normalizeSheetId } from "@/config/member-resources";

const REAL_LINK =
  "https://docs.google.com/spreadsheets/d/1JjmGzY--WsD4de2Zk0as5C5YxrRSO65L/edit?usp=drivesdk&ouid=100018786845501375128&rtpof=true&sd=true";

describe("normalizeSheetId", () => {
  /**
   * ลิงก์ที่เจ้าของก๊อปจากเบราว์เซอร์มี ouid ติดมาด้วย ซึ่งผูกกับบัญชี Google ของคนก๊อป
   * ต้องตัดทิ้งให้เหลือแค่ id ไม่งั้นลิงก์ที่สมาชิกกดจะพ่วงบัญชีเจ้าของไปด้วย
   */
  it("keeps only the file id from a link copied out of the browser", () => {
    expect(normalizeSheetId(REAL_LINK)).toBe("1JjmGzY--WsD4de2Zk0as5C5YxrRSO65L");
    expect(normalizeSheetId(" 1JjmGzY--WsD4de2Zk0as5C5YxrRSO65L ")).toBe("1JjmGzY--WsD4de2Zk0as5C5YxrRSO65L");
  });

  it("rejects anything that is not a Google Sheets file", () => {
    for (const bad of [
      "",
      undefined,
      "สวัสดี",
      "https://docs.google.com/document/d/1JjmGzY--WsD4de2Zk0as5C5YxrRSO65L/edit",
      "https://evil.example/spreadsheets/d/1JjmGzY--WsD4de2Zk0as5C5YxrRSO65L/edit",
      "http://docs.google.com/spreadsheets/d/1JjmGzY--WsD4de2Zk0as5C5YxrRSO65L/edit",
      "short-id",
    ]) {
      expect(normalizeSheetId(bad)).toBeNull();
    }
  });

  it("builds the copy, download and preview links from the id", () => {
    const journal = buildTradingJournal("1JjmGzY--WsD4de2Zk0as5C5YxrRSO65L");
    expect(journal).toEqual({
      copyUrl: "https://docs.google.com/spreadsheets/d/1JjmGzY--WsD4de2Zk0as5C5YxrRSO65L/copy",
      xlsxUrl: "https://docs.google.com/spreadsheets/d/1JjmGzY--WsD4de2Zk0as5C5YxrRSO65L/export?format=xlsx",
      previewUrl: "https://docs.google.com/spreadsheets/d/1JjmGzY--WsD4de2Zk0as5C5YxrRSO65L/preview",
    });
    expect(buildTradingJournal(null)).toBeNull();
  });
});

describe("MemberResources card", () => {
  it("offers both the Google Sheets copy and the Excel download", () => {
    const markup = renderToStaticMarkup(<MemberResources />);
    expect(markup).toContain(TRADING_JOURNAL!.copyUrl);
    expect(markup).toContain(TRADING_JOURNAL!.xlsxUrl);
    expect(markup).toContain(TRADING_JOURNAL_COPY.title);
  });

  /** บัญชีเจ้าของไม่ได้ซื้อแพ็กเกจ ถ้าไม่เปิดให้แอดมินเห็น จะตรวจของที่แจกสมาชิกไม่ได้เลย */
  it("tells an admin that members only see this with an active membership", () => {
    expect(renderToStaticMarkup(<MemberResources adminPreview />)).toContain("คุณเห็นการ์ดนี้เพราะเป็นแอดมิน");
    expect(renderToStaticMarkup(<MemberResources />)).not.toContain("คุณเห็นการ์ดนี้เพราะเป็นแอดมิน");
  });

  it("renders nothing when no file is configured, instead of a dead button", () => {
    expect(renderToStaticMarkup(<MemberResources journal={null} />)).toBe("");
  });

  /** การ์ดนี้ต้องอยู่หลังการตรวจสิทธิ์เท่านั้น — คนที่สิทธิ์หมดอายุแล้วไม่ควรเห็น */
  it("is rendered on the account page only for an active membership", () => {
    const page = readFileSync(path.resolve(__dirname, "..", "src/app/(account)/account/page.tsx"), "utf8");
    expect(page).toContain("{(isActive || isAdmin) && <MemberResources adminPreview={!isActive && isAdmin} />}");
    expect(page).toContain('const isAdmin = user?.role === "ADMIN"');
  });
});

describe("the journal is listed as a package perk", () => {
  const PERK = "ตารางบันทึกสถิติการเทรด";

  it("appears in the entry plan, which the longer plans inherit", () => {
    expect(SITE_PLANS[0].features.some((feature) => feature.includes(PERK))).toBe(true);
    expect(renderToStaticMarkup(<PricingSection />)).toContain(PERK);
  });

  /**
   * แถวแพ็กเกจในฐานข้อมูลมี features ของตัวเองซึ่งจะเก่าค้างจนกว่าจะรัน seed ใหม่
   * หน้าชำระเงินจึงต้องอ่านรายการสิทธิ์จาก config ไม่งั้นหน้าราคากับหน้าชำระเงินจะไม่ตรงกัน
   */
  it("makes the checkout page read the perk list from config, not the database row", () => {
    const page = readFileSync(path.resolve(__dirname, "..", "src/app/(account)/checkout/[plan]/page.tsx"), "utf8");
    expect(page).toContain("getPlanBySlug(plan.slug)?.features ?? plan.features");
    expect(page).toContain("{planFeatures.map(");
  });
});
