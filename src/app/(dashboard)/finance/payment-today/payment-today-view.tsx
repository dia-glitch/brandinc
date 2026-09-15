"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Wallet } from "lucide-react";
import { formatIDR } from "@/lib/utils";
import { processPaymentToday, type PayLine } from "../desk/actions";
import type { DeskItem } from "@/lib/finance-desk";

export type PTAccount = { id: string; name: string; kind: string; balance: number };

function compactIDR(n: number): string {
  const neg = n < 0;
  const a = Math.abs(n);
  let s: string;
  if (a >= 1_000_000_000) s = `Rp ${(a / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  else if (a >= 1_000_000) s = `Rp ${(a / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  else s = formatIDR(a);
  return neg ? "−" + s.replace("Rp ", "Rp ") : s;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Row = { item: DeskItem; amount: string; accountId: string };

export function PaymentTodayView({ items, accounts, canEdit }: { items: DeskItem[]; accounts: PTAccount[]; canEdit: boolean }) {
  const router = useRouter();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<Row[]>(() => items.map((i) => ({ item: i, amount: String(Math.round(i.remaining)), accountId: accounts[0]?.id ?? "" })));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ done: number; failed: { ref: string; error: string }[] } | null>(null);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const planned = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  // Proyeksi saldo per akun setelah pembayaran yang ditugaskan.
  const projByAcc = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of accounts) m.set(a.id, a.balance);
    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      if (!r.accountId || amt <= 0) continue;
      m.set(r.accountId, (m.get(r.accountId) ?? 0) - amt);
    }
    return m;
  }, [rows, accounts]);
  const anyOver = accounts.some((a) => (projByAcc.get(a.id) ?? 0) < -0.0001);
  const remainAfter = totalBalance - planned;

  function setRow(qid: string, patch: Partial<Row>) {
    setRows((p) => p.map((r) => (r.item.qid === qid ? { ...r, ...patch } : r)));
  }

  function process() {
    if (!canEdit) return;
    setResult(null);
    const lines: PayLine[] = rows
      .filter((r) => (Number(r.amount) || 0) > 0)
      .map((r) => ({
        source: r.item.source, refKey: r.item.refKey, refType: r.item.refType, refLabel: r.item.refLabel,
        accountId: r.accountId, amount: Number(r.amount) || 0, method: "transfer",
      }));
    start(async () => {
      const res = await processPaymentToday({ date, lines });
      setResult({ done: res.done, failed: res.failed });
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finance</p>
        <h1 className="text-2xl font-extrabold">Payment Today</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Item yang ditandai di Finance Desk. Atur pembayaran sesuai saldo kas/bank yang tersedia — pilih sumber dana per item,
          sistem posting mutasi &amp; update status otomatis.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total Saldo Kas & Bank" value={compactIDR(totalBalance)} sub={`${accounts.length} akun`} />
        <Stat label="Rencana Bayar Hari Ini" value={compactIDR(planned)} sub={`${rows.length} item`} tone="text-indigo-600" />
        <Stat label="Sisa Saldo Setelah Bayar" value={compactIDR(remainAfter)} sub={remainAfter < 0 ? "⚠ melebihi saldo tersedia" : "aman"} tone={remainAfter < 0 ? "text-danger" : "text-emerald-600"} />
      </div>

      <div className="card p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Saldo per akun (proyeksi setelah pembayaran yang ditugaskan)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {accounts.map((a) => {
            const proj = projByAcc.get(a.id) ?? a.balance;
            const used = a.balance - proj;
            const over = proj < -0.0001;
            return (
              <div key={a.id} className={"rounded-xl border p-3 " + (over ? "border-danger/40 bg-danger/5" : "border-border")}>
                <p className="text-xs font-bold text-muted-foreground">{a.name} · {a.kind === "bank" ? "Bank" : a.kind === "cash" ? "Kas" : a.kind}</p>
                <p className={"mt-0.5 text-lg font-black tracking-tight " + (over ? "text-danger" : "")}>{compactIDR(proj)}</p>
                <p className="text-[11px] font-semibold text-muted-foreground">saldo {formatIDR(a.balance)}{used > 0 ? ` · dibayar ${formatIDR(used)}` : ""}</p>
              </div>
            );
          })}
          {accounts.length === 0 && <p className="text-sm font-medium text-muted-foreground">Belum ada akun kas/bank.</p>}
        </div>
      </div>

      {anyOver && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-bold text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Ada akun yang rencana pembayarannya melebihi saldo. Pindahkan sebagian item ke akun lain atau tunda.
        </div>
      )}

      <div className="card p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <label className="flex items-center gap-2 text-sm font-bold">
            Tanggal Bayar
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary/40" />
          </label>
          <p className="text-sm font-bold text-muted-foreground">{rows.length} item · {formatIDR(planned)}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">Sumber</th>
                <th className="py-2.5 pr-3">Ref</th>
                <th className="py-2.5 pr-3">Penerima</th>
                <th className="hidden py-2.5 pr-3 lg:table-cell">Rekening Penerima</th>
                <th className="hidden py-2.5 pr-3 md:table-cell">Keterangan</th>
                <th className="py-2.5 pr-3 text-right">Sisa Tagihan</th>
                <th className="py-2.5 pr-3 text-right">Bayar (Rp)</th>
                <th className="py-2.5 pr-4">Sumber Dana</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-sm font-medium text-muted-foreground">Belum ada item ditandai. Buka tab Finance Desk dan tandai <b>Payment Today</b>.</td></tr>
              ) : rows.map((r) => {
                const i = r.item;
                const amt = Number(r.amount) || 0;
                const over = amt > i.remaining + 0.0001;
                return (
                  <tr key={i.qid} className="border-b border-border/60 font-semibold">
                    <td className="py-2.5 pl-4 pr-3"><SourcePill label={i.sourceLabel} /></td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-primary">{i.refLabel}</td>
                    <td className="py-2.5 pr-3">{i.payee}</td>
                    <td className="hidden py-2.5 pr-3 text-xs font-medium text-muted-foreground lg:table-cell">
                      {i.payeeBank || i.payeeAccountNo ? <>{i.payeeBank ?? ""}{i.payeeAccountNo ? ` · ${i.payeeAccountNo}` : ""}{i.payeeHolder ? <span className="block">{i.payeeHolder}</span> : null}</> : "—"}
                    </td>
                    <td className="hidden py-2.5 pr-3 font-medium text-muted-foreground md:table-cell">{i.note}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-extrabold">{formatIDR(i.remaining)}</td>
                    <td className="py-2.5 pr-3 text-right">
                      <input
                        type="number"
                        value={r.amount}
                        onChange={(e) => setRow(i.qid, { amount: e.target.value })}
                        className={"h-9 w-32 rounded-lg border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40 " + (over ? "border-danger" : "border-border")}
                      />
                    </td>
                    <td className="py-2.5 pr-4">
                      <select value={r.accountId} onChange={(e) => setRow(i.qid, { accountId: e.target.value })} className="h-9 w-44 rounded-lg border border-border bg-background px-2 text-sm font-semibold outline-none focus:border-primary/40">
                        <option value="">— Pilih —</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
            {result ? (
              <div className={"flex items-center gap-2 text-sm font-bold " + (result.failed.length === 0 ? "text-emerald-600" : "text-amber-600")}>
                <CheckCircle2 className="h-4 w-4" />
                {result.done} pembayaran diposting{result.failed.length > 0 ? `, ${result.failed.length} gagal: ${result.failed.map((f) => `${f.ref} (${f.error})`).join("; ")}` : "."}
              </div>
            ) : <span className="text-sm font-medium text-muted-foreground">Klik proses untuk posting mutasi kas keluar & update status.</span>}
            <button
              onClick={process}
              disabled={!canEdit || pending || anyOver}
              className="inline-flex items-center gap-2 rounded-full bg-eerie px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
              title={anyOver ? "Rencana melebihi saldo — perbaiki dulu" : ""}
            >
              <Wallet className="h-4 w-4" /> {pending ? "Memproses…" : "Proses Pembayaran"}
            </button>
          </div>
        )}
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
