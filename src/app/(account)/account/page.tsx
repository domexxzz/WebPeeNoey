import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Clock, KeyRound, Lock, Send, AlertTriangle } from "lucide-react";
import { getMembershipSummary } from "@/lib/admin/membership";
import { daysUntil, formatBaht, formatDate } from "@/lib/format";
import { computeOrderPhase } from "@/lib/orders/phase";
import { OrderStatusBadge } from "@/components/checkout/order-status-badge";
import { PAYMENT_RULES } from "@/config/payment";
import { telegramDeepLink } from "@/lib/telegram/link";
import { TelegramConnect } from "@/components/account/telegram-connect";

export default async function AccountDashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const now = new Date();

  // ดึงข้อมูลสมาชิกและสิทธิ์จากฐานข้อมูล
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        include: {
          orders: {
            orderBy: { createdAt: "desc" },
            take: 3,
            include: { plan: true },
          },
        },
      })
    : null;

  // สถานะรวมทุกช่วงที่ต่อทบกัน: ช่วงที่ใช้งานอยู่ตอนนี้ (ถือสถานะเปิดสิทธิ์) + วันหมดอายุของช่วงสุดท้าย
  const membership = userId ? await getMembershipSummary(prisma, { userId, now }) : null;
  const currentSub = membership?.currentSubscriptionId
    ? await prisma.subscription.findUnique({ where: { id: membership.currentSubscriptionId }, include: { plan: true } })
    : null;
  const isActive = Boolean(membership?.active && currentSub);
  const endsAt = membership?.endsAt ?? null;
  const daysLeft = endsAt ? daysUntil(endsAt, now) : null;
  const expiringSoon = isActive && daysLeft !== null && daysLeft <= PAYMENT_RULES.expiryReminderDays;
  const telegramEnabled = telegramDeepLink(process.env.TELEGRAM_BOT_USERNAME, "check") !== null;

  const supportTelegram = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM;
  const channels = currentSub
    ? [
        { label: "TradingView", granted: currentSub.tradingViewGranted, pending: "รอทีมงานเปิดสิทธิ์" },
        { label: "Discord VIP", granted: currentSub.discordRoleGranted, pending: "รอยืนยันยศ" },
      ]
    : [];

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 border border-line px-3 py-1 text-xs font-semibold tracking-wide text-signal rounded-full">
            <span aria-hidden="true" className="w-1.5 h-1.5 bg-signal rounded-full" />
            แดชบอร์ดสมาชิก
          </p>
          <h1 className="mt-5 font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05] text-white">
            ยินดีต้อนรับ, <span className="break-all">{user?.name || user?.email}</span>
          </h1>
          <p className="mt-3 text-base text-gray-300">ตรวจสอบสิทธิ์การใช้งานอินดิเคเตอร์ วันหมดอายุ และช่องทางคอมมูนิตี้ VIP ของคุณ</p>
        </div>
        <Link
          href="/#pricing"
          className="inline-flex shrink-0 items-center justify-center gap-2 bg-signal px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-signal-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal rounded-xl"
        >
          {isActive ? "ต่ออายุแพ็กเกจ (ทบวัน)" : "สมัครสมาชิก"}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section id="membership" aria-labelledby="membership-heading" className="scroll-mt-28 border border-line lg:col-span-2 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 sm:px-6 py-4">
            <h2 id="membership-heading" className="flex items-center gap-2.5 font-display text-lg font-bold text-white">
              <KeyRound className="w-5 h-5 text-signal" aria-hidden="true" />
              สถานะสมาชิก
            </h2>
            {isActive ? (
              <span className="inline-flex items-center gap-2 bg-signal px-3 py-1 text-xs font-bold text-ink rounded-full">
                <span aria-hidden="true" className="w-1.5 h-1.5 bg-ink motion-safe:animate-pulse rounded-full" />
                ใช้งานอยู่
              </span>
            ) : (
              <span className="inline-flex items-center border border-line px-3 py-1 text-xs font-semibold text-gray-300 rounded-full">ยังไม่มีสิทธิ์ที่ใช้งานอยู่</span>
            )}
          </div>

          {isActive && currentSub ? (
            <div>
              {expiringSoon && (
                <div role="status" className="flex flex-col gap-3 border-b border-line bg-signal-muted px-5 sm:px-6 py-4 text-sm text-gray-100 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-signal" aria-hidden="true" />
                    สิทธิ์ของคุณจะหมดในอีก {daysLeft} วัน — ต่ออายุตอนนี้ วันใช้งานจะทบต่อทันที
                  </span>
                  <Link href={`/checkout/${currentSub.plan.slug}`} className="shrink-0 font-semibold text-signal hover:text-signal-hover">
                    ต่ออายุ →
                  </Link>
                </div>
              )}

              <div className="grid gap-px bg-line sm:grid-cols-2 rounded-2xl overflow-hidden">
                <div className="bg-ink px-5 sm:px-6 py-6">
                  <p className="text-xs text-gray-400">แพ็กเกจที่ใช้งาน</p>
                  <p className="mt-2 font-display text-2xl font-bold tracking-tight text-white">{currentSub.plan.name}</p>
                  {currentSub.isPriceLocked && (
                    <p className="mt-3 inline-flex items-center gap-1.5 border border-signal px-2 py-1 text-xs font-medium text-signal rounded-full">
                      <Lock className="w-3.5 h-3.5" aria-hidden="true" /> ล็อกราคาโปรโมชันตลอดอายุ
                    </p>
                  )}
                </div>
                <div className="bg-ink px-5 sm:px-6 py-6">
                  <p className="text-xs text-gray-400">ใช้งานได้ถึง (รวมช่วงที่ต่ออายุไว้)</p>
                  <p className="mt-2 font-display text-2xl font-bold tracking-tight text-white">{endsAt ? formatDate(endsAt) : "-"}</p>
                  {daysLeft !== null && (
                    <p className="mt-1 text-sm text-gray-300">
                      เหลืออีก <span className="font-display text-xl font-bold text-signal tabular-nums">{daysLeft}</span> วัน
                    </p>
                  )}
                </div>
              </div>

              <ul className="grid gap-px bg-line border-t border-line sm:grid-cols-3 rounded-2xl overflow-hidden">
                {channels.map((channel) => (
                  <li key={channel.label} className="flex items-center justify-between gap-3 bg-ink px-5 py-4 text-sm">
                    <span className="text-gray-200">{channel.label}</span>
                    {channel.granted ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-signal">
                        <Check className="w-3.5 h-3.5" aria-hidden="true" /> เปิดสิทธิ์แล้ว
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-300">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {channel.pending}
                      </span>
                    )}
                  </li>
                ))}
                <li className="flex items-center justify-between gap-3 bg-ink px-5 py-4 text-sm">
                  <span className="text-gray-200">กลุ่ม Telegram VIP</span>
                  {supportTelegram ? (
                    <a href={supportTelegram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-signal hover:text-signal-hover">
                      <Send className="w-3.5 h-3.5" aria-hidden="true" /> ลิงก์เข้าร่วม
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">ทีมงานจะส่งลิงก์ให้</span>
                  )}
                </li>
              </ul>
            </div>
          ) : (
            <div className="px-5 sm:px-6 py-12 text-center">
              <p className="text-base text-gray-300">คุณยังไม่มีแพ็กเกจสมาชิกที่ใช้งานอยู่ หรือแพ็กเกจเดิมหมดอายุแล้ว</p>
              <Link href="/#pricing" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-signal hover:text-signal-hover">
                ดูแพ็กเกจและโปรโมชัน <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>

        <section aria-labelledby="profile-heading" className="border border-line rounded-2xl overflow-hidden">
          <h2 id="profile-heading" className="border-b border-line px-5 sm:px-6 py-4 font-display text-lg font-bold text-white">
            ข้อมูลบัญชี
          </h2>
          <dl className="divide-y divide-line-soft text-sm">
            <div className="px-5 sm:px-6 py-4">
              <dt className="text-xs text-gray-400">อีเมลสมาชิก</dt>
              <dd className="mt-1 break-all font-medium text-gray-100">{user?.email}</dd>
            </div>
            <div className="px-5 sm:px-6 py-4">
              <dt className="text-xs text-gray-400">TradingView Username</dt>
              <dd className="mt-1 font-medium text-gray-100">{user?.tradingViewUsername || "ยังไม่ได้ระบุ (แจ้งแอดมินเพื่อขอสิทธิ์)"}</dd>
            </div>
            <div className="px-5 sm:px-6 py-4">
              <dt className="text-xs text-gray-400">วันที่สมัครสมาชิก</dt>
              <dd className="mt-1 font-medium text-gray-100">{user?.createdAt ? formatDate(user.createdAt) : "-"}</dd>
            </div>
          </dl>
        </section>
      </div>

      <TelegramConnect
        enabled={telegramEnabled}
        linked={Boolean(user?.telegramChatId)}
        linkedAtLabel={user?.telegramLinkedAt ? formatDate(user.telegramLinkedAt) : null}
      />

      <section aria-labelledby="recent-orders-heading" className="border border-line rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 sm:px-6 py-4">
          <h2 id="recent-orders-heading" className="font-display text-lg font-bold text-white">
            คำสั่งซื้อล่าสุด
          </h2>
          <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-signal hover:text-signal-hover">
            ดูทั้งหมด <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {!user?.orders || user.orders.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">ยังไม่มีคำสั่งซื้อ</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {user.orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/checkout/order/${order.id}`}
                  className="group flex flex-col gap-2 px-5 sm:px-6 py-4 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal"
                >
                  <div>
                    <p className="font-mono text-sm text-white">{order.orderNumber}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {order.plan.name} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-display text-lg font-bold text-white tabular-nums">{formatBaht(Number(order.amount))} ฿</span>
                    <OrderStatusBadge phase={computeOrderPhase(order, now)} />
                    <ArrowUpRight className="hidden sm:block w-4 h-4 text-gray-500 group-hover:text-signal" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
