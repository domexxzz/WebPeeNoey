import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminActor } from "@/lib/admin/guard";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { prisma } from "@/lib/prisma";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin/messages";
import { AUDIT_ACTIONS } from "@/lib/admin/audit";
import { done, fail, runAdminAction } from "@/lib/admin/run-admin-action";

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "admin-1" }, expires: "2099" })) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { auditLog: { create: vi.fn() } } }));
vi.mock("next/headers", () => ({ headers: vi.fn(() => new Headers({ "x-forwarded-for": "203.0.113.9" })) }));
vi.mock("@/lib/admin/guard", () => ({ getAdminActor: vi.fn() }));
vi.mock("@/lib/notify/telegram", () => ({ sendAdminTelegram: vi.fn() }));

const create = vi.mocked(prisma.auditLog.create);
const rowOf = (call: number = 0) => create.mock.calls[call][0].data;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminActor).mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/**
 * แอดมินกดปุ่มแล้วถูกปฏิเสธตามกติกา (เช่น ติ๊กยืนยันไม่ครบ) เคยไม่เหลือร่องรอยฝั่งเซิร์ฟเวอร์เลย
 * ทำให้ตามย้อนหลังไม่ได้ว่าทำไม "กดแล้วไม่เข้า" — ต้องบันทึก AuditLog ทุกครั้ง (CLAUDE.md ข้อ 5)
 */
describe("บันทึก action หลังบ้านที่ถูกปฏิเสธ", () => {
  it("เขียน AuditLog พร้อมชื่อ action, รหัสเหตุผล, ผู้กด และ IP", async () => {
    const state = await runAdminAction("approveBrokerClaim", async () => fail("CHECKS_REQUIRED", { targetType: "Order", targetId: "order-9" }));

    expect(state).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.CHECKS_REQUIRED });
    expect(create).toHaveBeenCalledTimes(1);
    expect(rowOf()).toMatchObject({
      action: "ADMIN_ACTION_REFUSED",
      actorId: "admin-1",
      targetType: "Order",
      targetId: "order-9",
      ipAddress: "203.0.113.9",
      details: { action: "approveBrokerClaim", code: "CHECKS_REQUIRED", message: ADMIN_ERROR_MESSAGES.CHECKS_REQUIRED },
    });
  });

  it("ไม่ระบุเป้าหมาย = บันทึกเป็น System พร้อมชื่อ action", async () => {
    await runAdminAction("updateBrokerIbSettings", async () => fail("INVALID_IB_LINK"));

    expect(rowOf()).toMatchObject({ targetType: "System", targetId: "updateBrokerIbSettings", details: { code: "INVALID_IB_LINK" } });
  });

  it("action ที่สำเร็จไม่เขียนแถวปฏิเสธ", async () => {
    const state = await runAdminAction("approveBrokerClaim", async () => done("อนุมัติแล้ว"));

    expect(state).toEqual({ status: "success", message: "อนุมัติแล้ว" });
    expect(create).not.toHaveBeenCalled();
  });

  it("คนที่ไม่ใช่แอดมินถูกปฏิเสธโดยไม่เขียนลงฐานข้อมูล (กันยิง action ตรงเพื่อถมตาราง) แต่ต้องมี log", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(null);

    const state = await runAdminAction("approveBrokerClaim", async () => done("ไม่ควรถูกเรียก"));

    expect(state).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.FORBIDDEN });
    expect(create).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("เขียน AuditLog ไม่สำเร็จ ต้องไม่กลบข้อความเดิม แต่ต้องแจ้งกลุ่มแอดมิน (ร่องรอยหายคือปัญหาที่กำลังแก้อยู่)", async () => {
    create.mockRejectedValueOnce(new Error("db down"));

    const state = await runAdminAction("rejectBrokerClaim", async () => fail("REASON_REQUIRED", { targetType: "Order", targetId: "order-9" }));

    expect(state).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.REASON_REQUIRED });
    expect(console.error).toHaveBeenCalled();
    expect(vi.mocked(sendAdminTelegram).mock.calls[0][0]).toContain("rejectBrokerClaim");
  });

  it("ตัด targetId ที่ยาวเกินจริง ไม่ให้ถมตาราง", async () => {
    await runAdminAction("approveOrder", async () => fail("CONFIRM_REQUIRED", { targetType: "Order", targetId: "x".repeat(500) }));

    expect(String(rowOf().targetId)).toHaveLength(64);
  });

  it("แยกข้อผิดพลาดที่ไม่คาดคิดออกจากการปฏิเสธตามกติกาได้ด้วย kind", async () => {
    await runAdminAction("approveOrder", async () => fail("CONFIRM_REQUIRED"));
    expect(rowOf()).toMatchObject({ details: { kind: "REFUSED" } });
  });

  it("ข้อผิดพลาดที่ไม่คาดคิดยังถูกบันทึกเหมือนเดิม", async () => {
    const state = await runAdminAction("approveBrokerClaim", async () => {
      throw new Error("boom");
    });

    expect(state).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.UNEXPECTED });
    expect(rowOf()).toMatchObject({ action: "ADMIN_ACTION_REFUSED", details: { action: "approveBrokerClaim", code: "UNEXPECTED", kind: "UNEXPECTED" } });
  });

  it("ชนิด action นี้มีป้ายชื่อให้กรองในหน้าบันทึกการใช้งาน", () => {
    expect(AUDIT_ACTIONS.ADMIN_ACTION_REFUSED).toBeTruthy();
  });
});
