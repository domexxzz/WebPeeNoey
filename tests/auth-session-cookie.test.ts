import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { middleware } from "@/middleware";

const TEST_SECRET = "test-session-cookie-secret-0123456789abcdef";
const SECURE_COOKIE = "__Secure-next-auth.session-token";
const PLAIN_COOKIE = "next-auth.session-token";

let previousSecret: string | undefined;
beforeAll(() => {
  previousSecret = process.env.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_SECRET = TEST_SECRET;
});
afterAll(() => {
  process.env.NEXTAUTH_SECRET = previousSecret;
});

async function requestWith(cookieName: string, secret = TEST_SECRET, url = "http://localhost:10000/admin") {
  const token = await encode({ token: { sub: "u1", id: "u1", role: "ADMIN" }, secret });
  return new NextRequest(url, { headers: { cookie: `${cookieName}=${token}` } });
}

function redirectedToSignIn(response: Response) {
  return response.headers.get("location")?.includes("/auth/signin") ?? false;
}

describe("Middleware sees the session whichever cookie name NextAuth used (Vercel, Render or local)", () => {
  it("accepts the __Secure- cookie even when the proxied request looks like plain http", async () => {
    expect(redirectedToSignIn(await middleware(await requestWith(SECURE_COOKIE)))).toBe(false);
  });

  it("accepts the plain cookie used on local http development", async () => {
    expect(redirectedToSignIn(await middleware(await requestWith(PLAIN_COOKIE, TEST_SECRET, "http://localhost:3000/admin")))).toBe(false);
  });

  it("still rejects a session signed with a different secret under either name", async () => {
    for (const name of [SECURE_COOKIE, PLAIN_COOKIE]) {
      const forged = await requestWith(name, "attacker-chosen-secret-0123456789abcdefgh");
      expect(redirectedToSignIn(await middleware(forged))).toBe(true);
    }
  });

  it("sends visitors with no session to sign-in", async () => {
    expect(redirectedToSignIn(await middleware(new NextRequest("http://localhost:10000/admin")))).toBe(true);
  });
});
