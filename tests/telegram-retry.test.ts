import { afterEach, describe, expect, it, vi } from "vitest";
import { getTelegramWebhookInfo, sendAdminTelegram } from "@/lib/notify/telegram";

const env = { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_ADMIN_CHAT_ID: "-100" };
const ok = () => new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
const fast = { env, retryDelayMs: 0 };

afterEach(() => vi.restoreAllMocks());

// 25–29 ต.ค. 2569: เซิร์ฟเวอร์บน Render ติดต่อ Telegram ไม่ได้ชั่วคราว (NETWORK_ERROR) 4 ครั้ง
// Watchdog จึงแจ้งเองไม่ได้ และ GitHub ส่งข้อความสำรอง "เว็บล่ม" ทั้งที่เว็บปกติ
describe("Telegram client retries one transient failure", () => {
  it("delivers on the second try after a network error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("fetch failed")).mockResolvedValueOnce(ok());

    expect(await sendAdminTelegram("alert", { ...fast, fetchImpl })).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries Telegram's own rate limit and server errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const status of [429, 502]) {
      const fetchImpl = vi.fn().mockResolvedValueOnce(new Response("busy", { status })).mockResolvedValueOnce(ok());
      expect(await sendAdminTelegram("alert", { ...fast, fetchImpl })).toEqual({ ok: true });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    }
  });

  it("gives up after the second failure and logs both attempts", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("fetch failed"));

    expect(await sendAdminTelegram("alert", { ...fast, fetchImpl })).toEqual({ ok: false, reason: "NETWORK_ERROR" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(errorLog).toHaveBeenCalledTimes(2);
  });

  it("does not retry a request Telegram rejected (bad chat id, revoked token)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));

    expect(await sendAdminTelegram("alert", { ...fast, fetchImpl })).toEqual({ ok: false, reason: "HTTP_ERROR" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("also retries the webhook status check used by the watchdog", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("The operation was aborted due to timeout"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { url: "https://example.test/hook", pending_update_count: 0 } }), { status: 200 }));

    expect(await getTelegramWebhookInfo({ ...fast, fetchImpl })).toMatchObject({ ok: true, info: { url: "https://example.test/hook" } });
  });
});
