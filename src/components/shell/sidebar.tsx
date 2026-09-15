"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ChevronLeft } from "lucide-react";
import { SECTIONS, sectionForPath, type NavItem } from "./nav-config";
import { cn } from "@/lib/utils";
import { type PageKey } from "@/lib/permissions";

/**
 * Sidebar per-SECTION. Menampilkan menu section yang sedang dibuka saja.
 * Di Beranda (hub) menampilkan daftar section. `viewKeys` = halaman yang boleh dilihat.
 */
export function Sidebar({ viewKeys }: { viewKeys: PageKey[] }) {
  const pathname = usePathname();
  const canSee = (k: PageKey) => viewKeys.includes(k);
  const secKey = sectionForPath(pathname);
  const section = SECTIONS.find((s) => s.key === secKey) ?? null;

  const visibleItems = (items: NavItem[]) =>
    items.map((item) => ({ item, dest: item.pages.find((p) => canSee(p.key)) })).filter((x) => x.dest);

  const isActive = (item: NavItem) =>
    item.pages.some((p) => (p.href === "/" ? pathname === "/" : pathname === p.href || pathname.startsWith(p.href + "/")));

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border bg-surface p-4 md:flex">
      <div className="flex items-center gap-2.5 px-2 py-3">
        <span className="text-lg font-black">Brand<span className="font-extrabold text-muted-foreground">.Inc</span></span>
      </div>

      {/* Beranda / hub */}
      <Link href="/beranda" data-active={pathname === "/beranda"}
        className={cn("mb-1 flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-sm font-bold transition-colors",
          pathname === "/beranda" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}>
        <LayoutGrid className="h-[18px] w-[18px]" /> Beranda
      </Link>

      <nav className="mt-1 flex-1 overflow-y-auto">
        {section ? (
          <>
            <Link href="/beranda" className="mb-1 flex items-center gap-1 px-3 pt-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-3 w-3" /> {section.label}
            </Link>
            {visibleItems(section.items).map(({ item, dest }) => {
              const Icon = item.icon; const active = isActive(item);
              return (
                <Link key={item.label} href={dest!.href}
                  className={cn("mb-0.5 flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-sm font-semibold transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  <Icon className={cn("h-[18px] w-[18px]", active && "text-vanila")} /> {item.label}
                </Link>
              );
            })}
          </>
        ) : (
          <>
            <p className="px-3 pb-1.5 pt-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Area</p>
            {SECTIONS.map((s) => {
              const vis = visibleItems(s.items);
              if (vis.length === 0) return null;
              const Icon = s.icon;
              return (
                <Link key={s.key} href={vis[0].dest!.href}
                  className="mb-0.5 flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <Icon className="h-[18px] w-[18px]" /> {s.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="mt-2 rounded-2xl bg-honeydew/50 p-4">
        <p className="text-sm font-extrabold">🟢 Mode Live</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">Data produksi aktif — perubahan bersifat permanen.</p>
      </div>
    </aside>
  );
}
