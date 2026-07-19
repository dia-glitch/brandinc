"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Brand", href: "/master-data/brands" },
  { label: "Kategori", href: "/master-data/categories" },
  { label: "Warna", href: "/master-data/colors" },
  { label: "Ukuran", href: "/master-data/sizes" },
  { label: "Supplier", href: "/master-data/suppliers" },
  { label: "Gudang", href: "/master-data/warehouses" },
  { label: "Akun Penjualan", href: "/master-data/sales-channels" },
];

export function MasterDataTabs() {
  const pathname = usePathname();
  return (
    <div className="mx-auto mb-6 max-w-7xl">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} data-active={pathname.startsWith(t.href)} className="pill">
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
