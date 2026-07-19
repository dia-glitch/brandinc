"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Pengguna & Role", href: "/settings/users" },
  { label: "Data Management", href: "/settings/data" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="mx-auto mb-6 flex max-w-4xl flex-wrap gap-2">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} data-active={pathname.startsWith(t.href)} className="pill">{t.label}</Link>
      ))}
    </div>
  );
}
