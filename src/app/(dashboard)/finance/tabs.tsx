"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PageKey } from "@/lib/permissions";

const TABS: { label: string; href: string; key: PageKey }[] = [
  { label: "Hutang (AP)", href: "/finance", key: "fin_other" },
  { label: "Piutang (AR)", href: "/finance/ar", key: "fin_other" },
  { label: "Payment Request", href: "/finance/payment-request", key: "fin_payment_request" },
  { label: "Expenses", href: "/finance/expenses", key: "fin_other" },
  { label: "Refund", href: "/finance/refund", key: "fin_other" },
  { label: "Kas & Bank", href: "/finance/cash", key: "fin_other" },
  { label: "Mutasi Kas", href: "/finance/mutasi", key: "fin_other" },
  { label: "Ringkasan", href: "/finance/summary", key: "fin_other" },
];

export function FinanceTabs({ allow }: { allow?: PageKey[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/finance" ? pathname === "/finance" : pathname.startsWith(href));
  const visible = allow ? TABS.filter((t) => allow.includes(t.key)) : TABS;
  return (
    <div className="mx-auto mb-6 flex max-w-7xl flex-wrap gap-2">
      {visible.map((t) => (
        <Link key={t.href} href={t.href} data-active={isActive(t.href)} className="pill">{t.label}</Link>
      ))}
    </div>
  );
}
