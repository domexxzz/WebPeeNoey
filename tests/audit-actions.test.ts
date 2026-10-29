import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/admin/audit";

describe("audit action labels", () => {
  it("labels the manual subscription adjustment written straight to production (29 Oct 2026)", () => {
    // แถว AuditLog จริงใช้ action นี้แล้ว — ไม่มี label หน้าบันทึกการใช้งานจะโชว์ชื่ออังกฤษและกรองไม่ได้
    expect(AUDIT_ACTIONS.SUBSCRIPTION_ADJUST).toBe("ปรับวันหมดอายุของสิทธิ์");
  });

  it("gives every action a Thai label", () => {
    for (const label of Object.values(AUDIT_ACTIONS)) expect(label).toMatch(/[฀-๿]/);
  });
});
