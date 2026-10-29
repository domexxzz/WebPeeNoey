import { describe, expect, it } from "vitest";
import { describePlanDrift } from "@/lib/admin/plan-drift";

describe("describePlanDrift", () => {
  it("says which plan differs and what each side holds", () => {
    expect(describePlanDrift({ slug: "broker-ib", name: "IB", codeDays: 7, databaseDays: 30 })).toBe("broker-ib: ฐานข้อมูล 30 วัน แต่โค้ด 7 วัน");
  });

  it("says when the plan is missing or switched off in the database", () => {
    expect(describePlanDrift({ slug: "monthly", name: "1 เดือน", codeDays: 30, databaseDays: null })).toBe("monthly: ไม่มีในฐานข้อมูล (หรือถูกปิดไว้) แต่โค้ดใช้ 30 วัน");
  });
});
