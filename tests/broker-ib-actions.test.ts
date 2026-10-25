import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAdminActor } from "@/lib/admin/guard";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin/messages";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { updateBrokerIbSettings } from "@/lib/broker-ib/settings";
import { BROKER_IB_OFFER_TAG } from "@/lib/broker-ib/public-offer";
import { approveBrokerClaim, rejectBrokerClaim, releaseBrokerAccount, revokeBrokerAccess } from "@/lib/broker-ib/review";
import { sendBrokerClaimApprovedEmail, sendBrokerClaimRejectedEmail } from "@/lib/email";
import {
  approveBrokerClaimAction,
  rejectBrokerClaimAction,
  releaseBrokerAccountAction,
  revokeBrokerAccessAction,
  updateBrokerIbSettingsAction,
} from "@/app/(admin)/admin/broker-ib-actions";

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "admin-1" }, expires: "2099" })) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ headers: vi.fn(() => new Headers({ "x-forwarded-for": "203.0.113.9" })) }));
vi.mock("@/lib/admin/guard", () => ({ getAdminActor: vi.fn() }));
vi.mock("@/lib/notify/telegram", () => ({ sendAdminTelegram: vi.fn() }));
vi.mock("@/lib/broker-ib/settings", () => ({ updateBrokerIbSettings: vi.fn() }));
vi.mock("@/lib/broker-ib/review", () => ({ approveBrokerClaim: vi.fn(), rejectBrokerClaim: vi.fn(), revokeBrokerAccess: vi.fn(), releaseBrokerAccount: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendBrokerClaimApprovedEmail: vi.fn(), sendBrokerClaimRejectedEmail: vi.fn() }));

const idle = { status: "idle" } as const;
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.append(key, value));
  return data;
};
const actor = { id: "admin-1", ipAddress: "203.0.113.9" };
const XM_LINK = "https://clicks.pipaffiliates.com/c?c=111";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminActor).mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  vi.mocked(sendBrokerClaimApprovedEmail).mockResolvedValue(true);
  vi.mocked(sendBrokerClaimRejectedEmail).mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("broker IB admin actions: authorization", () => {
  it("refuses non-admins without calling the service", async () => {
    vi.mocked(getAdminActor).mockResolvedValue(null);
    const forbidden = { status: "error", message: ADMIN_ERROR_MESSAGES.FORBIDDEN };
    expect(await updateBrokerIbSettingsAction(idle, form({ ibClaimsEnabled: "on" }))).toEqual(forbidden);
    expect(await approveBrokerClaimAction(idle, form({ orderId: "o1", checkUnderIb: "on", checkEmail: "on", checkQualifies: "on" }))).toEqual(forbidden);
    expect(await rejectBrokerClaimAction(idle, form({ orderId: "o1", reasonPreset: "x" }))).toEqual(forbidden);
    expect(updateBrokerIbSettings).not.toHaveBeenCalled();
    expect(approveBrokerClaim).not.toHaveBeenCalled();
    expect(await revokeBrokerAccessAction(idle, form({ userId: "u1", confirmRevoke: "on", reason: "x" }))).toEqual(forbidden);
    expect(await releaseBrokerAccountAction(idle, form({ brokerAccountId: "b1", confirmRelease: "on", reason: "x" }))).toEqual(forbidden);
    expect(rejectBrokerClaim).not.toHaveBeenCalled();
    expect(revokeBrokerAccess).not.toHaveBeenCalled();
    expect(releaseBrokerAccount).not.toHaveBeenCalled();
  });
});

