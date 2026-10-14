import type { Broker } from "@prisma/client";

/**
 * จุดเสียบการตรวจบัญชีอัตโนมัติ (อนาคต: Exness Partner API) — ตอนนี้ตรวจด้วยมือทั้งสองโบรกเกอร์
 * ผลตรวจอัตโนมัติจะเป็นข้อมูลประกอบให้แอดมินเท่านั้น การอนุมัติยังเป็นการตัดสินของแอดมิน
 */
export type VerificationMethod = "MANUAL" | "EXNESS_PARTNER_API";

export interface BrokerAccountVerifier {
  method: VerificationMethod;
  check(input: { accountNumber: string; registeredEmail: string; minDepositUsd: number }): Promise<{ status: "PASS" | "FAIL" | "UNAVAILABLE"; detail?: string }>;
}

export function verifierFor(_broker: Broker): BrokerAccountVerifier | null {
  return null;
}
