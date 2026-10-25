import { normalizeAccountNumber, normalizeBrokerEmail } from "./validation";

/**
 * อ่านไฟล์รายงานที่ export จาก Partner Portal (XM / Exness) เป็นหลักฐานต่อบัญชีเทรด — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
 * หัวคอลัมน์ของโบรกเกอร์เปลี่ยนได้ จึงจับคอลัมน์จากชื่อ (ไทย/อังกฤษ) แทนตำแหน่ง และไม่เดาเมื่อไม่ชัด:
 * - เลขบัญชี: "MT4/MT5 ID", "Login", "Client account" ฯลฯ (ไม่ใช้ "หมายเลขลูกค้า"/"Client ID" ซึ่งเป็นรหัสลูกค้า ไม่ใช่บัญชีเทรด)
 * - ยอดฝาก: คอลัมน์ยอดฝากต่อบัญชี หรือรายการธุรกรรม (ประเภท + จำนวนเงิน) — นับเฉพาะ USD
 * ไฟล์ไม่ถูกเก็บ — เก็บเฉพาะผลสรุปใน Audit Log
 */

export interface AccountEvidence {
  /** อีเมลที่รายงานผูกกับบัญชีนี้ (ตัวพิมพ์เล็ก) — ว่าง = รายงานไม่มีอีเมล */
  emails: string[];
  /** ยอดฝาก USD ที่รายงานแสดง — null = รายงานไม่มียอดฝาก */
  depositUsd: number | null;
}

export type ReportEvidence =
  | { ok: true; accounts: Map<string, AccountEvidence>; rows: number; columns: { account: string; email: string | null; deposit: string | null } }
  | { ok: false; code: "EMPTY" | "NO_ACCOUNT_COLUMN" };

export type ClaimVerdict = "QUALIFIES" | "NOT_IN_REPORT" | "EMAIL_MISMATCH" | "DEPOSIT_UNKNOWN" | "DEPOSIT_BELOW" | "NO_MIN_DEPOSIT";

const DELIMITERS = [",", ";", "\t"] as const;

function detectDelimiter(firstLine: string): string {
  return DELIMITERS.reduce((best, candidate) => (firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best), ",");
}

/** CSV ตาม RFC 4180 (รองรับ BOM, ช่องในเครื่องหมายคำพูด, "" ในช่อง, CRLF) — ตัดแถวว่างทิ้ง */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((cells) => cells.map((value) => value.trim())).filter((cells) => cells.some((value) => value !== ""));
}

const normalizeHeader = (header: string) => header.toLowerCase().replace(/[\s_()./-]+/g, " ").trim();

const ACCOUNT_HEADERS = new Set(["mt4 mt5 id", "mt5 id", "mt4 id", "mt4 mt5", "mt5", "login", "mt5 login", "account", "account number", "account no", "trading account", "client account", "เลขบัญชี", "หมายเลขบัญชี", "เลขที่บัญชี", "บัญชีเทรด"]);
const isEmailHeader = (h: string) => /e ?mail|อีเมล/.test(h);
/** ยอดฝากต่อบัญชี — รายชื่อแน่นอน (ไม่ใช่ "deposit count/method/status/date") */
const isDepositHeader = (h: string) =>
  /^(total |first |net |sum of )?deposits?( amount| total| sum)?( usd)?$/.test(h) || /^(ยอดฝาก|เงินฝาก|ยอดเงินฝาก)(รวม|ทั้งหมด)?( usd)?$/.test(h);
const isTypeHeader = (h: string) => /^(transaction )?type$|^operation( type)?$|^ประเภทธุรกรรม$|^ประเภทรายการ$/.test(h);
const isAmountHeader = (h: string) => /^amount( usd)?$|^จำนวนเงิน$|^ยอดเงิน$/.test(h);
const isCurrencyHeader = (h: string) => /^currency$|^สกุลเงิน$/.test(h);
const isStatusHeader = (h: string) => /^(transaction )?status$|^สถานะ$/.test(h);
const DEPOSIT_TYPE = /deposit|ฝาก/i;
/** รายการที่ไม่ใช่เงินฝากจริงของลูกค้า */
const NOT_A_DEPOSIT = /revers|cancel|refund|bonus|credit|ยกเลิก|คืน|โบนัส/i;
const COMPLETED_STATUS = /^(completed?|approved|success(ful)?|done|processed|executed|สำเร็จ|อนุมัติ(แล้ว)?|เสร็จสิ้น)$/i;

/** "1,250.50" / "$100" / "100 USD" → 1250.5 / 100 / 100 — อ่านไม่ได้หรือติดลบ = null */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,\s$]|usd/gi, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** ยอดเป็น USD แน่นอนไหม — ไม่เดา: ต้องมีคอลัมน์สกุลเงินเป็น USD, หัวคอลัมน์ระบุ USD หรือค่าติด $/USD */
function isUsdAmount(raw: string, headerSaysUsd: boolean, currency: string | undefined): boolean {
  if (currency !== undefined) return /^usd$/i.test(currency.trim());
  return headerSaysUsd || /\$|usd/i.test(raw);
}

/** แถวธุรกรรมนี้เป็นเงินฝากที่สำเร็จแล้วไหม (มีคอลัมน์สถานะ = ต้องสำเร็จ) */
function isCompletedDeposit(type: string, status: string | undefined): boolean {
  if (!DEPOSIT_TYPE.test(type) || NOT_A_DEPOSIT.test(type)) return false;
  return status === undefined || COMPLETED_STATUS.test(status.trim());
}

