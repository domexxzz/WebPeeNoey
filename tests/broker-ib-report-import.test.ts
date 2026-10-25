import { describe, expect, it } from "vitest";
import {
  evaluateClaimAgainstReport,
  extractReportEvidence,
  mergeReportEvidence,
  parseCsv,
} from "@/lib/broker-ib/report-import";

const XM_TRADER_LIST = [
  "﻿หมายเลขลูกค้า,MT4/MT5 ID,แพลตฟอร์มซื้อขาย,ประเภทบัญชี,เวลาที่เริ่มสมัคร (EET),ได้รับการยืนยันเรียบร้อยแล้ว,เวลาที่เปิดใช้งาน (EET),ประเทศ",
  '2496806,322163030,MT5,"Ultra Low Standard - USD",20/07/2026 23:25:45,Yes,27/07/2026 08:26:32,Thailand',
  "2496806,411120876,MT5,Standard - USD,17/07/2026 17:54:07,Yes,,Thailand",
].join("\r\n");

const EXNESS_ACCOUNTS = ["Client account;Client ID;Platform;Email;Deposits (USD)", "81234567;148c5a76;MT5;Trader@Example.com;\"1,250.50\"", "81234999;b8244c79;MT5;;40"].join("\n");

const XM_DEPOSITS = ["Login,Transaction type,Amount,Currency", "322163030,Deposit,60,USD", "322163030,Deposit,50,USD", "322163030,Withdrawal,500,USD", "411120876,Deposit,5000,THB"].join("\n");

