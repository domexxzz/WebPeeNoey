import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/register/route";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function registerRequest(body: Record<string, string>): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200)}` },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await resetDatabase(prisma);
  process.env.ADMIN_EMAIL = "owner@example.com";
});

afterEach(() => {
  process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: public registration never grants admin", () => {
  it("creates a normal member even when the email matches ADMIN_EMAIL (admins come only from the seed)", async () => {
    const response = await POST(registerRequest({ name: "Not Owner", email: "Owner@Example.com", password: "a-long-password-123" }) as never);

    expect(response.status).toBeLessThan(300);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "owner@example.com" } });
    expect(user.role).toBe("USER");
  });
});

describe("Integration: registration validates the TradingView username", () => {
  it("stores a valid username and rejects line breaks or oversized values that could spoof admin messages", async () => {
    const valid = await POST(registerRequest({ name: "Trader", email: "trader@example.com", password: "a-long-password-123", tradingViewUsername: " Trader_01.x " }) as never);
    expect(valid.status).toBeLessThan(300);
    expect((await prisma.user.findUniqueOrThrow({ where: { email: "trader@example.com" } })).tradingViewUsername).toBe("Trader_01.x");

    const spoof = await POST(registerRequest({ name: "Evil", email: "evil@example.com", password: "a-long-password-123", tradingViewUsername: "evil\n✅ ปกติ" }) as never);
    const long = await POST(registerRequest({ name: "Long", email: "long@example.com", password: "a-long-password-123", tradingViewUsername: "x".repeat(51) }) as never);
    expect(spoof.status).toBe(400);
    expect(long.status).toBe(400);
    expect(await prisma.user.count({ where: { email: { in: ["evil@example.com", "long@example.com"] } } })).toBe(0);
  });
});