/** แปลงตาราง CSV หนึ่งไฟล์เป็นหลักฐานต่อบัญชี */
export function extractReportEvidence(table: string[][]): ReportEvidence {
  if (table.length === 0) return { ok: false, code: "EMPTY" };
  const headers = table[0].map(normalizeHeader);
  const accountIndex = headers.findIndex((h) => ACCOUNT_HEADERS.has(h));
  if (accountIndex < 0) return { ok: false, code: "NO_ACCOUNT_COLUMN" };
  const emailIndex = headers.findIndex(isEmailHeader);
  const depositIndex = headers.findIndex(isDepositHeader);
  const typeIndex = headers.findIndex(isTypeHeader);
  const amountIndex = headers.findIndex(isAmountHeader);
  const currencyIndex = headers.findIndex(isCurrencyHeader);
  const statusIndex = headers.findIndex(isStatusHeader);
  const transactional = depositIndex < 0 && typeIndex >= 0 && amountIndex >= 0;
  const amountHeaderSaysUsd = /usd/.test(headers[depositIndex >= 0 ? depositIndex : amountIndex] ?? "");

  const accounts = new Map<string, AccountEvidence>();
  for (const cells of table.slice(1)) {
    const account = normalizeAccountNumber(cells[accountIndex] ?? "");
    if (!account) continue;
    const entry = accounts.get(account) ?? { emails: [], depositUsd: null };
    const email = emailIndex >= 0 ? normalizeBrokerEmail(cells[emailIndex] ?? "") : null;
    if (email && !entry.emails.includes(email)) entry.emails.push(email);

    const currency = currencyIndex >= 0 ? cells[currencyIndex] : undefined;
    if (depositIndex >= 0) {
      const raw = cells[depositIndex] ?? "";
      const amount = parseAmount(raw);
      if (amount !== null && isUsdAmount(raw, amountHeaderSaysUsd, currency)) entry.depositUsd = Math.max(entry.depositUsd ?? 0, amount);
    } else if (transactional && isCompletedDeposit(cells[typeIndex] ?? "", statusIndex >= 0 ? cells[statusIndex] : undefined)) {
      const raw = cells[amountIndex] ?? "";
      const amount = parseAmount(raw);
      if (amount !== null && isUsdAmount(raw, amountHeaderSaysUsd, currency)) entry.depositUsd = Math.round(((entry.depositUsd ?? 0) + amount) * 100) / 100;
    }
    accounts.set(account, entry);
  }

  const original = table[0];
  return {
    ok: true,
    accounts,
    rows: table.length - 1,
    columns: {
      account: original[accountIndex],
      email: emailIndex >= 0 ? original[emailIndex] : null,
      deposit: depositIndex >= 0 ? original[depositIndex] : transactional ? `${original[typeIndex]} + ${original[amountIndex]}` : null,
    },
  };
}

/** รวมหลายไฟล์ของโบรกเกอร์เดียวกัน — อีเมลรวมกัน, ยอดฝากใช้ค่าสูงสุดที่พบ (ไฟล์ซ้ำ/รายงานคนละแบบไม่ถูกนับซ้ำ) */
export function mergeReportEvidence(files: Extract<ReportEvidence, { ok: true }>[]): Map<string, AccountEvidence> {
  const merged = new Map<string, AccountEvidence>();
  for (const file of files) {
    for (const [account, evidence] of file.accounts) {
      const entry = merged.get(account) ?? { emails: [], depositUsd: null };
      for (const email of evidence.emails) if (!entry.emails.includes(email)) entry.emails.push(email);
      if (evidence.depositUsd !== null) entry.depositUsd = Math.max(entry.depositUsd ?? 0, evidence.depositUsd);
      merged.set(account, entry);
    }
  }
  return merged;
}

/**
 * คำขอนี้ผ่านเงื่อนไขอนุมัติอัตโนมัติไหม (นโยบายเจ้าของ 25 ต.ค. 2026):
 * - บัญชีต้องอยู่ในรายงานของโบรกเกอร์นั้น (อยู่ใต้ IB ของเรา)
 * - รายงานมีอีเมล → ต้องตรงกับที่สมาชิกกรอก / ไม่มีอีเมล → ข้ามการตรวจอีเมล
 * - ต้องเห็นยอดฝาก USD ถึงขั้นต่ำที่บันทึกไว้ตอนยื่น (เปิดใช้งานแล้วแต่ไม่รู้ยอด = ให้แอดมินตรวจเอง)
 */
export function evaluateClaimAgainstReport(
  claim: { accountNumber: string; registeredEmail: string; minDepositUsd: number | null },
  evidence: Map<string, AccountEvidence>,
): { verdict: ClaimVerdict; depositUsd: number | null; emailChecked: boolean } {
  const found = evidence.get(claim.accountNumber);
  if (!found) return { verdict: "NOT_IN_REPORT", depositUsd: null, emailChecked: false };
  const emailChecked = found.emails.length > 0;
  if (emailChecked && !found.emails.includes(claim.registeredEmail.toLowerCase())) {
    return { verdict: "EMAIL_MISMATCH", depositUsd: found.depositUsd, emailChecked };
  }
  if (claim.minDepositUsd === null) return { verdict: "NO_MIN_DEPOSIT", depositUsd: found.depositUsd, emailChecked };
  if (found.depositUsd === null) return { verdict: "DEPOSIT_UNKNOWN", depositUsd: null, emailChecked };
  if (found.depositUsd < claim.minDepositUsd) return { verdict: "DEPOSIT_BELOW", depositUsd: found.depositUsd, emailChecked };
  return { verdict: "QUALIFIES", depositUsd: found.depositUsd, emailChecked };
}
