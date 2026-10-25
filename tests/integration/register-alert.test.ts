import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestPrisma, resetDatabase } from "./helpers";

vi.mock("@/lib/notify/telegram", () => ({ sendAdminTelegram: vi.fn().mockResolvedValue({ ok: true }) }));

const { sendAdminTelegram } = await import("@/lib/notify/telegram");
const { POST } = await import("@/app/api/auth/register/route");

const prisma = createTestPrisma();

function registerRequest(body: Record<string, string>): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200)}` },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await resetDatabase(prisma);
  vi.mocked(sendAdminTelegram).mockClear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: admins are told when a new member signs up", () => {
  it("sends one alert with a masked email, the TradingView username and a member link — never the password or name", async () => {
    const response = await POST(
      registerRequest({ name: "Somchai\n✅ อนุมัติแล้ว", email: "trader@example.com", password: "a-long-password-123", tradingViewUsername: "Trader_01" }) as never,
    );
    expect(response.status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "trader@example.com" } });

    expect(sendAdminTelegram).toHaveBeenCalledTimes(1);
    const text = vi.mocked(sendAdminTelegram).mock.calls[0][0];
    expect(text).toContain("👤 สมาชิกใหม่");
    expect(text).toContain("t***@example.com");
    expect(text).toContain("Trader_01");
    expect(text).toContain(`/admin/members/${user.id}`);
    expect(text).not.toContain("trader@example.com");
    expect(text).not.toContain("a-long-password-123");
    expect(text).not.toContain("Somchai"); // ชื่อเป็นข้อความอิสระ — ไม่ใส่ กันการปลอมบรรทัดในข้อความแอดมิน
  });

  it("does not alert for a rejected sign-up (duplicate email)", async () => {
    await POST(registerRequest({ name: "First", email: "dup@example.com", password: "a-long-password-123" }) as never);
    vi.mocked(sendAdminTelegram).mockClear();
    const duplicate = await POST(registerRequest({ name: "Second", email: "dup@example.com", password: "a-long-password-123" }) as never);
    expect(duplicate.status).toBe(409);
    expect(sendAdminTelegram).not.toHaveBeenCalled();
  });

  it("still completes the sign-up when the Telegram alert fails", async () => {
    vi.mocked(sendAdminTelegram).mockRejectedValueOnce(new Error("telegram down"));
    const response = await POST(registerRequest({ name: "Member", email: "member@example.com", password: "a-long-password-123" }) as never);
    expect(response.status).toBe(201);
    expect(await prisma.user.count({ where: { email: "member@example.com" } })).toBe(1);
  });
});
