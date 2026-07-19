"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Neraca", href: "/accounting" },
  { label: "Laba Rugi", href: "/accounting/laba-rugi" },
  { label: "Arus Kas", href: "/accounting/cashflow" },
  { label: "Bagan Akun (COA)", href: "/accounting/coa" },
];

export function AccountingTabs() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/accounting" ? pathname === "/accounting" : pathname.startsWith(href));
  return (
    <div className="mx-auto mb-6 flex max-w-4xl flex-wrap gap-2">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} data-active={isActive(t.href)} className="pill">{t.label}</Link>
      ))}
    </div>
  );
}
