import { isIP } from "node:net";
import { headers } from "next/headers";

/** key ของ rate limit เมื่ออ่าน IP ไม่ได้ — ค่าปลอม/ไม่ถูกรูปแบบทั้งหมดใช้ถังเดียวกัน (สลับค่าเพื่อเลี่ยง limit ไม่ได้) */
export const UNKNOWN_IP = "unknown-ip";

/** ตรวจรูปแบบ IP ด้วยตัวตรวจของ Node (IPv4 ห้ามเลขศูนย์นำหน้า, ไม่รับ zone id เช่น %eth0) */
export function isValidIp(value: string): boolean {
  return value.length <= 45 && !value.includes("%") && isIP(value) !== 0;
}

/** IPv6 → 8 กลุ่มเต็ม 4 หลัก (รองรับ :: และ IPv4 ต่อท้าย เช่น ::ffff:1.2.3.4) */
function expandIPv6(ip: string): string[] {
  let address = ip.toLowerCase();
  const tailV4 = address.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (tailV4) {
    const [a, b, c, d] = tailV4.slice(1).map(Number);
    address = `${address.slice(0, -tailV4[0].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = address.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const zeros = tail === undefined ? [] : Array<string>(8 - headGroups.length - tailGroups.length).fill("0");
  return [...headGroups, ...zeros, ...tailGroups].map((group) => group.padStart(4, "0"));
}

/** IP ที่ใช้เป็น key ของ rate limit: IPv4 ตามเดิม, IPv4-mapped → IPv4, IPv6 → เครือข่าย /64 (ผู้ใช้หนึ่งรายได้ทั้ง /64 จึงสลับที่อยู่เลี่ยงไม่ได้) */
function rateLimitBucket(ip: string): string {
  if (isIP(ip) === 4) return ip;
  const groups = expandIPv6(ip);
  if (groups.slice(0, 5).every((group) => group === "0000") && groups[5] === "ffff") {
    const [high, low] = [parseInt(groups[6], 16), parseInt(groups[7], 16)];
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
  }
  return `${groups.slice(0, 4).join(":")}::/64`;
}

/** header ได้ทั้งแบบ Web Headers (Route Handler) และ object ธรรมดา (req.headers ของ NextAuth) */
export type HeaderSource = { get(name: string): string | null } | Record<string, string | string[] | undefined>;

function readHeader(source: HeaderSource, name: string): string | undefined {
  if (typeof source.get === "function") return (source as { get(name: string): string | null }).get(name) ?? undefined;
  const value = (source as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(value) ? value[0] : value;
}

/** ตัวแปรที่บอกว่ารันอยู่บนโฮสต์ไหน (Render ตั้ง RENDER=true ให้เองทั้งตอน build และตอนรัน) */
export type HostEnv = { RENDER?: string };

/**
 * header ที่ proxy ของโฮสต์เขียนทับเอง ผู้ใช้ปลอมไม่ได้ — ตามลำดับที่เชื่อถือ
 * - Vercel: x-real-ip และ x-forwarded-for (แพลตฟอร์มเขียนทับทั้งคู่)
 * - Render: อยู่หลัง Cloudflare ซึ่งเขียนทับ cf-connecting-ip ทุกคำขอ แต่ Render แค่ต่อท้าย x-forwarded-for
 *   และไม่ได้ตั้ง x-real-ip → สองตัวนั้นผู้ใช้ส่งมาเองได้ ห้ามใช้ (ห้าม proxy โดเมนเองผ่าน Cloudflare ซ้อนอีกชั้น)
 */
function trustedIpCandidates(source: HeaderSource, env: HostEnv): (string | undefined)[] {
  if (env.RENDER === "true") return [readHeader(source, "cf-connecting-ip")];
  return [readHeader(source, "x-real-ip"), readHeader(source, "x-forwarded-for")?.split(",")[0]];
}

/** IP ของผู้ใช้จาก header ที่โฮสต์รับรอง — ค่าที่ไม่ใช่ IP ถูกทิ้ง */
export function clientIpFromHeaders(source: HeaderSource, env: HostEnv = { RENDER: process.env.RENDER }): string | undefined {
  return trustedIpCandidates(source, env)
    .map((value) => value?.trim() ?? "")
    .find((value) => value && isValidIp(value));
}

/** IP สำหรับใช้เป็น key ของ rate limit (ไม่มีวันว่าง) */
export function rateLimitIp(source: HeaderSource, env: HostEnv = { RENDER: process.env.RENDER }): string {
  const ip = clientIpFromHeaders(source, env);
  return ip ? rateLimitBucket(ip) : UNKNOWN_IP;
}

/** IP ของคำขอปัจจุบัน (Server Action / Server Component) — Next.js 15: headers() เป็น async */
export async function getClientIp(): Promise<string | undefined> {
  return clientIpFromHeaders(await headers());
}
