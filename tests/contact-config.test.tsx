import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  formatContactLine,
  normalizeContactEmail,
  normalizeLineId,
  normalizeTelegramHandle,
  resolveContact,
} from "@/config/site";
import { ContactChannels, getContactChannels } from "@/components/marketing/contact-section";
import { buildOrganizationJsonLd } from "@/lib/seo";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("contact channel normalizers", () => {
  it("accepts a plain email and rejects anything that is not one", () => {
    expect(normalizeContactEmail(" Support@GoldHybridshot.com ")).toBe("support@goldhybridshot.com");
    for (const bad of ["", undefined, "support", "a@b", "x@y.com?subject=hi", "javascript:alert(1)@x.com", "a b@x.com"]) {
      expect(normalizeContactEmail(bad)).toBeNull();
    }
  });

  it("normalizes a LINE Official Account ID to @id", () => {
    expect(normalizeLineId("@goldhybridshot")).toBe("@goldhybridshot");
    expect(normalizeLineId(" GoldHybridshot ")).toBe("@goldhybridshot");
    for (const bad of ["", undefined, "@", "@ab", "@has space", "https://line.me/R/ti/p/@x", "@a/../b"]) {
      expect(normalizeLineId(bad)).toBeNull();
    }
  });

  it("normalizes a Telegram username or t.me link to @handle", () => {
    expect(normalizeTelegramHandle("@gold_support")).toBe("@gold_support");
    expect(normalizeTelegramHandle("gold_support")).toBe("@gold_support");
    expect(normalizeTelegramHandle("https://t.me/gold_support/")).toBe("@gold_support");
    for (const bad of ["", undefined, "@abc", "@has-dash", "https://evil.example/gold_support", "https://t.me/+invitecode", "https://t.me/joinchat/abc"]) {
      expect(normalizeTelegramHandle(bad)).toBeNull();
    }
  });
});

describe("resolveContact", () => {
  it("reads every channel from env", () => {
    expect(
      resolveContact({
        NEXT_PUBLIC_CONTACT_EMAIL: "support@goldhybridshot.com",
        NEXT_PUBLIC_CONTACT_LINE: "@goldhybridshot",
        NEXT_PUBLIC_CONTACT_TELEGRAM: "@gold_support",
      }),
    ).toEqual({ email: "support@goldhybridshot.com", line: "@goldhybridshot", telegram: "@gold_support" });
  });

  it("leaves unset or invalid channels empty instead of falling back to the old peenoey accounts", () => {
    const contact = resolveContact({ NEXT_PUBLIC_CONTACT_EMAIL: "not-an-email" });
    expect(contact).toEqual({ email: null, line: null, telegram: null });
    expect(JSON.stringify(contact)).not.toMatch(/peenoey/);
  });
});

describe("contact channels on the homepage", () => {
  const full = { email: "support@goldhybridshot.com", line: "@goldhybridshot", telegram: "@gold_support" };

  it("builds links only for the configured channels", () => {
    expect(getContactChannels(full).map((channel) => channel.href)).toEqual([
      "mailto:support@goldhybridshot.com",
      "https://line.me/R/ti/p/%40goldhybridshot",
      "https://t.me/gold_support",
    ]);
    expect(getContactChannels({ ...full, email: null, line: null }).map((channel) => channel.label)).toEqual(["Telegram"]);
  });

  it("renders the list with the configured values and renders nothing when no channel is set", () => {
    const html = renderToStaticMarkup(<ContactChannels contact={full} />);
    expect(html).toContain("support@goldhybridshot.com");
    expect(html).toContain('href="https://t.me/gold_support"');
    expect(renderToStaticMarkup(<ContactChannels contact={{ email: null, line: null, telegram: null }} />)).toBe("");
  });
});

describe("contact line in the legal documents", () => {
  it("lists only the configured channels", () => {
    expect(formatContactLine({ email: "support@goldhybridshot.com", line: null, telegram: "@gold_support" })).toBe(
      "อีเมล support@goldhybridshot.com · Telegram @gold_support",
    );
  });

  it("says the channels are not published yet when none is configured", () => {
    expect(formatContactLine({ email: null, line: null, telegram: null })).toMatch(/ยังไม่ได้ระบุช่องทางติดต่อ/);
  });
});

describe("organization JSON-LD", () => {
  it("includes the email only when one is configured", () => {
    expect(buildOrganizationJsonLd({ email: "support@goldhybridshot.com", line: null, telegram: null }).email).toBe(
      "support@goldhybridshot.com",
    );
    expect(buildOrganizationJsonLd({ email: null, line: null, telegram: null })).not.toHaveProperty("email");
  });
});

describe("deploy config for contact channels", () => {
  it("declares the contact env vars in render.yaml and .env.example", () => {
    const root = path.resolve(__dirname, "..");
    const renderYaml = readFileSync(path.join(root, "render.yaml"), "utf8");
    const envExample = readFileSync(path.join(root, ".env.example"), "utf8");
    for (const key of ["NEXT_PUBLIC_CONTACT_EMAIL", "NEXT_PUBLIC_CONTACT_LINE", "NEXT_PUBLIC_CONTACT_TELEGRAM"]) {
      expect(renderYaml).toContain(`key: ${key}`);
      expect(envExample).toContain(`${key}=`);
    }
  });
});
