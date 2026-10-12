import { beforeEach, describe, expect, it, vi } from "vitest";
import { runExpiryJob } from "@/lib/jobs/expiry";
import { runWatchdog } from "@/lib/jobs/watchdog";
import { handleTelegramUpdate } from "@/lib/telegram/bot";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { GET as checkExpiry } from "@/app/api/cron/check-expiry/route";
import { GET as watchdog } from "@/app/api/cron/watchdog/route";
import { POST as telegramWebhook } from "@/app/api/telegram/webhook/route";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/jobs/expiry", () => ({ runExpiryJob: vi.fn() }));
vi.mock("@/lib/jobs/reminder-sender", () => ({ createReminderSender: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/jobs/watchdog", () => ({ runWatchdog: vi.fn() }));
vi.mock("@/lib/telegram/bot", () => ({ handleTelegramUpdate: vi.fn() }));
vi.mock("@/lib/notify/telegram", () => ({ sendAdminTelegram: vi.fn(), sendTelegramMessage: vi.fn(), getTelegramWebhookInfo: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ success: true })) }));

const SECRET = "Q7v_Kp2-Xr9Lm4Tz8Wn1Hb6Jd3Fs5Gc0Ya";
const authorized = (path: string) => new Request(`http://localhost${path}`, { headers: { authorization: `Bearer ${SECRET}` } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", SECRET);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Phase 5: /api/cron/check-expiry", () => {
  it("rejects calls without the cron secret and never runs the job", async () => {
    expect((await checkExpiry(new Request("http://localhost/api/cron/check-expiry"))).status).toBe(401);
    expect((await checkExpiry(new Request("http://localhost/x", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect(runExpiryJob).not.toHaveBeenCalled();
  });

  it("returns only aggregate counts (no member data) and is never cached", async () => {
    vi.mocked(runExpiryJob).mockResolvedValue({
      ok: true,
      runId: "run-1",
      summary: { expiredOrders: 2, expiredMembers: 1, continuingMembers: 0, pendingDeprovisionUserIds: ["u1"], reminded: 3, reminderFailedUserIds: [], errors: [], hasMore: false, summaryDelivered: true },
    });

    const response = await checkExpiry(authorized("/api/cron/check-expiry"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({ ok: true, runId: "run-1", expiredOrders: 2, expiredMembers: 1, continuingMembers: 0, pendingDeprovision: 1, reminded: 3, reminderFailed: 0, hasMore: false });
    expect(JSON.stringify(body)).not.toContain("u1");
  });

  it("answers 500 when the job failed so the scheduler records a failure", async () => {
    vi.mocked(runExpiryJob).mockResolvedValue({ ok: false, runId: "run-2", error: "boom", summary: null });
    const response = await checkExpiry(authorized("/api/cron/check-expiry"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, runId: "run-2" });
  });
});

describe("Phase 5: /api/cron/watchdog", () => {
  const summary = { healthy: true, problemKeys: [], problems: [], slipsRenotified: 0, slipsRenotifyFailed: 0, alerted: false, throttled: false, adminNotified: true, recovered: false };

  it("answers 200 when healthy and 503 when problems were found", async () => {
    vi.mocked(runWatchdog).mockResolvedValueOnce({ ok: true, runId: "w1", summary });
    expect((await watchdog(authorized("/api/cron/watchdog"))).status).toBe(200);

    vi.mocked(runWatchdog).mockResolvedValueOnce({ ok: true, runId: "w2", summary: { ...summary, healthy: false, problemKeys: ["check-expiry-stale"], problems: ["x"], adminNotified: false } });
    const response = await watchdog(authorized("/api/cron/watchdog"));
    expect(response.status).toBe(503);
    // adminNotified=false บอก GitHub Actions ว่าแอปแจ้งเตือนเองไม่ได้ ต้องแจ้งแทน
    expect(await response.json()).toMatchObject({ ok: false, problems: ["check-expiry-stale"], adminNotified: false });
  });

  it("checks the bot webhook only when the member bot is fully enabled", async () => {
    vi.mocked(runWatchdog).mockResolvedValue({ ok: true, runId: "w1", summary });
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "PeenoeyBot");
    await watchdog(authorized("/api/cron/watchdog"));
    expect(vi.mocked(runWatchdog).mock.calls[0][1].webhookCheck).toEqual(expect.any(Function));

    vi.stubEnv("TELEGRAM_BOT_USERNAME", "");
    await watchdog(authorized("/api/cron/watchdog"));
    expect(vi.mocked(runWatchdog).mock.calls[1][1].webhookCheck).toBeNull();

    vi.stubEnv("TELEGRAM_BOT_USERNAME", "PeenoeyBot");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");
    await watchdog(authorized("/api/cron/watchdog"));
    expect(vi.mocked(runWatchdog).mock.calls[2][1].webhookCheck).toBeNull();
  });

  it("rejects unauthenticated calls", async () => {
    expect((await watchdog(new Request("http://localhost/api/cron/watchdog"))).status).toBe(401);
    expect(runWatchdog).not.toHaveBeenCalled();
  });
});

describe("Phase 5: /api/telegram/webhook", () => {
  const post = (body: string, secret: string | null = SECRET) =>
    new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      body,
      headers: secret ? { "x-telegram-bot-api-secret-token": secret, "content-type": "application/json" } : { "content-type": "application/json" },
    });

  it("rejects requests that do not carry the registered secret", async () => {
    expect((await telegramWebhook(post("{}", null))).status).toBe(401);
    expect((await telegramWebhook(post("{}", "wrong"))).status).toBe(401);
    expect(handleTelegramUpdate).not.toHaveBeenCalled();
  });

  it("passes valid updates to the bot and acknowledges with 200", async () => {
    vi.mocked(handleTelegramUpdate).mockResolvedValue("help");
    const update = { update_id: 1, message: { text: "/status", chat: { id: 5, type: "private" } } };

    const response = await telegramWebhook(post(JSON.stringify(update)));

    expect(response.status).toBe(200);
    expect(handleTelegramUpdate).toHaveBeenCalledWith(expect.anything(), update, expect.objectContaining({ reply: expect.any(Function), allowChat: expect.any(Function) }));
  });

  it("drops malformed or oversized bodies without retries", async () => {
    expect((await telegramWebhook(post("not json"))).status).toBe(200);
    expect((await telegramWebhook(post(JSON.stringify({ pad: "x".repeat(70 * 1024) })))).status).toBe(200);
    const declaredHuge = new Request("http://localhost/api/telegram/webhook", { method: "POST", body: "{}", headers: { "x-telegram-bot-api-secret-token": SECRET, "content-length": String(10 * 1024 * 1024) } });
    expect((await telegramWebhook(declaredHuge)).status).toBe(200);
    expect(handleTelegramUpdate).not.toHaveBeenCalled();
  });

  it("never fails silently: logs, alerts admins and still answers 200 so Telegram does not loop", async () => {
    vi.mocked(handleTelegramUpdate).mockRejectedValue(new Error("db down"));
    const response = await telegramWebhook(post(JSON.stringify({ update_id: 1 })));
    expect(response.status).toBe(200);
    expect(console.error).toHaveBeenCalled();
    expect(sendAdminTelegram).toHaveBeenCalledWith(expect.stringContaining("บอท Telegram"));
  });
});
