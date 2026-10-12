import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { sendAdminTelegram } from "@/lib/notify/telegram";
import { sendPasswordResetEmail } from "@/lib/email";
import { hashToken } from "@/lib/security";
import { authorizeCredentials } from "@/lib/login";
import { hashPassword } from "@/lib/security";
import { createTestPrisma, resetDatabase } from "./helpers";

vi.mock("@/lib/notify/telegram", () => ({ sendAdminTelegram: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: vi.fn(async () => true) }));

const prisma = createTestPrisma();

function post(url: string, body: Record<string, string>, headers: Record<string, string>): Request {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

beforeEach(async () => {
  await resetDatabase(prisma);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.mocked(sendAdminTelegram).mockClear();
  vi.mocked(sendPasswordResetEmail).mockClear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: signup rate limit cannot be bypassed with forged headers", () => {
  it("counts rotating fake x-forwarded-for values as one client", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await register(
        post("http://localhost/api/auth/register", { name: "Spammer", email: `spam${attempt}@example.com`, password: "a-long-password-123" }, { "x-forwarded-for": `spoof-${attempt}` }) as never,
      );
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5).every((status) => status < 300)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it("uses the platform's x-real-ip even when x-forwarded-for carries different valid IPs", async () => {
    let last = 0;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await register(
        post("http://localhost/api/auth/register", { name: "Spammer", email: `ip${attempt}@example.com`, password: "a-long-password-123" }, { "x-real-ip": "203.0.113.50", "x-forwarded-for": `198.51.100.${attempt + 1}` }) as never,
      );
      last = response.status;
    }
    expect(last).toBe(429);
  });
});

describe("Integration: IPv6 rotation inside one allocation", () => {
  it("counts every address in the same /64 as one client for signup", async () => {
    let last = 0;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await register(
        post("http://localhost/api/auth/register", { name: "Spammer", email: `v6-${attempt}@example.com`, password: "a-long-password-123" }, { "x-real-ip": `2001:db8:aa:bb::${attempt + 1}` }) as never,
      );
      last = response.status;
    }
    expect(last).toBe(429);
  });
});

describe("Integration: login brute-force protection", () => {
  it("locks an email after 10 wrong passwords even when every attempt comes from a different IP", async () => {
    await prisma.user.create({ data: { email: "victim@example.com", passwordHash: await hashPassword("correct-horse-battery"), role: "USER" } });
    const attempt = (index: number, password: string) =>
      authorizeCredentials({ email: "victim@example.com", password }, { "x-real-ip": `198.51.100.${index}` });

    for (let index = 1; index <= 10; index += 1) {
      await expect(attempt(index, `wrong-${index}`)).rejects.toThrow("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    // ครั้งที่ 11 แม้รหัสถูกก็ยังถูกล็อกจนหมดเวลา
    await expect(attempt(11, "correct-horse-battery")).rejects.toThrow("พยายามเข้าสู่ระบบมากเกินไป");
  });

  it("limits one IP to 5 attempts per email and clears both counters after a successful login", async () => {
    await prisma.user.create({ data: { email: "member@example.com", passwordHash: await hashPassword("correct-horse-battery"), role: "USER" } });
    const fromSameIp = (password: string, xff = "spoof") => authorizeCredentials({ email: "Member@Example.com", password }, { "x-forwarded-for": xff });

    for (let index = 0; index < 3; index += 1) await expect(fromSameIp("wrong", `spoof-${index}`)).rejects.toThrow("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    await expect(fromSameIp("correct-horse-battery")).resolves.toMatchObject({ email: "member@example.com", role: "USER" });
    expect(await prisma.rateLimit.count()).toBe(0);

    for (let index = 0; index < 5; index += 1) await expect(fromSameIp("wrong", `garbage-${index}`)).rejects.toThrow("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    await expect(fromSameIp("correct-horse-battery")).rejects.toThrow("พยายามเข้าสู่ระบบมากเกินไป");
  });
});

describe("Integration: admin lockout is reported", () => {
  it("alerts the admin group once when an admin account reaches the failed-login limit", async () => {
    await prisma.user.create({ data: { email: "boss@example.com", passwordHash: await hashPassword("correct-horse-battery"), role: "ADMIN" } });
    for (let index = 1; index <= 10; index += 1) {
      await expect(authorizeCredentials({ email: "boss@example.com", password: "wrong" }, { "x-real-ip": `198.51.100.${index}` })).rejects.toThrow();
    }
    await expect(authorizeCredentials({ email: "boss@example.com", password: "wrong" }, { "x-real-ip": "198.51.100.99" })).rejects.toThrow("พยายามเข้าสู่ระบบมากเกินไป");

    expect(sendAdminTelegram).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendAdminTelegram).mock.calls[0][0]).toContain("bo***@example.com");
  });

  it("does not alert for member accounts or unknown emails", async () => {
    for (let index = 1; index <= 10; index += 1) {
      await expect(authorizeCredentials({ email: "ghost@example.com", password: "wrong" }, { "x-real-ip": `198.51.100.${index}` })).rejects.toThrow("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    expect(sendAdminTelegram).not.toHaveBeenCalled();
  });
});

describe("Integration: password reset links", () => {
  it("keeps the victim's existing link valid when someone else requests a reset, stores only hashes, and burns all links after use", async () => {
    await prisma.user.create({ data: { email: "owner@example.com", passwordHash: await hashPassword("old-password-123"), role: "USER" } });
    const request = (ip: string) => forgotPassword(post("http://localhost/api/auth/forgot-password", { email: "owner@example.com" }, { "x-real-ip": ip }) as never);

    await request("198.51.100.1");
    const victimToken = vi.mocked(sendPasswordResetEmail).mock.calls[0][1];
    await request("203.0.113.66");

    const stored = await prisma.passwordResetToken.findMany({ where: { email: "owner@example.com" } });
    expect(stored).toHaveLength(2);
    expect(stored.some((row) => row.token === victimToken)).toBe(false);
    expect(stored.some((row) => row.token === hashToken(victimToken))).toBe(true);

    const reset = (token: string) => resetPassword(post("http://localhost/api/auth/reset-password", { email: "owner@example.com", token, newPassword: "new-password-456" }, {}) as never);
    expect((await reset(victimToken)).status).toBe(200);
    expect(await prisma.passwordResetToken.count({ where: { email: "owner@example.com" } })).toBe(0);
    expect((await reset(victimToken)).status).toBe(400);
    await expect(authorizeCredentials({ email: "owner@example.com", password: "new-password-456" }, { "x-real-ip": "198.51.100.1" })).resolves.toMatchObject({ email: "owner@example.com" });
  });
});

describe("Integration: password reset cannot be used to flood a victim's inbox", () => {
  it("allows only 3 reset emails per address per 15 minutes regardless of the caller's IP", async () => {
    await prisma.user.create({ data: { email: "target@example.com", passwordHash: "x", role: "USER" } });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await forgotPassword(post("http://localhost/api/auth/forgot-password", { email: "target@example.com" }, { "x-real-ip": `198.51.100.${attempt + 1}` }) as never);
      statuses.push(response.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});
