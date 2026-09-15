"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Master data tim produksi (section Production) — kategori/warna/ukuran/supplier.
const TEAM_TABS = [
  { label: "Kategori", href: "/master-data/categories" },
  { label: "Warna", href: "/master-data/colors" },
  { label: "Ukuran", href: "/master-data/sizes" },
  { label: "Supplier", href: "/master-data/suppliers" },
];
// Master data admin (section Setting) — brand/gudang/akun penjualan.
const ADMIN_TABS = [
  { label: "Brand", href: "/master-data/brands" },
  { label: "Gudang", href: "/master-data/warehouses" },
  { label: "Akun Penjualan", href: "/master-data/sales-channels" },
];
const TEAM_PREFIXES = TEAM_TABS.map((t) => t.href);

export function MasterDataTabs() {
  const pathname = usePathname();
  // Tab mengikuti halaman yang dibuka, bukan role: halaman tim → tab tim saja,
  // halaman admin (brand/gudang/akun penjualan) → tab admin saja.
  const isTeamPage = TEAM_PREFIXES.some((p) => pathname.startsWith(p));
  const tabs = isTeamPage ? TEAM_TABS : ADMIN_TABS;
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
