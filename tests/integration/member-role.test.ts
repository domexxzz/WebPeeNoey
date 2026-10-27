import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { seedDatabase } from "@/lib/db/seed";
import { setMemberRole } from "@/lib/admin/members";
import { createTestPrisma, resetDatabase } from "./helpers";

const prisma = createTestPrisma();
const NOW = new Date("2026-10-27T03:00:00Z");

let adminId: string;
const actor = (id = adminId) => ({ id, ipAddress: "203.0.113.11" });

async function member(role: "USER" | "ADMIN" = "USER") {
  return prisma.user.create({
    data: { email: `m-${randomBytes(4).toString("hex")}@example.com`, role, passwordHash: "x" },
  });
}

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedDatabase(prisma, { adminEmail: "admin@example.com", adminPassword: "seed-password-123" });
  adminId = (await prisma.user.findUniqueOrThrow({ where: { email: "admin@example.com" } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integration: change a member's role", () => {
  it("promotes a member to admin and records who did it, from where, and the before/after", async () => {
    const user = await member();

    const result = await setMemberRole(prisma, { userId: user.id, actor: actor(), role: "ADMIN", reason: "รับเข้าทีมงาน", now: NOW });

    expect(result).toMatchObject({ ok: true, email: user.email, actorEmail: "admin@example.com", before: "USER", after: "ADMIN" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ role: "ADMIN" });

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "MEMBER_ROLE_CHANGE", targetId: user.id } });
    expect(audit).toMatchObject({ actorId: adminId, targetType: "User", ipAddress: "203.0.113.11" });
    expect(audit.details).toMatchObject({ email: user.email, reason: "รับเข้าทีมงาน", before: { role: "USER" }, after: { role: "ADMIN" } });
  });

  it("demotes an admin back to a plain member", async () => {
    const other = await member("ADMIN");

    expect(await setMemberRole(prisma, { userId: other.id, actor: actor(), role: "USER", reason: "ออกจากทีมแล้ว", now: NOW })).toMatchObject({
      ok: true,
      before: "ADMIN",
      after: "USER",
    });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).toMatchObject({ role: "USER" });
  });

  /**
   * กันล็อกตัวเองออกจากระบบ: ถ้าลดสิทธิ์แอดมินคนสุดท้ายได้ จะไม่เหลือใครเข้าหลังบ้านได้อีกเลย
   * ด่านที่กันไว้มีสามชั้น และที่นี่พิสูจน์ว่าเมื่อเหลือแอดมินคนเดียว ไม่มีทางไหนลดเขาลงได้
   */
  it("cannot reach zero admins when only one admin is left", async () => {
    expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
    const second = await member("ADMIN");

    // ยังมีแอดมินสองคน จึงลดคนหนึ่งได้
    expect(await setMemberRole(prisma, { userId: second.id, actor: actor(), role: "USER", reason: "ลาออก", now: NOW })).toMatchObject({ ok: true });

    // เหลือคนเดียวแล้ว: ตัวเขาเองก็ลดตัวเองไม่ได้ และคนที่ไม่ใช่แอดมินก็สั่งแทนไม่ได้
    expect(await setMemberRole(prisma, { userId: adminId, actor: actor(), role: "USER", reason: "ลองลดคนสุดท้าย", now: NOW })).toEqual({
      ok: false,
      code: "SELF_ROLE_CHANGE",
    });
    expect(await setMemberRole(prisma, { userId: adminId, actor: actor(second.id), role: "USER", reason: "ลองลดคนสุดท้าย", now: NOW })).toEqual({
      ok: false,
      code: "ACTOR_NOT_ADMIN",
    });
    expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
  });

  /**
   * ช่องโหว่ที่ปิดไว้: แอดมินผ่านด่านตรวจสิทธิ์ตอนเข้า action แล้วถูกลดสิทธิ์ระหว่างนั้น
   * ถ้าไม่ตรวจซ้ำใต้ล็อก เขายังเลื่อนขั้นพวกพ้องได้อยู่ (ทางลดสิทธิ์มีการนับแอดมินกันไว้ แต่ทางเลื่อนขั้นไม่มี)
   */
  it("refuses an actor whose admin rights were revoked before the write", async () => {
    const demoted = await member("USER");
    const accomplice = await member();

    expect(await setMemberRole(prisma, { userId: accomplice.id, actor: actor(demoted.id), role: "ADMIN", reason: "เลื่อนพวกพ้อง", now: NOW })).toEqual({
      ok: false,
      code: "ACTOR_NOT_ADMIN",
    });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: accomplice.id } })).toMatchObject({ role: "USER" });
  });

  /**
   * เหตุผลจริงที่ต้องมีทั้งล็อกและการนับ: แอดมินสองคนกดลดสิทธิ์กันและกันพร้อมกัน
   * ถ้าต่างคนต่างอ่านจำนวนแอดมินก่อนอีกฝ่ายเขียน จะผ่านทั้งคู่แล้วเหลือศูนย์คน
   */
  it("keeps at least one admin when two admins demote each other at the same time", async () => {
    const a = await member("ADMIN");
    const b = await member("ADMIN");
    await prisma.user.update({ where: { id: adminId }, data: { role: "USER" } });

    const [first, second] = await Promise.all([
      setMemberRole(prisma, { userId: b.id, actor: actor(a.id), role: "USER", reason: "ลดพร้อมกัน", now: NOW }),
      setMemberRole(prisma, { userId: a.id, actor: actor(b.id), role: "USER", reason: "ลดพร้อมกัน", now: NOW }),
    ]);

    // คนที่สองจะถูกปัดด้วย ACTOR_NOT_ADMIN หรือ LAST_ADMIN ก็ได้ ขอแค่สำเร็จคนเดียว
    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
  });

  /** แอดมินเปลี่ยนสิทธิ์ตัวเองไม่ได้ — กันทั้งการลดตัวเองพลาด และการที่คนเดียวเลื่อนขั้นตัวเองเงียบ ๆ */
  it("refuses to change your own role", async () => {
    expect(await setMemberRole(prisma, { userId: adminId, actor: actor(), role: "USER", reason: "ลองลดตัวเอง", now: NOW })).toEqual({
      ok: false,
      code: "SELF_ROLE_CHANGE",
    });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).toMatchObject({ role: "ADMIN" });
  });

  it("refuses an empty reason and a role the member already has", async () => {
    const user = await member();

    expect(await setMemberRole(prisma, { userId: user.id, actor: actor(), role: "ADMIN", reason: " ", now: NOW })).toEqual({ ok: false, code: "REASON_REQUIRED" });
    expect(await setMemberRole(prisma, { userId: user.id, actor: actor(), role: "USER", reason: "ไม่เปลี่ยนอะไร", now: NOW })).toEqual({
      ok: false,
      code: "ALREADY_THAT_ROLE",
    });
    expect(await prisma.auditLog.count({ where: { action: "MEMBER_ROLE_CHANGE" } })).toBe(0);
  });

  it("refuses a member that does not exist", async () => {
    expect(await setMemberRole(prisma, { userId: "does-not-exist", actor: actor(), role: "ADMIN", reason: "ลอง", now: NOW })).toEqual({
      ok: false,
      code: "MEMBER_NOT_FOUND",
    });
  });
});
