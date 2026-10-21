import { describe, expect, it } from "vitest";
import { clientIpFromHeaders, isValidIp, rateLimitIp, UNKNOWN_IP } from "@/lib/request";

describe("Client IP for rate limiting cannot be chosen by the caller", () => {
  it("prefers x-real-ip (set by Vercel) over a caller-supplied x-forwarded-for", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1, 10.0.0.1" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.7");
  });

  it("falls back to the first valid x-forwarded-for entry", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
  });

  it("puts every garbage value into one shared bucket so rotating it does not reset the limit", () => {
    ["spoof-1", "spoof-2", "<script>", "a".repeat(200), ""].forEach((value) => {
      expect(rateLimitIp(new Headers({ "x-forwarded-for": value }))).toBe(UNKNOWN_IP);
    });
    expect(rateLimitIp(new Headers())).toBe(UNKNOWN_IP);
  });

  it("reads plain header objects such as NextAuth's req.headers", () => {
    expect(clientIpFromHeaders({ "x-real-ip": "203.0.113.9" })).toBe("203.0.113.9");
    expect(clientIpFromHeaders({ "x-forwarded-for": ["198.51.100.4"] })).toBe("198.51.100.4");
    expect(rateLimitIp({})).toBe(UNKNOWN_IP);
  });
});

describe("Client IP on Render (behind Cloudflare, which overwrites cf-connecting-ip)", () => {
  const RENDER_ENV = { RENDER: "true" };

  it("uses cf-connecting-ip and ignores caller-supplied x-real-ip and x-forwarded-for", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.20",
      "x-real-ip": "198.51.100.66",
      "x-forwarded-for": "198.51.100.77, 10.0.0.1",
    });
    expect(clientIpFromHeaders(headers, RENDER_ENV)).toBe("203.0.113.20");
  });

  it("never falls back to headers a caller can forge when cf-connecting-ip is missing", () => {
    const forged = new Headers({ "x-real-ip": "198.51.100.66", "x-forwarded-for": "198.51.100.77" });
    expect(clientIpFromHeaders(forged, RENDER_ENV)).toBeUndefined();
    expect(rateLimitIp(forged, RENDER_ENV)).toBe(UNKNOWN_IP);
  });

  it("validates cf-connecting-ip and buckets IPv6 by /64 like the Vercel path", () => {
    expect(rateLimitIp(new Headers({ "cf-connecting-ip": "spoof" }), RENDER_ENV)).toBe(UNKNOWN_IP);
    expect(rateLimitIp(new Headers({ "cf-connecting-ip": "2001:db8:1:2:aaaa::1" }), RENDER_ENV)).toBe("2001:0db8:0001:0002::/64");
  });

  it("reads plain header objects such as NextAuth's req.headers", () => {
    expect(clientIpFromHeaders({ "cf-connecting-ip": "203.0.113.21" }, RENDER_ENV)).toBe("203.0.113.21");
  });

  it("keeps the Vercel headers when not running on Render", () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.20", "x-real-ip": "203.0.113.7" });
    expect(clientIpFromHeaders(headers, {})).toBe("203.0.113.7");
  });
});

describe("IP validation and IPv6 bucketing (security review)", () => {
  it("rejects hex-and-colon garbage, leading-zero IPv4 and zone ids that a loose regex accepted", () => {
    ["a:1", "::::", "dead:beef", "01.2.3.4", "fe80::1%eth0", "1.2.3"].forEach((value) => expect(isValidIp(value), value).toBe(false));
    ["2001:db8::1", "::1", "::ffff:1.2.3.4", "203.0.113.9"].forEach((value) => expect(isValidIp(value), value).toBe(true));
    expect(rateLimitIp(new Headers({ "x-forwarded-for": "a:1" }))).toBe(UNKNOWN_IP);
  });

  it("groups IPv6 addresses by /64 so rotating addresses inside one allocation does not reset the limit", () => {
    const bucket = (ip: string) => rateLimitIp(new Headers({ "x-real-ip": ip }));
    expect(bucket("2001:db8:aa:bb::1")).toBe("2001:0db8:00aa:00bb::/64");
    expect(bucket("2001:DB8:AA:BB:1234:5678:9abc:def0")).toBe(bucket("2001:db8:aa:bb::1"));
    expect(bucket("2001:db8:aa:cc::1")).not.toBe(bucket("2001:db8:aa:bb::1"));
  });

  it("treats IPv4-mapped IPv6 as the same client as plain IPv4", () => {
    expect(rateLimitIp(new Headers({ "x-real-ip": "::ffff:198.51.100.7" }))).toBe("198.51.100.7");
  });
});