describe("broker IB admin actions: settings", () => {
  it("saves with the actor and IP, alerts the admin group with the exact links, and refreshes the public offer", async () => {
    vi.mocked(updateBrokerIbSettings).mockResolvedValue({
      ok: true,
      warnings: [],
      changed: true,
      before: { ibClaimsEnabled: false, ibXmLink: "", ibExnessLink: "", ibMinDepositXmThb: null, ibMinDepositExnessThb: null, ibUsdThbRate: null },
      after: { ibClaimsEnabled: true, ibXmLink: XM_LINK, ibExnessLink: "", ibMinDepositXmThb: 1000, ibMinDepositExnessThb: null, ibUsdThbRate: 33.5 },
    });

    const result = await updateBrokerIbSettingsAction(
      idle,
      form({ ibClaimsEnabled: "on", ibXmLink: XM_LINK, ibExnessLink: "", ibMinDepositXmThb: "1000", ibUsdThbRate: "33.5" }),
    );

    expect(result).toEqual({ status: "success", message: "บันทึกการตั้งค่าสิทธิ์ผ่าน IB แล้ว" });
    expect(updateBrokerIbSettings).toHaveBeenCalledWith({}, { actor, ibClaimsEnabled: true, xmLink: XM_LINK, exnessLink: "", xmMinDepositThb: "1000", exnessMinDepositThb: "", usdThbRate: "33.5" });
    const alert = vi.mocked(sendAdminTelegram).mock.calls[0][0];
    expect(alert).toContain(XM_LINK);
    expect(alert).toContain("ปิด → เปิด");
    expect(alert).toContain("ฝากขั้นต่ำ XM (บาท): - → 1000");
    expect(revalidateTag).toHaveBeenCalledWith(BROKER_IB_OFFER_TAG);
    for (const path of ["/", "/broker-ib", "/admin/settings", "/account/broker-ib"]) expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  it("shows domain warnings next to the success message", async () => {
    const snapshot = { ibClaimsEnabled: false, ibXmLink: "https://partners.example.net/r", ibExnessLink: "", ibMinDepositXmThb: null, ibMinDepositExnessThb: null, ibUsdThbRate: null };
    vi.mocked(updateBrokerIbSettings).mockResolvedValue({ ok: true, warnings: ["ลิงก์ XM อยู่บนโดเมน partners.example.net"], changed: true, before: null, after: snapshot });
    const result = await updateBrokerIbSettingsAction(idle, form({ ibXmLink: "https://partners.example.net/r" }));
    expect(result).toEqual({ status: "success", message: expect.stringContaining("partners.example.net") });
  });

  it("sends no alert and keeps the cache when nothing changed", async () => {
    const same = { ibClaimsEnabled: true, ibXmLink: XM_LINK, ibExnessLink: "", ibMinDepositXmThb: 1000, ibMinDepositExnessThb: null, ibUsdThbRate: 33.5 };
    vi.mocked(updateBrokerIbSettings).mockResolvedValue({ ok: true, warnings: [], changed: false, before: same, after: same });
    expect(await updateBrokerIbSettingsAction(idle, form({ ibClaimsEnabled: "on", ibXmLink: XM_LINK, ibMinDepositXmThb: "1000", ibUsdThbRate: "33.5" }))).toEqual({ status: "success", message: "ไม่มีการเปลี่ยนแปลง" });
    expect(sendAdminTelegram).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("maps service errors to Thai messages and sends no alert", async () => {
    vi.mocked(updateBrokerIbSettings).mockResolvedValue({ ok: false, code: "INVALID_IB_LINK" });
    expect(await updateBrokerIbSettingsAction(idle, form({ ibXmLink: "http://x" }))).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.INVALID_IB_LINK });
    expect(sendAdminTelegram).not.toHaveBeenCalled();
    expect(ADMIN_ERROR_MESSAGES.INVALID_MIN_DEPOSIT).toMatch(/บาท/);
    expect(ADMIN_ERROR_MESSAGES.IB_NOT_CONFIGURED).toMatch(/ลิงก์/);
  });

  it("alerts the admin group and returns UNEXPECTED when the service throws", async () => {
    vi.mocked(updateBrokerIbSettings).mockRejectedValue(new Error("db down"));
    expect(await updateBrokerIbSettingsAction(idle, form({}))).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.UNEXPECTED });
    expect(sendAdminTelegram).toHaveBeenCalledWith(expect.stringContaining("UNEXPECTED"));
  });
});

