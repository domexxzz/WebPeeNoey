import QRCode from "qrcode";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { checkQrIntegrity, crc16ccitt, extractQrReference } from "@/lib/payments/slip-qr-payload";
import { readSlipQr } from "@/lib/payments/slip-qr";
import { accountRefMatches, isSlipFresh, receiverMatches, receiverNameMatches, SLIP_BACKDATE_GRACE_MS } from "@/lib/payments/slip-receiver";
import { checkSlipWithEasySlip, classifyEasySlipFailure, EASYSLIP_VERIFY_URL, evaluateVerifiedSlip } from "@/lib/payments/easyslip";
import { resolveSlipCheckConfig } from "@/config/slip-check";

const TRANS_REF = "2026102412345ABCDEFGH";
/** payload แบบสลิปโอน: TLV + ช่อง 91 ปิดท้ายด้วย CRC */
function slipPayload(reference = TRANS_REF): string {
  const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, "0")}${value}`;
  const body = `${tlv("00", "000001")}${tlv("01", "004")}${tlv("02", reference)}${tlv("51", "TH")}9104`;
  return `${body}${crc16ccitt(body)}`;
}

async function qrPng(payload: string, options: { negate?: boolean; margin?: number } = {}): Promise<Uint8Array> {
  const png = await QRCode.toBuffer(payload, { width: 320, margin: options.margin ?? 4 });
  return new Uint8Array(options.negate ? await sharp(png).negate({ alpha: false }).png().toBuffer() : png);
}

describe("slip QR payload", () => {
  it("computes CRC16-CCITT (FALSE) like EMVCo", () => {
    expect(crc16ccitt("123456789")).toBe("29B1");
  });

  it("tells a valid checksum from a tampered one and from slips without one", () => {
    const payload = slipPayload();
    expect(checkQrIntegrity(payload)).toBe("VALID");
    expect(checkQrIntegrity(payload.replace(TRANS_REF, TRANS_REF.replace("1", "2")))).toBe("INVALID");
    expect(checkQrIntegrity("0006000001ABCDEF")).toBe("ABSENT");
    expect(checkQrIntegrity(undefined)).toBe("ABSENT");
  });

  it("extracts the transaction reference for display and leaves unparseable payloads alone", () => {
    expect(extractQrReference(slipPayload())).toBe(TRANS_REF);
    expect(extractQrReference("not a tlv payload!")).toBeUndefined();
    expect(extractQrReference("0099abc")).toBeUndefined();
  });
});

describe("readSlipQr", () => {
  it("reads the QR payload, reference and checksum from a slip image", async () => {
    const result = await readSlipQr(await qrPng(slipPayload()));
    expect(result).toMatchObject({ found: true, payload: slipPayload(), reference: TRANS_REF, integrity: "VALID" });
  });

  it("reads a dark-mode (inverted) capture", async () => {
    const result = await readSlipQr(await qrPng(slipPayload(), { negate: true }));
    expect(result).toMatchObject({ found: true, payload: slipPayload() });
  });

  it("refuses tall, thin images instead of upscaling them into gigabytes", async () => {
    const sliver = await sharp({ create: { width: 10, height: 1600, channels: 3, background: "#ffffff" } }).png().toBuffer();
    expect(await readSlipQr(new Uint8Array(sliver))).toEqual({ found: false });
  });

  it("stops within its time budget on a noisy photo with no QR", async () => {
    const noise = await sharp(Buffer.from(Array.from({ length: 1080 * 1920 * 3 }, () => Math.floor(Math.random() * 256))), {
      raw: { width: 1080, height: 1920, channels: 3 },
    })
      .png()
      .toBuffer();
    const started = Date.now();
    expect(await readSlipQr(new Uint8Array(noise))).toEqual({ found: false });
    expect(Date.now() - started).toBeLessThan(6_000);
  }, 15_000);

  it("gives up immediately when the time budget is already spent", async () => {
    expect(await readSlipQr(await qrPng(slipPayload()), { timeBudgetMs: 0 })).toEqual({ found: false });
  });

  it("returns not found for images without a QR and never throws on garbage", async () => {
    const blank = await sharp({ create: { width: 200, height: 300, channels: 3, background: "#ffffff" } }).png().toBuffer();
    expect(await readSlipQr(new Uint8Array(blank))).toEqual({ found: false });
    expect(await readSlipQr(new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01]))).toEqual({ found: false });
    expect(await readSlipQr(new Uint8Array())).toEqual({ found: false });
  });
});

describe("receiver and freshness checks", () => {
  it("matches masked account numbers right-aligned and needs at least 4 real digits", () => {
    expect(accountRefMatches("123-4-51234-5", "xxx-x-x1234-5")).toBe(true);
    expect(accountRefMatches("xxx-x-x1234-x", "xxx-x-x1234-x")).toBe(true);
    expect(accountRefMatches("0812345678", "xxx-xxx-5678")).toBe(true);
    expect(accountRefMatches("123-4-51234-5", "xxx-x-x9999-5")).toBe(false);
    expect(accountRefMatches("xxx-x-xx234-x", "xxx-x-xx234-x")).toBe(false);
    expect(receiverMatches(["0812345678", "xxx-x-x1234-x"], [undefined, "xxx-x-x1234-x"])).toBe(true);
    expect(receiverMatches([], ["xxx-x-x1234-x"])).toBe(false);
  });

  it("compares receiver names, tolerating titles and a shortened surname", () => {
    expect(receiverNameMatches("นาย จักรพงษ์ ม", "นาย จักรพงษ์ มูลวิชา")).toBe("MATCH");
    expect(receiverNameMatches("จักรพงษ์ มูลวิชา", "นาย จักรพงษ์ มูลวิชา")).toBe("MATCH");
    expect(receiverNameMatches("น.ส.สมใจ ร", "นางสาว สมใจ รักดี")).toBe("MATCH");
    expect(receiverNameMatches("MR. CHAKRAPHONG M", "Mr Chakraphong Moonwicha")).toBe("MATCH");
    expect(receiverNameMatches("นาย สมชาย ม", "นาย จักรพงษ์ มูลวิชา")).toBe("MISMATCH");
    expect(receiverNameMatches("นาย จักรพงษ์ ก", "นาย จักรพงษ์ มูลวิชา")).toBe("MISMATCH");
    // "นาย" ที่เป็นส่วนหนึ่งของชื่อ ไม่ใช่คำนำหน้า
    expect(receiverNameMatches("นายิกา ส", "นางสาว นายิกา สุขใจ")).toBe("MATCH");
    expect(receiverNameMatches("MR. CHAKRAPHONG M", "นาย จักรพงษ์ มูลวิชา")).toBe("UNKNOWN");
    expect(receiverNameMatches(undefined, "นาย จักรพงษ์ มูลวิชา")).toBe("UNKNOWN");
    expect(receiverNameMatches("นาย จักรพงษ์ ม", "")).toBe("UNKNOWN");
  });

  it("accepts transfers made after the order (with clock grace) and rejects older ones", () => {
    const created = new Date("2026-10-24T10:00:00Z");
    const now = new Date("2026-10-24T10:20:00Z");
    expect(isSlipFresh(new Date("2026-10-24T10:05:00Z"), created, now)).toBe(true);
    expect(isSlipFresh(new Date(created.getTime() - SLIP_BACKDATE_GRACE_MS + 1000), created, now)).toBe(true);
    expect(isSlipFresh(new Date("2026-10-23T10:00:00Z"), created, now)).toBe(false);
    expect(isSlipFresh(new Date("2026-10-24T12:00:00Z"), created, now)).toBe(false);
  });
});

const ORDER = {
  expectedAmount: 990.37,
  orderCreatedAt: new Date("2026-10-24T10:00:00Z"),
  receiverIds: ["0812345678"],
  receiverAccountName: "นาย ทดสอบ รับเงินดี",
  now: new Date("2026-10-24T10:20:00Z"),
};
function verifiedData(overrides: { amount?: number; date?: string; receiverProxy?: string; matchedAccount?: unknown; receiverName?: Record<string, string> } = {}) {
  return {
    isDuplicate: false,
    matchedAccount: overrides.matchedAccount ?? null,
    amountInSlip: overrides.amount ?? 990.37,
    rawSlip: {
      transRef: TRANS_REF,
      date: overrides.date ?? "2026-10-24T17:10:00+07:00",
      amount: { amount: overrides.amount ?? 990.37, local: { amount: overrides.amount ?? 990.37, currency: "THB" } },
      receiver: { account: { name: overrides.receiverName ?? { th: "นาย ทดสอบ ร" }, proxy: { type: "MSISDN", account: overrides.receiverProxy ?? "xxx-xxx-5678" } } },
    },
  };
}

describe("evaluateVerifiedSlip", () => {
  it("verifies when amount, receiver and date all match", () => {
    expect(evaluateVerifiedSlip(verifiedData(), ORDER)).toMatchObject({ status: "VERIFIED", transRef: TRANS_REF, amount: 990.37, receiverName: "นาย ทดสอบ ร" });
  });

  it("does not trust last-4-digit matches alone: a different name is the wrong receiver", () => {
    expect(evaluateVerifiedSlip(verifiedData({ receiverName: { th: "นาย คนอื่น ร" } }), ORDER).status).toBe("WRONG_RECEIVER");
  });

  it("asks a human when the receiver name cannot be compared", () => {
    expect(evaluateVerifiedSlip(verifiedData({ receiverName: { en: "MR. TEST R" } }), ORDER).status).toBe("RECEIVER_UNVERIFIED");
    expect(evaluateVerifiedSlip(verifiedData({ receiverName: {} }), ORDER).status).toBe("RECEIVER_UNVERIFIED");
  });

  it("flags a one-satang difference as an amount mismatch", () => {
    expect(evaluateVerifiedSlip(verifiedData({ amount: 990.36 }), ORDER).status).toBe("AMOUNT_MISMATCH");
  });

  it("flags money sent to another account unless EasySlip matched our registered account", () => {
    expect(evaluateVerifiedSlip(verifiedData({ receiverProxy: "xxx-xxx-9999" }), ORDER).status).toBe("WRONG_RECEIVER");
    expect(evaluateVerifiedSlip(verifiedData({ receiverProxy: "xxx-xxx-9999", matchedAccount: { bankNumber: "123" } }), ORDER).status).toBe("VERIFIED");
  });

  it("flags old slips reused for a new order", () => {
    expect(evaluateVerifiedSlip(verifiedData({ date: "2026-10-20T10:00:00+07:00" }), ORDER).status).toBe("STALE");
  });

  it("treats a response without amount or reference as unreadable", () => {
    expect(evaluateVerifiedSlip({ rawSlip: {} }, ORDER).status).toBe("UNREADABLE");
  });
});

describe("classifyEasySlipFailure", () => {
  it("retries pending Bangkok Bank slips, rate limits and server errors", () => {
    expect(classifyEasySlipFailure(404, "SLIP_PENDING", undefined).status).toBe("PENDING");
    expect(classifyEasySlipFailure(429, "RATE_LIMIT_EXCEEDED", undefined).status).toBe("PENDING");
    expect(classifyEasySlipFailure(503, undefined, undefined).status).toBe("PENDING");
  });

  it("alerts admins when the token is rejected", () => {
    expect(classifyEasySlipFailure(401, "UNAUTHORIZED", "bad token")).toMatchObject({ status: "ERROR", alertAdmins: true });
  });

  it("keeps retrying (and alerts) when the quota runs out, so slips clear once it is topped up", () => {
    expect(classifyEasySlipFailure(402, "QUOTA_EXCEEDED", undefined)).toMatchObject({ status: "PENDING", alertAdmins: true });
    expect(classifyEasySlipFailure(403, "FORBIDDEN", undefined)).toMatchObject({ status: "PENDING", alertAdmins: true });
  });

  it("truncates provider text before storing it", () => {
    expect(classifyEasySlipFailure(400, "X".repeat(500), "y".repeat(500)).note.length).toBeLessThan(400);
  });

  it("marks slips the bank cannot find as unreadable", () => {
    expect(classifyEasySlipFailure(404, "SLIP_NOT_FOUND", undefined).status).toBe("UNREADABLE");
  });
});

describe("checkSlipWithEasySlip", () => {
  const image = { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("is disabled without a token and makes no request", async () => {
    const fetchImpl = vi.fn();
    expect((await checkSlipWithEasySlip({ ...ORDER, image }, { token: null, fetchImpl })).status).toBe("DISABLED");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the QR payload as JSON with the bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, { success: true, data: verifiedData() }));
    const result = await checkSlipWithEasySlip({ ...ORDER, image, qrPayload: slipPayload() }, { token: "test-token-123", fetchImpl });
    expect(result.status).toBe("VERIFIED");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(EASYSLIP_VERIFY_URL);
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-token-123", "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ payload: slipPayload() });
  });

  it("uploads the image when the QR could not be read locally", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, { success: true, data: verifiedData() }));
    await checkSlipWithEasySlip({ ...ORDER, image }, { token: "test-token-123", fetchImpl });
    const init = fetchImpl.mock.calls[0][1];
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("image")).toBeInstanceOf(Blob);
  });

  it("maps provider errors and network failures without throwing", async () => {
    const pending = vi.fn().mockResolvedValue(json(404, { success: false, error: { code: "SLIP_PENDING", message: "pending" } }));
    expect((await checkSlipWithEasySlip({ ...ORDER, image }, { token: "test-token-123", fetchImpl: pending })).status).toBe("PENDING");
    const offline = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    expect((await checkSlipWithEasySlip({ ...ORDER, image }, { token: "test-token-123", fetchImpl: offline })).status).toBe("PENDING");
    const garbage = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));
    expect((await checkSlipWithEasySlip({ ...ORDER, image }, { token: "test-token-123", fetchImpl: garbage })).status).toBe("PENDING");
  });
});

describe("slip check config", () => {
  it("reads the token and keeps only well-formed receiver accounts", () => {
    expect(resolveSlipCheckConfig({ EASYSLIP_TOKEN: " secret-token-1 ", SLIP_RECEIVER_ACCOUNTS: "xxx-x-x1234-x, 0812345678, bad value, " })).toEqual({
      easyslipToken: "secret-token-1",
      receiverAccounts: ["xxx-x-x1234-x", "0812345678"],
    });
    expect(resolveSlipCheckConfig({})).toEqual({ easyslipToken: null, receiverAccounts: [] });
  });
});
