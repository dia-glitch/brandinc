"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Penjualan", href: "/sales" },
  { label: "Return", href: "/sales/return" },
  { label: "Ledger SKU", href: "/sales/ledger" },
];

export function SalesTabs() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/sales" ? pathname === "/sales" : pathname.startsWith(href));
  return (
    <div className="mx-auto mb-6 flex max-w-7xl flex-wrap gap-2">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} data-active={isActive(t.href)} className="pill">{t.label}</Link>
      ))}
    </div>
  );
}
