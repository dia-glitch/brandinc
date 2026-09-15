import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canView, PAGE_KEYS, type PageKey } from "@/lib/permissions";
import { SECTIONS } from "@/components/shell/nav-config";

export default async function BerandaPage() {
  const ALL: PageKey[] = [...PAGE_KEYS, "settings" as PageKey];
  let viewKeys: PageKey[] = ALL;
  if (isSupabaseConfigured()) {
    const role = await getRole(createClient());
    viewKeys = ALL.filter((k) => canView(role, k));
  }
  const canSee = (k: PageKey) => viewKeys.includes(k);

  const sections = SECTIONS.map((s) => ({
    ...s,
    vitems: s.items.map((it) => ({ ...it, dest: it.pages.find((p) => canSee(p.key)) })).filter((x) => x.dest),
  })).filter((s) => s.vitems.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Beranda</p>
        <h1 className="text-2xl font-extrabold">Pilih Area Kerja 👋</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Klik area untuk membukanya — menu di samping akan menyesuaikan section yang kamu pilih, jadi tidak terlalu penuh.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => {
          const Icon = s.icon;
          const first = s.vitems[0].dest!.href;
          return (
            <Link key={s.key} href={first} className="card group flex flex-col p-5 transition hover:border-primary/40 hover:shadow-card">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
              <h2 className="text-base font-extrabold">{s.label}</h2>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{s.desc}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.vitems.map((it) => (
                  <span key={it.label} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{it.label}</span>
                ))}
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">
                Buka <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
