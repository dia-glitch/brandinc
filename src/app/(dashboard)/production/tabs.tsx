"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Produk & SKU", href: "/production/products" },
  { label: "SPK", href: "/production/spk" },
  { label: "PO Produksi", href: "/production/po" },
  { label: "Material Issue", href: "/production/material-issue" },
  { label: "COGM", href: "/production/cogm" },
];

export function ProductionTabs() {
  const pathname = usePathname();
  return (
    <div className="mx-auto mb-6 flex max-w-7xl flex-wrap gap-2">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} data-active={pathname.startsWith(t.href)} className="pill">
          {t.label}
        </Link>
      ))}
    </div>
  );
}
