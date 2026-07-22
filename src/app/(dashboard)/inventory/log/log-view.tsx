"use client";

import { useState, useMemo } from "react";
import { Search, Download, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatIDR } from "@/lib/utils";

export type Opt = { id: string; name: string };
export type LogRow = { id: string; date: string; sku: string; product: string; brand: string; warehouse: string; status: string; type: string; source: string; qty: number; unitCost: number; note: string };

// Label ramah untuk jenis pergerakan.
const TYPE_LABEL: Record<string, string> = {
  production: "Barang Masuk (Produksi)", fg_receipt: "Terima Barang Jadi", receipt: "Terima Barang",
  sale: "Penjualan", return: "Retur Masuk",
  transfer_in: "Transfer Masuk", transfer_out: "Transfer Keluar",
  adjustment: "Penyesuaian (Opname)", opname: "Stock Opname",
  issue: "Keluar", repair: "Perbaikan",
};
function typeLabel(t: string) { return TYPE_LABEL[t] ?? (t ? t.replace(/_/g, " ") : "—"); }

const TYPE_OPTS = [
  { v: "in", label: "Masuk (+)" }, { v: "out", label: "Keluar (−)" },
  { v: "sale", label: "Penjualan" }, { v: "return", label: "Retur" },
  { v: "transfer_in", label: "Transfer Masuk" }, { v: "transfer_out", label: "Transfer Keluar" },
  { v: "adjustment", label: "Penyesuaian/Opname" },
];

export function LogView({ rows, warehouses }: { rows: LogRow[]; warehouses: Opt[] }) {
  const [q, setQ] = useState("");
  const [wh, setWh] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = q.trim().toLowerCase();

  const list = useMemo(() => rows.filter((r) => {
    if (query && !(`${r.sku} ${r.product} ${r.warehouse} ${r.note}`.toLowerCase().includes(query))) return false;
    if (wh && r.warehouse !== wh) return false;
    if (from && r.date.slice(0, 10) < from) return false;
    if (to && r.date.slice(0, 10) > to) return false;
    if (type) {
      if (type === "in" && !(r.qty > 0)) return false;
      if (type === "out" && !(r.qty < 0)) return false;
      if (!["in", "out"].includes(type) && r.type !== type) return false;
    }
    return true;
  }), [rows, query, wh, type, from, to]);

  const totalIn = list.filter((r) => r.qty > 0).reduce((s, r) => s + r.qty, 0);
  const totalOut = list.filter((r) => r.qty < 0).reduce((s, r) => s + Math.abs(r.qty), 0);

  function download() {
    const head = ["Waktu", "SKU", "Produk", "Brand", "Gudang", "Status", "Jenis", "Qty", "COGM", "Keterangan"];
    const body = list.map((r) => [r.date, r.sku, r.product, r.brand, r.warehouse, r.status, typeLabel(r.type), r.qty, r.unitCost, (r.note || "").replace(/[\n,]/g, " ")]);
    const csv = "﻿" + [head, ...body].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "log-pergerakan-stok.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inventory</p>
          <h1 className="text-2xl font-extrabold">Log Pergerakan Stok</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Riwayat semua pergerakan barang jadi (masuk, keluar, transfer, penjualan, retur, penyesuaian) — ledger append-only.</p>
        </div>
        <Button variant="outline" size="sm" onClick={download} disabled={list.length === 0}><Download className="h-4 w-4" /> Download CSV</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari SKU / produk / gudang / keterangan…" className={inp + " pl-9"} />
        </div>
        <select value={wh} onChange={(e) => setWh(e.target.value)} className={sel}><option value="">Semua Gudang</option>{warehouses.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}</select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={sel}><option value="">Semua Jenis</option>{TYPE_OPTS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={sel} title="Dari tanggal" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={sel} title="Sampai tanggal" />
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-bold text-emerald-700">Masuk: +{totalIn}</span>
        <span className="rounded-lg bg-red-50 px-3 py-1.5 font-bold text-danger">Keluar: −{totalOut}</span>
        <span className="rounded-lg bg-muted px-3 py-1.5 font-semibold text-muted-foreground">{list.length} baris</span>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada pergerakan stok yang cocok.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">Waktu</th><th className="py-2.5 pr-3">SKU / Produk</th><th className="py-2.5 pr-3">Gudang</th>
                <th className="py-2.5 pr-3">Status</th><th className="py-2.5 pr-3">Jenis</th><th className="py-2.5 pr-3 text-right">Qty</th>
                <th className="py-2.5 pr-3 text-right">COGM</th><th className="py-2.5 pr-4">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-border/60 font-semibold hover:bg-muted/40">
                  <td className="py-2 pl-4 pr-3 text-xs font-medium text-muted-foreground tabular-nums">{r.date || "—"}</td>
                  <td className="py-2 pr-3"><span className="font-mono text-xs">{r.sku}</span><div className="text-xs font-medium text-muted-foreground">{r.product}</div></td>
                  <td className="py-2 pr-3 font-medium text-muted-foreground">{r.warehouse}</td>
                  <td className="py-2 pr-3">{r.status === "damaged" ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Damage</span> : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Good</span>}</td>
                  <td className="py-2 pr-3 text-xs font-semibold">{typeLabel(r.type)}</td>
                  <td className={cn("py-2 pr-3 text-right tabular-nums font-black inline-flex w-full items-center justify-end gap-1", r.qty < 0 ? "text-danger" : "text-emerald-700")}>
                    {r.qty < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}{r.qty > 0 ? `+${r.qty}` : r.qty}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{formatIDR(r.unitCost)}</td>
                  <td className="py-2 pr-4 text-xs text-muted-foreground">{r.note || (r.source ? r.source.replace(/_/g, " ") : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inp = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40";
const sel = "h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40";