describe("broker IB admin actions: review", () => {
  it("approves with the three checks from the form, emails the member and reminds the admin to provision", async () => {
    vi.mocked(approveBrokerClaim).mockResolvedValue({
      ok: true,
      orderNumber: "IB-20261015-ABC123",
      email: "m@example.com",
      periodStart: new Date("2026-10-15T00:00:00Z"),
      periodEnd: new Date("2026-11-14T00:00:00Z"),
      isRenewal: false,
    });

    const result = await approveBrokerClaimAction(idle, form({ orderId: "o1", checkUnderIb: "on", checkEmail: "on", checkQualifies: "on", note: "ตรวจแล้ว" }));

    expect(approveBrokerClaim).toHaveBeenCalledWith({}, { orderId: "o1", actor, checks: { underIb: true, emailMatches: true, qualifies: true }, note: "ตรวจแล้ว" });
    expect(sendBrokerClaimApprovedEmail).toHaveBeenCalledWith("m@example.com", expect.objectContaining({ orderNumber: "IB-20261015-ABC123", isRenewal: false }));
    expect(result).toEqual({ status: "success", message: expect.stringContaining("IB-20261015-ABC123") });
    expect(result.status === "success" && result.message).toMatch(/TradingView/);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/broker-claims/o1");
  });

  it("passes unticked checks through so the service refuses them", async () => {
    vi.mocked(approveBrokerClaim).mockResolvedValue({ ok: false, code: "CHECKS_REQUIRED" });
    const result = await approveBrokerClaimAction(idle, form({ orderId: "o1", checkUnderIb: "on" }));
    expect(approveBrokerClaim).toHaveBeenCalledWith({}, expect.objectContaining({ checks: { underIb: true, emailMatches: false, qualifies: false } }));
    expect(result).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.CHECKS_REQUIRED });
    expect(sendBrokerClaimApprovedEmail).not.toHaveBeenCalled();
  });

  it("tells the admin to inform the member when the approval email fails", async () => {
    vi.mocked(approveBrokerClaim).mockResolvedValue({ ok: true, orderNumber: "IB-1", email: "m@example.com", periodStart: new Date(), periodEnd: new Date(), isRenewal: true });
    vi.mocked(sendBrokerClaimApprovedEmail).mockResolvedValue(false);
    const result = await approveBrokerClaimAction(idle, form({ orderId: "o1", checkUnderIb: "on", checkEmail: "on", checkQualifies: "on" }));
    expect(result.status === "success" && result.message).toMatch(/ส่งอีเมลไม่สำเร็จ/);
    expect(console.error).toHaveBeenCalled();
  });

  it("rejects with preset + detail as the reason, passes the release choice, and emails the member", async () => {
    vi.mocked(rejectBrokerClaim).mockResolvedValue({ ok: true, orderNumber: "IB-2", email: "m@example.com", reason: "ไม่พบบัญชีภายใต้ IB ของเรา — ลองยื่นบัญชีอื่น", released: true });

    const result = await rejectBrokerClaimAction(idle, form({ orderId: "o2", reasonPreset: "ไม่พบบัญชีภายใต้ IB ของเรา", reasonDetail: "ลองยื่นบัญชีอื่น", releaseAccount: "on" }));

    expect(rejectBrokerClaim).toHaveBeenCalledWith({}, { orderId: "o2", actor, reason: "ไม่พบบัญชีภายใต้ IB ของเรา — ลองยื่นบัญชีอื่น", releaseAccount: true });
    expect(sendBrokerClaimRejectedEmail).toHaveBeenCalledWith("m@example.com", expect.objectContaining({ orderNumber: "IB-2", pageUrl: expect.stringMatching(/\/account\/broker-ib$/) }));
    expect(result).toEqual({ status: "success", message: expect.stringContaining("ปลดการผูก") });
  });

  it("maps review failures to admin messages", async () => {
    vi.mocked(rejectBrokerClaim).mockResolvedValue({ ok: false, code: "REASON_REQUIRED" });
    expect(await rejectBrokerClaimAction(idle, form({ orderId: "o2" }))).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.REASON_REQUIRED });
    for (const code of ["CHECKS_REQUIRED", "ACCOUNT_RELEASED", "NOT_IN_RENEWAL_WINDOW"] as const) expect(ADMIN_ERROR_MESSAGES[code]).toBeTruthy();
  });
});

describe("broker IB admin actions: revoke and release", () => {
  it("requires confirming before revoking or releasing", async () => {
    expect(await revokeBrokerAccessAction(idle, form({ userId: "u1", reason: "x" }))).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.CONFIRM_REQUIRED });
    expect(await releaseBrokerAccountAction(idle, form({ brokerAccountId: "b1", reason: "x" }))).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.CONFIRM_REQUIRED });
    expect(revokeBrokerAccess).not.toHaveBeenCalled();
    expect(releaseBrokerAccount).not.toHaveBeenCalled();
  });

  it("revokes IB access with the release choice and tells the admin whether channels must be removed", async () => {
    vi.mocked(revokeBrokerAccess).mockResolvedValue({ ok: true, revoked: 1, continuing: false, rejectedClaims: 1 });
    const result = await revokeBrokerAccessAction(idle, form({ userId: "u1", reason: "บัญชีออกจาก IB", releaseAccount: "on", confirmRevoke: "on" }));
    expect(revokeBrokerAccess).toHaveBeenCalledWith({}, { userId: "u1", actor, reason: "บัญชีออกจาก IB", releaseAccount: true });
    expect(result).toEqual({ status: "success", message: expect.stringContaining("ถอดสิทธิ์") });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/u1");
  });

  it("releases an account and refreshes the owner's page computed on the server (not from the form)", async () => {
    vi.mocked(releaseBrokerAccount).mockResolvedValue({ ok: true, rejectedClaims: 0, userId: "owner-1" });
    const result = await releaseBrokerAccountAction(idle, form({ brokerAccountId: "b1", reason: "เจ้าของจริงแสดงหลักฐาน", confirmRelease: "on", userId: "someone-else" }));
    expect(releaseBrokerAccount).toHaveBeenCalledWith({}, { brokerAccountId: "b1", actor, reason: "เจ้าของจริงแสดงหลักฐาน" });
    expect(result.status).toBe("success");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/owner-1");
    expect(revalidatePath).not.toHaveBeenCalledWith("/admin/members/someone-else");
  });

  it("maps revoke/release failures", async () => {
    vi.mocked(revokeBrokerAccess).mockResolvedValue({ ok: false, code: "NOTHING_TO_REVOKE" });
    expect(await revokeBrokerAccessAction(idle, form({ userId: "u1", reason: "x", confirmRevoke: "on" }))).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.NOTHING_TO_REVOKE });
    vi.mocked(releaseBrokerAccount).mockResolvedValue({ ok: false, code: "ALREADY_RELEASED" });
    expect(await releaseBrokerAccountAction(idle, form({ brokerAccountId: "b1", reason: "x", confirmRelease: "on" }))).toEqual({ status: "error", message: ADMIN_ERROR_MESSAGES.ALREADY_RELEASED });
  });
});
