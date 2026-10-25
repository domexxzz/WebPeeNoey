import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/broker-ib/review", () => ({ approveBrokerClaim: vi.fn() }));

const { approveBrokerClaim } = await import("@/lib/broker-ib/review");
const { approveQualifyingClaims } = await import("@/lib/broker-ib/report-review");

const claim = (id: string, accountNumber: string) => ({
  id,
  orderNumber: `IB-${id}`,
  ibMinDepositUsd: { toNumber: () => 100 },
  user: { email: `${id}@example.com` },
  brokerAccount: { broker: "XM", accountNumber, registeredEmail: `${id}@example.com` },
});

describe("Approving from a report keeps going when one claim fails unexpectedly", () => {
  it("records the failure, still approves the rest and always writes the import summary", async () => {
    const auditCreate = vi.fn();
    const db = {
      order: { findMany: vi.fn().mockResolvedValue([claim("a", "11111111"), claim("b", "22222222"), claim("c", "33333333")]) },
      auditLog: { create: auditCreate },
    };
    vi.mocked(approveBrokerClaim)
      .mockResolvedValueOnce({ ok: true, orderNumber: "IB-a", email: "a@example.com", periodStart: new Date(), periodEnd: new Date(), isRenewal: false })
      .mockRejectedValueOnce(new Error("deadlock detected"))
      .mockResolvedValueOnce({ ok: true, orderNumber: "IB-c", email: "c@example.com", periodStart: new Date(), periodEnd: new Date(), isRenewal: false });
    const deposit = { emails: [], depositUsd: 500 };

    const result = await approveQualifyingClaims(db as never, {
      actor: { id: "admin", ipAddress: null },
      evidenceByBroker: { XM: new Map([["11111111", deposit], ["22222222", deposit], ["33333333", deposit]]) },
      sourceFiles: ["XM:traders.csv"],
    });

    expect(result.approved.map((row) => row.orderId)).toEqual(["a", "c"]);
    expect(result.failed).toEqual([expect.objectContaining({ orderId: "b", code: "UNEXPECTED" })]);
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "BROKER_REPORT_IMPORT", details: expect.objectContaining({ approved: 2, failed: 1 }) }) }),
    );
  });
});
