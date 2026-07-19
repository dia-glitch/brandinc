"use client";

import { useState, useMemo } from "react";
import { Search, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatIDR } from "@/lib/utils";

export type Opt = { id: string; name: string };
export type LedgerRow = {
  date: string | null; code: string; orderId: string; brand: string; brandId: string | null; channel: string; settlement: string;
  sku: string; product: string; size: string; qty: number; retail: number; price: number; discount: number; cogm: number; net: number; cogs: number; profit: number;
};

function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export function LedgerView({ rows, brands, channels }: { rows: LedgerRow[]; brands: Opt[]; channels: Opt[] }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [chanFilter, setChanFilter] = useState("");
  const [month, setMonth] = useState("");

  const query = q.trim().toLowerCase();
  const list = useMemo(() => rows
    .filter((r) => !brandFilter || r.brandId === brandFilter)
    .filter((r) => !chanFilter || r.channel === chanFilter)
    .filter((r) => !month || (r.date ?? "").startsWith(month))
    .filter((r) => !query || r.sku.toLowerCase().includes(query) || r.product.toLowerCase().includes(query) || r.code.toLowerCase().includes(query) || r.orderId.toLowerCase().includes(query)),
    [rows, brandFilter, chanFilter, month, query]);

  const tQty = list.reduce((s, r) => s + r.qty, 0);
  const tNet = list.reduce((s, r) => s + r.net, 0);
  const tCogs = list.reduce((s, r) => s + r.cogs, 0);
  const tProfit = list.reduce((s, r) => s + r.profit, 0);

  function download() {
    const head = ["Tanggal", "Kode SO", "No. Order", "Brand", "Channel", "Penyelesaian", "SKU", "Produk", "Size", "Qty", "Retail", "Harga Jual", "Diskon", "COGM", "Subtotal (Neto)", "COGS", "Laba Kotor"];
    const body = list.map((r) => [r.date ?? "", r.code, r.orderId, r.brand, r.channel, r.settlement === "marketplace" ? "Marketplace" : "AR/Konsinyasi", r.sku, r.product, r.size, r.qty, r.retail, r.price, r.discount, r.cogm, r.net, r.cogs, r.profit]);
    const csv = "﻿" + [head, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ledger-penjualan-sku${month ? "-" + month : ""}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sales</p>
          <h1 className="text-2xl font-extrabold">Ledger Penjualan (per SKU)</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Rincian tiap baris penjualan — untuk analisa &amp; ekspor.</p>
        </div>
        <button onClick={download} disabled={list.length === 0} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"><Download className="h-4 w-4" /> Download CSV</button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari SKU / produk / kode / no order…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40"><option value="">Semua Brand</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select value={chanFilter} onChange={(e) => setChanFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40"><option value="">Semua Channel</option>{channels.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary/40" />
        {(q || brandFilter || chanFilter || month) && <button onClick={() => { setQ(""); setBrandFilter(""); setChanFilter(""); setMonth(""); }} className="h-10 rounded-xl border border-border px-3 text-sm font-bold hover:bg-muted">Reset</button>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card px-4 py-2.5"><p className="text-xs font-bold uppercase text-muted-foreground">Total Qty</p><p className="text-lg font-black tabular-nums">{tQty}</p></div>
        <div className="card px-4 py-2.5"><p className="text-xs font-bold uppercase text-muted-foreground">Penjualan Neto</p><p className="text-lg font-black tabular-nums">{formatIDR(tNet)}</p></div>
        <div className="card px-4 py-2.5"><p className="text-xs font-bold uppercase text-muted-foreground">Total COGS</p><p className="text-lg font-black tabular-nums text-danger">{formatIDR(tCogs)}</p></div>
        <div className="card px-4 py-2.5"><p className="text-xs font-bold uppercase text-muted-foreground">Laba Kotor</p><p className="text-lg font-black tabular-nums text-emerald-700">{formatIDR(tProfit)}</p></div>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada baris penjualan pada filter ini.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[1200px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">Tgl</th><th className="py-2.5 pr-3">Kode</th><th className="py-2.5 pr-3">No. Order</th>
                <th className="py-2.5 pr-3">Brand</th><th className="py-2.5 pr-3">Channel</th><th className="py-2.5 pr-3">SKU</th><th className="py-2.5 pr-3">Produk</th>
                <th className="py-2.5 pr-3 text-right">Qty</th><th className="py-2.5 pr-3 text-right">Harga Jual</th><th className="py-2.5 pr-3 text-right">Diskon</th>
                <th className="py-2.5 pr-3 text-right">Neto</th><th className="py-2.5 pr-3 text-right">COGS</th><th className="py-2.5 pr-4 text-right">Laba Kotor</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={i} className="border-t border-border font-semibold hover:bg-muted/40">
                  <td className="py-2.5 pl-4 pr-3 font-medium text-muted-foreground">{r.date ?? "—"}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.code}{r.qty < 0 && <span className="ml-1.5 rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">Retur</span>}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{r.orderId || "—"}</td>
                  <td className="py-2.5 pr-3"><Badge tone="neutral">{r.brand}</Badge></td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.channel}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.sku}</td>
                  <td className="py-2.5 pr-3">{r.product}{r.size ? ` · ${r.size}` : ""}</td>
                  <td className={cn("py-2.5 pr-3 text-right tabular-nums", r.qty < 0 && "text-danger")}>{r.qty}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(r.price)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-amber-600">{r.discount > 0 ? formatIDR(r.discount) : "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(r.net)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{formatIDR(r.cogs)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-emerald-700">{formatIDR(r.profit)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/40 font-extrabold">
                <td className="py-2.5 pl-4 pr-3" colSpan={7}>Total ({list.length} baris)</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{tQty}</td>
                <td className="py-2.5 pr-3" colSpan={2}></td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(tNet)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-danger">{formatIDR(tCogs)}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-emerald-700">{formatIDR(tProfit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
