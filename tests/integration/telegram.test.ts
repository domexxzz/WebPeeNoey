import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "crypto";
import { SITE_PLANS } from "@/config/plans";
import { seedDatabase, SYSTEM_SETTING_ID } from "@/lib/db/seed";
import { createOrder, submitSlip } from "@/lib/orders/checkout";
import { approveOrder } from "@/lib/admin/order-review";
import { createTelegramLinkToken, hashLinkToken, linkTelegramChat, telegramDeepLink, unlinkTelegramChat, unlinkTelegramForUser } from "@/lib/telegram/link";
import { handleTelegramUpdate } from "@/lib/telegram/bot";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const T0 = new Date("2026-10-11T03:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60 * 1000);
const SITE_URL = "https://example.test";

async function member(email = `m-${randomBytes(4).toString("hex")}@example.com`) {
  return prisma.user.create({ data: { email, role: "USER", passwordHash: "x" } });
}

function privateMessage(chatId: number, text: string) {
  return { update_id: Math.floor(Math.random() * 1e9), message: { message_id: 1, text, chat: { id: chatId, type: "private" }, from: { id: chatId, is_bot: false } } };
}

function bot(now = at(5)) {
  const reply = vi.fn(async (_chatId: string, _text: string) => ({ ok: true }));
  return { reply, deps: { siteUrl: SITE_URL, reply, now } };
}

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "integration-test-password" });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: Telegram link tokens", () => {
  it("stores only the token hash and replaces older unused tokens", async () => {
    const user = await member();
    const first = await createTelegramLinkToken(prisma, { userId: user.id, now: T0 });
    const second = await createTelegramLinkToken(prisma, { userId: user.id, now: T0 });

    const rows = await prisma.telegramLinkToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashLinkToken(second.token));
    expect(JSON.stringify(rows)).not.toContain(second.token);
    expect(second.expiresAt).toEqual(at(15));
    expect(await linkTelegramChat(prisma, { token: first.token, chatId: "111", now: at(1) })).toEqual({ ok: false, code: "INVALID_TOKEN" });
    expect(telegramDeepLink("@PeenoeyBot", second.token)).toBe(`https://t.me/PeenoeyBot?start=${second.token}`);
    expect(telegramDeepLink("bad name!", second.token)).toBeNull();
  });

  it("links a chat once, rejects reused, expired and malformed tokens", async () => {
    const user = await member();
    const { token } = await createTelegramLinkToken(prisma, { userId: user.id, now: T0 });

    expect(await linkTelegramChat(prisma, { token, chatId: "111", now: at(1) })).toEqual({ ok: true, userId: user.id, email: user.email });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ telegramChatId: "111", telegramLinkedAt: at(1) });
    expect(await linkTelegramChat(prisma, { token, chatId: "222", now: at(2) })).toEqual({ ok: false, code: "INVALID_TOKEN" });

    const late = await createTelegramLinkToken(prisma, { userId: user.id, now: T0 });
    expect(await linkTelegramChat(prisma, { token: late.token, chatId: "111", now: at(16) })).toEqual({ ok: false, code: "EXPIRED_TOKEN" });
    expect(await linkTelegramChat(prisma, { token: "not-a-token", chatId: "111", now: at(1) })).toEqual({ ok: false, code: "INVALID_TOKEN" });
  });

  it("lets only one of two simultaneous /start messages use the same token", async () => {
    const user = await member();
    const { token } = await createTelegramLinkToken(prisma, { userId: user.id, now: T0 });

    const results = await Promise.all([
      linkTelegramChat(prisma, { token, chatId: "111", now: at(1) }),
      linkTelegramChat(prisma, { token, chatId: "222", now: at(1) }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });

  it("never silently moves a linked chat to another account (someone else's link cannot cut off our alerts)", async () => {
    const victim = await member();
    const attacker = await member();
    await linkTelegramChat(prisma, { token: (await createTelegramLinkToken(prisma, { userId: victim.id, now: T0 })).token, chatId: "111", now: at(1) });
    const attackerToken = (await createTelegramLinkToken(prisma, { userId: attacker.id, now: T0 })).token;

    expect(await linkTelegramChat(prisma, { token: attackerToken, chatId: "111", now: at(2) })).toEqual({ ok: false, code: "CHAT_LINKED_ELSEWHERE" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: victim.id } })).telegramChatId).toBe("111");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: attacker.id } })).telegramChatId).toBeNull();

    // เจ้าของแชตตั้งใจเปลี่ยนบัญชี: /stop ก่อน แล้วลิงก์เดิม (ยังไม่ถูกใช้) ใช้ได้
    await unlinkTelegramChat(prisma, { chatId: "111" });
    expect(await linkTelegramChat(prisma, { token: attackerToken, chatId: "111", now: at(3) })).toMatchObject({ ok: true, userId: attacker.id });
  });

  it("unlinks from the account page and cancels pending tokens", async () => {
    const user = await member();
    await linkTelegramChat(prisma, { token: (await createTelegramLinkToken(prisma, { userId: user.id, now: T0 })).token, chatId: "111", now: at(1) });
    await createTelegramLinkToken(prisma, { userId: user.id, now: at(2) });

    await unlinkTelegramForUser(prisma, { userId: user.id });

    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ telegramChatId: null, telegramLinkedAt: null });
    expect(await prisma.telegramLinkToken.count({ where: { userId: user.id, usedAt: null } })).toBe(0);
  });
});

