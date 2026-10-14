import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { siteConfig } from "@/config/site";

const mocks = vi.hoisted(() => ({ sent: [] as Array<{ from: string; subject: string; html: string }> }));

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (payload: { from: string; subject: string; html: string }) => {
        mocks.sent.push(payload);
        return { error: null };
      },
    };
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.sent.length = 0;
});

describe("Brand name in member emails", () => {
  it("puts the brand in the sender, subject, header and team signature of every email", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
    vi.resetModules();
    const email = await import("@/lib/email");

    await email.sendPasswordResetEmail("member@example.com", "reset-token");
    await email.sendReceiptEmail("member@example.com", "PN-0001", "แพ็กเกจ 1 เดือน", 990, new Date("2026-11-13T00:00:00Z"));
    await email.sendSlipRejectedEmail("member@example.com", "PN-0001", "ยอดไม่ตรง", "https://example.test/checkout/order/1");
    await email.sendExpiryReminderEmail("member@example.com", {
      planName: "แพ็กเกจ 1 เดือน",
      endsAt: new Date("2026-11-13T00:00:00Z"),
      daysLeft: 3,
      renewUrl: "https://example.test/checkout/monthly",
    });

    expect(mocks.sent).toHaveLength(4);
    for (const message of mocks.sent) {
      expect(message.from).toContain(siteConfig.name);
      expect(message.subject).toContain(siteConfig.name);
      expect(message.html).toContain(siteConfig.name);
      expect(message.html).toContain(`ทีมงาน ${siteConfig.name}`);
      expect(message.html).toContain('href="https://example.test"');
      // ธีมปัจจุบัน (ครีม-ทอง) — ปุ่มทอง พื้นขาว ไม่เหลือสีของธีมเก่า (เขียวสัญญาณ / พื้นมืด)
      expect(message.html).toContain("#D4A537");
      expect(message.html).toContain("background-color: #FFFFFF");
      expect(message.html).not.toMatch(/#6EEA6E|#111312|#0B0F17|#10B981/i);
    }
  });

  it("still escapes member-supplied text inside the branded layout", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.resetModules();
    const email = await import("@/lib/email");
    await email.sendSlipRejectedEmail("member@example.com", "PN-0002", '<script>alert("x")</script>', "https://example.test/o/2");
    expect(mocks.sent[0].html).not.toContain("<script>");
    expect(mocks.sent[0].html).toContain("&lt;script&gt;");
  });
});

describe("Brand name in the Telegram bot", () => {
  it("sets the bot's profile name and descriptions from the site name when registering the webhook", () => {
    const script = readFileSync(join(process.cwd(), "scripts", "telegram-set-webhook.mjs"), "utf8");
    expect(script).toContain('call("setMyName"');
    expect(script).toContain('"setMyShortDescription"');
    expect(script).toContain('"setMyDescription"');
    expect(script).toContain("env.NEXT_PUBLIC_SITE_NAME");
    expect(readFileSync(join(process.cwd(), ".env.example"), "utf8")).toContain(`NEXT_PUBLIC_SITE_NAME="${siteConfig.name}"`);
  });
});
