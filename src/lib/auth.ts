import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import { verifyPassword } from "./security";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 วัน
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "อีเมลและรหัสผ่าน",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน");
        }

        const normalizedEmail = credentials.email.trim().toLowerCase();

        // 1. Rate Limiting สำหรับการเข้าสู่ระบบ (สูงสุด 5 ครั้ง ใน 15 นาที)
        const ip =
          req?.headers?.["x-forwarded-for"] ||
          req?.headers?.["x-real-ip"] ||
          "local";
        const rateKey = `login:${ip}:${normalizedEmail}`;
        const limitCheck = await checkRateLimit(rateKey, 5, 15 * 60);

        if (!limitCheck.success) {
          const waitMinutes = Math.ceil(
            (limitCheck.resetAt.getTime() - Date.now()) / (60 * 1000)
          );
          throw new Error(
            `พยายามเข้าสู่ระบบมากเกินไป กรุณารออีก ${waitMinutes} นาที`
          );
        }

        // 2. ค้นหาผู้ใช้ในฐานข้อมูล
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user || !user.passwordHash) {
          throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        }

        // 3. ตรวจสอบความถูกต้องของรหัสผ่าน
        const isMatch = await verifyPassword(
          credentials.password,
          user.passwordHash
        );
        if (!isMatch) {
          throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        }

        // 4. เข้าสู่ระบบสำเร็จ ให้รีเซ็ต Rate Limit
        await resetRateLimit(rateKey);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          tradingViewUsername: user.tradingViewUsername,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tradingViewUsername = user.tradingViewUsername;
      }
      if (trigger === "update" && session?.user) {
        token.name = session.user.name;
        token.tradingViewUsername = session.user.tradingViewUsername;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tradingViewUsername = token.tradingViewUsername;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "development-secret-for-jwt-signing-minimum-32chars",
};
