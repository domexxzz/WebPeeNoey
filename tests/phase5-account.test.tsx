import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getServerSession } from "next-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createTelegramLinkToken, unlinkTelegramForUser } from "@/lib/telegram/link";
import { createTelegramLinkAction, unlinkTelegramAction } from "@/app/(account)/account/telegram-actions";
import { TelegramConnect } from "@/components/account/telegram-connect";

// react-dom 18.3 stable ไม่มี useFormState/useFormStatus แบบที่ Next.js ใช้ — จำลองไว้สำหรับ render
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormState: (action: unknown, initialState: unknown) => [initialState, action],
  useFormStatus: () => ({ pending: false }),
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/telegram/link", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/telegram/link")>()),
  createTelegramLinkToken: vi.fn(),
  unlinkTelegramForUser: vi.fn(),
}));

const idle = { status: "idle" } as const;
const TOKEN = "t".repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("TELEGRAM_BOT_USERNAME", "PeenoeyBot");
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" }, expires: "2099" } as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ success: true } as never);
  vi.mocked(createTelegramLinkToken).mockResolvedValue({ token: TOKEN, expiresAt: new Date("2026-10-12T03:15:00Z") });
});

describe("Phase 5: Telegram link actions", () => {
  it("creates a one-time deep link for the signed-in member", async () => {
    expect(await createTelegramLinkAction(idle, new FormData())).toEqual({
      status: "ready",
      url: `https://t.me/PeenoeyBot?start=${TOKEN}`,
      expiresAt: "2026-10-12T03:15:00.000Z",
    });
    expect(createTelegramLinkToken).toHaveBeenCalledWith(expect.anything(), { userId: "u1" });
  });

  it("refuses when signed out, when the bot is not configured or when rate limited", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    expect((await createTelegramLinkAction(idle, new FormData())).status).toBe("error");

    vi.stubEnv("TELEGRAM_BOT_USERNAME", "");
    expect(await createTelegramLinkAction(idle, new FormData())).toEqual({ status: "error", message: "การแจ้งเตือนทาง Telegram ยังไม่เปิดใช้งาน" });

    vi.stubEnv("TELEGRAM_BOT_USERNAME", "PeenoeyBot");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false } as never);
    expect((await createTelegramLinkAction(idle, new FormData())).status).toBe("error");
    expect(createTelegramLinkToken).not.toHaveBeenCalled();
  });

  it("unlinks only the signed-in member", async () => {
    await unlinkTelegramAction();
    expect(unlinkTelegramForUser).toHaveBeenCalledWith(expect.anything(), { userId: "u1" });

    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    vi.mocked(unlinkTelegramForUser).mockClear();
    await unlinkTelegramAction();
    expect(unlinkTelegramForUser).not.toHaveBeenCalled();
  });
});

describe("Phase 5: Telegram connect card", () => {
  it("shows the connect button, the linked state or a disabled notice", () => {
    expect(renderToStaticMarkup(<TelegramConnect enabled linked={false} linkedAtLabel={null} />)).toContain("เชื่อมต่อ Telegram");
    const linked = renderToStaticMarkup(<TelegramConnect enabled linked linkedAtLabel="12 ต.ค. 2569" />);
    expect(linked).toContain("เชื่อมต่อแล้ว (ตั้งแต่ 12 ต.ค. 2569)");
    expect(linked).toContain("ยกเลิกการเชื่อมต่อ");
    expect(renderToStaticMarkup(<TelegramConnect enabled={false} linked={false} linkedAtLabel={null} />)).toContain("ยังไม่เปิดใช้งาน");
  });
});
