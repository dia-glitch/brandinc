"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav-config";
import { cn } from "@/lib/utils";
import { canView, pageKeyForPath, type Role } from "@/lib/permissions";

export function Sidebar({ role = "admin" }: { role?: Role }) {
  const pathname = usePathname();
  const activeKey = pageKeyForPath(pathname);

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border bg-surface p-4 md:flex">
      <div className="flex items-center gap-2.5 px-2 py-3">
        <span className="text-lg font-black">
          Brand<span className="font-extrabold text-muted-foreground">.Inc</span>
        </span>
      </div>

      <nav className="mt-2 flex-1 overflow-y-auto">
        {NAV.map((group) => {
          // Untuk tiap item: sub-halaman pertama yang boleh dilihat role ini.
          const items = group.items
            .map((item) => ({ item, dest: item.pages.find((p) => canView(role, p.key)) }))
            .filter((x) => x.dest);
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="mb-1">
              <p className="px-3 pb-1.5 pt-4 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              {items.map(({ item, dest }) => {
                const Icon = item.icon;
                const active = !!activeKey && item.pages.some((p) => p.key === activeKey);
                return (
                  <Link
                    key={item.label}
                    href={dest!.href}
                    className={cn(
                      "mb-0.5 flex items-center gap-3 rounded-[13px] px-3 py-2.5 text-sm font-semibold transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px]", active && "text-vanila")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="mt-2 rounded-2xl bg-muted p-4">
        <p className="text-sm font-extrabold">🧪 Mode Demo</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">
          Data testing aktif — bisa direset bersih kapan saja.
        </p>
      </div>
    </aside>
  );
}
