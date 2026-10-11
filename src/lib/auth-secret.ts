const MIN_SECRET_LENGTH = 32;
// ใช้ได้เฉพาะตอนพัฒนา/ทดสอบบนเครื่อง — production ต้องตั้ง NEXTAUTH_SECRET เสมอ
const DEVELOPMENT_ONLY_SECRET = "local-development-only-secret-not-for-production";

/**
 * คืน secret สำหรับเซ็น JWT ของ NextAuth
 * production: ต้องตั้ง NEXTAUTH_SECRET ยาวอย่างน้อย 32 ตัว ไม่งั้นหยุดทันที (กันการปลอม token แอดมิน)
 * ใช้ได้ทั้ง Edge (middleware) และ Node
 */
export function resolveAuthSecret(env: { NODE_ENV?: string; NEXTAUTH_SECRET?: string }): string {
  const secret = env.NEXTAUTH_SECRET?.trim();
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  if (env.NODE_ENV === "production") {
    throw new Error(`NEXTAUTH_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters in production`);
  }
  return secret || DEVELOPMENT_ONLY_SECRET;
}

export function getAuthSecret(): string {
  return resolveAuthSecret({ NODE_ENV: process.env.NODE_ENV, NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET });
}
