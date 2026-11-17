import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * เจ้าของยืนยันเมื่อ 17 พ.ย. 2569 ว่า **ไม่มีกลุ่ม Telegram VIP แล้ว** คอมมูนิตี้คือ Discord เท่านั้น
 * ข้อความเก่าที่โฆษณาว่าแพ็กเกจได้สิทธิ์เข้ากลุ่ม Telegram VIP จึงเป็นการขายสิทธิ์ที่ไม่มีอยู่จริง
 * (CLAUDE.md ข้อ 3 และ พ.ร.บ. คุ้มครองผู้บริโภค) เทสต์นี้กันไม่ให้ข้อความแบบนั้นกลับมาอีก
 *
 * บอท Telegram สำหรับเตือนก่อนสิทธิ์หมดอายุยังใช้อยู่ตามปกติ คำว่า Telegram เฉย ๆ จึงไม่ผิด
 * ที่ห้ามคือการพูดถึง "กลุ่ม/ห้อง Telegram" หรือ "Telegram VIP" ในฐานะสิทธิ์ของสมาชิก
 */
const ROOT = path.resolve(__dirname, "..");
const SCANNED = ["src/config", "src/content", "src/components", "src/app"];
const BANNED = /Telegram VIP|กลุ่ม Telegram|ห้อง Telegram/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

describe("no page may sell a Telegram VIP group that does not exist", () => {
  it("keeps the claim out of every source file customers can reach", () => {
    const offenders = SCANNED.flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
      .filter((file) => BANNED.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(ROOT, file));

    expect(offenders).toEqual([]);
  });
});
