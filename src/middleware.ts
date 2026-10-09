import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = process.env.NEXTAUTH_SECRET || "development-secret-for-jwt-signing-minimum-32chars";

  // 1. ดึง Token ความปลอดภัย
  const token = await getToken({ req, secret });

  // 2. สร้าง Response พื้นฐาน
  let response = NextResponse.next();

  // 3. ตรวจสอบสิทธิ์เส้นทาง Admin (/admin หรือ /admin/*)
  if (pathname.startsWith("/admin")) {
    if (!token) {
      const signInUrl = new URL("/auth/signin", req.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }

    if (token.role !== "ADMIN") {
      // ผู้ใช้ทั่วไปที่พยายามเข้าหน้าแอดมิน ให้ดีดกลับไปหน้า /account
      const accountUrl = new URL("/account", req.url);
      accountUrl.searchParams.set("error", "unauthorized_admin");
      return NextResponse.redirect(accountUrl);
    }
  }

  // 4. ตรวจสอบสิทธิ์เส้นทางสมาชิก (/account หรือ /checkout/*)
  if (pathname.startsWith("/account") || pathname.startsWith("/checkout")) {
    if (!token) {
      const signInUrl = new URL("/auth/signin", req.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // 5. หากล็อกอินแล้ว แต่พยายามเข้าหน้า Signin / Signup ให้ส่งต่อไปหน้าตาม Role
  if (pathname === "/auth/signin" || pathname === "/auth/signup") {
    if (token) {
      const target = token.role === "ADMIN" ? "/admin" : "/account";
      return NextResponse.redirect(new URL(target, req.url));
    }
  }

  // 6. Security Headers ตามกฎความปลอดภัย (กัน Clickjacking และโจมตีอื่นๆ)
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/account/:path*",
    "/checkout/:path*",
    "/auth/signin",
    "/auth/signup",
  ],
};
