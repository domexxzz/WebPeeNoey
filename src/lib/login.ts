import type { User } from "next-auth";
import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./security";
import { checkRateLimit, resetRateLimit } from "./rate-limit";
import { rateLimitIp, type HeaderSource } from "./request";
import { sendAdminTelegram } from "./notify/telegram";

const WINDOW_SECONDS = 15 * 60;
/** ต่อ IP + อีเมล — ผู้ใช้จริงที่พิมพ์ผิดถูกล็อกเฉพาะเครื่องตัวเอง */
const PER_IP_AND_EMAIL = 5;
/** ต่ออีเมล ไม่สน IP — กันการเดารหัสผ่านโดยสลับ IP/ปลอม header (สูงกว่าต่อ IP เพื่อลดผลจากการกลั่นแกล้งล็อกบัญชีคนอื่น) */
const PER_EMAIL = 10;
/** ความยาวอีเมลสูงสุดตามมาตรฐาน — ยาวกว่านี้ไม่ใช่บัญชีจริง และไม่ควรกลายเป็น key ของ rate limit */
const EMAIL_MAX_LENGTH = 254;
const INVALID_CREDENTIALS = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

let dummyHash: Promise<string> | null = null;
/** ตรวจรหัสกับ hash หลอกเมื่อไม่พบผู้ใช้ — ให้เวลาตอบเท่ากัน จึงเดาไม่ได้ว่าอีเมลไหนมีบัญชี */
function timingSafeDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("timing-equalizer-not-a-real-password");
  return dummyHash;
}

function tooManyAttempts(resetAt: Date): never {
  const waitMinutes = Math.ceil((resetAt.getTime() - Date.now()) / (60 * 1000));
  throw new Error(`พยายามเข้าสู่ระบบมากเกินไป กรุณารออีก ${waitMinutes} นาที`);
}

/**
 * ตรวจอีเมล/รหัสผ่าน (NextAuth Credentials) พร้อม rate limit สองชั้น — ข้อผิดพลาดแสดงในหน้า signin
 * นับก่อนตรวจรหัสแบบ atomic (ยิงพร้อมกันก็ไม่หลุดเกิน limit) และล้างตัวนับเมื่อเข้าสู่ระบบสำเร็จ
 * ข้อจำกัดที่ยอมรับ: ผู้ไม่หวังดีที่รู้อีเมลทำให้บัญชีนั้นล็อกอินไม่ได้ชั่วคราว 15 นาทีได้ — บัญชีแอดมินจะแจ้งเตือนกลุ่มแอดมินทันที
 */
export async function authorizeCredentials(
  credentials: Record<"email" | "password", string> | undefined,
  requestHeaders: HeaderSource | undefined,
): Promise<User> {
  if (!credentials?.email || !credentials?.password) {
    throw new Error("กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน");
  }
  const email = credentials.email.trim().toLowerCase();
  if (email.length > EMAIL_MAX_LENGTH) throw new Error(INVALID_CREDENTIALS);
  const ipKey = `login:${rateLimitIp(requestHeaders ?? {})}:${email}`;
  const emailKey = `login-email:${email}`;

  const perIp = await checkRateLimit(ipKey, PER_IP_AND_EMAIL, WINDOW_SECONDS);
  if (!perIp.success) tooManyAttempts(perIp.resetAt);
  const perEmail = await checkRateLimit(emailKey, PER_EMAIL, WINDOW_SECONDS);
  if (!perEmail.success) tooManyAttempts(perEmail.resetAt);

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = await verifyPassword(credentials.password, user?.passwordHash ?? (await timingSafeDummyHash()));
  if (!user?.passwordHash || !passwordMatches) {
    // ครั้งที่ทำให้ครบ limit พอดี (เกิดครั้งเดียวต่อรอบ 15 นาที) — บัญชีแอดมินถูกล็อก = ตรวจสลิป/อนุมัติไม่ได้ ต้องรู้ทันที
    if (user?.role === "ADMIN" && perEmail.remaining === 0) {
      await sendAdminTelegram(`🔒 บัญชีแอดมิน ${email.slice(0, 2)}***@${email.split("@")[1] ?? ""} ใส่รหัสผิดครบ ${PER_EMAIL} ครั้งใน 15 นาที — ถูกล็อกชั่วคราว อาจมีคนพยายามเดารหัสผ่าน`);
    }
    throw new Error(INVALID_CREDENTIALS);
  }

  // เข้าสู่ระบบสำเร็จ: ล้างตัวนับทั้งสองชั้นของบัญชีนี้
  await Promise.all([resetRateLimit(ipKey), resetRateLimit(emailKey)]);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
    tradingViewUsername: user.tradingViewUsername,
  };
}
