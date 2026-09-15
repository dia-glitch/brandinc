"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Tab yang bisa diedit tim produksi (pindah ke section Production).
const TEAM_TABS = [
  { label: "Kategori", href: "/master-data/categories" },
  { label: "Warna", href: "/master-data/colors" },
  { label: "Ukuran", href: "/master-data/sizes" },
  { label: "Supplier", href: "/master-data/suppliers" },
];
// Tab master data lain — hanya admin.
const ADMIN_TABS = [
  { label: "Brand", href: "/master-data/brands" },
  { label: "Gudang", href: "/master-data/warehouses" },
  { label: "Akun Penjualan", href: "/master-data/sales-channels" },
];

export function MasterDataTabs({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname();
  const tabs = showAdmin ? [...ADMIN_TABS, ...TEAM_TABS] : TEAM_TABS;
  return (
    <div className="mx-auto mb-6 max-w-7xl">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} data-active={pathname.startsWith(t.href)} className="pill">
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
