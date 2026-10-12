import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import { getAuthSecret } from "./auth-secret";
import { authorizeCredentials } from "./login";

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
      // rate limit ต่อ IP+อีเมล และต่ออีเมล (IP อ่านแบบตรวจรูปแบบแล้ว — ปลอม header เพื่อเลี่ยงไม่ได้)
      authorize: (credentials, req) => authorizeCredentials(credentials, req?.headers),
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
  secret: getAuthSecret(),
};
