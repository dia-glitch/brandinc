"use client";

import { useState, useMemo } from "react";
import { Search, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/utils";

export type StockRow = {
  key: string; parentSku: string; sku: string; product: string; brand: string; brandId: string | null;
  warehouse: string; status: string; qtyIn: number; qtySold: number; qty: number; avg: number; value: number; retail: number;
};

export function StockTable({ rows, brands }: { rows: StockRow[]; brands: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const query = q.trim().toLowerCase();
  const list = useMemo(() => rows
    .filter((r) => !brandFilter || r.brandId === brandFilter)
    .filter((r) => !statusFilter || r.status === statusFilter)
    .filter((r) => !query || r.sku.toLowerCase().includes(query) || r.product.toLowerCase().includes(query) || r.warehouse.toLowerCase().includes(query)),
    [rows, brandFilter, statusFilter, query]);

  const good = list.filter((r) => r.status === "available");
  const damaged = list.filter((r) => r.status === "damaged");
  const retailGood = good.reduce((s, r) => s + r.qty * r.retail, 0);   // potensi nilai jual barang bagus
  const goodCogm = good.reduce((s, r) => s + r.value, 0);               // nilai stok Good @ COGM
  const damageWip = damaged.reduce((s, r) => s + r.value, 0);           // nilai damage @ WIP saja

  function downloadCsv() {
    const header = ["Parent SKU", "SKU", "Produk", "Brand", "Gudang", "Status", "Qty In", "Qty Sold", "SOH", "COGM", "Nilai COGM", "Nilai Retail"];
    const body = list.map((r) => [r.parentSku, r.sku, r.product, r.brand, r.warehouse, r.status === "damaged" ? "Damage" : "Good", r.qtyIn, r.qtySold, r.qty, r.avg, r.value, r.status === "available" ? r.qty * r.retail : 0]);
    const csv = [header, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventory-stok-lokasi.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari SKU / produk / gudang…"
            className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Brand</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Status</option>
          <option value="available">Good</option>
          <option value="damaged">Damage</option>
        </select>
        {(q || brandFilter || statusFilter) && <button onClick={() => { setQ(""); setBrandFilter(""); setStatusFilter(""); }} className="h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted">Reset</button>}
        <button onClick={downloadCsv} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted"><Download className="h-4 w-4" /> Download</button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nilai Retail (Good)</p>
          <p className="mt-1 text-xl font-black tabular-nums text-emerald-700">{formatIDR(retailGood)}</p>
          <p className="text-xs font-medium text-muted-foreground">potensi nilai jual stok bagus</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nilai COGM (Good)</p>
          <p className="mt-1 text-xl font-black tabular-nums">{formatIDR(goodCogm)}</p>
          <p className="text-xs font-medium text-muted-foreground">stok bagus @ COGM penuh</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nilai Damage</p>
          <p className="mt-1 text-xl font-black tabular-nums text-danger">{formatIDR(damageWip)}</p>
          <p className="text-xs font-medium text-muted-foreground">@ WIP saja (tanpa material)</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total Nilai Stok</p>
          <p className="mt-1 text-xl font-black tabular-nums">{formatIDR(goodCogm + damageWip)}</p>
          <p className="text-xs font-medium text-muted-foreground">Good (COGM) + Damage (WIP)</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada stok yang cocok.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[1300px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">Parent SKU</th>
                <th className="py-2.5 pr-3">SKU</th>
                <th className="py-2.5 pr-3">Produk</th>
                <th className="py-2.5 pr-3">Brand</th>
                <th className="py-2.5 pr-3">Gudang</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-3 text-right">Qty In</th>
                <th className="py-2.5 pr-3 text-right">Qty Sold</th>
                <th className="py-2.5 pr-3 text-right">SOH</th>
                <th className="py-2.5 pr-3 text-right">COGM</th>
                <th className="py-2.5 pr-3 text-right">Nilai COGM</th>
                <th className="py-2.5 pr-4 text-right">Nilai Retail</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.key} className="border-t border-border font-semibold hover:bg-muted/40">
                  <td className="py-2.5 pl-4 pr-3 font-mono text-xs text-muted-foreground">{r.parentSku}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.sku}</td>
                  <td className="py-2.5 pr-3">{r.product}</td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.brand}</td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.warehouse}</td>
                  <td className="py-2.5 pr-3">{r.status === "damaged" ? <Badge tone="danger">Damage</Badge> : <Badge tone="success">Good</Badge>}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-700">{r.qtyIn || "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-danger">{r.qtySold || "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-extrabold">{r.qty}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(r.avg)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(r.value)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-emerald-700">{r.status === "available" && r.retail > 0 ? formatIDR(r.qty * r.retail) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