describe("Integration: Telegram bot commands", () => {
  it("links with /start <token>, reports membership with /status and unlinks with /stop", async () => {
    const user = await member("somchai@example.com");
    await prisma.systemSetting.update({ where: { id: SYSTEM_SETTING_ID }, data: { paymentsEnabled: true, promptpayNumber: "0812345678", promptpayAccountName: "บัญชีทดสอบ" } });
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const created = await createOrder(prisma, { userId: user.id, planSlug: SITE_PLANS[0].slug, now: T0 });
    if (!created.ok) throw new Error(created.code);
    await submitSlip(prisma, { userId: user.id, orderId: created.orderId, bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from(randomBytes(32))]), now: at(1) });
    await approveOrder(prisma, { orderId: created.orderId, actor: { id: admin.id, ipAddress: null }, referenceNo: "REF12345", now: at(2) });
    const { token } = await createTelegramLinkToken(prisma, { userId: user.id, now: at(3) });
    const { reply, deps } = bot();

    expect(await handleTelegramUpdate(prisma, privateMessage(555, `/start@PeenoeyBot ${token}`), deps)).toBe("linked");
    expect(reply).toHaveBeenLastCalledWith("555", expect.stringContaining("so***@example.com"));

    expect(await handleTelegramUpdate(prisma, privateMessage(555, "/status"), deps)).toBe("status");
    expect(reply).toHaveBeenLastCalledWith("555", expect.stringContaining("ใช้งานได้ถึง"));

    expect(await handleTelegramUpdate(prisma, privateMessage(555, "/stop"), deps)).toBe("unlinked");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).telegramChatId).toBeNull();
  });

  it("explains how to link when the token is wrong and points unknown chats to the account page", async () => {
    const { reply, deps } = bot();

    expect(await handleTelegramUpdate(prisma, privateMessage(555, `/start ${"x".repeat(43)}`), deps)).toBe("link_failed");
    expect(reply).toHaveBeenLastCalledWith("555", expect.stringContaining(`${SITE_URL}/account`));
    expect(await handleTelegramUpdate(prisma, privateMessage(555, "สวัสดี"), deps)).toBe("help");
    expect(await handleTelegramUpdate(prisma, privateMessage(555, "/status"), deps)).toBe("status");
    expect(reply).toHaveBeenLastCalledWith("555", expect.stringContaining("เชื่อมบัญชีได้ที่"));
  });

  it("ignores group chats, malformed updates and rate-limited chats without replying", async () => {
    const { reply, deps } = bot();
    const group = { update_id: 1, message: { message_id: 1, text: "/status", chat: { id: -100, type: "supergroup" } } };

    expect(await handleTelegramUpdate(prisma, group, deps)).toBe("ignored");
    expect(await handleTelegramUpdate(prisma, { nonsense: true }, deps)).toBe("ignored");
    expect(await handleTelegramUpdate(prisma, null, deps)).toBe("ignored");
    expect(await handleTelegramUpdate(prisma, privateMessage(555, "/status"), { ...deps, allowChat: async () => false })).toBe("rate_limited");
    expect(reply).not.toHaveBeenCalled();
  });
});
