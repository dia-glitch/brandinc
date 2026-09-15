import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canView, PAGE_KEYS, type PageKey } from "@/lib/permissions";
import { SECTIONS } from "@/components/shell/nav-config";

// Warna kartu selaras tema Dashboard (eerie / vanila / honeydew / alice),
// dibagi rata 2 kartu per warna supaya penuh warna tapi tetap seimbang.
type Style = { card: string; icon: string; sub: string; chip: string; arrow: string };
const DARK: Style = {
  card: "bg-eerie text-ghost hover:bg-eerie/90",
  icon: "bg-white/10 text-ghost",
  sub: "text-ghost/60",
  chip: "bg-white/10 text-ghost/80",
  arrow: "bg-vanila text-eerie",
};
const light = (bg: string): Style => ({
  card: `${bg} text-eerie hover:brightness-[0.97]`,
  icon: "bg-eerie/10 text-eerie",
  sub: "text-eerie/55",
  chip: "bg-eerie/[0.07] text-eerie/70",
  arrow: "bg-eerie text-ghost",
});
const STYLES: Record<string, Style> = {
  dashboard: DARK,
  produksi: light("bg-vanila"),
  inbound: light("bg-honeydew"),
  distribusi: light("bg-alice"),
  sales: light("bg-vanila"),
  finance: light("bg-honeydew"),
  analitik: light("bg-alice"),
  setting: DARK,
};

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
    <div className="flex h-full flex-col gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Beranda</p>
        <h1 className="text-xl font-extrabold leading-tight">Pilih Area Kerja 👋</h1>
        <p className="text-xs font-medium text-muted-foreground">
          Klik area untuk membukanya — menu di samping menyesuaikan section yang kamu pilih.
        </p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4 lg:grid-rows-2">
        {sections.map((s) => {
          const Icon = s.icon;
          const st = STYLES[s.key] ?? light("bg-ghost");
          const first = s.vitems[0].dest!.href;
          return (
            <Link
              key={s.key}
              href={first}
              className={"group relative flex flex-col rounded-2xl p-4 shadow-card transition " + st.card}
            >
              <div className="flex items-start justify-between">
                <div className={"flex h-9 w-9 items-center justify-center rounded-xl " + st.icon}>
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <span className={"flex h-7 w-7 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100 " + st.arrow}>
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
              <h2 className="mt-2.5 text-sm font-extrabold leading-tight">{s.label}</h2>
              <p className={"mt-0.5 text-[11px] font-medium leading-snug " + st.sub}>{s.desc}</p>
              <div className="mt-auto flex flex-wrap gap-1 pt-3">
                {s.vitems.map((it) => (
                  <span key={it.label} className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + st.chip}>{it.label}</span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
