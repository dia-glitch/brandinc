"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Katalog / Master", href: "/inventory" },
  { label: "Stok per Lokasi", href: "/inventory/stock" },
  { label: "Log Pergerakan", href: "/inventory/log" },
  { label: "Stock Opname", href: "/inventory/opname" },
];

export function InventoryTabs() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/inventory" ? pathname === "/inventory" : pathname.startsWith(href));
  return (
    <div className="mx-auto mb-6 flex max-w-7xl flex-wrap gap-2">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} data-active={isActive(t.href)} className="pill">{t.label}</Link>
      ))}
    </div>
  );
}
