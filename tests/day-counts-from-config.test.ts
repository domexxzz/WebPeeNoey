import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * จำนวนวันที่บอกลูกค้าต้องมาจาก config เสมอ ห้ามพิมพ์ตัวเลขลงในข้อความ
 *
 * ที่มา: เปลี่ยนสิทธิ์ IB จาก 30 วันเป็น 7 วัน แล้วพบว่าหน้าเว็บยังโฆษณา 30 วัน
 * และยังบอกว่ายื่นต่อได้ใน 7 วันก่อนหมดอายุทั้งที่เหลือ 2 วัน — ตัวเลขกระจายอยู่ 9 ไฟล์
 * ลูกค้าจ่ายเงินตามสิ่งที่อ่าน ตัวเลขที่ไม่ตรงกับระบบจึงเป็นการโฆษณาเกินจริง (CLAUDE.md ข้อ 3)
 */

const SRC = path.resolve(__dirname, "../src");

/** ตัวเลขที่เป็นค่าคงที่จริงของมันเอง ไม่ได้ผูกกับนโยบายที่เจ้าของเปลี่ยนได้ */
const ALLOWED = new Map<string, string>([
  ["src/config", "ไฟล์ config คือที่ที่ตัวเลขควรอยู่"],
  ["src/content/legal.ts", "30 วัน = กรอบเวลาตอบคำขอใช้สิทธิ์ตาม PDPA ไม่ใช่ค่านโยบายของเรา"],
  ["src/lib/auth.ts", "อายุ session"],
  ["src/lib/admin/page-guard.ts", "อายุ session"],
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("จำนวนวันในข้อความ", () => {
  it("never hard-codes a day count outside config", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const relative = path.relative(path.resolve(__dirname, ".."), file).replace(/\\/g, "/");
      if ([...ALLOWED.keys()].some((prefix) => relative.startsWith(prefix))) continue;

      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          for (const match of line.matchAll(/(?<!\$\{[^}]{0,80})(\d+)\s*วัน/g)) {
            offenders.push(`${relative}:${index + 1} → "${match[0]}"`);
          }
        });
    }

    expect(offenders, `พิมพ์จำนวนวันไว้ตายตัว ให้ดึงจาก config แทน:\n${offenders.join("\n")}`).toEqual([]);
  });
});
