import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { markAdminNotified } from "@/lib/orders/checkout";
import { createBrokerClaim } from "@/lib/broker-ib/claims";
import { brokerClaimErrorMessage, BROKER_CLAIM_SUCCESS_MESSAGE } from "@/lib/broker-ib/messages";
import { submitBrokerClaimAction } from "@/app/(account)/account/broker-ib/actions";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(() => new Headers({ "x-forwarded-for": "198.51.100.4" })) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/notify/telegram", () => ({ sendAdminTelegram: vi.fn() }));
vi.mock("@/lib/orders/checkout", () => ({ markAdminNotified: vi.fn() }));
vi.mock("@/lib/broker-ib/claims", () => ({ createBrokerClaim: vi.fn() }));

const idle = { status: "idle" } as const;
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.append(key, value));
  return data;
};
const NEW_FIELDS = {
  mode: "NEW",
  broker: "XM",
  platform: "MT5",
  accountNumber: "12345678",
  registeredEmail: "trader@example.com",
  confirmOpenedViaLink: "on",
  confirmDeposit: "on",
  acceptTerms: "on",
};
const CREATED = { ok: true as const, orderId: "o1", orderNumber: "IB-20261015-ABC123", reused: false, isRenewal: false, broker: "XM" as const, accountMasked: "****5678" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" }, expires: "2099" } as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ success: true } as never);
  vi.mocked(sendAdminTelegram).mockResolvedValue({ ok: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Member action: submit a broker IB claim", () => {
  it("sends signed-out visitors to sign in", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    await expect(submitBrokerClaimAction(idle, form(NEW_FIELDS))).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining("/auth/signin"));
    expect(createBrokerClaim).not.toHaveBeenCalled();
  });

  it("is rate limited and fails closed", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ success: false } as never);
    expect(await submitBrokerClaimAction(idle, form(NEW_FIELDS))).toEqual({ status: "error", message: brokerClaimErrorMessage("RATE_LIMITED") });
    expect(checkRateLimit).toHaveBeenCalledWith("broker-claim:user-1", 5, 600, { failClosed: true });
  });

  it("is also rate limited per IP address (fail closed)", async () => {
    vi.mocked(checkRateLimit).mockImplementation(async (key: string) => ({ success: !key.startsWith("broker-claim-ip:") }) as never);
    expect(await submitBrokerClaimAction(idle, form(NEW_FIELDS))).toEqual({ status: "error", message: brokerClaimErrorMessage("RATE_LIMITED") });
    expect(checkRateLimit).toHaveBeenCalledWith("broker-claim-ip:198.51.100.4", 20, 3600, { failClosed: true });
    expect(createBrokerClaim).not.toHaveBeenCalled();
  });

  it("requires the confirmations and the terms", async () => {
    const { confirmDeposit: _deposit, ...noDeposit } = NEW_FIELDS;
    expect(await submitBrokerClaimAction(idle, form(noDeposit))).toEqual({ status: "error", message: brokerClaimErrorMessage("CONFIRM_REQUIRED") });
    const { acceptTerms: _terms, ...noTerms } = NEW_FIELDS;
    expect(await submitBrokerClaimAction(idle, form(noTerms))).toEqual({ status: "error", message: brokerClaimErrorMessage("TERMS_REQUIRED") });
    expect(await submitBrokerClaimAction(idle, form({ mode: "RENEW", acceptTerms: "on" }))).toEqual({ status: "error", message: brokerClaimErrorMessage("CONFIRM_REQUIRED") });
    expect(await submitBrokerClaimAction(idle, form({ ...NEW_FIELDS, broker: "OTHER" }))).toEqual({ status: "error", message: brokerClaimErrorMessage("INVALID_BROKER") });
    expect(createBrokerClaim).not.toHaveBeenCalled();
  });

  it("creates the claim for the signed-in member only (ignores any userId in the form) and alerts admins once", async () => {
    vi.mocked(createBrokerClaim).mockResolvedValue(CREATED);

    const result = await submitBrokerClaimAction(idle, form({ ...NEW_FIELDS, userId: "attacker" }));

    expect(result).toEqual({ status: "success", message: BROKER_CLAIM_SUCCESS_MESSAGE });
    expect(createBrokerClaim).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        userId: "user-1",
        ipAddress: "198.51.100.4",
        claim: { mode: "NEW", broker: "XM", platform: "MT5", accountNumber: "12345678", registeredEmail: "trader@example.com" },
      }),
    );
    expect(sendAdminTelegram).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendAdminTelegram).mock.calls[0][0]).not.toContain("12345678");
    expect(markAdminNotified).toHaveBeenCalledWith({}, { orderId: "o1" });
  });

  it("does not alert admins again for a repeated submit", async () => {
    vi.mocked(createBrokerClaim).mockResolvedValue({ ...CREATED, reused: true });
    expect(await submitBrokerClaimAction(idle, form(NEW_FIELDS))).toMatchObject({ status: "success" });
    expect(sendAdminTelegram).not.toHaveBeenCalled();
  });

  it("still succeeds when the admin alert fails, leaving it for the watchdog to resend", async () => {
    vi.mocked(createBrokerClaim).mockResolvedValue(CREATED);
    vi.mocked(sendAdminTelegram).mockResolvedValue({ ok: false, reason: "NETWORK_ERROR" });
    expect(await submitBrokerClaimAction(idle, form(NEW_FIELDS))).toMatchObject({ status: "success" });
    expect(markAdminNotified).not.toHaveBeenCalled();
  });

  it("alerts admins when someone submits an account another member holds", async () => {
    vi.mocked(createBrokerClaim).mockResolvedValue({ ok: false, code: "ACCOUNT_CLAIMED" });
    expect(await submitBrokerClaimAction(idle, form(NEW_FIELDS))).toEqual({ status: "error", message: brokerClaimErrorMessage("ACCOUNT_CLAIMED") });
    expect(vi.mocked(sendAdminTelegram).mock.calls[0][0]).toContain("****5678");
    expect(checkRateLimit).toHaveBeenCalledWith("broker-conflict:XM:12345678", 1, 3600);
  });

  it("alerts about the same contested account at most once per hour", async () => {
    vi.mocked(createBrokerClaim).mockResolvedValue({ ok: false, code: "ACCOUNT_CLAIMED" });
    vi.mocked(checkRateLimit).mockImplementation(async (key: string) => ({ success: !key.startsWith("broker-conflict:") }) as never);
    expect(await submitBrokerClaimAction(idle, form(NEW_FIELDS))).toEqual({ status: "error", message: brokerClaimErrorMessage("ACCOUNT_CLAIMED") });
    expect(sendAdminTelegram).not.toHaveBeenCalled();
  });

  it("tells the member when the renewal window opens", async () => {
    const opensAt = new Date("2026-11-07T00:00:00Z");
    vi.mocked(createBrokerClaim).mockResolvedValue({ ok: false, code: "NOT_IN_RENEWAL_WINDOW", opensAt });
    const result = await submitBrokerClaimAction(idle, form({ mode: "RENEW", confirmStillActive: "on", acceptTerms: "on" }));
    expect(result).toEqual({ status: "error", message: brokerClaimErrorMessage("NOT_IN_RENEWAL_WINDOW", opensAt) });
  });

  it("alerts admins and returns a safe message on unexpected errors", async () => {
    vi.mocked(createBrokerClaim).mockRejectedValue(new Error("db down"));
    expect(await submitBrokerClaimAction(idle, form(NEW_FIELDS))).toEqual({ status: "error", message: brokerClaimErrorMessage("UNEXPECTED") });
    expect(sendAdminTelegram).toHaveBeenCalledWith(expect.stringContaining("UNEXPECTED"));
  });
});
