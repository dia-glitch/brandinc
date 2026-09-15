"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Search } from "lucide-react";
import { formatIDR } from "@/lib/utils";
import { togglePaymentToday } from "./actions";
import type { DeskItem } from "@/lib/finance-desk";

function compactIDR(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  return formatIDR(n);
}

const SOURCE_OPTS = [
  { value: "", label: "Semua sumber" },
  { value: "ap", label: "Payable (AP)" },
  { value: "expense", label: "Payable (Umum)" },
  { value: "pr", label: "Cash Advance / Reimburse" },
];

export function FinanceDeskView({ items, canEdit }: { items: DeskItem[]; canEdit: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [src, setSrc] = useState("");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => {
    const all = items.reduce((s, i) => s + i.remaining, 0);
    const payable = items.filter((i) => i.source === "ap" || i.source === "expense").reduce((s, i) => s + i.remaining, 0);
    const reimb = items.filter((i) => i.source === "pr").reduce((s, i) => s + i.remaining, 0);
    const marked = items.filter((i) => i.marked);
    const markedSum = marked.reduce((s, i) => s + i.remaining, 0);
    return { all, count: items.length, payable, reimb, markedSum, markedCount: marked.length };
  }, [items]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => {
      if (src && i.source !== src) return false;
      if (!s) return true;
      return (i.payee + " " + i.refLabel + " " + i.note).toLowerCase().includes(s);
    });
  }, [items, q, src]);
  const listSum = list.reduce((s, i) => s + i.remaining, 0);

  function toggle(i: DeskItem) {
    if (!canEdit) return;
    setBusy(i.qid);
    setErr(null);
    start(async () => {
      const res = await togglePaymentToday({ source: i.source, refKey: i.refKey, refType: i.refType, on: !i.marked });
      if (!res.ok) setErr(res.error);
      router.refresh();
      setBusy(null);
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finance</p>
        <h1 className="text-2xl font-extrabold">Finance Desk — Antrian Pembayaran</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Semua yang siap dibayar: Payable terverifikasi, Reimbursement, &amp; Cash Advance yang sudah di-approve.
          Tandai <b>Payment Today</b> untuk memasukkannya ke antrian pembayaran hari ini.
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">
          Gagal menandai: {err} — pastikan tabel <b>payment_queue</b> sudah dibuat (jalankan supabase/sql/payment_queue.sql).
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total siap dibayar" value={compactIDR(totals.all)} sub={`${totals.count} item`} />
        <Stat label="Payable (AP + Umum)" value={compactIDR(totals.payable)} tone="text-indigo-600" />
        <Stat label="Reimburse & Cash Advance" value={compactIDR(totals.reimb)} tone="text-amber-700" />
        <Stat label="Ditandai Payment Today" value={compactIDR(totals.markedSum)} sub={`${totals.markedCount} item → tab Payment Today`} tone="text-emerald-600" />
      </div>

      <div className="card p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select value={src} onChange={(e) => setSrc(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary/40">
              {SOURCE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama penerima atau no. invoice…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
            </div>
          </div>
          <p className="text-sm font-bold text-muted-foreground">{list.length} item · {formatIDR(listSum)}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">Sumber</th>
                <th className="py-2.5 pr-3">Ref</th>
                <th className="py-2.5 pr-3">Penerima</th>
                <th className="hidden py-2.5 pr-3 md:table-cell">Keterangan</th>
                <th className="hidden py-2.5 pr-3 sm:table-cell">Jatuh Tempo</th>
                <th className="py-2.5 pr-3 text-right">Jumlah</th>
                <th className="py-2.5 pr-4 text-right">Payment Today</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-sm font-medium text-muted-foreground">Tidak ada item siap dibayar.</td></tr>
              ) : list.map((i) => (
                <tr key={i.qid} className={"border-b border-border/60 font-semibold " + (i.marked ? "bg-emerald-50/60" : "hover:bg-muted/40")}>
                  <td className="py-2.5 pl-4 pr-3"><SourcePill label={i.sourceLabel} /></td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-primary">{i.refLabel}</td>
                  <td className="py-2.5 pr-3">{i.payee}</td>
                  <td className="hidden py-2.5 pr-3 font-medium text-muted-foreground md:table-cell">{i.note}</td>
                  <td className="hidden py-2.5 pr-3 font-medium text-muted-foreground sm:table-cell">{i.dueDate ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-extrabold">{formatIDR(i.remaining)}</td>
                  <td className="py-2.5 pr-4 text-right">
                    <button
                      onClick={() => toggle(i)}
                      disabled={!canEdit || (pending && busy === i.qid)}
                      className={
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 " +
                        (i.marked ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-border bg-background hover:border-primary/40")
                      }
                    >
                      {i.marked ? <><Check className="h-3.5 w-3.5" /> Payment Today</> : <><Plus className="h-3.5 w-3.5" /> Payment Today</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className={"mt-1 text-2xl font-black tracking-tight " + (tone ?? "")}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SourcePill({ label }: { label: string }) {
  const tone =
    label.includes("AP") ? "bg-indigo-100 text-indigo-700" :
    label.includes("Umum") ? "bg-sky-100 text-sky-700" :
    label.includes("Cash") ? "bg-amber-100 text-amber-700" :
    "bg-rose-100 text-rose-700";
  return <span className={"inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold " + tone}>{label}</span>;
}
