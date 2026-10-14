import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BROKER_IB_CONTENT } from "@/config/broker-ib";
import { getBrokerIbStatusForUser } from "@/lib/broker-ib/member-status";
import { AccountPageHeader } from "@/components/account/account-page-header";
import { BrokerIbStatus } from "@/components/account/broker-ib-status";

export const metadata: Metadata = { title: "สิทธิ์ผ่านโบรกเกอร์", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function BrokerIbPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) redirect("/auth/signin?callbackUrl=%2Faccount%2Fbroker-ib");

  const [user, status] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    getBrokerIbStatusForUser(prisma, { userId }),
  ]);

  return (
    <div className="space-y-6">
      <AccountPageHeader eyebrow={BROKER_IB_CONTENT.eyebrow} title="สิทธิ์ผ่านโบรกเกอร์ (IB)" description={BROKER_IB_CONTENT.description} />
      <BrokerIbStatus status={status} memberEmail={user?.email ?? ""} />
    </div>
  );
}