describe("CSV parsing of broker report exports", () => {
  it("handles a UTF-8 BOM, quoted commas, CRLF line endings and blank lines", () => {
    expect(parseCsv('﻿a,b\r\n"x, y",2\r\n\r\n')).toEqual([
      ["a", "b"],
      ["x, y", "2"],
    ]);
  });

  it("detects semicolon and tab delimiters", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("keeps escaped quotes inside quoted fields", () => {
    expect(parseCsv('a\n"say ""hi"""')).toEqual([["a"], ['say "hi"']]);
  });
});

describe("Reading accounts, emails and deposits from report exports", () => {
  it("reads MT5 numbers from the XM trader list and never mistakes the client number for an account", () => {
    const evidence = extractReportEvidence(parseCsv(XM_TRADER_LIST));
    expect(evidence.ok).toBe(true);
    if (!evidence.ok) return;
    expect([...evidence.accounts.keys()].sort()).toEqual(["322163030", "411120876"]);
    expect(evidence.accounts.has("2496806")).toBe(false);
    expect(evidence.accounts.get("322163030")).toEqual({ emails: [], depositUsd: null });
    expect(evidence.columns).toMatchObject({ account: "MT4/MT5 ID", email: null, deposit: null });
  });

  it("reads emails (lower-cased) and per-account deposit totals from an Exness accounts export", () => {
    const evidence = extractReportEvidence(parseCsv(EXNESS_ACCOUNTS));
    if (!evidence.ok) throw new Error(evidence.code);
    expect(evidence.accounts.get("81234567")).toEqual({ emails: ["trader@example.com"], depositUsd: 1250.5 });
    expect(evidence.accounts.get("81234999")).toEqual({ emails: [], depositUsd: 40 });
  });

  it("sums only USD deposit transactions per account and ignores withdrawals and other currencies", () => {
    const evidence = extractReportEvidence(parseCsv(XM_DEPOSITS));
    if (!evidence.ok) throw new Error(evidence.code);
    expect(evidence.accounts.get("322163030")?.depositUsd).toBe(110);
    expect(evidence.accounts.get("411120876")?.depositUsd).toBeNull();
  });

  it("counts only completed deposits — not pending, rejected, reversed or bonus rows", () => {
    const table = parseCsv(
      [
        "Login,Type,Amount,Currency,Status",
        "322163030,Deposit,60,USD,Completed",
        "322163030,Deposit,500,USD,Rejected",
        "322163030,Deposit,500,USD,Pending",
        "322163030,Deposit reversal,60,USD,Completed",
        "322163030,Deposit bonus,300,USD,Completed",
      ].join("\n"),
    );
    const evidence = extractReportEvidence(table);
    if (!evidence.ok) throw new Error(evidence.code);
    expect(evidence.accounts.get("322163030")?.depositUsd).toBe(60);
  });

  it("does not assume USD: amounts with no currency column or USD label are treated as unknown", () => {
    const evidence = extractReportEvidence(parseCsv("Login,Deposit\n322163030,5000"));
    if (!evidence.ok) throw new Error(evidence.code);
    expect(evidence.accounts.get("322163030")?.depositUsd).toBeNull();
    const labelled = extractReportEvidence(parseCsv("Login,Deposit\n322163030,$150"));
    if (!labelled.ok) throw new Error(labelled.code);
    expect(labelled.accounts.get("322163030")?.depositUsd).toBe(150);
  });

  it("never reads a deposit count, date, method or status column as a dollar amount", () => {
    const evidence = extractReportEvidence(parseCsv("Login,Deposit count,Deposit method,First deposit date,Currency\n322163030,7,Card,2026-10-01,USD"));
    if (!evidence.ok) throw new Error(evidence.code);
    expect(evidence.columns.deposit).toBeNull();
    expect(evidence.accounts.get("322163030")?.depositUsd).toBeNull();
  });

  it("rejects a file without a recognisable account-number column", () => {
    expect(extractReportEvidence(parseCsv("Client ID,Status\nabc,Active"))).toEqual({ ok: false, code: "NO_ACCOUNT_COLUMN" });
    expect(extractReportEvidence([])).toEqual({ ok: false, code: "EMPTY" });
  });

  it("merges several files: union of emails, highest deposit seen (never double-counted across files)", () => {
    const list = extractReportEvidence(parseCsv(XM_TRADER_LIST));
    const deposits = extractReportEvidence(parseCsv(XM_DEPOSITS));
    if (!list.ok || !deposits.ok) throw new Error("parse failed");
    const merged = mergeReportEvidence([list, deposits, deposits]);
    expect(merged.get("322163030")).toEqual({ emails: [], depositUsd: 110 });
    expect(merged.get("411120876")).toEqual({ emails: [], depositUsd: null });
  });
});

describe("Deciding whether a pending IB claim qualifies from report evidence", () => {
  const claim = { accountNumber: "81234567", registeredEmail: "trader@example.com", minDepositUsd: 100 };

  it("qualifies when the account is in the report, the email matches and the deposit reaches the minimum", () => {
    const evidence = new Map([["81234567", { emails: ["trader@example.com"], depositUsd: 100 }]]);
    expect(evaluateClaimAgainstReport(claim, evidence)).toEqual({ verdict: "QUALIFIES", depositUsd: 100, emailChecked: true });
  });

  it("skips the email check when the report has no email for the account (owner's policy)", () => {
    const evidence = new Map([["81234567", { emails: [], depositUsd: 150 }]]);
    expect(evaluateClaimAgainstReport(claim, evidence)).toEqual({ verdict: "QUALIFIES", depositUsd: 150, emailChecked: false });
  });

  it("rejects a mismatched email when the report has one", () => {
    const evidence = new Map([["81234567", { emails: ["someone@else.com"], depositUsd: 500 }]]);
    expect(evaluateClaimAgainstReport(claim, evidence).verdict).toBe("EMAIL_MISMATCH");
  });

  it("leaves the claim for manual review when the account is missing, the amount is unknown or below the minimum", () => {
    expect(evaluateClaimAgainstReport(claim, new Map()).verdict).toBe("NOT_IN_REPORT");
    expect(evaluateClaimAgainstReport(claim, new Map([["81234567", { emails: [], depositUsd: null }]])).verdict).toBe("DEPOSIT_UNKNOWN");
    // ผ่อนผัน 5%: 99.99 ยังผ่าน แต่ต่ำกว่านั้นมากไม่ผ่าน
    expect(evaluateClaimAgainstReport(claim, new Map([["81234567", { emails: [], depositUsd: 99.99 }]])).verdict).toBe("QUALIFIES");
    expect(evaluateClaimAgainstReport(claim, new Map([["81234567", { emails: [], depositUsd: 94.9 }]])).verdict).toBe("DEPOSIT_BELOW");
  });

  it("never auto-approves a claim submitted without a minimum deposit", () => {
    const evidence = new Map([["81234567", { emails: [], depositUsd: 1000 }]]);
    expect(evaluateClaimAgainstReport({ ...claim, minDepositUsd: null }, evidence).verdict).toBe("NO_MIN_DEPOSIT");
  });
});
