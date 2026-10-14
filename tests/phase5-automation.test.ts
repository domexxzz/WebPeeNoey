import { afterEach, describe, expect, it, vi } from "vitest";
import { constantTimeEquals, isAuthorizedCronRequest, isAuthorizedTelegramWebhook, isStrongSecret } from "@/lib/request-auth";
import { redactSensitive } from "@/lib/redact";
import { getTelegramWebhookInfo, sendAdminTelegram, sendTelegramMessage } from "@/lib/notify/telegram";
import { createReminderSender } from "@/lib/jobs/reminder-sender";
import { formatExpirySummary, type ExpiredMember } from "@/lib/jobs/expiry";

const SECRET = "Q7v_Kp2-Xr9Lm4Tz8Wn1Hb6Jd3Fs5Gc0Ya";
const TOKEN = "123456:SECRET-BOT-TOKEN";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Phase 5: endpoint authentication", () => {
  it("accepts only the exact bearer secret for cron endpoints", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
  });

  it("refuses every request when the secret is missing or too short", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer short", "short")).toBe(false);
    expect(isAuthorizedTelegramWebhook("x", undefined)).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("CRON_SECRET"));
  });

  it("rejects copied placeholders and low-variety secrets even when they are long enough", () => {
    expect(isStrongSecret(SECRET)).toBe(true);
    expect(isStrongSecret("generate-a-strong-secret-token-for-cron-invocations")).toBe(false);
    expect(isStrongSecret("a".repeat(64))).toBe(false);
    expect(isStrongSecret("Short1-")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer " + "a".repeat(64), "a".repeat(64))).toBe(false);
  });

  it("checks the Telegram webhook secret header and compares in constant time", () => {
    expect(isAuthorizedTelegramWebhook(SECRET, SECRET)).toBe(true);
    expect(isAuthorizedTelegramWebhook("wrong", SECRET)).toBe(false);
    expect(constantTimeEquals("a", "a")).toBe(true);
    expect(constantTimeEquals("a", "a".repeat(100))).toBe(false);
  });
});

describe("Phase 5: Telegram API helpers", () => {
  const okResponse = (result: unknown) => new Response(JSON.stringify({ ok: true, result }), { status: 200 });

  it("sends a plain-text message to a member chat and truncates very long text", async () => {
    const fetchImpl = vi.fn(async () => okResponse({}));
    const result = await sendTelegramMessage("777", "x".repeat(5000), { env: { TELEGRAM_BOT_TOKEN: TOKEN }, fetchImpl });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ chat_id: "777", disable_web_page_preview: true });
    expect(body).not.toHaveProperty("parse_mode");
    expect(body.text.length).toBeLessThan(4096);
  });

  it("reports failures without ever logging the bot token", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_ADMIN_CHAT_ID: "-100" };

    expect(await sendAdminTelegram("hi", { env, fetchImpl: vi.fn(async () => new Response("", { status: 502 })) })).toEqual({ ok: false, reason: "HTTP_ERROR" });
    expect(await sendTelegramMessage("1", "hi", { env, fetchImpl: vi.fn(async () => Promise.reject(new Error("offline"))) })).toEqual({ ok: false, reason: "NETWORK_ERROR" });
    expect(await sendTelegramMessage("1", "hi", { env: {}, fetchImpl: vi.fn() })).toEqual({ ok: false, reason: "NOT_CONFIGURED" });
    expect(JSON.stringify(error.mock.calls)).not.toContain(TOKEN);
  });

  it("parses webhook info for the watchdog", async () => {
    const fetchImpl = vi.fn(async () => okResponse({ url: "https://x.test/api/telegram/webhook", pending_update_count: 3, last_error_date: 1_800_000_000, last_error_message: "Timeout" }));
    expect(await getTelegramWebhookInfo({ env: { TELEGRAM_BOT_TOKEN: TOKEN }, fetchImpl })).toEqual({
      ok: true,
      info: { url: "https://x.test/api/telegram/webhook", pendingUpdateCount: 3, lastErrorDate: new Date(1_800_000_000_000), lastErrorMessage: "Timeout" },
    });
  });
});

