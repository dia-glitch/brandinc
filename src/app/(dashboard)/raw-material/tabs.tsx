"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Stok", href: "/raw-material" },
  { label: "Material", href: "/raw-material/materials" },
  { label: "Purchase Order", href: "/raw-material/po" },
  { label: "Pembelian Tunai", href: "/raw-material/cash-purchase" },
];

export function RawMaterialTabs() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/raw-material" ? pathname === "/raw-material" : pathname.startsWith(href));
  return (
    <div className="mx-auto mb-6 flex max-w-7xl flex-wrap gap-2">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} data-active={isActive(t.href)} className="pill">{t.label}</Link>
      ))}
    </div>
  );
}
