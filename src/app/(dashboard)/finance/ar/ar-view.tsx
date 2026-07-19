"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Search, Download, Wallet, Printer, Trash2, HandCoins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/utils";
import { createReceivable, deleteReceivable, receiveAR } from "./actions";

export type ARRow = {
  id: string; code: string; billTo: string; channel: string; brand: string; period: string; invoiceDate: string | null; dueDate: string | null;
  amount: number; paid: number; status: "unpaid" | "partial" | "paid"; notes: string; source: "manual" | "sales";
};
export type ChannelOpt = { id: string; name: string };
export type BrandOpt = { id: string; name: string };
export type AccountOpt = { id: string; name: string; balance: number };

export function ARView({ rows, channels, brands, accounts }: { rows: ARRow[]; channels: ChannelOpt[]; brands: BrandOpt[]; accounts: AccountOpt[] }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [receive, setReceive] = useState<ARRow | null>(null);

  const query = q.trim().toLowerCase();
  const list = useMemo(() => rows
    .filter((r) => !statusFilter || r.status === statusFilter)
    .filter((r) => !query || r.code.toLowerCase().includes(query) || r.billTo.toLowerCase().includes(query) || r.channel.toLowerCase().includes(query)), [rows, statusFilter, query]);

  const outstanding = list.reduce((s, r) => s + Math.max(0, r.amount - r.paid), 0);

  function download() {
    const head = ["Kode", "Brand", "Store", "Periode", "Tgl Invoice", "Jatuh Tempo", "Tagihan", "Diterima", "Sisa", "Status"];
    const lines = list.map((r) => [r.code, r.brand, r.billTo || r.channel, r.period, r.invoiceDate ?? "", r.dueDate ?? "", r.amount, r.paid, Math.max(0, r.amount - r.paid), r.status]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = "﻿" + [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "piutang-ar.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finance</p>
          <h1 className="text-2xl font-extrabold">Piutang / Account Receivable</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Tagihan ke store konsinyasi berdasar total penerimaan (nominal general, tanpa level produk). Outstanding: <b className="text-danger">{formatIDR(outstanding)}</b></p>
        </div>
        <div className="flex gap-2">
          <button onClick={download} disabled={list.length === 0} className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"><Download className="h-4 w-4" /> Download</button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Buat Tagihan AR</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode / store…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Status</option>
          <option value="unpaid">Belum Bayar</option>
          <option value="partial">Sebagian</option>
          <option value="paid">Lunas</option>
        </select>
        <span className="text-sm font-medium text-muted-foreground">{list.length} tagihan</span>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada tagihan AR.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">Kode</th>
                <th className="py-2.5 pr-3">Brand</th>
                <th className="py-2.5 pr-3">Store</th>
                <th className="py-2.5 pr-3">Periode</th>
                <th className="py-2.5 pr-3">Jatuh Tempo</th>
                <th className="py-2.5 pr-3 text-right">Tagihan</th>
                <th className="py-2.5 pr-3 text-right">Diterima</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const out = Math.max(0, r.amount - r.paid);
                return (
                  <tr key={r.id} className="border-t border-border font-semibold hover:bg-muted/40">
                    <td className="py-2.5 pl-4 pr-3 font-mono text-xs">{r.code}{r.source === "sales" && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">Penjualan</span>}</td>
                    <td className="py-2.5 pr-3"><Badge tone="neutral">{r.brand}</Badge></td>
                    <td className="py-2.5 pr-3">{r.billTo || r.channel}</td>
                    <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.period || "—"}</td>
                    <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.dueDate ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(r.amount)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-700">{r.paid > 0 ? formatIDR(r.paid) : "—"}</td>
                    <td className="py-2.5 pr-3">{r.status === "paid" ? <Badge tone="success">Lunas</Badge> : r.status === "partial" ? <Badge tone="accent">Sebagian</Badge> : <Badge tone="danger">Belum</Badge>}</td>
                    <td className="py-2.5 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a href={r.source === "sales" ? `/print/sales-ar/${r.id}` : `/print/ar/${r.id}`} target="_blank" rel="noreferrer" title="Cetak invoice AR" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-muted"><Printer className="h-4 w-4" /> Invoice</a>
                        {out > 0 && <Button variant="ghost" size="sm" onClick={() => setReceive(r)}><Wallet className="h-4 w-4" /> Terima</Button>}
                        {r.source === "manual" ? <DelBtn onDel={() => deleteReceivable(r.id)} /> : <span className="text-xs font-medium text-muted-foreground" title="Kelola di modul Sales">di Sales</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && <ARForm channels={channels} brands={brands} accounts={accounts} onClose={() => setOpen(false)} />}
      {receive && <ReceiveDialog row={receive} accounts={accounts} onClose={() => setReceive(null)} />}
    </div>
  );
}

function DelBtn({ onDel }: { onDel: () => Promise<{ ok: boolean } | void> }) {
  const router = useRouter();
  const [c, setC] = useState(false);
  const [pending, startTransition] = useTransition();
  if (c) return <Button size="sm" variant="danger" disabled={pending} onClick={() => startTransition(async () => { await onDel(); router.refresh(); })}>Yakin?</Button>;
  return <Button size="sm" variant="ghost" onClick={() => setC(true)}><Trash2 className="h-4 w-4" /></Button>;
}

function ARForm({ channels, brands, accounts, onClose }: { channels: ChannelOpt[]; brands: BrandOpt[]; accounts: AccountOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [payAccountId, setPayAccountId] = useState(accounts[0]?.id ?? "");
  const [billTo, setBillTo] = useState("");
  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const [dueDate, setDueDate] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const chanName = channels.find((c) => c.id === channelId)?.name ?? "";
    startTransition(async () => {
      const res = await createReceivable({ channelId: channelId || null, brandId: brandId || null, payAccountId: payAccountId || null, billTo: billTo.trim() || chanName, period, invoiceDate, dueDate, amount: Number(amount) || 0, notes });
      if (!res.ok) { setError(res.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">Buat Tagihan AR</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Brand</label>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inp + " px-3"}>
                <option value="">— Pilih brand —</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Store (konsinyasi)</label>
              <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={inp + " px-3"}>
                <option value="">— Pilih / isi manual —</option>
                {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Nama Penerima <span className="font-medium text-muted-foreground">(opsional)</span></label><input value={billTo} onChange={(e) => setBillTo(e.target.value)} className={inp} placeholder="jika beda dari store" /></div>
            <div><label className={lbl}>Bayar ke Rekening <span className="font-medium text-muted-foreground">(tercetak di invoice)</span></label>
              <select value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)} className={inp + " px-3"}>
                <option value="">— Pilih rekening —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Periode Penagihan</label><input value={period} onChange={(e) => setPeriod(e.target.value)} className={inp} placeholder="mis. Juli 2026" /></div>
            <div><label className={lbl}>Nominal Tagihan (total)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} placeholder="0" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Tgl Invoice</label><input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Jatuh Tempo</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp} /></div>
          </div>
          <div><label className={lbl}>Catatan</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium outline-none focus:border-primary/40" placeholder="opsional" /></div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Simpan Tagihan"}</Button></div>
        </form>
      </div>
    </div>
  );
}

function ReceiveDialog({ row, accounts, onClose }: { row: ARRow; accounts: AccountOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const outstanding = Math.max(0, row.amount - row.paid);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState(String(outstanding));
  const [method, setMethod] = useState("transfer");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    startTransition(async () => {
      const res = await receiveAR({ id: row.id, code: row.code, amount: Number(amount) || 0, accountId, date, method });
      if (!res.ok) { setError(res.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold inline-flex items-center gap-2"><HandCoins className="h-5 w-5" /> Terima Pembayaran</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
        <div className="mb-4 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm"><p className="font-mono font-bold">{row.code}</p><p className="text-muted-foreground">{row.billTo || row.channel} · Sisa <b className="text-danger">{formatIDR(outstanding)}</b></p></div>
        <form onSubmit={submit} className="space-y-4">
          <div><label className={lbl}>Masuk ke Akun</label><select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inp + " px-3"}><option value="">— Pilih —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · saldo {formatIDR(a.balance)}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Nominal</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          </div>
          <div><label className={lbl}>Metode</label><select value={method} onChange={(e) => setMethod(e.target.value)} className={inp + " px-3"}><option value="transfer">Transfer</option><option value="tunai">Tunai</option><option value="giro">Giro</option></select></div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending}>{pending ? "Memproses…" : "Terima"}</Button></div>
        </form>
      </div>
    </div>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