describe("Phase 5: expiry reminder delivery", () => {
  const target = { userId: "u1", email: "c@example.com", planName: "แพ็กเกจ 1 เดือน", planSlug: "monthly", endsAt: new Date("2026-11-13T03:00:00Z") };
  const now = new Date("2026-11-11T03:00:00Z");

  it("emails a renew link and also messages members who linked Telegram", async () => {
    const sendEmail = vi.fn(async () => true);
    const sendTelegram = vi.fn(async () => ({ ok: true as const }));
    const send = createReminderSender({ siteUrl: "https://example.test", now, sendEmail, sendTelegram });

    expect(await send({ ...target, telegramChatId: "777" })).toEqual({ email: true, telegram: true });
    expect(sendEmail).toHaveBeenCalledWith("c@example.com", { planName: target.planName, endsAt: target.endsAt, daysLeft: 2, renewUrl: "https://example.test/checkout/monthly" });
    expect(sendTelegram).toHaveBeenCalledWith("777", expect.stringContaining("https://example.test/checkout/monthly"));
  });

  it("sends members on a free broker IB grant to the IB renewal page, not to checkout", async () => {
    const sendEmail = vi.fn(async () => true);
    const sendTelegram = vi.fn(async (_chatId: string, _text: string) => ({ ok: true as const }));
    const send = createReminderSender({ siteUrl: "https://example.test", now, sendEmail, sendTelegram });

    await send({ ...target, planSlug: "broker-ib", planKind: "BROKER_IB", telegramChatId: "777" });

    expect(sendEmail).toHaveBeenCalledWith("c@example.com", expect.objectContaining({ renewUrl: "https://example.test/account/broker-ib" }));
    const text = vi.mocked(sendTelegram).mock.calls[0][1];
    expect(text).toContain("https://example.test/account/broker-ib");
    expect(text).toContain("IB");
    expect(text).not.toContain("/checkout/");
  });

  it("skips Telegram for members without a linked chat and reports channel failures", async () => {
    const sendTelegram = vi.fn();
    const send = createReminderSender({ siteUrl: "https://example.test", now, sendEmail: vi.fn(async () => false), sendTelegram });
    expect(await send({ ...target, telegramChatId: null })).toEqual({ email: false, telegram: false });
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("escapes plan names and links inside the reminder email", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const sendMail = vi.fn(async (_message: { html: string; subject: string }) => ({ error: null }));
    vi.doMock("resend", () => ({ Resend: class { emails = { send: sendMail }; } }));
    const { sendExpiryReminderEmail } = await import("@/lib/email");

    const sent = await sendExpiryReminderEmail("c@example.com", { planName: "<script>alert(1)</script>", endsAt: target.endsAt, daysLeft: 2, renewUrl: 'https://example.test/checkout/a"onmouseover="x' });

    expect(sent).toBe(true);
    const html = sendMail.mock.calls[0][0].html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('a"onmouseover');
  });
});

describe("Phase 5: redaction of sensitive text", () => {
  it("removes connection strings and bot tokens and masks emails before logging or alerting", () => {
    const text = redactSensitive("Cannot reach postgresql://app:pw@db.neon.tech:5432/main and bot123456:ABC-def_789 for somchai@example.com");
    expect(text).not.toContain("pw@db");
    expect(text).not.toContain("ABC-def_789");
    expect(text).not.toContain("somchai@");
    expect(text).toContain("so***@example.com");
  });
});

describe("Phase 5: daily summary for admins", () => {
  const expired = (index: number, overrides: Partial<ExpiredMember> = {}): ExpiredMember => ({
    userId: `u${index}`,
    email: `m${index}@example.com`,
    tradingViewUsername: `tv${index}`,
    discordUserId: null,
    expiredSubscriptions: 1,
    continuing: false,
    pendingChannels: ["tradingViewGranted", "discordRoleGranted"],
    ...overrides,
  });

  it("lists who needs manual de-provisioning, separates renewed members and caps long lists", () => {
    const members = [...Array.from({ length: 22 }, (_, index) => expired(index)), expired(99, { continuing: true, pendingChannels: [] })];
    const text = formatExpirySummary({ members, errors: [], hasMore: false }, { reminded: 4, failed: [{ userId: "x", email: "late@example.com" }], hasMore: false }, "run-1", "https://example.test");

    expect(text).toContain("สิทธิ์หมดอายุ: 22 คน (อีก 1 คนต่ออายุไว้แล้ว ใช้งานต่อได้)");
    expect(text).toContain("m0***@example.com | TV: tv0 | TradingView, Discord | https://example.test/admin/members/u0");
    expect(text).toContain("…และอีก 2 คน");
    expect(text).not.toContain("/admin/members/u99");
    expect(text).toContain("la***@example.com");
    expect(text).not.toContain("late@example.com");
  });

  it("returns nothing when there is nothing to report", () => {
    expect(formatExpirySummary({ members: [], errors: [], hasMore: false }, { reminded: 0, failed: [], hasMore: false }, "run-1", "https://example.test")).toBeNull();
  });

  it("strips line breaks and caps member-supplied fields so they cannot fake lines or push others out", () => {
    const text = formatExpirySummary(
      { members: [expired(1, { tradingViewUsername: "evil\n✅ ทุกอย่างปกติ" + "x".repeat(500) })], errors: [], hasMore: false },
      { reminded: 0, failed: [], hasMore: false },
      "run-1",
      "https://example.test",
    )!;
    expect(text.split("\n").some((line) => line.startsWith("✅"))).toBe(false);
    expect(text).not.toContain("x".repeat(100));
  });
});
