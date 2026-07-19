"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Wallet, Search, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/utils";
import { processRefund } from "./actions";

export type RefundRow = { id: string; code: string; brand: string; date: string | null; amount: number; bankName: string; accountNo: string; accountHolder: string; status: string; paidAt: string | null };
export type AccountOpt = { id: string; name: string; balance: number };

export function RefundView({ rows, accounts, canEdit = true }: { rows: RefundRow[]; accounts: AccountOpt[]; canEdit?: boolean }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [proc, setProc] = useState<RefundRow | null>(null);
  const query = q.trim().toLowerCase();
  const list = rows.filter((r) => !statusFilter || r.status === statusFilter).filter((r) => !query || r.code.toLowerCase().includes(query) || r.accountHolder.toLowerCase().includes(query));
  const pendingTotal = rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finance</p>
          <h1 className="text-2xl font-extrabold">Refund ke Customer</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Permintaan refund dari retur penjualan. Finance memproses transfer riil → kas keluar. Pending: <b className="text-danger">{formatIDR(pendingTotal)}</b></p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode retur / nama rekening…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="pending">Pending</option><option value="paid">Sudah Ditransfer</option><option value="">Semua</option>
        </select>
        <span className="text-sm font-medium text-muted-foreground">{list.length} refund</span>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada refund pada filter ini.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">Kode Retur</th><th className="py-2.5 pr-3">Brand</th><th className="py-2.5 pr-3">Tgl</th>
                <th className="py-2.5 pr-3">Rekening Tujuan (Customer)</th><th className="py-2.5 pr-3 text-right">Nominal</th><th className="py-2.5 pr-3">Status</th><th className="py-2.5 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-border font-semibold hover:bg-muted/40">
                  <td className="py-2.5 pl-4 pr-3 font-mono text-xs">{r.code}</td>
                  <td className="py-2.5 pr-3"><Badge tone="neutral">{r.brand}</Badge></td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.date ?? "—"}</td>
                  <td className="py-2.5 pr-3"><span className="inline-flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5 text-muted-foreground" />{r.bankName || "—"} · {r.accountNo || "—"} · a.n. {r.accountHolder || "—"}</span></td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(r.amount)}</td>
                  <td className="py-2.5 pr-3">{r.status === "paid" ? <Badge tone="success">Ditransfer</Badge> : <Badge tone="danger">Pending</Badge>}</td>
                  <td className="py-2.5 pr-4 text-right">{r.status === "pending" ? (canEdit ? <Button size="sm" onClick={() => setProc(r)}><Wallet className="h-4 w-4" /> Proses Transfer</Button> : <span className="text-xs font-medium text-muted-foreground">—</span>) : <span className="text-xs font-medium text-muted-foreground">{r.paidAt ?? "—"}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {proc && <ProcessDialog row={proc} accounts={accounts} onClose={() => setProc(null)} />}
    </div>
  );
}

function ProcessDialog({ row, accounts, onClose }: { row: RefundRow; accounts: AccountOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [method, setMethod] = useState("transfer");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">Proses Transfer Refund</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
        <div className="mb-4 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm">
          <p className="font-mono font-bold">{row.code} · {formatIDR(row.amount)}</p>
          <p className="text-muted-foreground">Ke: {row.bankName} · {row.accountNo} · a.n. {row.accountHolder}</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setError(null); startTransition(async () => { const r = await processRefund({ id: row.id, code: row.code, amount: row.amount, accountId, date, method }); if (!r.ok) { setError(r.error); return; } onClose(); router.refresh(); }); }} className="space-y-4">
          <div><label className={lbl}>Transfer dari Akun</label><select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inp + " px-3"}><option value="">— Pilih —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · saldo {formatIDR(a.balance)}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div><div><label className={lbl}>Metode</label><select value={method} onChange={(e) => setMethod(e.target.value)} className={inp + " px-3"}><option value="transfer">Transfer</option><option value="tunai">Tunai</option></select></div></div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending}>{pending ? "Memproses…" : "Konfirmasi Transfer"}</Button></div>
        </form>
      </div>
    </div>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
