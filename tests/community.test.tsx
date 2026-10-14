import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COMMUNITY, normalizeDiscordInvite } from "@/config/community";
import { CommunityBand } from "@/components/marketing/community-band";
import { DiscordJoinLink } from "@/components/account/discord-join-link";

describe("Discord community config", () => {
  it("accepts only real Discord invite links", () => {
    expect(normalizeDiscordInvite("https://discord.gg/erJFe57YY")).toBe("https://discord.gg/erJFe57YY");
    expect(normalizeDiscordInvite(" https://discord.com/invite/erJFe57YY/ ")).toBe("https://discord.com/invite/erJFe57YY");
    for (const bad of ["", undefined, "http://discord.gg/abc", "https://discord.gg.evil.example/abc", "https://evil.example/discord.gg/abc", "javascript:alert(1)", "https://discord.gg/"]) {
      expect(normalizeDiscordInvite(bad)).toBeNull();
    }
  });

  it("uses the owner's invite by default", () => {
    expect(COMMUNITY.discord.inviteUrl).toBe("https://discord.gg/erJFe57YY");
  });
});

describe("Community band on the homepage", () => {
  it("links to the Discord invite in a new tab and shows no member counts", () => {
    const html = renderToStaticMarkup(<CommunityBand inviteUrl="https://discord.gg/erJFe57YY" />);
    expect(html).toMatch(/<a[^>]*href="https:\/\/discord\.gg\/erJFe57YY"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    expect(html).toContain(COMMUNITY.discord.name);
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(/\d+\s*(คน|สมาชิก|members|online|ออนไลน์)/i);
  });

  it("renders nothing without a valid invite", () => {
    expect(renderToStaticMarkup(<CommunityBand inviteUrl={null} />)).toBe("");
  });
});

describe("Discord join link in the member dashboard", () => {
  it("offers the invite and explains how to get the VIP role", () => {
    const html = renderToStaticMarkup(<DiscordJoinLink inviteUrl="https://discord.gg/erJFe57YY" />);
    expect(html).toContain('href="https://discord.gg/erJFe57YY"');
    expect(html).toContain(COMMUNITY.discord.vipHint);
    expect(renderToStaticMarkup(<DiscordJoinLink inviteUrl={null} />)).toBe("");
  });
});
